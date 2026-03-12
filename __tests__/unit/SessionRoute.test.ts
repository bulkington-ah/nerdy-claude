// Test for POST /api/session handler
// Tests the ephemeral key generation logic

import { createSessionHandler } from "@/app/api/session/handler";

// Mock fetch for OpenAI API call
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("POST /api/session", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: "sk-test-key-123" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("should return an ephemeral key on success", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: "ek_test_ephemeral_key",
        expires_at: 1700000000,
      }),
    });

    const result = await createSessionHandler();

    expect(result.status).toBe(200);
    expect(result.body.clientSecret).toBe("ek_test_ephemeral_key");
    expect(result.body.expiresAt).toBe(1700000000);
  });

  it("should call OpenAI client_secrets endpoint with correct parameters", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        value: "ek_test",
        expires_at: 1700000000,
      }),
    });

    await createSessionHandler();

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.openai.com/v1/realtime/client_secrets",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer sk-test-key-123",
          "Content-Type": "application/json",
        }),
      }),
    );

    // Verify the body includes session config
    const callArgs = mockFetch.mock.calls[0][1];
    const body = JSON.parse(callArgs.body);
    expect(body.session).toBeDefined();
    expect(body.session.type).toBe("realtime");
    expect(body.session.model).toBeDefined();
    expect(body.session.audio.input.turn_detection).toBeDefined();
    expect(body.session.audio.input.transcription.model).toBe("whisper-1");
    expect(body.session.audio.output.voice).toBeDefined();
    expect(body.session.instructions).toBeDefined();
  });

  it("should return 500 when OPENAI_API_KEY is missing", async () => {
    delete process.env.OPENAI_API_KEY;

    const result = await createSessionHandler();
    expect(result.status).toBe(500);
    expect(result.body.error).toBeDefined();
  });

  it("should return 502 when OpenAI API returns an error", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      text: async () => "Unauthorized",
    });

    const result = await createSessionHandler();
    expect(result.status).toBe(502);
    expect(result.body.error).toBeDefined();
  });

  it("should return 502 when OpenAI API request fails", async () => {
    mockFetch.mockRejectedValueOnce(new Error("Network error"));

    const result = await createSessionHandler();
    expect(result.status).toBe(502);
    expect(result.body.error).toBeDefined();
  });
});
