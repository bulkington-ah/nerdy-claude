import { AUDIO_SAMPLE_RATE } from "@/config/constants";

/**
 * Captures microphone audio, resamples to 24kHz PCM16, and sends
 * base64-encoded chunks via a callback (for input_audio_buffer.append events).
 */
export class MicCapture {
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private processor: ScriptProcessorNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private onAudioChunk: ((base64Pcm: string) => void) | null = null;

  /**
   * Start capturing mic audio.
   * @param onAudioChunk Callback invoked with base64-encoded PCM16 chunks.
   */
  public async start(onAudioChunk: (base64Pcm: string) => void): Promise<void> {
    this.onAudioChunk = onAudioChunk;

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: AUDIO_SAMPLE_RATE,
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
      },
    });

    this.audioContext = new AudioContext({ sampleRate: AUDIO_SAMPLE_RATE });
    this.source = this.audioContext.createMediaStreamSource(this.stream);

    // ScriptProcessorNode for simplicity; AudioWorklet would be better for production
    const bufferSize = 4096;
    this.processor = this.audioContext.createScriptProcessor(bufferSize, 1, 1);

    this.processor.onaudioprocess = (event: AudioProcessingEvent) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcm16 = this.float32ToPcm16(inputData);
      const base64 = this.arrayBufferToBase64(pcm16.buffer as ArrayBuffer);
      this.onAudioChunk?.(base64);
    };

    this.source.connect(this.processor);
    this.processor.connect(this.audioContext.destination);
  }

  /** Stop mic capture and release resources. */
  public stop(): void {
    if (this.processor) {
      this.processor.disconnect();
      this.processor = null;
    }
    if (this.source) {
      this.source.disconnect();
      this.source = null;
    }
    if (this.stream) {
      for (const track of this.stream.getTracks()) {
        track.stop();
      }
      this.stream = null;
    }
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
    this.onAudioChunk = null;
  }

  /** Convert Float32Array [-1, 1] to Int16Array PCM16. */
  private float32ToPcm16(float32: Float32Array): Int16Array {
    const pcm16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const clamped = Math.max(-1, Math.min(1, float32[i]));
      pcm16[i] = clamped < 0 ? clamped * 32768 : clamped * 32767;
    }
    return pcm16;
  }

  /** Convert ArrayBuffer to base64 string. */
  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
}
