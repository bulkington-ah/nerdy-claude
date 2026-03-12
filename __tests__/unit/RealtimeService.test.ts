import { RealtimeService } from "@/services/RealtimeService";
import { EventBus } from "@/lib/EventBus";
import { VAD_CONFIG } from "@/config/constants";

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
    const dataChannel = new MockDataChannel(label);
    mockDataChannel = dataChannel;
    return dataChannel;
  }

  async createOffer(): Promise<RTCSessionDescriptionInit> {
    return { type: "offer", sdp: "mock-sdp-offer" };
  }

  async setLocalDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    this.localDescription = desc;
  }

  async setRemoteDescription(desc: RTCSessionDescriptionInit): Promise<void> {
    void desc;
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

    expect(dc.sentMessages).toHaveLength(2);
    const sessionUpdate = JSON.parse(dc.sentMessages[0]);
    expect(sessionUpdate.type).toBe("session.update");
    expect(sessionUpdate.session.instructions).toBeDefined();
    expect(sessionUpdate.session.voice).toBeDefined();
    expect(sessionUpdate.session.audio.input.turn_detection).toBeDefined();

    // Should cancel any auto-generated greeting
    const cancelMsg = JSON.parse(dc.sentMessages[1]);
    expect(cancelMsg.type).toBe("response.cancel");
  });

  it("should use VAD_CONFIG from constants in session config", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const msg = JSON.parse(dc.sentMessages[0]);
    const td = msg.session.audio.input.turn_detection;
    expect(td.threshold).toBe(VAD_CONFIG.threshold);
    expect(td.silence_duration_ms).toBe(VAD_CONFIG.silence_duration_ms);
    expect(td.prefix_padding_ms).toBe(VAD_CONFIG.prefix_padding_ms);
    expect(td.create_response).toBe(false);
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

  it("should emit transcript delta events from output text", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:transcript_delta", handler);

    dc.simulateMessage({
      type: "response.output_text.delta",
      response_id: "resp_1",
      delta: "Hello ",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response.output_text.delta",
        delta: "Hello ",
      }),
    );
  });

  it("should emit transcript done events from output text", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:transcript_done", handler);

    dc.simulateMessage({
      type: "response.output_text.done",
      response_id: "resp_1",
      text: "Hello world",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response.output_text.done",
        text: "Hello world",
      }),
    );
  });

  it("should emit audio transcript delta events separately", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:audio_transcript_delta", handler);

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

  it("should include audio input transcription in session config", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const msg = JSON.parse(dc.sentMessages[0]);
    expect(msg.session.audio.input.turn_detection).toBeDefined();
    expect(msg.session.audio.input.transcription).toBeDefined();
    expect(msg.session.audio.input.transcription.model).toBe("whisper-1");
  });

  it("should emit user_transcript for input_audio_transcription.completed", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:user_transcript", handler);

    dc.simulateMessage({
      type: "conversation.item.input_audio_transcription.completed",
      transcript: "Hello world",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "conversation.item.input_audio_transcription.completed",
        transcript: "Hello world",
      }),
    );
  });

  it("should emit user_transcript_delta for input_audio_transcription.delta", async () => {
    const dc = await connectAndGetDataChannel();
    dc.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:user_transcript_delta", handler);

    dc.simulateMessage({
      type: "conversation.item.input_audio_transcription.delta",
      item_id: "item_1",
      delta: "Hello",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "conversation.item.input_audio_transcription.delta",
        item_id: "item_1",
        delta: "Hello",
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
