import { SessionManager } from "@/services/SessionManager";
import { EventBus } from "@/lib/EventBus";

// Mock fetch for ephemeral key
(global as Record<string, unknown>).fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () =>
    Promise.resolve({
      client_secret: { value: "test-key", expires_at: Date.now() + 60000 },
    }),
});

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = MockWebSocket.CONNECTING;
  url: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  sentMessages: string[] = [];

  constructor(url: string) {
    this.url = url;
    // Auto-open after a tick to simulate connection
    setTimeout(() => this.simulateOpen(), 0);
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: "normal" } as CloseEvent);
  }

  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: object): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }
}

(global as Record<string, unknown>).WebSocket = MockWebSocket;

// Mock AudioContext for AudioPlaybackService
class MockAnalyserNode {
  fftSize = 256;
  smoothingTimeConstant = 0.8;
  frequencyBinCount = 128;
  connect = jest.fn();
  disconnect = jest.fn();
  getByteTimeDomainData = jest.fn();
}

class MockGainNode {
  gain = { value: 1 };
  connect = jest.fn();
  disconnect = jest.fn();
}

class MockAudioBuffer {
  readonly numberOfChannels = 1;
  readonly length: number;
  readonly sampleRate: number;
  readonly duration: number;
  private channelData: Float32Array;

  constructor(options: { length: number; sampleRate: number; numberOfChannels: number }) {
    this.length = options.length;
    this.sampleRate = options.sampleRate;
    this.duration = this.length / this.sampleRate;
    this.channelData = new Float32Array(this.length);
  }

  getChannelData(): Float32Array {
    return this.channelData;
  }

  copyToChannel(source: Float32Array): void {
    this.channelData.set(source);
  }
}

class MockAudioBufferSourceNode {
  buffer: MockAudioBuffer | null = null;
  onended: (() => void) | null = null;
  connect = jest.fn();
  start = jest.fn();
  stop = jest.fn();
  disconnect = jest.fn();
}

class MockAudioContext {
  sampleRate = 24000;
  currentTime = 0;
  state = "running";

  createBuffer(channels: number, length: number, sampleRate: number): MockAudioBuffer {
    return new MockAudioBuffer({ length, sampleRate, numberOfChannels: channels });
  }

  createBufferSource(): MockAudioBufferSourceNode {
    return new MockAudioBufferSourceNode();
  }

  createAnalyser(): MockAnalyserNode {
    return new MockAnalyserNode();
  }

  createGain(): MockGainNode {
    return new MockGainNode();
  }

  get destination(): unknown {
    return {};
  }

  close = jest.fn();
}

(global as Record<string, unknown>).AudioContext = MockAudioContext;

describe("SessionManager", () => {
  let manager: SessionManager;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    manager = new SessionManager(eventBus);
  });

  afterEach(() => {
    manager.dispose();
  });

  it("should start in idle state", () => {
    expect(manager.getState()).toBe("idle");
  });

  it("should transition to connecting when startSession is called", async () => {
    const statePromise = new Promise<string>((resolve) => {
      eventBus.on("session:state_changed", (payload: unknown) => {
        if (payload === "connecting") resolve(payload);
      });
    });

    manager.startSession();
    const state = await statePromise;
    expect(state).toBe("connecting");
  });

  it("should set avatar to listening on speech_started", () => {
    const handler = jest.fn();
    eventBus.on("avatar:set_expression", handler);

    eventBus.emit("realtime:speech_started", {
      type: "input_audio_buffer.speech_started",
      audio_start_ms: 100,
    });

    expect(handler).toHaveBeenCalledWith("listening");
  });

  it("should set avatar to thinking on speech_stopped", () => {
    const handler = jest.fn();
    eventBus.on("avatar:set_expression", handler);

    eventBus.emit("realtime:speech_stopped", {
      type: "input_audio_buffer.speech_stopped",
      audio_end_ms: 200,
    });

    expect(handler).toHaveBeenCalledWith("thinking");
  });

  it("should set avatar to talking on first audio delta", () => {
    const handler = jest.fn();
    eventBus.on("avatar:set_expression", handler);

    // Simulate speech stopped first to start a response cycle
    eventBus.emit("realtime:speech_stopped", {
      type: "input_audio_buffer.speech_stopped",
      audio_end_ms: 200,
    });

    // First audio delta
    eventBus.emit("realtime:audio_delta", {
      type: "response.audio.delta",
      response_id: "resp_1",
      delta: "base64audio",
    });

    expect(handler).toHaveBeenCalledWith("talking");
  });

  it("should set avatar to idle on response done", () => {
    const handler = jest.fn();
    eventBus.on("avatar:set_expression", handler);

    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_1", status: "completed" },
    });

    expect(handler).toHaveBeenCalledWith("idle");
  });

  it("should track latency from speech_stopped through audio delta", () => {
    // Emit speech_stopped to start latency tracking
    eventBus.emit("realtime:speech_stopped", {
      type: "input_audio_buffer.speech_stopped",
      audio_end_ms: 200,
    });

    // Emit response created
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });

    // Emit first audio delta
    eventBus.emit("realtime:audio_delta", {
      type: "response.audio.delta",
      response_id: "resp_1",
      delta: "base64audio",
    });

    const metrics = manager.getCurrentMetrics();
    // Input processing should be measured (speech_stopped → response_created)
    expect(metrics.inputProcessingMs).toBeGreaterThanOrEqual(0);
  });

  it("should handle interruption by stopping playback and resetting avatar", () => {
    const expressionHandler = jest.fn();
    eventBus.on("avatar:set_expression", expressionHandler);

    // Simulate response in progress
    eventBus.emit("realtime:audio_delta", {
      type: "response.audio.delta",
      response_id: "resp_1",
      delta: "base64audio",
    });

    // Simulate interruption via speech_started during response
    eventBus.emit("realtime:speech_started", {
      type: "input_audio_buffer.speech_started",
      audio_start_ms: 500,
    });

    // Avatar should switch to listening
    expect(expressionHandler).toHaveBeenCalledWith("listening");
  });

  it("should forward transcript deltas to ConversationStore", () => {
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.audio_transcript.delta",
      response_id: "resp_1",
      delta: "Hello ",
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.audio_transcript.delta",
      response_id: "resp_1",
      delta: "there!",
    });

    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_1", status: "completed" },
    });

    const messages = manager.getTranscript();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("Hello there!");
  });

  it("should dispose all services cleanly", () => {
    expect(() => manager.dispose()).not.toThrow();
    expect(manager.getState()).toBe("idle");
  });
});
