import { REALTIME_MODEL, REALTIME_VOICE, VAD_CONFIG } from "@/config/constants";
import { SocraticPrompt } from "@/lib/SocraticPrompt";

export interface HandlerResult {
  body: Record<string, unknown>;
  status: number;
}

// Extracted handler logic so it can be tested without Next.js runtime
export async function createSessionHandler(): Promise<HandlerResult> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      body: { error: "OPENAI_API_KEY is not configured" },
      status: 500,
    };
  }

  try {
    const response = await fetch("https://api.openai.com/v1/realtime/client_secrets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        session: {
          type: "realtime",
          model: REALTIME_MODEL,
          instructions: SocraticPrompt.build(),
          audio: {
            output: {
              voice: REALTIME_VOICE,
            },
          },
          turn_detection: { ...VAD_CONFIG },
        },
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      return {
        body: { error: `OpenAI API error: ${response.status} ${text}` },
        status: 502,
      };
    }

    const data = await response.json();
    return {
      body: {
        clientSecret: data.value,
        expiresAt: data.expires_at,
      },
      status: 200,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return {
      body: { error: `Failed to create session: ${message}` },
      status: 502,
    };
  }
}
