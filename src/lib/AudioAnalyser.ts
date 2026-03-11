import {
  ANALYSER_FFT_SIZE,
  ANALYSER_SMOOTHING,
  AMPLITUDE_SCALE_FACTOR,
} from "@/config/constants";

/**
 * Wraps a Web Audio AnalyserNode to compute RMS amplitude from time-domain data.
 * Returns a value in [0, 1] suitable for driving avatar mouth movement.
 */
export class AudioAnalyser {
  private analyserNode: AnalyserNode;
  private timeDomainData: Uint8Array<ArrayBuffer>;

  constructor(analyserNode: AnalyserNode) {
    this.analyserNode = analyserNode;

    // Configure the analyser
    this.analyserNode.fftSize = ANALYSER_FFT_SIZE;
    this.analyserNode.smoothingTimeConstant = ANALYSER_SMOOTHING;

    this.timeDomainData = new Uint8Array(this.analyserNode.frequencyBinCount) as Uint8Array<ArrayBuffer>;
  }

  /**
   * Compute the current amplitude as a value in [0, 1].
   * Uses RMS of the time-domain waveform, scaled by AMPLITUDE_SCALE_FACTOR
   * and clamped to [0, 1].
   */
  public getAmplitude(): number {
    this.analyserNode.getByteTimeDomainData(this.timeDomainData);

    let sumSquares = 0;
    for (let i = 0; i < this.timeDomainData.length; i++) {
      // Unsigned byte domain: 128 = zero crossing
      const normalized = (this.timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }

    const rms = Math.sqrt(sumSquares / this.timeDomainData.length);
    const scaled = rms * AMPLITUDE_SCALE_FACTOR;
    return Math.min(1, Math.max(0, scaled));
  }
}
