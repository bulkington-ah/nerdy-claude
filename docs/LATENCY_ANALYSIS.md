# Latency Analysis

## Target: Sub-second End-to-End

| Stage | Measurement | Target | Max Acceptable |
|-------|-------------|--------|----------------|
| Input Processing | speech_stopped → response.created | 200ms | 400ms |
| Time to First Audio | response.created → first audio.delta | 300ms | 500ms |
| Full Response | first audio.delta → response.done | 2000ms | 3000ms |
| End-to-End | speech_stopped → first audio plays | 500ms | 1000ms |

## Why This Architecture is Fast

### Collapsed Pipeline (300-500ms e2e)

Traditional approach:
```
[Mic] → [STT: 200-400ms] → [LLM: 300-500ms] → [TTS: 200-400ms] → [Speaker]
Total: 700-1300ms
```

Our approach:
```
[Mic] → [OpenAI Realtime API: 300-500ms all-in-one] → [Speaker]
Total: 300-500ms
```

The OpenAI Realtime API processes STT, LLM, and TTS in a single server-side pipeline with internal optimizations that eliminate inter-service latency.

### Zero-Latency Avatar

Rive canvas renders client-side at 60fps. Lip-sync reads from Web Audio AnalyserNode — no network call, no API, just a `getByteTimeDomainData()` read per frame (~0.1ms).

### No Server Proxy

Browser connects directly to OpenAI via WebSocket using an ephemeral key. Audio never passes through our server — only the one-time key exchange does.

## How We Measure

**LatencyTracker** records `performance.now()` at each Realtime API event:

```
speech_stopped         → markStart(INPUT_PROCESSING), markStart(END_TO_END)
response.created       → markEnd(INPUT_PROCESSING), markStart(TIME_TO_FIRST_AUDIO)
first audio.delta      → markEnd(TIME_TO_FIRST_AUDIO), markEnd(END_TO_END), markStart(FULL_RESPONSE)
response.done          → markEnd(FULL_RESPONSE), finalizeTurn()
```

Metrics are displayed in the LatencyOverlay HUD, color-coded:
- Green: within target
- Yellow: within acceptable range
- Red: exceeds budget

## Optimizations Applied

1. **Gapless audio scheduling** — AudioBufferSourceNodes scheduled with precise start times to avoid gaps between chunks
2. **Short system prompt** — Socratic prompt instructs 15-40 word responses to minimize generation time
3. **Server VAD** — OpenAI handles voice activity detection server-side, avoiding client-side processing delay
4. **ScriptProcessorNode** — Direct PCM16 conversion without resampling (mic captured at 24kHz)
