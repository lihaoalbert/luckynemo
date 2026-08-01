// LuckyNemo tests cover video generation provider plugin behavior.
import {
  getProviderHttpMocks,
  installProviderHttpMockCleanup,
} from "openclaw/plugin-sdk/provider-http-test-mocks";
import { expectExplicitVideoGenerationCapabilities } from "openclaw/plugin-sdk/provider-test-contracts";
import { beforeAll, describe, expect, it, vi, type Mock } from "vitest";

const {
  postJsonRequestMock,
  fetchWithTimeoutMock,
  pollProviderOperationJsonMock,
  resolveApiKeyForProviderMock,
} = getProviderHttpMocks();
// The shared mock runtime object carries fetchProviderDownloadResponseMock,
// but the exported ProviderHttpMocks interface omits it; narrow it locally.
const { fetchProviderDownloadResponseMock } = getProviderHttpMocks() as unknown as {
  fetchProviderDownloadResponseMock: Mock;
};

let buildLuckyNemoVideoGenerationProvider: typeof import("./video-generation-provider.js").buildLuckyNemoVideoGenerationProvider;

beforeAll(async () => {
  ({ buildLuckyNemoVideoGenerationProvider } = await import("./video-generation-provider.js"));
});

installProviderHttpMockCleanup();

const VIDEO_BYTES = Buffer.from("fake-video-bytes");

