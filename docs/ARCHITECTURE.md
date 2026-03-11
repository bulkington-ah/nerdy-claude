# Architecture

## Overview

This app is a real-time AI tutor that uses the Socratic method and a procedural canvas avatar. The current implementation uses OpenAI Realtime over WebRTC: the browser sends the microphone as a media track, receives the model's audio as a remote media track, and uses a data channel for transcript and control events.

## Runtime Flow

```
[Mic track] → [OpenAI Realtime WebRTC call] → [Remote audio track] → <audio> playback
                   ↓                                 ↓
             data channel events              MediaStreamSource
                   ↓                                 ↓
      transcript + latency + avatar state      AnalyserNode → amplitude → [Canvas Avatar]
```

## Key Components

### Services (`src/services/`)

- **SessionManager** — Top-level orchestrator. Requests an ephemeral client secret, acquires mic access, connects the realtime session, and routes events into transcript, latency, and avatar systems.
- **RealtimeService** — Owns the `RTCPeerConnection`, data channel, and SDP exchange with OpenAI. Mic audio is sent over the WebRTC media track, not manually chunked in userland.
- **AudioPlaybackService** — In the active path, connects the remote WebRTC `MediaStream` to an `AnalyserNode` for lip-sync. It also retains PCM16 decode/scheduling helpers from an earlier prototype.
- **AvatarService** — Draws the procedural canvas avatar, reads audio amplitude, and animates expression changes such as `listening`, `thinking`, and `talking`.

### Libraries (`src/lib/`)

- **EventBus** — Lightweight pub/sub used to decouple services and UI.
- **LatencyTracker** — Records per-turn timing and computes current and average metrics.
- **ConversationStore** — Accumulates streaming assistant transcript deltas into finalized assistant messages.
- **SocraticPrompt** — Builds the system prompt that constrains the tutor to short Socratic responses.
- **AudioAnalyser** — Wraps the `AnalyserNode` and computes normalized RMS amplitude for lip-sync.
- **MicCapture** — Legacy PCM-capture utility from the pre-WebRTC prototype. It is not part of the current live session path.

### Components (`src/components/`)

- **TutorSession** — Creates the session manager, subscribes to events, and renders the page.
- **AvatarCanvas** — Creates the canvas avatar and boots `AvatarService`.
- **TranscriptPanel** — Displays finalized assistant messages and the in-progress assistant transcript.
- **LatencyOverlay** — Shows current and average latency metrics against simple budgets.
- **MicButton** — Starts and stops the session.

### API (`src/app/api/`)

- **POST /api/session** — Exchanges the server-side `OPENAI_API_KEY` for a short-lived client secret. Audio still goes directly between browser and OpenAI.

## Data Flow

```
Browser ←—WebRTC—→ OpenAI Realtime API
   ↑
   └── POST /api/session → ephemeral client secret
```

1. User clicks Start.
2. `SessionManager` resumes the local `AudioContext`, requests microphone access, and calls `/api/session`.
3. `RealtimeService` creates a `RTCPeerConnection`, adds the microphone track, opens a data channel, and performs SDP exchange with OpenAI.
4. On data-channel open, `RealtimeService` sends `session.update` with the Socratic prompt, audio formats, voice, and server VAD settings.
5. OpenAI emits speech, response, and transcript events on the data channel and streams synthesized audio back on the remote media track.
6. The remote audio plays through an `HTMLAudioElement`; `AudioPlaybackService` taps that stream with a `MediaStreamSource` so `AudioAnalyser` can drive lip-sync.
7. `LatencyTracker` timestamps data-channel events, and `TranscriptPanel` renders assistant transcript deltas as they arrive.
