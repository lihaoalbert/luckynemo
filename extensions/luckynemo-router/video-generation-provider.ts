// LuckyNemo video generation provider talks to the platform proxy's task-based
// /video/tasks endpoints (doubao-seedance models behind the proxy).
import { toImageDataUrl } from "openclaw/plugin-sdk/image-generation";
import { extensionForMime } from "openclaw/plugin-sdk/media-mime";
import { isProviderApiKeyConfigured } from "openclaw/plugin-sdk/provider-auth";
import { resolveApiKeyForProvider } from "openclaw/plugin-sdk/provider-auth-runtime";
import {
  assertOkOrThrowHttpError,
  createProviderOperationDeadline,
  fetchProviderDownloadResponse,
  pollProviderOperationJson,
  postJsonRequest,
  readProviderJsonResponse,
  resolveProviderHttpRequestConfig,
  resolveProviderOperationTimeoutMs,
  sanitizeConfiguredModelProviderRequest,
  type ProviderOperationDeadline,
} from "openclaw/plugin-sdk/provider-http";
import { readResponseWithLimit } from "openclaw/plugin-sdk/response-limit-runtime";
import { isRecord, normalizeOptionalString } from "openclaw/plugin-sdk/string-coerce-runtime";
import type {
  GeneratedVideoAsset,
  VideoGenerationProvider,
  VideoGenerationRequest,
  VideoGenerationSourceAsset,
} from "openclaw/plugin-sdk/video-generation";
import { normalizeLuckyNemoRouterApiBaseUrl } from "./provider-catalog.js";

const PROVIDER_ID = "luckynemo";
const DEFAULT_VIDEO_MODEL = "doubao-seedance-2-0-fast-260128";
const VIDEO_MODELS = [
  DEFAULT_VIDEO_MODEL,
  "doubao-seedance-2-0-260128",
  "doubao-seedance-2-0-mini-260615",
] as const;
// Seedance tasks take 2.5-5.5 minutes; keep the default operation timeout
// comfortably above the slowest observed generation.
const DEFAULT_TIMEOUT_MS = 600_000;
const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 90;
const DEFAULT_RATIO = "16:9";
const DEFAULT_RESOLUTION = "720p";
const DEFAULT_DURATION_SECONDS = 5;
const MIN_DURATION_SECONDS = 5;
const MAX_DURATION_SECONDS = 10;
const SUPPORTED_DURATION_SECONDS = Array.from(
  { length: MAX_DURATION_SECONDS - MIN_DURATION_SECONDS + 1 },
  (_, index) => MIN_DURATION_SECONDS + index,
);
const SUPPORTED_RATIOS = ["16:9", "4:3", "1:1", "3:4", "9:16"] as const;
const SUPPORTED_RESOLUTIONS = ["480P", "720P", "1080P"] as const;
const MAX_INPUT_IMAGES = 9;
const DEFAULT_GENERATED_VIDEO_MAX_BYTES = 64 * 1024 * 1024;

type LuckyNemoVideoTaskCreateResponse = {
  taskId?: unknown;
  status?: unknown;
};

type LuckyNemoVideoTaskStatusResponse = {
  status?: unknown;
  videoUrl?: unknown;
  error?: unknown;
  message?: unknown;
};

type LuckyNemoVideoTaskStatus = "pending" | "running" | "succeeded" | "failed";

function resolveConfiguredBaseUrl(req: VideoGenerationRequest): string {
  const configured = req.cfg?.models?.providers?.[PROVIDER_ID]?.baseUrl;
  return normalizeLuckyNemoRouterApiBaseUrl(
    typeof configured === "string" ? configured : undefined,
  );
}

function normalizeLuckyNemoVideoModel(model: string | undefined): string {
  const normalized = normalizeOptionalString(model)?.replace(/^luckynemo\//iu, "");
  return normalized ?? DEFAULT_VIDEO_MODEL;
}

function resolveDurationSeconds(value: number | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_DURATION_SECONDS;
  }
  return Math.max(MIN_DURATION_SECONDS, Math.min(MAX_DURATION_SECONDS, Math.round(value)));
}

function resolveRatio(req: VideoGenerationRequest): string {
  return normalizeOptionalString(req.aspectRatio) ?? DEFAULT_RATIO;
}

// The proxy follows the doubao-seedance resolution tokens (480p/720p/1080p);
// core capability tokens are uppercase, so lower-case them on the wire.
function resolveResolution(req: VideoGenerationRequest): string {
  return (normalizeOptionalString(req.resolution) ?? DEFAULT_RESOLUTION).toLowerCase();
}

