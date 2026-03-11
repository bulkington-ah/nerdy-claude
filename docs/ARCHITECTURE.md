# Architecture

## Overview

A real-time AI video avatar tutor that uses the Socratic method to teach 6-12th graders. The system achieves sub-second end-to-end response latency by collapsing the STT+LLM+TTS pipeline into a single OpenAI Realtime API WebSocket call, paired with a Rive canvas avatar for zero-latency lip-sync.

## Pipeline Flow

```
[Mic] → PCM16 24kHz → [OpenAI Realtime API WebSocket] → PCM audio chunks → [AudioPlayback] → speakers
                        (STT + LLM + TTS internally)        ↓
                        ~300-500ms e2e              [AnalyserNode] → amplitude → [Rive Avatar]
```

## Key Components

### Services (`src/services/`)

- **SessionManager** — Top-level orchestrator. Requests ephemeral key, initializes all services, routes Realtime API events to avatar/latency/transcript systems, handles interruption.
- **RealtimeService** — Manages WebSocket to `wss://api.openai.com/v1/realtime`. Sends session config + mic audio, receives server events, emits them via EventBus.
- **AudioPlaybackService** — Decodes base64 PCM16 audio chunks, schedules gapless Web Audio playback, exposes AnalyserNode for lip-sync.
- **AvatarService** — Drives Rive state machine inputs (mouthOpen, expression booleans) from audio amplitude and session events.

### Libraries (`src/lib/`)

- **EventBus** — Typed pub/sub for decoupled inter-service communication.
- **LatencyTracker** — Records `performance.now()` timestamps keyed to pipeline stages, computes per-turn and average metrics.
- **ConversationStore** — Accumulates transcript deltas into conversation messages.
- **SocraticPrompt** — Builds the Socratic method system prompt with grade-level adaptation.
- **AudioAnalyser** — Wraps Web Audio AnalyserNode, computes RMS amplitude scaled to [0,1].
- **MicCapture** — getUserMedia → PCM16 → base64 chunks via callback.

### Components (`src/components/`)

- **TutorSession** — Top-level React component, manages SessionManager lifecycle.
- **AvatarCanvas** — Canvas wrapper for Rive avatar.
- **TranscriptPanel** — Scrolling conversation display.
- **LatencyOverlay** — Color-coded latency metrics HUD.
- **MicButton** — Mic toggle with visual state indicators.

### API (`src/app/api/`)

- **POST /api/session** — Creates an ephemeral Realtime API key via OpenAI REST API. Browser uses this to connect directly to OpenAI (no server proxy for audio).

## Data Flow

```
Browser ←—WebSocket—→ OpenAI Realtime API
   ↑
   └── POST /api/session → ephemeral key (one-time)
```

1. User clicks Start → SessionManager calls `/api/session` for ephemeral key
2. RealtimeService opens WebSocket to OpenAI, sends session config with Socratic prompt
3. MicCapture streams PCM16 audio to RealtimeService → WebSocket
4. OpenAI VAD detects speech end → processes → streams response audio + transcript
5. AudioPlaybackService plays response audio, AnalyserNode feeds AudioAnalyser
6. AvatarService reads amplitude each frame → drives Rive mouth movement
7. LatencyTracker records timestamps at each event → LatencyOverlay displays metrics
