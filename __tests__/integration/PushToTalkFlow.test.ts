import { SessionManager } from "@/services/SessionManager";
import { RealtimeService } from "@/services/RealtimeService";
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
  constructor(label: string) { this.label = label; }
  send = jest.fn();
  close = jest.fn();
}

class MockRTCPeerConnection {
  ontrack: ((ev: RTCTrackEvent) => void) | null = null;
  addTrack = jest.fn();
  createDataChannel(label: string): MockDataChannel { return new MockDataChannel(label); }
  async createOffer(): Promise<RTCSessionDescriptionInit> { return { type: "offer", sdp: "mock" }; }
  async setLocalDescription(): Promise<void> { /* no-op */ }
  async setRemoteDescription(): Promise<void> { /* no-op */ }
  close(): void { /* no-op */ }
}

(global as Record<string, unknown>).RTCPeerConnection = MockRTCPeerConnection;

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

class MockAudioContext {
  sampleRate = 24000;
  currentTime = 0;
  state = "running";
  createAnalyser(): MockAnalyserNode { return new MockAnalyserNode(); }
  createGain(): MockGainNode { return new MockGainNode(); }
  createMediaStreamSource(): { connect: jest.Mock } { return { connect: jest.fn() }; }
  get destination(): unknown { return {}; }
  resume = jest.fn().mockResolvedValue(undefined);
  close = jest.fn();
}

(global as Record<string, unknown>).AudioContext = MockAudioContext;

describe("PushToTalkFlow", () => {
  let manager: SessionManager;
  let eventBus: EventBus;
  let sendEventSpy: jest.SpyInstance;

  function forceState(mgr: SessionManager, state: string): void {
    (mgr as unknown as Record<string, unknown>)["state"] = state;
  }

  function attachMockMicStream(mgr: SessionManager): { track: MediaStreamTrack } {
    const mockTrack = { enabled: true, stop: jest.fn() } as unknown as MediaStreamTrack;
    const mockStream = { getAudioTracks: () => [mockTrack], getTracks: () => [mockTrack] } as unknown as MediaStream;
    (mgr as unknown as Record<string, unknown>)["micStream"] = mockStream;
    return { track: mockTrack };
  }

  beforeEach(() => {
    jest.useFakeTimers();
    eventBus = new EventBus();
    manager = new SessionManager(eventBus);
    sendEventSpy = jest.spyOn(RealtimeService.prototype, "sendEvent");
  });

  afterEach(() => {
    jest.useRealTimers();
    sendEventSpy.mockRestore();
    manager.dispose();
  });

  it("should simulate full PTT cycle: unmute -> speak -> mute -> immediate response", () => {
    forceState(manager, "listening");
    const { track } = attachMockMicStream(manager);

    // User presses Space — unmute
    manager.setMuted(false);
    expect(manager.isMuted()).toBe(false);
    expect(track.enabled).toBe(true);

    // User releases Space — mute and trigger response
    manager.setMuted(true);
    expect(manager.isMuted()).toBe(true);
    expect(track.enabled).toBe(false);

    manager.triggerResponse();
    expect(sendEventSpy).toHaveBeenCalledWith({ type: "response.create" });
  });

  it("should cancel pending VAD response when PTT triggers immediate response", () => {
    forceState(manager, "listening");
    attachMockMicStream(manager);

    // VAD detects speech stopped — schedules response.create after grace period
    eventBus.emit("realtime:speech_stopped", {
      type: "input_audio_buffer.speech_stopped",
      audio_end_ms: 200,
    });

    sendEventSpy.mockClear();

    // PTT release triggers immediate response, cancelling the pending one
    manager.triggerResponse();
    expect(sendEventSpy).toHaveBeenCalledWith({ type: "response.create" });
    expect(sendEventSpy).toHaveBeenCalledTimes(1);

    sendEventSpy.mockClear();

    // Grace period expires — should NOT send duplicate response.create
    jest.runAllTimers();
    expect(sendEventSpy).not.toHaveBeenCalledWith({ type: "response.create" });
  });

  it("should not trigger response when model is already speaking", () => {
    forceState(manager, "listening");
    attachMockMicStream(manager);

    // Model starts speaking
    eventBus.emit("realtime:audio_started", {
      type: "output_audio_buffer.started",
      response_id: "resp_1",
    });

    sendEventSpy.mockClear();

    // PTT release while model is speaking — should be suppressed
    manager.setMuted(true);
    manager.triggerResponse();

    expect(sendEventSpy).not.toHaveBeenCalledWith({ type: "response.create" });
  });

  it("should start muted after session connects", async () => {
    // Mock getUserMedia on the jsdom navigator
    const mockTrack = { enabled: true, stop: jest.fn() } as unknown as MediaStreamTrack;
    const mockStream = { getAudioTracks: () => [mockTrack], getTracks: () => [mockTrack] } as unknown as MediaStream;
    const getUserMediaMock = jest.fn().mockResolvedValue(mockStream);
    Object.defineProperty(navigator, "mediaDevices", {
      value: { getUserMedia: getUserMediaMock },
      writable: true,
      configurable: true,
    });

    await manager.startSession();

    // After connect, mic should be muted for PTT
    expect(manager.isMuted()).toBe(true);
    expect(mockTrack.enabled).toBe(false);

    manager.endSession();
  });
});