function resolveReferenceImageUrl(input: VideoGenerationSourceAsset): string {
  const inputUrl = normalizeOptionalString(input.url);
  if (inputUrl) {
    return inputUrl;
  }
  if (!input.buffer) {
    throw new Error("LuckyNemo image-to-video input is missing image data.");
  }
  return toImageDataUrl({ buffer: input.buffer, mimeType: input.mimeType ?? "image/png" });
}

// The proxy accepts up to 9 reference images as `image_urls` (URL or data URL);
// even a single image is sent as an array since the server treats both shapes
// alike.
function resolveReferenceImageUrls(req: VideoGenerationRequest): string[] {
  return (req.inputImages ?? []).map(resolveReferenceImageUrl);
}

function readTaskId(payload: LuckyNemoVideoTaskCreateResponse): string {
  const taskId = normalizeOptionalString(payload.taskId);
  if (!taskId) {
    throw new Error("LuckyNemo video generation response missing taskId");
  }
  return taskId;
}

function readTaskStatus(payload: LuckyNemoVideoTaskStatusResponse): LuckyNemoVideoTaskStatus {
  const status = normalizeOptionalString(payload.status);
  switch (status) {
    case "pending":
    case "running":
    case "succeeded":
    case "failed":
      return status;
    case undefined:
      throw new Error("LuckyNemo video status response missing task status");
    default:
      throw new Error(`LuckyNemo video status response returned unknown task status: ${status}`);
  }
}

function readTaskFailureMessage(payload: LuckyNemoVideoTaskStatusResponse): string | undefined {
  if (readTaskStatus(payload) !== "failed") {
    return undefined;
  }
  const detail = isRecord(payload.error)
    ? normalizeOptionalString(payload.error.message)
    : normalizeOptionalString(payload.error);
  return detail ?? normalizeOptionalString(payload.message) ?? "LuckyNemo video generation failed";
}

async function pollVideoTask(params: {
  taskId: string;
  baseUrl: string;
  headers: Headers;
  deadline: ProviderOperationDeadline;
  fetchFn: typeof fetch;
  allowPrivateNetwork: boolean;
  dispatcherPolicy?: Parameters<typeof postJsonRequest>[0]["dispatcherPolicy"];
}): Promise<LuckyNemoVideoTaskStatusResponse> {
  return await pollProviderOperationJson<LuckyNemoVideoTaskStatusResponse>({
    url: `${params.baseUrl}/video/tasks/${encodeURIComponent(params.taskId)}`,
    headers: () => params.headers,
    deadline: params.deadline,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    fetchFn: params.fetchFn,
    maxAttempts: MAX_POLL_ATTEMPTS,
    pollIntervalMs: POLL_INTERVAL_MS,
    requestFailedMessage: "LuckyNemo video status request failed",
    timeoutMessage: `LuckyNemo video generation task ${params.taskId} did not finish in time`,
    isComplete: (candidate) => readTaskStatus(candidate) === "succeeded",
    getFailureMessage: (candidate) => readTaskFailureMessage(candidate),
    allowPrivateNetwork: params.allowPrivateNetwork,
    dispatcherPolicy: params.dispatcherPolicy,
  });
}

function readVideoUrl(payload: LuckyNemoVideoTaskStatusResponse): string {
  const videoUrl = normalizeOptionalString(payload.videoUrl);
  if (!videoUrl) {
    throw new Error("LuckyNemo video generation completed without a video URL");
  }
  return videoUrl;
}

// The proxy returns a signed videoUrl that expires after ~1 hour, so download
// the bytes immediately instead of forwarding the URL to delivery surfaces.
async function downloadGeneratedVideo(params: {
  url: string;
  timeoutMs: number;
  fetchFn: typeof fetch;
  maxBytes: number;
}): Promise<GeneratedVideoAsset> {
  const response = await fetchProviderDownloadResponse({
    url: params.url,
    init: { method: "GET" },
    timeoutMs: params.timeoutMs,
    fetchFn: params.fetchFn,
    provider: PROVIDER_ID,
    requestFailedMessage: "LuckyNemo generated video download failed",
  });
  const mimeType =
    normalizeOptionalString(response.headers.get("content-type"))?.split(";")[0] ?? "video/mp4";
  const buffer = await readResponseWithLimit(response, params.maxBytes, {
    onOverflow: ({ maxBytes }) =>
      new Error(`LuckyNemo generated video download exceeds ${maxBytes} bytes`),
  });
  return {
    buffer,
    mimeType,
    fileName: `video-1.${extensionForMime(mimeType)?.slice(1) ?? "mp4"}`,
    metadata: {
      sourceUrl: params.url,
    },
  };
}

function resolveGeneratedVideoMaxBytes(req: VideoGenerationRequest): number {
  const configured = req.cfg.agents?.defaults?.mediaMaxMb;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured * 1024 * 1024);
  }
  return DEFAULT_GENERATED_VIDEO_MAX_BYTES;
}

