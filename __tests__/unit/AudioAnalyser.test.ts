import { AudioAnalyser } from "@/lib/AudioAnalyser";

// Mock AnalyserNode
class MockAnalyserNode {
  fftSize = 256;
  smoothingTimeConstant = 0.3;
  frequencyBinCount = 128;

  private timeDomainData: Uint8Array;

  constructor() {
    // Default: silence (128 = zero crossing in unsigned byte domain)
    this.timeDomainData = new Uint8Array(this.frequencyBinCount).fill(128);
  }

  getByteTimeDomainData(array: Uint8Array): void {
    array.set(this.timeDomainData.subarray(0, array.length));
  }

  // Test helper: set waveform data (pads remaining samples with 128 = silence)
  setTimeDomainData(data: number[]): void {
    this.timeDomainData = new Uint8Array(this.frequencyBinCount).fill(128);
    for (let i = 0; i < data.length && i < this.frequencyBinCount; i++) {
      this.timeDomainData[i] = data[i];
    }
  }
}

describe("AudioAnalyser", () => {
  let mockNode: MockAnalyserNode;
  let analyser: AudioAnalyser;

  beforeEach(() => {
    mockNode = new MockAnalyserNode();
    analyser = new AudioAnalyser(mockNode as unknown as AnalyserNode);
  });

  it("should return 0 amplitude for silence (all 128 values)", () => {
    // Default mock data is all 128s (silence)
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBe(0);
  });

  it("should return amplitude between 0 and 1", () => {
    // Fill all 128 samples with oscillating values around 128
    const data = new Array(128).fill(0).map((_, i) => (i % 2 === 0 ? 200 : 56));
    mockNode.setTimeDomainData(data);
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBeGreaterThan(0);
    expect(amplitude).toBeLessThanOrEqual(1);
  });

  it("should compute correct RMS for known waveform", () => {
    // All 128 values at 228 (100 above center 128)
    // Normalized: (228-128)/128 = 0.78125 for each sample
    // RMS = 0.78125, scaled by factor 4.0 = 3.125, clamped to 1.0
    const data = new Array(128).fill(228);
    mockNode.setTimeDomainData(data);
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBe(1); // Clamped to 1
  });

  it("should scale small amplitudes correctly", () => {
    // Fill all 128 samples with 138 (10 above center 128)
    // Normalized: 10/128 = 0.078125
    // RMS = 0.078125, scaled by 4.0 = 0.3125
    const data = new Array(128).fill(138);
    mockNode.setTimeDomainData(data);
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBeCloseTo(0.3125, 2);
  });

  it("should handle maximum amplitude (255 values)", () => {
    // All 128 samples at 255: (255-128)/128 = 0.9921875
    // RMS = 0.9921875, scaled by 4.0 = clamped to 1.0
    const data = new Array(128).fill(255);
    mockNode.setTimeDomainData(data);
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBe(1);
  });

  it("should handle minimum amplitude (0 values)", () => {
    // All 128 samples at 0: (0-128)/128 = -1.0
    // RMS = 1.0, scaled by 4.0 = clamped to 1.0
    const data = new Array(128).fill(0);
    mockNode.setTimeDomainData(data);
    const amplitude = analyser.getAmplitude();
    expect(amplitude).toBe(1);
  });

  it("should return consistent results across multiple calls with same data", () => {
    const data = new Array(128).fill(0).map((_, i) => (i % 2 === 0 ? 160 : 96));
    mockNode.setTimeDomainData(data);
    const a1 = analyser.getAmplitude();
    const a2 = analyser.getAmplitude();
    expect(a1).toBe(a2);
  });
});
