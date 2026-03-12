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

// Mock RTCPeerConnection (needed by RealtimeService)
class MockDataChannel {
  readyState = "open";
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

import { SessionManager } from "@/services/SessionManager";

describe("Text Input Flow Integration", () => {
  let eventBus: EventBus;
  let manager: SessionManager;

  beforeEach(() => {
    eventBus = new EventBus();
    manager = new SessionManager(eventBus);
  });

  afterEach(() => {
    manager.dispose();
  });

  it("should show text message in transcript alongside assistant response", () => {
    // Simulate an active session by forcing state via event
    (manager as unknown as Record<string, unknown>)["state"] = "listening";

    // Send a text message
    manager.sendTextMessage("What is photosynthesis?");

    // Simulate assistant response
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });

    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "Photosynthesis is the process by which plants convert light to energy.",
    });

    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_1", status: "completed" },
    });

    const messages = manager.getTranscript();
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe("user");
    expect(messages[0].content).toBe("What is photosynthesis?");
    expect(messages[1].role).toBe("assistant");
    expect(messages[1].content).toBe(
      "Photosynthesis is the process by which plants convert light to energy."
    );
  });

  it("should maintain chronological order across multiple text messages", () => {
    (manager as unknown as Record<string, unknown>)["state"] = "listening";

    // First text message
    manager.sendTextMessage("First question");

    // First assistant response
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_1" },
    });
    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "First answer",
    });
    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_1", status: "completed" },
    });

    // Second text message
    manager.sendTextMessage("Second question");

    // Second assistant response
    eventBus.emit("realtime:response_created", {
      type: "response.created",
      response: { id: "resp_2" },
    });
    eventBus.emit("realtime:transcript_delta", {
      type: "response.output_text.delta",
      response_id: "resp_2",
      delta: "Second answer",
    });
    eventBus.emit("realtime:response_done", {
      type: "response.done",
      response: { id: "resp_2", status: "completed" },
    });

    const messages = manager.getTranscript();
    expect(messages).toHaveLength(4);
    expect(messages[0]).toMatchObject({ role: "user", content: "First question" });
    expect(messages[1]).toMatchObject({ role: "assistant", content: "First answer" });
    expect(messages[2]).toMatchObject({ role: "user", content: "Second question" });
    expect(messages[3]).toMatchObject({ role: "assistant", content: "Second answer" });
  });
});
