import { AudioPlaybackService } from "@/services/AudioPlaybackService";
import { EventBus } from "@/lib/EventBus";

// Mock Web Audio API
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
  startTime: number = 0;
  connect = jest.fn();
  start = jest.fn().mockImplementation((time: number) => {
    this.startTime = time;
  });
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

function createBase64Pcm16(sampleCount: number): string {
  const buffer = new ArrayBuffer(sampleCount * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < sampleCount; i++) {
    view.setInt16(i * 2, Math.floor(Math.random() * 32767), true);
  }
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

describe("Audio Scheduling Latency", () => {
  let eventBus: EventBus;
  let playback: AudioPlaybackService;

  beforeEach(() => {
    eventBus = new EventBus();
    playback = new AudioPlaybackService(eventBus);
  });

  afterEach(() => {
    playback.dispose();
  });

  it("should schedule first chunk with negligible overhead (<10ms)", () => {
    const before = performance.now();
    const base64 = createBase64Pcm16(240); // 10ms of audio at 24kHz
    playback.enqueue(base64);
    const elapsed = performance.now() - before;

    expect(elapsed).toBeLessThan(10);
  });

  it("should schedule multiple chunks without accumulating overhead", () => {
    const before = performance.now();
    for (let i = 0; i < 10; i++) {
      const base64 = createBase64Pcm16(240);
      playback.enqueue(base64);
    }
    const elapsed = performance.now() - before;

    // 10 chunks should still be well under 50ms total scheduling time
    expect(elapsed).toBeLessThan(50);
  });

  it("should clear queue instantly on stop", () => {
    for (let i = 0; i < 20; i++) {
      playback.enqueue(createBase64Pcm16(240));
    }

    const before = performance.now();
    playback.stop();
    const elapsed = performance.now() - before;

    expect(elapsed).toBeLessThan(5);
    expect(playback.getTotalScheduled()).toBe(0);
  });
});
