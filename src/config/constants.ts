export const REALTIME_MODEL = "gpt-4o-mini-realtime-preview-2024-12-17";
export const REALTIME_CALL_MODEL = "gpt-realtime";
export const REALTIME_VOICE = "sage";
export const AUDIO_SAMPLE_RATE = 24000;
export const AUDIO_FORMAT = "pcm16";

export const VAD_CONFIG = {
  type: "server_vad" as const,
  threshold: 0.6,
  prefix_padding_ms: 300,
  silence_duration_ms: 500,
  create_response: false,
};

export const INPUT_AUDIO_TRANSCRIPTION_MODEL = "whisper-1";

export const ANALYSER_FFT_SIZE = 256;
export const ANALYSER_SMOOTHING = 0.3;
export const AMPLITUDE_SCALE_FACTOR = 4.0;