export function buildLuckyNemoVideoGenerationProvider(): VideoGenerationProvider {
  return {
    id: PROVIDER_ID,
    label: "LuckyNemo",
    defaultModel: DEFAULT_VIDEO_MODEL,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    models: [...VIDEO_MODELS],
    isConfigured: ({ agentDir }) =>
      isProviderApiKeyConfigured({
        provider: PROVIDER_ID,
        agentDir,
      }),
    capabilities: {
      generate: {
        maxVideos: 1,
        maxDurationSeconds: MAX_DURATION_SECONDS,
        supportedDurationSeconds: SUPPORTED_DURATION_SECONDS,
        aspectRatios: [...SUPPORTED_RATIOS],
        resolutions: [...SUPPORTED_RESOLUTIONS],
        supportsAspectRatio: true,
        supportsResolution: true,
      },
      imageToVideo: {
        enabled: true,
        maxVideos: 1,
        maxInputImages: MAX_INPUT_IMAGES,
        maxDurationSeconds: MAX_DURATION_SECONDS,
        supportedDurationSeconds: SUPPORTED_DURATION_SECONDS,
        resolutions: [...SUPPORTED_RESOLUTIONS],
        supportsResolution: true,
      },
      videoToVideo: {
        enabled: false,
      },
    },
    async generateVideo(req) {
      if ((req.inputVideos?.length ?? 0) > 0) {
        throw new Error("LuckyNemo video generation does not support video reference inputs.");
      }
      if ((req.inputImages?.length ?? 0) > MAX_INPUT_IMAGES) {
        throw new Error(
          `LuckyNemo image-to-video supports at most ${MAX_INPUT_IMAGES} input images.`,
        );
      }

      const auth = await resolveApiKeyForProvider({
        provider: PROVIDER_ID,
        cfg: req.cfg,
        agentDir: req.agentDir,
        store: req.authStore,
      });
      if (!auth.apiKey) {
        throw new Error("LuckyNemo API key missing");
      }

      const providerConfig = req.cfg?.models?.providers?.[PROVIDER_ID];
      const resolvedBaseUrl = resolveConfiguredBaseUrl(req);
      const deadline = createProviderOperationDeadline({
        timeoutMs: req.timeoutMs,
        label: "LuckyNemo video generation",
      });
      const timeoutMs = resolveProviderOperationTimeoutMs({
        deadline,
        defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
      });
      const { baseUrl, allowPrivateNetwork, headers, dispatcherPolicy } =
        resolveProviderHttpRequestConfig({
          baseUrl: resolvedBaseUrl,
          defaultBaseUrl: resolvedBaseUrl,
          request: sanitizeConfiguredModelProviderRequest(providerConfig?.request),
          defaultHeaders: {
            Authorization: `Bearer ${auth.apiKey}`,
          },
          provider: PROVIDER_ID,
          capability: "video",
          transport: "http",
        });

      const model = normalizeLuckyNemoVideoModel(req.model);
      const referenceImageUrls = resolveReferenceImageUrls(req);
      const requestHeaders = new Headers(headers);
      requestHeaders.set("Content-Type", "application/json");
      const create = await postJsonRequest({
        url: `${baseUrl}/video/tasks`,
        headers: requestHeaders,
        body: {
          model,
          prompt: req.prompt,
          ratio: resolveRatio(req),
          duration: resolveDurationSeconds(req.durationSeconds),
          resolution: resolveResolution(req),
          ...(referenceImageUrls.length > 0 ? { image_urls: referenceImageUrls } : {}),
        },
        timeoutMs,
        fetchFn: fetch,
        allowPrivateNetwork,
        dispatcherPolicy,
      });
      try {
        await assertOkOrThrowHttpError(create.response, "LuckyNemo video generation failed");
        const payload = await readProviderJsonResponse<LuckyNemoVideoTaskCreateResponse>(
          create.response,
          "LuckyNemo video generation failed",
        );
        const taskId = readTaskId(payload);
        const completed = await pollVideoTask({
          taskId,
          baseUrl,
          headers,
          deadline,
          fetchFn: fetch,
          allowPrivateNetwork,
          dispatcherPolicy,
        });
        const videoUrl = readVideoUrl(completed);
        const video = await downloadGeneratedVideo({
          url: videoUrl,
          timeoutMs,
          fetchFn: fetch,
          maxBytes: resolveGeneratedVideoMaxBytes(req),
        });
        return {
          videos: [video],
          model,
          metadata: {
            taskId,
          },
        };
      } finally {
        await create.release();
      }
    },
  };
}
