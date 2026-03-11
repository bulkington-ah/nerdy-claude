import { EventBus } from "@/lib/EventBus";
import { AUDIO_SAMPLE_RATE } from "@/config/constants";

/**
 * Manages playback of base64 PCM16 audio chunks from the OpenAI Realtime API.
 * Schedules gapless playback using Web Audio API and exposes an AnalyserNode
 * for avatar lip-sync.
 */
export class AudioPlaybackService {
  private audioContext: AudioContext;
  private analyserNode: AnalyserNode;
  private gainNode: GainNode;
  private eventBus: EventBus;

  // Gapless scheduling state
  private scheduledSources: AudioBufferSourceNode[] = [];
  private queue: AudioBuffer[] = [];
  private nextStartTime: number = 0;
  private isPlaying: boolean = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.audioContext = new AudioContext();
    this.analyserNode = this.audioContext.createAnalyser();
    this.gainNode = this.audioContext.createGain();

    // Route: source → gain → analyser → destination
    this.gainNode.connect(this.analyserNode);
    this.analyserNode.connect(this.audioContext.destination);
  }

  /** Returns the AnalyserNode for audio amplitude analysis (used by AudioAnalyser). */
  public getAnalyserNode(): AnalyserNode {
    return this.analyserNode;
  }

  /**
   * Decodes a base64-encoded PCM16 (little-endian, mono, 24kHz) string
   * to a Float32Array with values in [-1, 1].
   */
  public decodeBase64Pcm16(base64: string): Float32Array {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    const sampleCount = Math.floor(bytes.length / 2);
    const floats = new Float32Array(sampleCount);
    const view = new DataView(bytes.buffer);

    for (let i = 0; i < sampleCount; i++) {
      const int16 = view.getInt16(i * 2, true); // little-endian
      floats[i] = int16 / 32768;
    }

    return floats;
  }

  /** Enqueue a base64 PCM16 audio chunk for gapless playback. */
  public enqueue(base64: string): void {
    if (!base64) return;

    const floats = this.decodeBase64Pcm16(base64);
    if (floats.length === 0) return;

    const audioBuffer = this.audioContext.createBuffer(
      1,
      floats.length,
      AUDIO_SAMPLE_RATE,
    );
    audioBuffer.copyToChannel(floats, 0);

    this.scheduleBuffer(audioBuffer);
  }

  /** Stop all playback and clear the queue. */
  public stop(): void {
    for (const source of this.scheduledSources) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    }
    this.scheduledSources = [];
    this.queue = [];
    this.nextStartTime = 0;
    this.isPlaying = false;
    this.eventBus.emit("playback:stopped");
  }

  /** Number of buffers waiting in the queue (not yet scheduled). */
  public getQueueLength(): number {
    return this.queue.length;
  }

  /** Total number of scheduled (playing or pending) source nodes. */
  public getTotalScheduled(): number {
    return this.scheduledSources.length;
  }

  /** Release all resources. */
  public dispose(): void {
    this.stop();
    this.audioContext.close();
  }

  private scheduleBuffer(buffer: AudioBuffer): void {
    const wasPlaying = this.isPlaying;
    this.isPlaying = true;

    const source = this.audioContext.createBufferSource();
    source.buffer = buffer;
    source.connect(this.gainNode);

    // Schedule gapless: start right after the last scheduled buffer ends
    const now = this.audioContext.currentTime;
    const startTime = Math.max(now, this.nextStartTime);
    source.start(startTime);

    this.nextStartTime = startTime + buffer.duration;
    this.scheduledSources.push(source);

    // Clean up when this source finishes
    source.onended = () => {
      const index = this.scheduledSources.indexOf(source);
      if (index !== -1) {
        this.scheduledSources.splice(index, 1);
      }
      source.disconnect();
    };

    if (!wasPlaying) {
      this.eventBus.emit("playback:started");
    }
  }
}
