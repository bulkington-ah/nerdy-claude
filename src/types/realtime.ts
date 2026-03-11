// OpenAI Realtime API event types

export interface RealtimeSessionConfig {
  model: string;
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  turn_detection: {
    type: "server_vad";
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  };
}

// Server events we handle
export interface RealtimeServerEvent {
  type: string;
  event_id?: string;
}

export interface SessionCreatedEvent extends RealtimeServerEvent {
  type: "session.created";
  session: { id: string };
}

export interface SessionUpdatedEvent extends RealtimeServerEvent {
  type: "session.updated";
  session: { id: string };
}

export interface SpeechStartedEvent extends RealtimeServerEvent {
  type: "input_audio_buffer.speech_started";
  audio_start_ms: number;
}

export interface SpeechStoppedEvent extends RealtimeServerEvent {
  type: "input_audio_buffer.speech_stopped";
  audio_end_ms: number;
}

export interface ResponseCreatedEvent extends RealtimeServerEvent {
  type: "response.created";
  response: { id: string };
}

export interface ResponseAudioDeltaEvent extends RealtimeServerEvent {
  type: "response.audio.delta";
  response_id: string;
  delta: string; // base64-encoded PCM audio
}

export interface ResponseAudioTranscriptDeltaEvent extends RealtimeServerEvent {
  type: "response.audio_transcript.delta";
  response_id: string;
  delta: string; // text fragment
}

export interface ResponseDoneEvent extends RealtimeServerEvent {
  type: "response.done";
  response: { id: string; status: string };
}

export interface ResponseCancelledEvent extends RealtimeServerEvent {
  type: "response.cancelled";
  response_id: string;
}

export interface ErrorEvent extends RealtimeServerEvent {
  type: "error";
  error: { type: string; code: string; message: string };
}

export type RealtimeEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SpeechStartedEvent
  | SpeechStoppedEvent
  | ResponseCreatedEvent
  | ResponseAudioDeltaEvent
  | ResponseAudioTranscriptDeltaEvent
  | ResponseDoneEvent
  | ResponseCancelledEvent
  | ErrorEvent;

// Client events we send
export interface SessionUpdateClientEvent {
  type: "session.update";
  session: Partial<RealtimeSessionConfig>;
}

export interface InputAudioBufferAppendEvent {
  type: "input_audio_buffer.append";
  audio: string; // base64-encoded PCM
}

export interface InputAudioBufferCommitEvent {
  type: "input_audio_buffer.commit";
}

export type RealtimeClientEvent =
  | SessionUpdateClientEvent
  | InputAudioBufferAppendEvent
  | InputAudioBufferCommitEvent;

// Ephemeral key response from /api/session
export interface EphemeralKeyResponse {
  clientSecret: string;
  expiresAt: number;
}
