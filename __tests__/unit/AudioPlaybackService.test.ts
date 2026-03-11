import { AudioPlaybackService } from "@/services/AudioPlaybackService";
import { EventBus } from "@/lib/EventBus";

// Mock Web Audio API
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

  getChannelData(_channel: number): Float32Array {
    return this.channelData;
  }

  copyToChannel(source: Float32Array, _channel: number): void {
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

class MockAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
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

// Helper: create a valid base64 PCM16 chunk (4 samples = 8 bytes)
function createBase64Pcm16(samples: number[]): string {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  samples.forEach((s, i) => view.setInt16(i * 2, s, true));
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

describe("AudioPlaybackService", () => {
  let service: AudioPlaybackService;
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
    service = new AudioPlaybackService(eventBus);
  });

  afterEach(() => {
    service.dispose();
  });

  it("should initialize with an AnalyserNode accessible via getter", () => {
    const analyser = service.getAnalyserNode();
    expect(analyser).toBeDefined();
  });

  it("should decode base64 PCM16 to Float32Array correctly", () => {
    // Encode a known sample: [0, 16384, -16384, 32767]
    const base64 = createBase64Pcm16([0, 16384, -16384, 32767]);
    const floats = service.decodeBase64Pcm16(base64);

    expect(floats.length).toBe(4);
    expect(floats[0]).toBeCloseTo(0, 4);
    expect(floats[1]).toBeCloseTo(16384 / 32768, 4);
    expect(floats[2]).toBeCloseTo(-16384 / 32768, 4);
    expect(floats[3]).toBeCloseTo(32767 / 32768, 4);
  });

  it("should enqueue audio chunks and schedule playback", () => {
    const base64 = createBase64Pcm16([1000, 2000, 3000, 4000]);
    service.enqueue(base64);

    // After enqueuing, a source node should have been created and started
    expect(service.getQueueLength()).toBe(0); // Playing, not queued
  });

  it("should handle multiple enqueued chunks for gapless playback", () => {
    const chunk1 = createBase64Pcm16([1000, 2000]);
    const chunk2 = createBase64Pcm16([3000, 4000]);

    service.enqueue(chunk1);
    service.enqueue(chunk2);

    // Both should be scheduled (one playing, one queued or both scheduled)
    expect(service.getTotalScheduled()).toBeGreaterThanOrEqual(1);
  });

  it("should clear all queued audio on stop", () => {
    const chunk1 = createBase64Pcm16([1000, 2000]);
    const chunk2 = createBase64Pcm16([3000, 4000]);

    service.enqueue(chunk1);
    service.enqueue(chunk2);
    service.stop();

    expect(service.getQueueLength()).toBe(0);
    expect(service.getTotalScheduled()).toBe(0);
  });

  it("should emit playback:started event when first chunk is enqueued", () => {
    const handler = jest.fn();
    eventBus.on("playback:started", handler);

    const base64 = createBase64Pcm16([1000, 2000]);
    service.enqueue(base64);

    expect(handler).toHaveBeenCalled();
  });

  it("should emit playback:stopped event when stop is called", () => {
    const handler = jest.fn();
    eventBus.on("playback:stopped", handler);

    const base64 = createBase64Pcm16([1000, 2000]);
    service.enqueue(base64);
    service.stop();

    expect(handler).toHaveBeenCalled();
  });

  it("should handle empty base64 input gracefully", () => {
    expect(() => service.enqueue("")).not.toThrow();
  });

  it("should clean up AudioContext on dispose", () => {
    const closeSpy = jest.spyOn(
      service["audioContext"] as unknown as MockAudioContext,
      "close",
    );
    service.dispose();
    expect(closeSpy).toHaveBeenCalled();
  });
});
