import { SessionManager } from "@/services/SessionManager";
import { EventBus } from "@/lib/EventBus";

// Mock fetch for ephemeral key
(global as Record<string, unknown>).fetch = jest.fn().mockResolvedValue({
  ok: true,
  json: () =>
    Promise.resolve({
      clientSecret: "test-key",
      expiresAt: Date.now() + 60000,
    }),
  text: () => Promise.resolve("mock-sdp-answer"),
});

// Mock RTCPeerConnection
class MockDataChannel {
  readyState = "connecting";
  label: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: Event) => void) | null = null;

  constructor(label: string) {
    this.label = label;
  }

  send = jest.fn();
  close = jest.fn();
}

class MockRTCPeerConnection {
  ontrack: ((ev: RTCTrackEvent) => void) | null = null;
  addTrack = jest.fn();
  createDataChannel(label: string): MockDataChannel {
    return new MockDataChannel(label);
  }
  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "mock" };
  }
  async setLocalDescription(): Promise<void> { /* no-op */ }
  async setRemoteDescription(): Promise<void> { /* no-op */ }
  close(): void { /* no-op */ }
}

(global as Record<string, unknown>).RTCPeerConnection = MockRTCPeerConnection;

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

  createMediaStreamSource(): { connect: jest.Mock } {
    return { connect: jest.fn() };
  }

  get destination(): unknown {
    return {};
  }

  resume = jest.fn().mockResolvedValue(undefined);
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

  it("should set avatar to talking on audio_started", () => {
    const handler = jest.fn();
    eventBus.on("avatar:set_expression", handler);

    eventBus.emit("realtime:speech_stopped", {
      type: "input_audio_buffer.speech_stopped",
      audio_end_ms: 200,
    });

    eventBus.emit("realtime:audio_started", {
      type: "output_audio_buffer.started",
      response_id: "resp_1",
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
    eventBus.emit("realtime:speech_stopped", {
      type: "input_audio_buffer.speech_stopped",
      audio_end_ms: 200,
    });

    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });

    eventBus.emit("realtime:audio_started", {
      type: "output_audio_buffer.started",
      response_id: "resp_1",
    });

    const metrics = manager.getCurrentMetrics();
    expect(metrics.inputProcessingMs).toBeGreaterThanOrEqual(0);
  });

  it("should handle interruption by resetting avatar to listening", () => {
    const expressionHandler = jest.fn();
    eventBus.on("avatar:set_expression", expressionHandler);

    eventBus.emit("realtime:audio_started", {
      type: "output_audio_buffer.started",
      response_id: "resp_1",
    });

    eventBus.emit("realtime:speech_started", {
      type: "input_audio_buffer.speech_started",
      audio_start_ms: 500,
    });

    expect(expressionHandler).toHaveBeenCalledWith("listening");
  });

  it("should forward transcript deltas to ConversationStore", () => {
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_audio_transcript.delta",
      response_id: "resp_1",
      delta: "Hello ",
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_audio_transcript.delta",
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

  describe("sendTextMessage", () => {
    // Helper to set internal state for testing (private field)
    function forceState(mgr: SessionManager, state: string): void {
      (mgr as unknown as Record<string, unknown>)["state"] = state;
    }

    it("should add user message to transcript", () => {
      forceState(manager, "listening");

      manager.sendTextMessage("What is gravity?");

      const messages = manager.getTranscript();
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe("user");
      expect(messages[0].content).toBe("What is gravity?");
    });

    it("should emit session:user_message event", () => {
      forceState(manager, "listening");

      const handler = jest.fn();
      eventBus.on("session:user_message", handler);

      manager.sendTextMessage("Hello tutor");

      expect(handler).toHaveBeenCalledWith("Hello tutor");
    });

    it("should be no-op when idle", () => {
      // Manager starts idle, no need to change state
      const handler = jest.fn();
      eventBus.on("session:user_message", handler);

      manager.sendTextMessage("Should be ignored");

      expect(handler).not.toHaveBeenCalled();
      expect(manager.getTranscript()).toHaveLength(0);
    });

    it("should be no-op when connecting", () => {
      forceState(manager, "connecting");

      const handler = jest.fn();
      eventBus.on("session:user_message", handler);

      manager.sendTextMessage("Should be ignored");

      expect(handler).not.toHaveBeenCalled();
      expect(manager.getTranscript()).toHaveLength(0);
    });
  });
});
