import { EventBus } from "@/lib/EventBus";
import { SocraticPrompt } from "@/lib/SocraticPrompt";
import { RealtimeServerEvent } from "@/types/realtime";
import {
  REALTIME_MODEL,
  REALTIME_VOICE,
  AUDIO_FORMAT,
  VAD_CONFIG,
} from "@/config/constants";

// Map server event types to EventBus event names
const EVENT_MAP: Record<string, string> = {
  "session.created": "realtime:session_created",
  "session.updated": "realtime:session_updated",
  "input_audio_buffer.speech_started": "realtime:speech_started",
  "input_audio_buffer.speech_stopped": "realtime:speech_stopped",
  "response.created": "realtime:response_created",
  "response.audio.delta": "realtime:audio_delta",
  "response.audio_transcript.delta": "realtime:transcript_delta",
  "response.done": "realtime:response_done",
  "response.cancelled": "realtime:response_cancelled",
  "error": "realtime:error",
};

export class RealtimeService {
  private ws: WebSocket | null = null;
  private eventBus: EventBus;
  private connected: boolean = false;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  public connect(ephemeralKey: string): void {
    const url = `wss://api.openai.com/v1/realtime?model=${REALTIME_MODEL}`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected = true;
      this.sendSessionConfig();
      this.eventBus.emit("realtime:connected");
    };

    this.ws.onmessage = (event: MessageEvent) => {
      this.handleServerEvent(event.data as string);
    };

    this.ws.onerror = () => {
      this.eventBus.emit("realtime:error", { message: "WebSocket error" });
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.eventBus.emit("realtime:disconnected");
    };
  }

  public disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
      this.connected = false;
    }
  }

  public sendAudio(base64Audio: string): void {
    if (!this.ws || !this.connected) return;
    this.send({
      type: "input_audio_buffer.append",
      audio: base64Audio,
    });
  }

  public isConnected(): boolean {
    return this.connected;
  }

  private sendSessionConfig(): void {
    this.send({
      type: "session.update",
      session: {
        instructions: SocraticPrompt.build(),
        voice: REALTIME_VOICE,
        input_audio_format: AUDIO_FORMAT,
        output_audio_format: AUDIO_FORMAT,
        turn_detection: VAD_CONFIG,
      },
    });
  }

  private send(data: object): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(data));
  }

  private handleServerEvent(rawData: string): void {
    let event: RealtimeServerEvent;
    try {
      event = JSON.parse(rawData) as RealtimeServerEvent;
    } catch {
      return; // Ignore malformed messages
    }

    const busEvent = EVENT_MAP[event.type];
    if (busEvent) {
      this.eventBus.emit(busEvent, event);
    }
  }
}
