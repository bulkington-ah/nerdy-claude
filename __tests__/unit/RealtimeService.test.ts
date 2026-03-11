import { RealtimeService } from "@/services/RealtimeService";
import { EventBus } from "@/lib/EventBus";

// Mock RTCPeerConnection and data channel
let mockDataChannel: MockDataChannel;

class MockDataChannel {
  readyState = "connecting";
  label: string;
  onopen: ((ev: Event) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;
  onclose: ((ev: Event) => void) | null = null;
  sentMessages: string[] = [];

  constructor(label: string) {
    this.label = label;
    mockDataChannel = this;
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = "closed";
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = "open";
    this.onopen?.({} as Event);
  }

  simulateMessage(data: object): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(): void {
    this.readyState = "closed";
    this.onclose?.({} as Event);
  }
}

class MockRTCPeerConnection {
  ontrack: ((ev: RTCTrackEvent) => void) | null = null;
  localDescription: RTCSessionDescriptionInit | null = null;

  addTrack = jest.fn();

  createDataChannel(label: string): MockDataChannel {
    return new MockDataChannel(label);
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "mock-sdp-offer" };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
  }

  async setRemoteDescription(_desc: RTCSessionDescriptionInit): Promise<void> {
    // no-op
  }

  close(): void {
    // no-op
  }
}

(global as Record<string, unknown>).RTCPeerConnection = MockRTCPeerConnection;

// Mock fetch for SDP exchange
(global as Record<string, unknown>).fetch = jest.fn().mockResolvedValue({
  ok: true,
  text: () => Promise.resolve("mock-sdp-answer"),
});

// Mock MediaStream
class MockMediaStream {
  getAudioTracks(): { kind: string }[] {
    return [{ kind: "audio" }];
  }
}

describe("RealtimeService", () => {
  let service: RealtimeService;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new RealtimeService(eventBus);
  });

  async function connectAndGetDataChannel(): Promise<MockDataChannel> {
    const stream = new MockMediaStream() as unknown as MediaStream;
    await service.connect("test-ephemeral-key", stream);
    return mockDataChannel;
  }

  it("should create a data channel named oai-events", async () => {
    const dc = await connectAndGetDataChannel();
    expect(dc.label).toBe("oai-events");
  });

  it("should send session.update with Socratic prompt on data channel open", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    expect(dc.sentMessages).toHaveLength(1);
    const msg = JSON.parse(dc.sentMessages[0]);
    expect(msg.type).toBe("session.update");
    expect(msg.session.instructions).toBeDefined();
    expect(msg.session.voice).toBeDefined();
    expect(msg.session.turn_detection).toBeDefined();
  });

  it("should emit server events via EventBus", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:speech_started", handler);

    dc.simulateMessage({
      type: "input_audio_buffer.speech_started",
      audio_start_ms: 1000,
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "input_audio_buffer.speech_started",
        audio_start_ms: 1000,
      }),
    );
  });

  it("should emit audio_started event for output_audio_buffer.started", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:audio_started", handler);

    dc.simulateMessage({
      type: "output_audio_buffer.started",
      response_id: "resp_1",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "output_audio_buffer.started",
      }),
    );
  });

  it("should emit transcript delta events (GA format)", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:transcript_delta", handler);

    dc.simulateMessage({
      type: "response.output_audio_transcript.delta",
      response_id: "resp_1",
      delta: "Hello ",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response.output_audio_transcript.delta",
        delta: "Hello ",
      }),
    );
  });

  it("should send SDP offer to OpenAI with ephemeral key", async () => {
    const stream = new MockMediaStream() as unknown as MediaStream;
    await service.connect("test-ephemeral-key", stream);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("api.openai.com/v1/realtime"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer test-ephemeral-key",
          "Content-Type": "application/sdp",
        }),
      }),
    );
  });

  it("should not throw when sendAudio is called (no-op with WebRTC)", () => {
    service.sendAudio("data");
    // Should not throw — sendAudio is a no-op with WebRTC
  });

  it("should emit connection state events", async () => {
    const dc = await connectAndGetDataChannel();

    const connectedHandler = jest.fn();
    const disconnectedHandler = jest.fn();
    eventBus.on("realtime:connected", connectedHandler);
    eventBus.on("realtime:disconnected", disconnectedHandler);

    dc.simulateOpen();
    expect(connectedHandler).toHaveBeenCalled();

    dc.simulateClose();
    expect(disconnectedHandler).toHaveBeenCalled();
  });

  it("should disconnect and clean up", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    service.disconnect();
    expect(dc.readyState).toBe("closed");
  });

  it("should report connection state via isConnected()", async () => {
    expect(service.isConnected()).toBe(false);

    const dc = await connectAndGetDataChannel();
    expect(service.isConnected()).toBe(false);

    dc.simulateOpen();
    expect(service.isConnected()).toBe(true);

    dc.simulateClose();
    expect(service.isConnected()).toBe(false);
  });
});
