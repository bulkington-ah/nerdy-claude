# Known Limitations

## Technical

1. **Transcript is assistant-only** — `ConversationStore` currently records streamed assistant transcript text, but the user's spoken turns are not added to the transcript panel.

2. **Avatar visuals are simple by design** — The current avatar is a procedural canvas drawing with a small set of expression states. It is responsive, but not especially rich or realistic.

3. **Single concurrent session** — `SessionManager` supports one session at a time. There is no explicit multi-user or multi-tab coordination.

4. **No persistent conversation** — Conversation history is lost on refresh. There is no database or session storage.

5. **No error recovery** — If the WebRTC or data-channel session disconnects mid-session, the user must manually restart. There is no reconnect or renegotiation flow.

6. **Browser compatibility** — Requires modern browser support for WebRTC, `AudioContext`, and `getUserMedia`.

7. **Legacy prototype code remains in the repo** — `src/lib/MicCapture.ts`, the PCM enqueue path in `AudioPlaybackService`, and the unused `.riv` asset reflect earlier experiments and are not part of the current session flow.

## Pedagogical

1. **No progress tracking** — No way to track student learning over time or across sessions.

2. **No curriculum alignment** — The Socratic prompt is general-purpose. It does not align to specific curricula, standards, or learning objectives.

3. **No assessment** — The tutor asks questions but does not formally assess understanding or generate reports.

4. **Prompt-only pedagogy** — All Socratic behavior is driven by the system prompt. The model may occasionally break character and provide direct answers despite instructions.

5. **Single modality** — Audio-only interaction. There is no support for images, diagrams, equations, or code that would help in STEM subjects.

## Infrastructure

1. **Session bootstrap has no retry strategy** — `/api/session` and the SDP exchange are attempted once per start. Failures fall back to `idle` without backoff or retry guidance.

2. **No rate limiting** — The `/api/session` endpoint has no rate limiting or authentication.

3. **Cost monitoring** — No tracking of OpenAI API usage or cost per session.

4. **No logging or telemetry** — No server-side logging of sessions, errors, or latency metrics for operational monitoring.
