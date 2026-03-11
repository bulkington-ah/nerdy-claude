# Latency Analysis

## Target: Sub-second End-to-End

| Stage | Measurement | Target | Max Acceptable |
|-------|-------------|--------|----------------|
| Input Processing | speech_stopped → response.created | 200ms | 400ms |
| Time to First Audio | response.created → output_audio_buffer.started | 300ms | 500ms |
| Full Response | output_audio_buffer.started → response.output_audio.done | 2000ms | 3000ms |
| End-to-End | speech_stopped → output_audio_buffer.started | 500ms | 1000ms |

## Why This Architecture is Fast

### Collapsed Pipeline (300-500ms e2e)

Traditional approach:
```
[Mic] → [STT: 200-400ms] → [LLM: 300-500ms] → [TTS: 200-400ms] → [Speaker]
Total: 700-1300ms
```

Our approach:
```
[Mic track] → [OpenAI Realtime API: 300-500ms all-in-one] → [Remote audio track] → [Speaker]
Total: 300-500ms
```

The OpenAI Realtime API processes STT, LLM, and TTS in a single server-side pipeline with internal optimizations that eliminate inter-service latency.

### Zero-Latency Avatar

Rive canvas renders client-side at 60fps. Lip-sync reads from a Web Audio `AnalyserNode` fed by the remote WebRTC stream, with no extra network hop.

### No Server Proxy

Browser connects directly to OpenAI over WebRTC using a short-lived client secret. Audio never passes through our server; the server only exchanges the permanent API key for that client secret.

## How We Measure

`LatencyTracker` records `performance.now()` at each Realtime API event:

```
speech_stopped              → markStart(INPUT_PROCESSING), markStart(END_TO_END)
response.created            → markEnd(INPUT_PROCESSING), markStart(TIME_TO_FIRST_AUDIO)
output_audio_buffer.started → markEnd(TIME_TO_FIRST_AUDIO), markEnd(END_TO_END), markStart(FULL_RESPONSE)
response.output_audio.done  → markEnd(FULL_RESPONSE)
response.done               → finalizeTurn()
```

Metrics are displayed in the LatencyOverlay HUD, color-coded:
- Green: within target
- Yellow: within acceptable range
- Red: exceeds budget

## Optimizations Applied

1. **Collapsed realtime model** — STT, reasoning, and speech synthesis stay inside a single OpenAI realtime session
2. **Short system prompt** — Socratic prompt instructs 15-40 word responses to minimize generation time
3. **Server VAD** — OpenAI handles voice activity detection server-side, avoiding extra client-side coordination
4. **WebRTC media transport** — Mic audio and response audio move on native media tracks instead of a manual PCM append/commit loop

## Notes

- The current `endToEndMs` metric is anchored to `output_audio_buffer.started`, which is closer to audible playback than the old `audio.delta` proxy but is still event-driven rather than speaker-measured.
- `AudioPlaybackService` still contains PCM16 scheduling helpers from an earlier prototype, but the live session path uses the remote WebRTC stream for playback and lip-sync analysis.
