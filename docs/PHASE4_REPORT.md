# Phase 4: Rive Avatar + Lip-sync — Implementation Report

> Historical snapshot: this report was written before the current procedural canvas avatar and WebRTC transport were wired up. The live UI still uses `AvatarService`, but it now renders directly to a canvas instead of driving a Rive asset. See `docs/ARCHITECTURE.md` for the current runtime view.

## What was implemented

### AudioAnalyser (`src/lib/AudioAnalyser.ts`)
Wraps Web Audio API's AnalyserNode to produce amplitude values for lip-sync:
- Computes RMS amplitude from `getByteTimeDomainData()`
- Normalizes unsigned byte domain (128 = zero crossing) to [-1, 1]
- Scales by `AMPLITUDE_SCALE_FACTOR` (4.0) and clamps to [0, 1]
- Config: `fftSize=256`, `smoothingTimeConstant=0.3` (from constants)

### AvatarService (`src/services/AvatarService.ts`)
Manages avatar state and Rive integration:
- Expression state machine: idle, listening, thinking, talking
- `AvatarInputs` struct: `mouthOpen` (0-1) + 4 boolean expression flags
- Reads amplitude from AudioAnalyser each frame via `requestAnimationFrame`
- Listens for `avatar:set_expression` events via EventBus
- Loads the Rive animation and applies values to named state-machine inputs
- Clean dispose: cancels animation frame, cleans up Rive instance

### AvatarCanvas (`src/components/AvatarCanvas.tsx`)
React wrapper component:
- Renders a `<canvas>` element with configurable dimensions
- Creates AvatarService on mount, loads Rive with canvas ref
- Exposes service via `onServiceReady` callback
- Cleans up on unmount

## Key design decisions

1. **AudioAnalyser is decoupled from AvatarService**: AudioAnalyser wraps the raw AnalyserNode; AvatarService consumes it via `setAudioAnalyser()`. This keeps each class focused and testable independently.
2. **Expression as simple string union**: Uses `AvatarExpression` type ("idle" | "listening" | "thinking" | "talking") rather than a state machine library — the transitions are driven externally by SessionManager.
3. **Rive loaded dynamically**: `import("@rive-app/canvas")` in `loadRive()` keeps the bundle smaller and avoids SSR issues in Next.js.
4. **Asset/code coupling**: The Rive asset contract is defined implicitly in code by the expected state-machine and input names, rather than by a typed interface.

## Test results

- `AudioAnalyser.test.ts`: 7 tests — silence, amplitude range, RMS calc, scaling, max/min, consistency
- `AvatarService.test.ts`: 9 tests — state transitions, EventBus integration, mouth open, dispose
- All 70 tests across 9 suites passing

## Notes for Phase 5 integration

- Create AudioAnalyser: `new AudioAnalyser(audioPlaybackService.getAnalyserNode())`
- Pass to AvatarService: `avatarService.setAudioAnalyser(analyser)`
- Drive expressions from Realtime API events:
  - `speech_started` → `avatarService.setExpression("listening")`
  - `speech_stopped` → `avatarService.setExpression("thinking")`
  - first `audio.delta` → `avatarService.setExpression("talking")`
  - `response.done` → `avatarService.setExpression("idle")`

## Current Status

- The live app now uses a procedural canvas avatar rather than a Rive-driven one.
- `AvatarService` still owns expression state and audio-driven mouth animation, but it renders those states directly with canvas drawing commands.
- The old `.riv` asset remains in the repository as a legacy artifact and is not used by the current UI.
