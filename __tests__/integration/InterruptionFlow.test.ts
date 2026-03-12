import { EventBus } from "@/lib/EventBus";

// Mock AudioContext (needed by AudioPlaybackService inside SessionManager)
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

// Import after mocks are set up
import { SessionManager } from "@/services/SessionManager";

describe("Interruption Flow Integration", () => {
  let eventBus: EventBus;
  let manager: SessionManager;

  beforeEach(() => {
    eventBus = new EventBus();
    manager = new SessionManager(eventBus);
  });

  afterEach(() => {
    manager.dispose();
  });

  it("should cancel in-progress response on speech_started during playback", () => {
    const expressionChanges: string[] = [];
    eventBus.on("avatar:set_expression", (p: unknown) => expressionChanges.push(p as string));

    // Simulate a response in progress
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });
    eventBus.emit("realtime:audio_started", {
      type: "output_audio_buffer.started",
      response_id: "resp_1",
    });

    // Student interrupts
    eventBus.emit("realtime:speech_started", {
      type: "input_audio_buffer.speech_started",
      audio_start_ms: 500,
    });

    // Avatar should have gone: talking → listening
    expect(expressionChanges).toContain("talking");
    expect(expressionChanges[expressionChanges.length - 1]).toBe("listening");
  });

  it("should discard partial transcript on response_cancelled", () => {
    // Start a response with transcript
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });
    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "I was saying—",
    });

    // Cancel
    eventBus.emit("realtime:response_cancelled", {
      type: "response.cancelled",
      response_id: "resp_1",
    });

    // Transcript should not contain the partial message
    expect(manager.getTranscript()).toHaveLength(0);
  });

  it("should reset avatar to listening on cancellation", () => {
    const handler = jest.fn();
    eventBus.on("avatar:set_expression", handler);

    eventBus.emit("realtime:response_cancelled", {
      type: "response.cancelled",
      response_id: "resp_1",
    });

    expect(handler).toHaveBeenCalledWith("listening");
  });

  it("should allow new response cycle after interruption", () => {
    // Complete interruption cycle
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });
    eventBus.emit("realtime:response_cancelled", {
      type: "response.cancelled",
      response_id: "resp_1",
    });

    // New response cycle should work
    eventBus.emit("realtime:speech_stopped", {
      type: "input_audio_buffer.speech_stopped",
      audio_end_ms: 600,
    });
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_2" },
    });
    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_2",
      delta: "New response",
    });
    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_2", status: "completed" },
    });

    const messages = manager.getTranscript();
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("New response");
  });
});
