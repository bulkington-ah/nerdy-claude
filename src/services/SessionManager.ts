import { EventBus } from "@/lib/EventBus";
import { LatencyTracker } from "@/lib/LatencyTracker";
import { ConversationStore } from "@/lib/ConversationStore";
import { AudioPlaybackService } from "@/services/AudioPlaybackService";
import { RealtimeService } from "@/services/RealtimeService";
import { AudioAnalyser } from "@/lib/AudioAnalyser";
import { PipelineStage, LatencyMetrics } from "@/types/pipeline";
import { SessionState, Message } from "@/types/conversation";
import {
  ResponseOutputAudioTranscriptDeltaEvent,
  InputAudioTranscriptionCompletedEvent,
  ConversationItemCreateClientEvent,
  ResponseCreateClientEvent,
} from "@/types/realtime";

/**
 * Orchestrates all services for a tutoring session:
 * - Requests ephemeral key, connects RealtimeService via WebRTC
 * - Mic audio goes through WebRTC media track directly
 * - Response audio comes back via WebRTC remote track
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
  private audioAnalyser: AudioAnalyser;
  private micStream: MediaStream | null = null;

  private state: SessionState = "idle";
  private isFirstAudioDelta: boolean = true;
  private isSpeaking: boolean = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.latencyTracker = new LatencyTracker();
    this.conversationStore = new ConversationStore();
    this.audioPlayback = new AudioPlaybackService(eventBus);
    this.realtimeService = new RealtimeService(eventBus);

    // AudioAnalyser wraps the playback service's AnalyserNode.
    // Exposed via getAudioAnalyser() so AvatarCanvas can wire it
    // to the AvatarService instance that owns the procedural canvas avatar.
    this.audioAnalyser = new AudioAnalyser(this.audioPlayback.getAnalyserNode());

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

  /** Get the AudioAnalyser for connecting to AvatarService lip-sync. */
  public getAudioAnalyser(): AudioAnalyser {
    return this.audioAnalyser;
  }

  /**
   * Start a new tutoring session:
   * 1. Get mic permission
   * 2. Fetch ephemeral key from /api/session
   * 3. Connect to OpenAI Realtime API via WebRTC (mic + events)
   */
  public async startSession(): Promise<void> {
    console.log("[SessionManager] startSession called");
    this.setState("connecting");

    try {
      // Resume AudioContext (browsers suspend it until user gesture)
      await this.audioPlayback.resume();

      // Get mic access
      console.log("[SessionManager] Requesting mic access...");
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
      console.log("[SessionManager] Mic access granted");

      // Fetch ephemeral key
      console.log("[SessionManager] Fetching ephemeral key...");
      const response = await fetch("/api/session", { method: "POST" });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Session creation failed: ${response.status} ${text}`);
      }

      const { clientSecret } = await response.json();
      console.log("[SessionManager] Got ephemeral key, connecting via WebRTC...");

      // Connect — passes mic stream to WebRTC peer connection
      await this.realtimeService.connect(clientSecret, this.micStream);

      console.log("[SessionManager] WebRTC connected, listening");
      this.setState("listening");
    } catch (error) {
      console.error("[SessionManager] startSession failed:", error);
      this.stopMicStream();
      this.setState("idle");
    }
  }

  /**
   * Send a text message to the tutor.
   * Adds to transcript, emits event for UI refresh,
   * and sends to OpenAI Realtime API via data channel.
   */
  public sendTextMessage(text: string): void {
    if (this.state === "idle" || this.state === "connecting") return;

    this.conversationStore.addUserMessage(text);
    this.eventBus.emit("session:user_message", text);

    const itemCreate: ConversationItemCreateClientEvent = {
      type: "conversation.item.create",
      item: {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text }],
      },
    };
    this.realtimeService.sendEvent(itemCreate);

    const responseCreate: ResponseCreateClientEvent = {
      type: "response.create",
    };
    this.realtimeService.sendEvent(responseCreate);
  }

  /** End the session and release all resources. */
  public endSession(): void {
    this.stopMicStream();
    this.realtimeService.disconnect();
    this.audioPlayback.stop();
    this.setState("idle");
  }

  /** Dispose all services. */
  public dispose(): void {
    this.endSession();
    this.audioPlayback.dispose();
    this.state = "idle";
  }

  private stopMicStream(): void {
    if (this.micStream) {
      for (const track of this.micStream.getTracks()) {
        track.stop();
      }
      this.micStream = null;
    }
  }

  private setState(newState: SessionState): void {
    this.state = newState;
    this.eventBus.emit("session:state_changed", newState);
  }

  private setupEventListeners(): void {
    // When remote audio stream arrives, connect it to AudioPlaybackService
    // for AnalyserNode-based lip-sync
    this.eventBus.on("realtime:remote_stream", (payload: unknown) => {
      const stream = payload as MediaStream;
      this.audioPlayback.connectRemoteStream(stream);
    });

    // Student started speaking
    this.eventBus.on("realtime:speech_started", () => {
      this.eventBus.emit("avatar:set_expression", "listening");

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

      // Manually trigger response only when model isn't speaking.
      // VAD has create_response: false to prevent echo-triggered double responses.
      if (!this.isSpeaking) {
        this.realtimeService.sendEvent({ type: "response.create" });
      }
    });

    // User speech transcribed — add to transcript
    this.eventBus.on("realtime:user_transcript", (payload: unknown) => {
      const event = payload as InputAudioTranscriptionCompletedEvent;
      const text = event.transcript?.trim();
      if (text) {
        this.conversationStore.addUserMessage(text);
        this.eventBus.emit("session:user_message", text);
      }
    });

    // Response created — model started generating
    this.eventBus.on("realtime:response_created", () => {
      this.latencyTracker.markEnd(PipelineStage.INPUT_PROCESSING);
      this.latencyTracker.markStart(PipelineStage.TIME_TO_FIRST_AUDIO);

      // Start accumulating transcript
      this.conversationStore.startAssistantMessage();
    });

    // Audio buffer started — marks when response audio actually begins playing.
    // This is the key latency marker for Time to First Audio and End-to-End.
    this.eventBus.on("realtime:audio_started", () => {
      this.isSpeaking = true;
      if (this.isFirstAudioDelta) {
        this.isFirstAudioDelta = false;
        this.latencyTracker.markEnd(PipelineStage.TIME_TO_FIRST_AUDIO);
        this.latencyTracker.markEnd(PipelineStage.END_TO_END);
        this.latencyTracker.markStart(PipelineStage.FULL_RESPONSE);
        this.eventBus.emit("avatar:set_expression", "talking");
      }
    });

    // Audio done — marks when response audio has finished
    this.eventBus.on("realtime:audio_done", () => {
      this.latencyTracker.markEnd(PipelineStage.FULL_RESPONSE);
    });

    // Transcript delta — text fragment of the response
    this.eventBus.on("realtime:transcript_delta", (payload: unknown) => {
      const event = payload as ResponseOutputAudioTranscriptDeltaEvent;
      this.conversationStore.appendAssistantDelta(event.delta);
    });

    // Response complete
    this.eventBus.on("realtime:response_done", () => {
      this.isSpeaking = false;
      this.latencyTracker.finalizeTurn();

      this.conversationStore.finalizeAssistantMessage();
      this.eventBus.emit("avatar:set_expression", "idle");
    });

    // Response cancelled (interruption handled by Realtime API)
    this.eventBus.on("realtime:response_cancelled", () => {
      this.isSpeaking = false;
      this.conversationStore.cancelAssistantMessage();
      this.latencyTracker.reset();
      this.eventBus.emit("avatar:set_expression", "listening");
    });
  }
}
