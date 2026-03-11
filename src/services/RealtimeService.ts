import { EventBus } from "@/lib/EventBus";
import { SocraticPrompt } from "@/lib/SocraticPrompt";
import { RealtimeServerEvent } from "@/types/realtime";
import {
  REALTIME_CALL_MODEL,
  REALTIME_VOICE,
} from "@/config/constants";

// Map server event types to EventBus event names
// GA API uses different event names than the beta API
const EVENT_MAP: Record<string, string> = {
  "session.created": "realtime:session_created",
  "session.updated": "realtime:session_updated",
  "input_audio_buffer.speech_started": "realtime:speech_started",
  "input_audio_buffer.speech_stopped": "realtime:speech_stopped",
  "response.created": "realtime:response_created",
  "output_audio_buffer.started": "realtime:audio_started",
  "response.output_audio_transcript.delta": "realtime:transcript_delta",
  "response.output_audio.done": "realtime:audio_done",
  "response.done": "realtime:response_done",
  "response.cancelled": "realtime:response_cancelled",
  "error": "realtime:error",
};

const REALTIME_BASE_URL = "https://api.openai.com/v1/realtime/calls";

export class RealtimeService {
  private pc: RTCPeerConnection | null = null;
  private dc: RTCDataChannel | null = null;
  private eventBus: EventBus;
  private connected: boolean = false;

  // Remote audio element for playback
  private audioElement: HTMLAudioElement | null = null;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Connect to the OpenAI Realtime API via WebRTC.
   * 1. Create RTCPeerConnection
   * 2. Add mic audio track
   * 3. Create data channel for events
   * 4. SDP offer/answer exchange with OpenAI using ephemeral key
   */
  public async connect(ephemeralKey: string, micStream: MediaStream): Promise<void> {
    this.pc = new RTCPeerConnection();

    // Add mic audio track to send to OpenAI
    for (const track of micStream.getAudioTracks()) {
      this.pc.addTrack(track, micStream);
    }

    // Handle remote audio (response from OpenAI)
    this.pc.ontrack = (event: RTCTrackEvent) => {
      console.log("[RealtimeService] Remote audio track received");
      this.audioElement = new Audio();
      this.audioElement.srcObject = event.streams[0];
      this.audioElement.autoplay = true;
      this.eventBus.emit("realtime:remote_stream", event.streams[0]);
    };

    // Create data channel for events (must be created before offer)
    this.dc = this.pc.createDataChannel("oai-events");

    this.dc.onopen = () => {
      console.log("[RealtimeService] Data channel open");
      this.connected = true;
      this.sendSessionConfig();
      this.eventBus.emit("realtime:connected");
    };

    this.dc.onmessage = (event: MessageEvent) => {
      this.handleServerEvent(event.data as string);
    };

    this.dc.onclose = () => {
      console.log("[RealtimeService] Data channel closed");
      this.connected = false;
      this.eventBus.emit("realtime:disconnected");
    };

    this.dc.onerror = (err) => {
      console.error("[RealtimeService] Data channel error:", err);
      this.eventBus.emit("realtime:error", { message: "Data channel error" });
    };

    // Create and set local SDP offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Exchange SDP with OpenAI
    console.log("[RealtimeService] Sending SDP offer to OpenAI...");
    const sdpResponse = await fetch(`${REALTIME_BASE_URL}?model=${REALTIME_CALL_MODEL}`, {
      method: "POST",
      body: offer.sdp,
      headers: {
        Authorization: `Bearer ${ephemeralKey}`,
        "Content-Type": "application/sdp",
      },
    });

    if (!sdpResponse.ok) {
      const text = await sdpResponse.text();
      console.error("[RealtimeService] SDP exchange failed:", sdpResponse.status, text);
      throw new Error(`SDP exchange failed: ${sdpResponse.status}`);
    }

    const answerSdp = await sdpResponse.text();
    console.log("[RealtimeService] Got SDP answer, setting remote description");
    await this.pc.setRemoteDescription({
      type: "answer",
      sdp: answerSdp,
    });
  }

  public disconnect(): void {
    if (this.dc) {
      this.dc.close();
      this.dc = null;
    }
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.audioElement) {
      this.audioElement.srcObject = null;
      this.audioElement = null;
    }
    this.connected = false;
  }

  public sendAudio(_base64Audio: string): void {
    // With WebRTC, audio is sent via the media track automatically.
    // This legacy method remains only for compatibility with the pre-WebRTC
    // prototype and is a no-op in the current transport.
  }

  public isConnected(): boolean {
    return this.connected;
  }

  /** Send a message over the data channel. */
  public sendEvent(data: object): void {
    if (!this.dc || this.dc.readyState !== "open") return;
    this.dc.send(JSON.stringify(data));
  }

  private sendSessionConfig(): void {
    // GA API session config format
    this.sendEvent({
      type: "session.update",
      session: {
        instructions: SocraticPrompt.build(),
        voice: REALTIME_VOICE,
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 300,
        },
      },
    });
  }

  private handleServerEvent(rawData: string): void {
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(rawData) as RealtimeServerEvent;
    } catch {
      return;
    }

    const busEvent = EVENT_MAP[event.type];
    if (busEvent) {
      this.eventBus.emit(busEvent, event);
    }
  }
}