function jsonResponse(payload: unknown): Response {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function mockCreateTask(taskId = "task-1") {
  postJsonRequestMock.mockResolvedValue({
    response: jsonResponse({ taskId, status: "pending" }),
    release: vi.fn(async () => {}),
  });
}

function mockPollPayloads(...payloads: unknown[]) {
  for (const payload of payloads) {
    fetchWithTimeoutMock.mockResolvedValueOnce({
      json: async () => payload,
      headers: new Headers(),
    });
  }
}

function mockVideoDownload() {
  fetchProviderDownloadResponseMock.mockResolvedValueOnce(
    new Response(VIDEO_BYTES, { headers: { "content-type": "video/mp4" } }),
  );
}

function firstPostJsonRequest() {
  const [call] = postJsonRequestMock.mock.calls;
  if (!call) {
    throw new Error("expected LuckyNemo video create request");
  }
  return call[0] as { url?: string; body?: Record<string, unknown>; headers?: Headers };
}

function firstPollRequest() {
  const [call] = pollProviderOperationJsonMock.mock.calls;
  if (!call) {
    throw new Error("expected LuckyNemo video status poll request");
  }
  return call[0] as { url?: string };
}

describe("luckynemo video generation provider", () => {
  it("declares explicit mode capabilities and a generous default timeout", () => {
    const provider = buildLuckyNemoVideoGenerationProvider();

    expectExplicitVideoGenerationCapabilities(provider);
    expect(provider.id).toBe("luckynemo");
    expect(provider.defaultModel).toBe("doubao-seedance-2-0-fast-260128");
    expect(provider.models).toEqual([
      "doubao-seedance-2-0-fast-260128",
      "doubao-seedance-2-0-260128",
      "doubao-seedance-2-0-mini-260615",
    ]);
    expect(provider.defaultTimeoutMs).toBeGreaterThanOrEqual(600_000);
    expect(provider.capabilities.imageToVideo?.maxInputImages).toBe(9);
    expect(provider.capabilities.generate?.supportedDurationSeconds?.[0]).toBe(4);
    expect(provider.capabilities.generate?.supportedDurationSeconds?.at(-1)).toBe(15);
    expect(provider.capabilities.generate?.maxDurationSeconds).toBe(15);
    expect(provider.capabilities.generate?.aspectRatios).toContain("21:9");
    expect(provider.capabilities.imageToVideo?.providerOptions).toEqual({
      "luckynemo.firstFrame": "string",
      "luckynemo.lastFrame": "string",
    });
  });

  it("submits a task, polls until succeeded, and downloads the signed video URL", async () => {
    mockCreateTask();
    mockPollPayloads(
      { status: "running" },
      { status: "succeeded", videoUrl: "https://cdn.example.com/out.mp4?sig=1" },
    );
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    const result = await provider.generateVideo({
      provider: "luckynemo",
      model: "luckynemo/doubao-seedance-2-0-fast-260128",
      prompt: "a kite festival over the beach",
      cfg: {},
    });

    const create = firstPostJsonRequest();
    expect(create.url).toBe("https://kidsai.ibi.ren/v1/video/tasks");
    expect(create.body).toEqual({
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "a kite festival over the beach",
      ratio: "16:9",
      duration: 5,
      resolution: "720p",
    });
    expect(create.headers?.get("Authorization")).toBe("Bearer provider-key");
    expect(create.headers?.get("Content-Type")).toBe("application/json");
    expect(firstPollRequest().url).toBe("https://kidsai.ibi.ren/v1/video/tasks/task-1");
    expect(fetchWithTimeoutMock).toHaveBeenCalledTimes(2);
    expect(result.model).toBe("doubao-seedance-2-0-fast-260128");
    expect(result.metadata).toEqual({ taskId: "task-1" });
    expect(result.videos).toHaveLength(1);
    expect(result.videos[0]?.mimeType).toBe("video/mp4");
    expect(result.videos[0]?.fileName).toBe("video-1.mp4");
    expect(result.videos[0]?.buffer?.equals(VIDEO_BYTES)).toBe(true);
    expect(result.videos[0]?.metadata).toEqual({
      sourceUrl: "https://cdn.example.com/out.mp4?sig=1",
    });
  });

  it("maps durationSeconds, aspectRatio, and resolution onto the task body", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/mapped.mp4" });
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    await provider.generateVideo({
      provider: "luckynemo",
      model: "doubao-seedance-2-0-260128",
      prompt: "mapped params",
      cfg: {},
      durationSeconds: 8,
      aspectRatio: "9:16",
      resolution: "1080P",
    });

    expect(firstPostJsonRequest().body).toEqual({
      model: "doubao-seedance-2-0-260128",
      prompt: "mapped params",
      ratio: "9:16",
      duration: 8,
      resolution: "1080p",
    });
  });

  it("accepts durations at both ends of the supported 4-15s window", async () => {
    const provider = buildLuckyNemoVideoGenerationProvider();
    for (const [durationSeconds, expected] of [
      [4, 4],
      [15, 15],
      [4.4, 4],
    ] as const) {
      postJsonRequestMock.mockClear();
      mockCreateTask();
      mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/duration.mp4" });
      mockVideoDownload();

      await provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "duration boundary",
        cfg: {},
        durationSeconds,
      });

      expect(firstPostJsonRequest().body?.duration).toBe(expected);
    }
  });

  it("rejects out-of-range durations with the supported window", async () => {
    const provider = buildLuckyNemoVideoGenerationProvider();
    for (const durationSeconds of [2, 99]) {
      await expect(
        provider.generateVideo({
          provider: "luckynemo",
          model: "doubao-seedance-2-0-fast-260128",
          prompt: "out of range",
          cfg: {},
          durationSeconds,
        }),
      ).rejects.toThrow("LuckyNemo video duration must be between 4 and 15 seconds.");
    }
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("rejects unsupported aspect ratios before submitting", async () => {
    const provider = buildLuckyNemoVideoGenerationProvider();
    for (const aspectRatio of ["7:3", "abc"]) {
      await expect(
        provider.generateVideo({
          provider: "luckynemo",
          model: "doubao-seedance-2-0-fast-260128",
          prompt: "bad ratio",
          cfg: {},
          aspectRatio,
        }),
      ).rejects.toThrow(
        "LuckyNemo video aspect ratio must be one of 16:9, 9:16, 1:1, 4:3, 3:4, 21:9.",
      );
    }
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("accepts the 21:9 aspect ratio", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/wide.mp4" });
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    await provider.generateVideo({
      provider: "luckynemo",
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "wide",
      cfg: {},
      aspectRatio: "21:9",
    });

    expect(firstPostJsonRequest().body?.ratio).toBe("21:9");
  });

  it("forwards a single reference image as a one-element image_urls array", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/i2v.mp4" });
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    await provider.generateVideo({
      provider: "luckynemo",
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "animate this",
      cfg: {},
      inputImages: [{ url: "https://example.com/input.png" }],
    });

    expect(firstPostJsonRequest().body?.image_urls).toEqual(["https://example.com/input.png"]);
  });

  it("forwards mixed URL and buffer reference images in order", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/i2v-multi.mp4" });
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    await provider.generateVideo({
      provider: "luckynemo",
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "animate these",
      cfg: {},
      inputImages: [
        { url: "https://example.com/first.png" },
        { buffer: Buffer.from("fake-input"), mimeType: "image/png" },
        { url: "https://example.com/third.jpg" },
      ],
    });

    expect(firstPostJsonRequest().body?.image_urls).toEqual([
      "https://example.com/first.png",
      `data:image/png;base64,${Buffer.from("fake-input").toString("base64")}`,
      "https://example.com/third.jpg",
    ]);
  });

  it("rejects more than nine reference images", async () => {
    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "too many",
        cfg: {},
        inputImages: Array.from({ length: 10 }, (_, index) => ({
          url: `https://example.com/${index}.png`,
        })),
      }),
    ).rejects.toThrow("LuckyNemo image-to-video supports at most 9 input images.");
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("forwards firstFrame/lastFrame as a pair", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/frames.mp4" });
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    await provider.generateVideo({
      provider: "luckynemo",
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "interpolate",
      cfg: {},
      providerOptions: {
        "luckynemo.firstFrame": "https://example.com/first.png",
        "luckynemo.lastFrame": { buffer: Buffer.from("last-frame"), mimeType: "image/png" },
      },
    });

    const body = firstPostJsonRequest().body;
    expect(body?.firstFrame).toBe("https://example.com/first.png");
    expect(body?.lastFrame).toBe(
      `data:image/png;base64,${Buffer.from("last-frame").toString("base64")}`,
    );
    expect(body).not.toHaveProperty("image_urls");
  });

  it("rejects an unpaired firstFrame/lastFrame", async () => {
    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "unpaired",
        cfg: {},
        providerOptions: {
          "luckynemo.firstFrame": "https://example.com/first.png",
        },
      }),
    ).rejects.toThrow("LuckyNemo firstFrame and lastFrame must be provided together.");
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("rejects firstFrame/lastFrame combined with reference images", async () => {
    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "mixed frames",
        cfg: {},
        inputImages: [{ url: "https://example.com/ref.png" }],
        providerOptions: {
          "luckynemo.firstFrame": "https://example.com/first.png",
          "luckynemo.lastFrame": "https://example.com/last.png",
        },
      }),
    ).rejects.toThrow("LuckyNemo firstFrame/lastFrame cannot be combined with reference images.");
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("unwraps the upstream JSON message from HTTP 502 responses", async () => {
    postJsonRequestMock.mockResolvedValue({
      response: new Response(
        JSON.stringify({
          error: {
            message: JSON.stringify({
              code: "InvalidParameter",
              message: "duration is not supported for this model",
            }),
          },
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      ),
      release: vi.fn(async () => {}),
    });

    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "bad param",
        cfg: {},
      }),
    ).rejects.toThrow(
      "LuckyNemo video generation failed: duration is not supported for this model",
    );
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
  });

  it("falls back to the raw message when the 502 body is not embedded JSON", async () => {
    postJsonRequestMock.mockResolvedValue({
      response: new Response(JSON.stringify({ error: { message: "upstream timeout" } }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      }),
      release: vi.fn(async () => {}),
    });

    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "raw upstream message",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo video generation failed: upstream timeout");
  });

  it("forwards a local reference image as a data URL for image-to-video", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/i2v-local.mp4" });
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    await provider.generateVideo({
      provider: "luckynemo",
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "animate this local image",
      cfg: {},
      inputImages: [{ buffer: Buffer.from("fake-input"), mimeType: "image/png" }],
    });

    expect(firstPostJsonRequest().body?.image_urls).toEqual([
      `data:image/png;base64,${Buffer.from("fake-input").toString("base64")}`,
    ]);
  });

  it("honors a configured baseUrl for submit and poll", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "succeeded", videoUrl: "https://cdn.example.com/custom.mp4" });
    mockVideoDownload();

    const provider = buildLuckyNemoVideoGenerationProvider();
    await provider.generateVideo({
      provider: "luckynemo",
      model: "doubao-seedance-2-0-fast-260128",
      prompt: "custom base",
      cfg: {
        models: {
          providers: { luckynemo: { baseUrl: "https://proxy.example.com/v1/", models: [] } },
        },
      },
    });

    expect(firstPostJsonRequest().url).toBe("https://proxy.example.com/v1/video/tasks");
    expect(firstPollRequest().url).toBe("https://proxy.example.com/v1/video/tasks/task-1");
  });

  it("surfaces task failure details from status polling", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "failed", error: { message: "prompt rejected by moderation" } });

    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "moderated",
        cfg: {},
      }),
    ).rejects.toThrow("prompt rejected by moderation");
    expect(fetchProviderDownloadResponseMock).not.toHaveBeenCalled();
  });

  it("falls back to a generic failure message when the task fails without details", async () => {
    mockCreateTask();
    mockPollPayloads({ status: "failed" });

    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "failed",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo video generation failed");
  });

  it("times out when the task never finishes", async () => {
    mockCreateTask();
    fetchWithTimeoutMock.mockResolvedValue({
      json: async () => ({ status: "running" }),
      headers: new Headers(),
    });

    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "never finishes",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo video generation task task-1 did not finish in time");
  });

  it("rejects create responses without a taskId before polling", async () => {
    postJsonRequestMock.mockResolvedValue({
      response: jsonResponse({ status: "pending" }),
      release: vi.fn(async () => {}),
    });

    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "missing id",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo video generation response missing taskId");
    expect(fetchWithTimeoutMock).not.toHaveBeenCalled();
  });

  it("rejects video reference inputs", async () => {
    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "video input",
        cfg: {},
        inputVideos: [{ url: "https://example.com/ref.mp4" }],
      }),
    ).rejects.toThrow("LuckyNemo video generation does not support video reference inputs.");
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });

  it("throws a clear error when the API key is missing", async () => {
    resolveApiKeyForProviderMock.mockResolvedValueOnce({ apiKey: "" });

    const provider = buildLuckyNemoVideoGenerationProvider();
    await expect(
      provider.generateVideo({
        provider: "luckynemo",
        model: "doubao-seedance-2-0-fast-260128",
        prompt: "x",
        cfg: {},
      }),
    ).rejects.toThrow("LuckyNemo API key missing");
    expect(postJsonRequestMock).not.toHaveBeenCalled();
  });
});
