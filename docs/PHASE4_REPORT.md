# Phase 4: Rive Avatar + Lip-sync — Implementation Report

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
- Loads Rive animation with `TutorStateMachine` state machine
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
4. **Placeholder Rive asset**: The `.riv` file at `public/tutor-avatar.riv` needs to be created in Rive editor with a `TutorStateMachine` containing `mouthOpen`, `isTalking`, `isListening`, `isThinking`, `isIdle` inputs.

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
- The Rive `.riv` asset still needs to be created with the expected state machine inputs
