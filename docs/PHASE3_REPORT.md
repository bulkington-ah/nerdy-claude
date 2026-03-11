# Phase 3: Audio I/O — Implementation Report

## What was implemented

### AudioPlaybackService (`src/services/AudioPlaybackService.ts`)
Core service for playing back PCM16 audio from the OpenAI Realtime API:
- Decodes base64-encoded PCM16 (little-endian, mono, 24kHz) to Float32Array
- Creates AudioBuffers and schedules gapless playback via Web Audio API
- Audio routing: source → GainNode → AnalyserNode → destination
- Exposes AnalyserNode for Phase 4 avatar lip-sync
- Stop/clear functionality for interruption handling (clears queue, stops all sources)
- Emits `playback:started` and `playback:stopped` events via EventBus

### MicCapture (`src/lib/MicCapture.ts`)
Microphone capture utility for sending audio to the Realtime API:
- `getUserMedia` with echo cancellation + noise suppression
- Captures at 24kHz mono via ScriptProcessorNode
- Converts Float32 → PCM16 → base64 per chunk
- Delivers chunks via callback for `input_audio_buffer.append` events
- Clean teardown: stops tracks, disconnects nodes, closes AudioContext

## Key design decisions

1. **ScriptProcessorNode over AudioWorklet**: Simpler implementation. AudioWorklet would be better for production (off main thread), but ScriptProcessorNode is sufficient and widely supported.
2. **Gapless scheduling**: Uses `AudioBufferSourceNode.start(time)` with a `nextStartTime` tracker to schedule consecutive buffers without gaps.
3. **AnalyserNode exposure**: AudioPlaybackService owns the AnalyserNode and exposes it via getter, so AudioAnalyser (Phase 4) can wrap it without tight coupling.
4. **EventBus integration**: Playback state changes emit events so SessionManager (Phase 5) can coordinate avatar state transitions.

## Test results

- `AudioPlaybackService.test.ts`: 9 tests passing — decode, enqueue, gapless scheduling, stop/clear, events, dispose
- All 70 tests across 9 suites passing

## Notes for Phase 5 integration

- `AudioPlaybackService.getAnalyserNode()` → pass to `AudioAnalyser` constructor
- Listen for `realtime:audio_delta` events → call `service.enqueue(event.delta)`
- On interruption (`realtime:response_cancelled`) → call `service.stop()`
- `MicCapture.start(callback)` → callback should call `realtimeService.sendAudio(base64)`
