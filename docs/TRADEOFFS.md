# Tradeoffs

## Collapsed vs Composable Pipeline

**Chose: Collapsed (OpenAI Realtime API)**

| | Collapsed | Composable (Deepgram + GPT + ElevenLabs) |
|---|---|---|
| Latency | 300-500ms | 700-1300ms |
| Complexity | Single realtime session | 3 services, 3 APIs |
| Cost | Single API billing | 3 separate billings |
| Flexibility | Locked to OpenAI voices/models | Mix and match providers |
| Interruption | Built-in barge-in | Must implement manually |

**Why**: Latency is the primary constraint for a real-time tutoring experience. The ~400ms savings from collapsing the pipeline is significant for conversational flow.

**Tradeoff**: Vendor lock-in to OpenAI. Cannot swap individual components such as STT or TTS independently.

## Procedural Canvas Avatar vs Hosted Video Avatar

**Chose: Procedural canvas avatar**

| | Procedural Canvas | Hosted Video Avatar |
|---|---|---|
| Latency | 0ms network overhead | 200-500ms+ API call |
| Cost | No avatar API cost | Per-minute API pricing |
| Realism | Stylized | Often photorealistic |
| Control | Full code-level control | Limited to provider features |

**Why**: Zero added network latency is critical. Keeping the avatar local also makes lip-sync straightforward because it can read amplitude from the live audio stream directly.

**Tradeoff**: The avatar is intentionally simple and less realistic than a hosted video avatar.

## WebRTC Media Tracks vs Manual PCM Streaming

**Chose: WebRTC media tracks**

The browser now sends microphone audio to OpenAI as a native WebRTC track and receives the model voice back as a remote track. A data channel carries session and transcript events.

**Why**: This matches the current OpenAI realtime call flow, removes the need to manually chunk microphone PCM in userland, and lets the browser handle transport details such as jitter buffering and playback synchronization.

**Tradeoff**: The repository still contains legacy PCM helper code (`MicCapture`, chunk scheduling in `AudioPlaybackService`) that can confuse readers because it is no longer part of the live path.

## Server VAD vs Client VAD

**Chose: Server VAD (OpenAI built-in)**

**Why**: OpenAI's Realtime API includes server-side VAD with configurable threshold and silence duration. Using it eliminates the need for client-side VAD processing and keeps turn detection aligned with the model's own pipeline.

**Tradeoff**: Slightly less responsive than an aggressively tuned client-side detector because audio must reach the server before VAD triggers.

## No Subject Selector

**Chose: Open-ended conversation**

**Why**: The Socratic method works across subjects. Forcing subject selection adds friction and limits the tutor's flexibility. The student just starts talking.

**Tradeoff**: The prompt cannot be as deeply specialized for a specific subject. A math-only tutor could scaffold more aggressively than this general-purpose version.
