import { EventBus } from "@/lib/EventBus";
import { LatencyTracker } from "@/lib/LatencyTracker";
import { ConversationStore } from "@/lib/ConversationStore";
import { AudioPlaybackService } from "@/services/AudioPlaybackService";
import { RealtimeService } from "@/services/RealtimeService";
import { AvatarService } from "@/services/AvatarService";
import { AudioAnalyser } from "@/lib/AudioAnalyser";
import { MicCapture } from "@/lib/MicCapture";
import { PipelineStage, LatencyMetrics } from "@/types/pipeline";
import { SessionState, Message } from "@/types/conversation";
import {
  ResponseAudioDeltaEvent,
  ResponseAudioTranscriptDeltaEvent,
} from "@/types/realtime";

/**
 * Orchestrates all services for a tutoring session:
 * - Requests ephemeral key, connects RealtimeService
 * - Starts mic capture, routes audio to Realtime API
 * - Routes Realtime API audio to AudioPlaybackService
 * - Drives AvatarService expressions from Realtime events
 * - Tracks latency metrics via LatencyTracker
 * - Manages transcript via ConversationStore
 */
export class SessionManager {
  private eventBus: EventBus;
  private latencyTracker: LatencyTracker;
  private conversationStore: ConversationStore;
  private audioPlayback: AudioPlaybackService;
  private realtimeService: RealtimeService;
  private avatarService: AvatarService;
  private audioAnalyser: AudioAnalyser | null = null;
  private micCapture: MicCapture;

  private state: SessionState = "idle";
  private isFirstAudioDelta: boolean = true;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.latencyTracker = new LatencyTracker();
    this.conversationStore = new ConversationStore();
    this.audioPlayback = new AudioPlaybackService(eventBus);
    this.realtimeService = new RealtimeService(eventBus);
    this.avatarService = new AvatarService(eventBus);
    this.micCapture = new MicCapture();

    // Wire up AudioAnalyser from playback's AnalyserNode
    this.audioAnalyser = new AudioAnalyser(this.audioPlayback.getAnalyserNode());
    this.avatarService.setAudioAnalyser(this.audioAnalyser);

    this.setupEventListeners();
  }

  /** Current session state. */
  public getState(): SessionState {
    return this.state;
  }

  /** Get the conversation transcript. */
  public getTranscript(): Message[] {
    return this.conversationStore.getMessages();
  }

  /** Get current latency metrics for the in-progress turn. */
  public getCurrentMetrics(): LatencyMetrics {
    return this.latencyTracker.computeCurrentMetrics();
  }

  /** Get latency history across all turns. */
  public getLatencyHistory(): LatencyMetrics[] {
    return this.latencyTracker.getHistory();
  }

  /** Get average latency metrics. */
  public getAverageMetrics(): LatencyMetrics {
    return this.latencyTracker.getAverages();
  }

  /**
   * Start a new tutoring session:
   * 1. Fetch ephemeral key from /api/session
   * 2. Connect to OpenAI Realtime API
   * 3. Start mic capture
   */
  public async startSession(): Promise<void> {
    this.setState("connecting");

    try {
      const response = await fetch("/api/session", { method: "POST" });
      if (!response.ok) {
        throw new Error(`Session creation failed: ${response.status}`);
      }

      const { clientSecret } = await response.json();
      this.realtimeService.connect(clientSecret);

      // Start mic capture — sends audio to Realtime API
      await this.micCapture.start((base64Pcm) => {
        this.realtimeService.sendAudio(base64Pcm);
      });

      this.setState("listening");
    } catch {
      this.setState("idle");
    }
  }

  /** End the session and release all resources. */
  public endSession(): void {
    this.micCapture.stop();
    this.realtimeService.disconnect();
    this.audioPlayback.stop();
    this.setState("idle");
  }

  /** Dispose all services. */
  public dispose(): void {
    this.endSession();
    this.audioPlayback.dispose();
    this.avatarService.dispose();
    this.state = "idle";
  }

  private setState(newState: SessionState): void {
    this.state = newState;
    this.eventBus.emit("session:state_changed", newState);
  }

  private setupEventListeners(): void {
    // Student started speaking
    this.eventBus.on("realtime:speech_started", () => {
      this.eventBus.emit("avatar:set_expression", "listening");

      // If audio was playing, stop it (interruption)
      this.audioPlayback.stop();

      // Start latency tracking for this turn
      this.latencyTracker.reset();
      this.latencyTracker.markStart(PipelineStage.END_TO_END);
      this.isFirstAudioDelta = true;
    });

    // Student stopped speaking
    this.eventBus.on("realtime:speech_stopped", () => {
      this.eventBus.emit("avatar:set_expression", "thinking");

      // Mark end-to-end start (speech_stopped is when we start measuring response latency)
      this.latencyTracker.markStart(PipelineStage.INPUT_PROCESSING);
      this.latencyTracker.markStart(PipelineStage.END_TO_END);
      this.isFirstAudioDelta = true;
    });

    // Response created — model started generating
    this.eventBus.on("realtime:response_created", () => {
      this.latencyTracker.markEnd(PipelineStage.INPUT_PROCESSING);
      this.latencyTracker.markStart(PipelineStage.TIME_TO_FIRST_AUDIO);

      // Start accumulating transcript
      this.conversationStore.startAssistantMessage();
    });

    // Audio delta — PCM chunk from the response
    this.eventBus.on("realtime:audio_delta", (payload: unknown) => {
      const event = payload as ResponseAudioDeltaEvent;

      if (this.isFirstAudioDelta) {
        this.isFirstAudioDelta = false;
        this.latencyTracker.markEnd(PipelineStage.TIME_TO_FIRST_AUDIO);
        this.latencyTracker.markEnd(PipelineStage.END_TO_END);
        this.latencyTracker.markStart(PipelineStage.FULL_RESPONSE);
        this.eventBus.emit("avatar:set_expression", "talking");
      }

      // Forward audio to playback
      this.audioPlayback.enqueue(event.delta);
    });

    // Transcript delta — text fragment of the response
    this.eventBus.on("realtime:transcript_delta", (payload: unknown) => {
      const event = payload as ResponseAudioTranscriptDeltaEvent;
      this.conversationStore.appendAssistantDelta(event.delta);
    });

    // Response complete
    this.eventBus.on("realtime:response_done", () => {
      this.latencyTracker.markEnd(PipelineStage.FULL_RESPONSE);
      this.latencyTracker.finalizeTurn();

      this.conversationStore.finalizeAssistantMessage();
      this.eventBus.emit("avatar:set_expression", "idle");
    });

    // Response cancelled (interruption handled by Realtime API)
    this.eventBus.on("realtime:response_cancelled", () => {
      this.audioPlayback.stop();
      this.conversationStore.cancelAssistantMessage();
      this.latencyTracker.reset();
      this.eventBus.emit("avatar:set_expression", "listening");
    });
  }
}
