import { AudioPlaybackService } from "@/services/AudioPlaybackService";
import { AudioAnalyser } from "@/lib/AudioAnalyser";
import { EventBus } from "@/lib/EventBus";

// Mock Web Audio API
class MockAnalyserNode {
  fftSize = 256;
  smoothingTimeConstant = 0.3;
  frequencyBinCount = 128;
  private timeDomainData = new Uint8Array(128).fill(128);

  connect = jest.fn();
  disconnect = jest.fn();

  getByteTimeDomainData(array: Uint8Array): void {
    array.set(this.timeDomainData.subarray(0, array.length));
  }

  // Test helper: simulate audio playing
  setActive(amplitude: number): void {
    const val = Math.round(128 + amplitude * 127);
    this.timeDomainData.fill(val);
  }
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

let mockAnalyserInstance: MockAnalyserNode;

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
    mockAnalyserInstance = new MockAnalyserNode();
    return mockAnalyserInstance;
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

function createBase64Pcm16(samples: number[]): string {
  const buffer = new ArrayBuffer(samples.length * 2);
  const view = new DataView(buffer);
  samples.forEach((s, i) => view.setInt16(i * 2, s, true));
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

describe("AudioPipeline Integration", () => {
  let eventBus: EventBus;
  let playback: AudioPlaybackService;
  let analyser: AudioAnalyser;

  beforeEach(() => {
    eventBus = new EventBus();
    playback = new AudioPlaybackService(eventBus);
    analyser = new AudioAnalyser(playback.getAnalyserNode());
  });

  afterEach(() => {
    playback.dispose();
  });

  it("should connect AudioPlaybackService analyser to AudioAnalyser", () => {
    // AudioAnalyser should be able to read from the playback analyser node
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBe(0); // No audio playing = silence
  });

  it("should decode and enqueue audio through the full pipeline", () => {
    const startedHandler = jest.fn();
    eventBus.on("playback:started", startedHandler);

    const base64 = createBase64Pcm16([1000, 2000, 3000, 4000]);
    playback.enqueue(base64);

    expect(startedHandler).toHaveBeenCalled();
  });

  it("should report amplitude when audio is active", () => {
    // Simulate audio playing by setting the mock analyser to active
    mockAnalyserInstance.setActive(0.5);
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBeGreaterThan(0);
  });

  it("should stop pipeline and return to silence on interruption", () => {
    const stoppedHandler = jest.fn();
    eventBus.on("playback:stopped", stoppedHandler);

    const base64 = createBase64Pcm16([1000, 2000]);
    playback.enqueue(base64);
    playback.stop();

    expect(stoppedHandler).toHaveBeenCalled();
    expect(playback.getTotalScheduled()).toBe(0);
  });
});
