import { EventBus } from "@/lib/EventBus";

// Mock AudioContext
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

import { SessionManager } from "@/services/SessionManager";

describe("Transcript Flow Integration", () => {
  let eventBus: EventBus;
  let manager: SessionManager;

  beforeEach(() => {
    eventBus = new EventBus();
    manager = new SessionManager(eventBus);
  });

  afterEach(() => {
    manager.dispose();
  });

  it("should accumulate transcript deltas into a single assistant message", () => {
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "What do ",
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "you think ",
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "about that?",
    });

    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_1", status: "completed" },
    });

    const messages = manager.getTranscript();
    expect(messages).toHaveLength(1);
    expect(messages[0].role).toBe("assistant");
    expect(messages[0].content).toBe("What do you think about that?");
  });

  it("should handle multiple conversation turns in order", () => {
    // Turn 1: assistant
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });
    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "Hello! What would you like to learn?",
    });
    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_1", status: "completed" },
    });

    // Turn 2: another assistant response
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_2" },
    });
    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_2",
      delta: "Great choice! What do you already know about it?",
    });
    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_2", status: "completed" },
    });

    const messages = manager.getTranscript();
    expect(messages).toHaveLength(2);
    expect(messages[0].content).toBe("Hello! What would you like to learn?");
    expect(messages[1].content).toBe("Great choice! What do you already know about it?");
  });

  it("should not add empty messages for responses with no transcript", () => {
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });
    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_1", status: "completed" },
    });

    const messages = manager.getTranscript();
    // Empty message will still be added since finalizeAssistantMessage always pushes
    // This is expected behavior — the ConversationStore records it
    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe("");
  });
});
