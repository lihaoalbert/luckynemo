// LuckyNemo tests cover image generation provider plugin behavior.
import {
  getProviderHttpMocks,
  installProviderHttpMockCleanup,
} from "openclaw/plugin-sdk/provider-http-test-mocks";
import { beforeAll, describe, expect, it, vi, type Mock } from "vitest";

const { postJsonRequestMock, resolveApiKeyForProviderMock } = getProviderHttpMocks();
// The shared mock runtime object carries fetchProviderDownloadResponseMock,
// but the exported ProviderHttpMocks interface omits it; narrow it locally.
const { fetchProviderDownloadResponseMock } = getProviderHttpMocks() as unknown as {
  fetchProviderDownloadResponseMock: Mock;
};

let buildLuckyNemoImageGenerationProvider: typeof import("./image-generation-provider.js").buildLuckyNemoImageGenerationProvider;

beforeAll(async () => {
  ({ buildLuckyNemoImageGenerationProvider } = await import("./image-generation-provider.js"));
});

installProviderHttpMockCleanup();

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const JPEG_BYTES = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function mockB64ImageResponse(payload?: unknown) {
  postJsonRequestMock.mockResolvedValue({
    response: jsonResponse(
      payload ?? { created: 1, data: [{ b64_json: PNG_BYTES.toString("base64") }] },
    ),
    release: vi.fn(async () => {}),
  });
}

function firstPostJsonRequest() {
  const [call] = postJsonRequestMock.mock.calls;
  if (!call) {
    throw new Error("expected LuckyNemo image create request");
  }
  return call[0] as { url?: string; body?: Record<string, unknown>; headers?: Headers };
}

describe("luckynemo image generation provider", () => {
  it("declares luckynemo id, default model, and edit capabilities", () => {
    const provider = buildLuckyNemoImageGenerationProvider();

    expect(provider.id).toBe("luckynemo");
    expect(provider.label).toBe("LuckyNemo");
    expect(provider.defaultModel).toBe("doubao-seedream-5-0-260128");
    expect(provider.models).toEqual(["doubao-seedream-5-0-260128"]);
    expect(provider.defaultTimeoutMs).toBe(180_000);
    expect(provider.capabilities.generate).toMatchObject({ maxCount: 4, supportsSize: true });
    expect(provider.capabilities.edit).toMatchObject({ enabled: true, maxInputImages: 1 });
  });

  it("posts an OpenAI-compatible request with bearer auth to the default endpoint", async () => {
    mockB64ImageResponse();

    const provider = buildLuckyNemoImageGenerationProvider();
    const result = await provider.generateImage({
      provider: "luckynemo",
      model: "luckynemo/doubao-seedream-5-0-260128",
      prompt: "a red kite over the sea",
      cfg: {},
      count: 2,
      size: "1024x1024",
    });

    const request = firstPostJsonRequest();
    expect(request.url).toBe("https://kidsai.ibi.ren/v1/images/generations");
    expect(request.body).toEqual({
      model: "doubao-seedream-5-0-260128",
      prompt: "a red kite over the sea",
      n: 2,
      size: "1024x1024",
    });
    expect(request.headers?.get("Authorization")).toBe("Bearer provider-key");
    expect(request.headers?.get("Content-Type")).toBe("application/json");
    expect(result.model).toBe("doubao-seedream-5-0-260128");
    expect(result.images).toHaveLength(1);
    expect(result.images[0]?.mimeType).toBe("image/png");
    expect(result.images[0]?.buffer.equals(PNG_BYTES)).toBe(true);
  });

  it("normalizes configured baseUrl with and without the /v1 suffix", async () => {
    const cases = [
      { configured: "https://proxy.example.com/v1/", expected: "https://proxy.example.com/v1" },
      { configured: "https://proxy.example.com", expected: "https://proxy.example.com/v1" },
    ] as const;
    for (const { configured, expected } of cases) {
      postJsonRequestMock.mockClear();
      mockB64ImageResponse();

      const provider = buildLuckyNemoImageGenerationProvider();
      await provider.generateImage({
        provider: "luckynemo",
        model: "doubao-seedream-5-0-260128",
        prompt: "custom endpoint",
        cfg: { models: { providers: { luckynemo: { baseUrl: configured, models: [] } } } },
      });

      expect(firstPostJsonRequest().url).toBe(`${expected}/images/generations`);
    }
  });

  it("downloads url-based image results immediately", async () => {
    mockB64ImageResponse({ created: 1, data: [{ url: "https://cdn.example.com/out.jpeg" }] });
    fetchProviderDownloadResponseMock.mockResolvedValueOnce(
      new Response(JPEG_BYTES, { headers: { "content-type": "image/jpeg" } }),
    );

    const provider = buildLuckyNemoImageGenerationProvider();
    const result = await provider.generateImage({
      provider: "luckynemo",
      model: "doubao-seedream-5-0-260128",
      prompt: "url result",
      cfg: {},
    });

    expect(
      (fetchProviderDownloadResponseMock.mock.calls[0]?.[0] as { url?: string } | undefined)?.url,
    ).toBe("https://cdn.example.com/out.jpeg");
    expect(result.images[0]?.mimeType).toBe("image/jpeg");
    expect(result.images[0]?.fileName).toBe("image-1.jpg");
    expect(result.images[0]?.buffer.equals(JPEG_BYTES)).toBe(true);
  });

  it("sends the reference image as a data URL for image-to-image requests", async () => {
    mockB64ImageResponse();

    const provider = buildLuckyNemoImageGenerationProvider();
    await provider.generateImage({
      provider: "luckynemo",
      model: "doubao-seedream-5-0-260128",
      prompt: "repaint this",
      cfg: {},
      inputImages: [{ buffer: Buffer.from("fake-input"), mimeType: "image/png" }],
    });

    expect(firstPostJsonRequest().body).toEqual({
      model: "doubao-seedream-5-0-260128",
      prompt: "repaint this",
      n: 1,
      image_url: `data:image/png;base64,${Buffer.from("fake-input").toString("base64")}`,
    });
  });

  it("rejects more than one reference image", async () => {
    const provider = buildLuckyNemoImageGenerationProvider();
    await expect(
      provider.generateImage({
        provider: "luckynemo",
        model: "doubao-seedream-5-0-260128",
        prompt: "too many",
        cfg: {},
        inputImages: [
          { buffer: Buffer.from("a"), mimeType: "image/png" },
          { buffer: Buffer.from("b"), mimeType: "image/png" },
        ],
      }),
    ).rejects.toThrow("LuckyNemo image generation supports one reference image.");
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when the API key is missing", async () => {
    resolveApiKeyForProviderMock.mockResolvedValueOnce({ apiKey: "" });

    const provider = buildLuckyNemoImageGenerationProvider();
    await expect(
      provider.generateImage({
        provider: "luckynemo",
        model: "doubao-seedream-5-0-260128",
        prompt: "x",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo API key missing");
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("rejects responses without image data", async () => {
    mockB64ImageResponse({ created: 1, data: [] });

    const provider = buildLuckyNemoImageGenerationProvider();
    await expect(
      provider.generateImage({
        provider: "luckynemo",
        model: "doubao-seedream-5-0-260128",
        prompt: "empty",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo image generation response missing image data");
  });

  it("rejects malformed image entries", async () => {
    mockB64ImageResponse({ created: 1, data: [{ revised_prompt: "no payload" }] });

    const provider = buildLuckyNemoImageGenerationProvider();
    await expect(
      provider.generateImage({
        provider: "luckynemo",
        model: "doubao-seedream-5-0-260128",
        prompt: "malformed",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo image generation response malformed");
  });
});
