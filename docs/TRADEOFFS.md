# Tradeoffs

## Collapsed vs Composable Pipeline

**Chose: Collapsed (OpenAI Realtime API)**

| | Collapsed | Composable (Deepgram + GPT + ElevenLabs) |
|---|---|---|
| Latency | 300-500ms | 700-1300ms |
| Complexity | Single WebSocket | 3 services, 3 APIs |
| Cost | Single API billing | 3 separate billings |
| Flexibility | Locked to OpenAI voices/models | Mix and match providers |
| Interruption | Built-in barge-in | Must implement manually |

**Why**: Latency is the primary constraint for a real-time tutoring experience. The ~400ms savings from collapsing the pipeline is significant for conversational flow.

**Tradeoff**: Vendor lock-in to OpenAI. Cannot swap individual components (e.g., use a better TTS voice from ElevenLabs).

## Rive vs Simli (Video Avatar)

**Chose: Rive canvas**

| | Rive | Simli |
|---|---|---|
| Latency | 0ms (client-side) | 200-500ms (API call) |
| Cost | Free (runtime) | Per-minute API pricing |
| Realism | 2D animated | Photorealistic deepfake |
| Customization | Full control via Rive editor | Limited to provided avatars |

**Why**: Zero latency is critical. Adding 200-500ms for a video avatar API would double our e2e latency.

**Tradeoff**: Less realistic avatar. A 2D Rive animation is clearly not a real person, which may be less engaging for some students.

## ScriptProcessorNode vs AudioWorklet

**Chose: ScriptProcessorNode**

ScriptProcessorNode runs on the main thread and is deprecated. AudioWorklet runs on a separate thread and is the modern approach.

**Why**: Simpler implementation, widely supported, sufficient for our buffer sizes. The main-thread cost of processing 4096-sample buffers at 24kHz is negligible.

**Tradeoff**: Could cause audio glitches under heavy main-thread load. For production, AudioWorklet would be more robust.

## Server VAD vs Client VAD

**Chose: Server VAD (OpenAI built-in)**

**Why**: OpenAI's Realtime API includes server-side VAD with configurable threshold and silence duration. Using it eliminates the need for client-side VAD processing and ensures consistent behavior.

**Tradeoff**: Slightly less responsive than client-side VAD since audio must travel to the server before VAD triggers. In practice, the difference is minimal (~50ms).

## No Subject Selector

**Chose: Open-ended conversation**

**Why**: The Socratic method works across subjects. Forcing subject selection adds friction and limits the tutor's flexibility. The student just starts talking.

**Tradeoff**: The system prompt can't be as deeply specialized for a specific subject. A math-specific tutor could have better scaffolding prompts than a general-purpose one.
