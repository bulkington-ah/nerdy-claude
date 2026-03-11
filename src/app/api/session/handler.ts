import { REALTIME_MODEL, REALTIME_VOICE } from "@/config/constants";

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
    const response = await fetch("https://api.openai.com/v1/realtime/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: REALTIME_MODEL,
        voice: REALTIME_VOICE,
      }),
    });

    if (!response.ok) {
      return {
        body: { error: `OpenAI API error: ${response.status} ${response.statusText}` },
        status: 502,
      };
    }

    const data = await response.json();
    return {
      body: {
        clientSecret: data.client_secret.value,
        expiresAt: data.client_secret.expires_at,
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
