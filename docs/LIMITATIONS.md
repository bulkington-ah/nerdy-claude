# Known Limitations

## Technical

1. **ScriptProcessorNode deprecation** — MicCapture uses the deprecated ScriptProcessorNode API. Should migrate to AudioWorklet for production use.

2. **No Rive asset** — The `public/tutor-avatar.riv` file needs to be created in the Rive editor with a `TutorStateMachine` state machine containing inputs: `mouthOpen` (Number), `isTalking`, `isListening`, `isThinking`, `isIdle` (Booleans).

3. **Single concurrent session** — SessionManager supports one session at a time. No multi-user or multi-tab handling.

4. **No persistent conversation** — Conversation history is lost on page refresh. No database or session storage.

5. **No error recovery** — If the WebSocket disconnects mid-session, the user must manually restart. No automatic reconnection.

6. **Browser compatibility** — Requires modern browser with WebSocket, AudioContext, getUserMedia support. No Safari AudioWorklet fallback.

## Pedagogical

1. **No progress tracking** — No way to track student learning over time or across sessions.

2. **No curriculum alignment** — The Socratic prompt is general-purpose. It doesn't align to specific curricula, standards, or learning objectives.

3. **No assessment** — The tutor asks questions but doesn't formally assess understanding or generate reports.

4. **Prompt-only pedagogy** — All Socratic behavior is driven by the system prompt. The model may occasionally break character and provide direct answers despite instructions.

5. **Single modality** — Audio-only interaction. No support for images, diagrams, equations, or code that would help in STEM subjects.

## Infrastructure

1. **Ephemeral key expiration** — Keys expire after ~60 seconds. Long sessions need key refresh logic (not implemented).

2. **No rate limiting** — The `/api/session` endpoint has no rate limiting or authentication.

3. **Cost monitoring** — No tracking of OpenAI API usage or cost per session.

4. **No logging/telemetry** — No server-side logging of sessions, errors, or latency metrics for operational monitoring.
