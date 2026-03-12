// OpenAI Realtime API event types.
// This file now reflects the current WebRTC/data-channel flow. Some legacy
// PCM-streaming client event types remain for completeness.

export interface RealtimeSessionConfig {
  type?: "realtime";
  instructions: string;
  voice: string;
  audio?: {
    input?: {
      turn_detection?: {
        type: "server_vad";
        threshold: number;
        prefix_padding_ms: number;
        silence_duration_ms: number;
        create_response?: boolean;
      };
      transcription?: {
        model: string;
      };
    };
    output?: {
      voice?: string;
    };
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

export interface OutputAudioBufferStartedEvent extends RealtimeServerEvent {
  type: "output_audio_buffer.started";
}

export interface ResponseOutputAudioTranscriptDeltaEvent extends RealtimeServerEvent {
  type: "response.output_audio_transcript.delta";
  response_id: string;
  delta: string; // text fragment
}

export interface ResponseOutputAudioDoneEvent extends RealtimeServerEvent {
  type: "response.output_audio.done";
  response_id: string;
}

export interface ResponseDoneEvent extends RealtimeServerEvent {
  type: "response.done";
  response: { id: string; status: string };
}

export interface ResponseCancelledEvent extends RealtimeServerEvent {
  type: "response.cancelled";
  response_id: string;
}

export interface InputAudioTranscriptionDeltaEvent extends RealtimeServerEvent {
  type: "conversation.item.input_audio_transcription.delta";
  item_id?: string;
  content_index?: number;
  delta: string;
}

export interface InputAudioTranscriptionCompletedEvent extends RealtimeServerEvent {
  type: "conversation.item.input_audio_transcription.completed";
  item_id?: string;
  content_index?: number;
  transcript: string;
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
  | OutputAudioBufferStartedEvent
  | ResponseOutputAudioTranscriptDeltaEvent
  | ResponseOutputAudioDoneEvent
  | ResponseDoneEvent
  | ResponseCancelledEvent
  | InputAudioTranscriptionDeltaEvent
  | InputAudioTranscriptionCompletedEvent
  | ErrorEvent;

// Client events we may send over the data channel.
// In the current WebRTC flow, only session.update is used; audio append/commit
// remain here for legacy PCM streaming completeness.
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

export interface ConversationItemCreateClientEvent {
  type: "conversation.item.create";
  item: {
    type: "message";
    role: "user";
    content: Array<{ type: "input_text"; text: string }>;
  };
}

export interface ResponseCreateClientEvent {
  type: "response.create";
}

export type RealtimeClientEvent =
  | SessionUpdateClientEvent
  | InputAudioBufferAppendEvent
  | InputAudioBufferCommitEvent
  | ConversationItemCreateClientEvent
  | ResponseCreateClientEvent;

// Ephemeral key response from /api/session
export interface EphemeralKeyResponse {
  clientSecret: string;
  expiresAt: number;
}
