import { RealtimeService } from "@/services/RealtimeService";
import { EventBus } from "@/lib/EventBus";

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
  }

  send(data: string): void {
    this.sentMessages.push(data);
  }

  close(): void {
    this.readyState = MockWebSocket.CLOSED;
  }

  // Test helpers
  simulateOpen(): void {
    this.readyState = MockWebSocket.OPEN;
    this.onopen?.({} as Event);
  }

  simulateMessage(data: object): void {
    this.onmessage?.({ data: JSON.stringify(data) } as MessageEvent);
  }

  simulateClose(): void {
    this.readyState = MockWebSocket.CLOSED;
    this.onclose?.({ code: 1000, reason: "normal" } as CloseEvent);
  }

  simulateError(): void {
    this.onerror?.({} as Event);
  }
}

// Inject mock WebSocket globally
(global as Record<string, unknown>).WebSocket = MockWebSocket;

describe("RealtimeService", () => {
  let service: RealtimeService;
  let eventBus: EventBus;
  let mockWs: MockWebSocket;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new RealtimeService(eventBus);
  });

  function connectAndCaptureMockWs(): MockWebSocket {
    service.connect("test-ephemeral-key");
    // The constructor creates a WebSocket — grab it via the URL
    mockWs = (service as unknown as { ws: MockWebSocket }).ws;
    return mockWs;
  }

  it("should connect to the Realtime API with ephemeral key", () => {
    const ws = connectAndCaptureMockWs();
    expect(ws.url).toContain("wss://api.openai.com/v1/realtime");
    expect(ws.url).toContain("model=");
  });

  it("should send session.update with Socratic prompt on open", () => {
    const ws = connectAndCaptureMockWs();
    ws.simulateOpen();

    expect(ws.sentMessages).toHaveLength(1);
    const msg = JSON.parse(ws.sentMessages[0]);
    expect(msg.type).toBe("session.update");
    expect(msg.session.instructions).toBeDefined();
    expect(msg.session.voice).toBeDefined();
    expect(msg.session.turn_detection).toBeDefined();
  });

  it("should emit server events via EventBus", () => {
    const ws = connectAndCaptureMockWs();
    ws.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:speech_started", handler);

    ws.simulateMessage({
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

  it("should emit audio delta events for playback", () => {
    const ws = connectAndCaptureMockWs();
    ws.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:audio_delta", handler);

    ws.simulateMessage({
      type: "response.audio.delta",
      response_id: "resp_1",
      delta: "base64audiodata",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response.audio.delta",
        delta: "base64audiodata",
      }),
    );
  });

  it("should emit transcript delta events", () => {
    const ws = connectAndCaptureMockWs();
    ws.simulateOpen();

    const handler = jest.fn();
    eventBus.on("realtime:transcript_delta", handler);

    ws.simulateMessage({
      type: "response.audio_transcript.delta",
      response_id: "resp_1",
      delta: "Hello ",
    });

    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "response.audio_transcript.delta",
        delta: "Hello ",
      }),
    );
  });

  it("should send audio buffer append events", () => {
    const ws = connectAndCaptureMockWs();
    ws.simulateOpen();

    // Clear the session.update message
    ws.sentMessages = [];

    service.sendAudio("base64pcmdata");

    expect(ws.sentMessages).toHaveLength(1);
    const msg = JSON.parse(ws.sentMessages[0]);
    expect(msg.type).toBe("input_audio_buffer.append");
    expect(msg.audio).toBe("base64pcmdata");
  });

  it("should not send audio when disconnected", () => {
    // Not connected yet
    service.sendAudio("data");
    // Should not throw, just silently ignore
  });

  it("should emit connection state events", () => {
    const ws = connectAndCaptureMockWs();

    const connectedHandler = jest.fn();
    const disconnectedHandler = jest.fn();
    eventBus.on("realtime:connected", connectedHandler);
    eventBus.on("realtime:disconnected", disconnectedHandler);

    ws.simulateOpen();
    expect(connectedHandler).toHaveBeenCalled();

    ws.simulateClose();
    expect(disconnectedHandler).toHaveBeenCalled();
  });

  it("should disconnect and clean up", () => {
    const ws = connectAndCaptureMockWs();
    ws.simulateOpen();

    service.disconnect();
    expect(ws.readyState).toBe(MockWebSocket.CLOSED);
  });

  it("should report connection state via isConnected()", () => {
    expect(service.isConnected()).toBe(false);

    const ws = connectAndCaptureMockWs();
    expect(service.isConnected()).toBe(false);

    ws.simulateOpen();
    expect(service.isConnected()).toBe(true);

    ws.simulateClose();
    expect(service.isConnected()).toBe(false);
  });
});
