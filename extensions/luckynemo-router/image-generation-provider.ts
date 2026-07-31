// LuckyNemo image generation provider talks to the platform proxy's
// OpenAI-compatible /images/generations endpoint.
import {
  generatedImageAssetFromBase64,
  sniffImageMimeType,
  toImageDataUrl,
  type GeneratedImageAsset,
  type ImageGenerationProvider,
  type ImageGenerationRequest,
} from "openclaw/plugin-sdk/image-generation";
import { isProviderApiKeyConfigured } from "openclaw/plugin-sdk/provider-auth";
import { resolveApiKeyForProvider } from "openclaw/plugin-sdk/provider-auth-runtime";
import {
  assertOkOrThrowHttpError,
  createProviderOperationDeadline,
  fetchProviderDownloadResponse,
  postJsonRequest,
  readProviderJsonResponse,
  resolveProviderHttpRequestConfig,
  resolveProviderOperationTimeoutMs,
  sanitizeConfiguredModelProviderRequest,
} from "openclaw/plugin-sdk/provider-http";
import { readResponseWithLimit } from "openclaw/plugin-sdk/response-limit-runtime";
import {
  asFiniteNumber,
  isRecord,
  normalizeOptionalString,
} from "openclaw/plugin-sdk/string-coerce-runtime";
import { normalizeLuckyNemoRouterApiBaseUrl } from "./provider-catalog.js";

const PROVIDER_ID = "luckynemo";
const DEFAULT_IMAGE_MODEL = "doubao-seedream-5-0-260128";
const IMAGE_MODELS = [DEFAULT_IMAGE_MODEL] as const;
const DEFAULT_TIMEOUT_MS = 180_000;
const MAX_IMAGE_COUNT = 4;
const MAX_INPUT_IMAGES = 1;
const DEFAULT_IMAGE_MIME_TYPE = "image/png";
const DEFAULT_GENERATED_IMAGE_MAX_BYTES = 16 * 1024 * 1024;

type LuckyNemoImagesResponse = {
  data?: unknown;
};

function resolveConfiguredBaseUrl(req: ImageGenerationRequest): string {
  const configured = req.cfg?.models?.providers?.[PROVIDER_ID]?.baseUrl;
  return normalizeLuckyNemoRouterApiBaseUrl(
    typeof configured === "string" ? configured : undefined,
  );
}

function normalizeLuckyNemoImageModel(model: string | undefined): string {
  const normalized = normalizeOptionalString(model)?.replace(/^luckynemo\//iu, "");
  return normalized ?? DEFAULT_IMAGE_MODEL;
}

function resolveImageCount(req: ImageGenerationRequest): number {
  const count = asFiniteNumber(req.count);
  if (count == null) {
    return 1;
  }
  return Math.max(1, Math.min(MAX_IMAGE_COUNT, Math.round(count)));
}

// The proxy accepts a remote URL or a base64 data URL for the optional
// reference image (image_url), matching the doubao-seedream request shape.
function resolveReferenceImageUrl(req: ImageGenerationRequest): string | undefined {
  const input = req.inputImages?.[0];
  if (!input) {
    return undefined;
  }
  return toImageDataUrl({
    buffer: input.buffer,
    mimeType: normalizeOptionalString(input.mimeType) ?? DEFAULT_IMAGE_MIME_TYPE,
  });
}

function resolveGeneratedImageMaxBytes(req: ImageGenerationRequest): number {
  const configured = req.cfg.agents?.defaults?.mediaMaxMb;
  if (typeof configured === "number" && Number.isFinite(configured) && configured > 0) {
    return Math.floor(configured * 1024 * 1024);
  }
  return DEFAULT_GENERATED_IMAGE_MAX_BYTES;
}

async function downloadGeneratedImage(params: {
  url: string;
  index: number;
  timeoutMs: number;
  fetchFn: typeof fetch;
  maxBytes: number;
}): Promise<GeneratedImageAsset> {
  const response = await fetchProviderDownloadResponse({
    url: params.url,
    init: { method: "GET" },
    timeoutMs: params.timeoutMs,
    fetchFn: params.fetchFn,
    provider: PROVIDER_ID,
    requestFailedMessage: "LuckyNemo generated image download failed",
  });
  const contentType = normalizeOptionalString(response.headers.get("content-type"))?.split(";")[0];
  const buffer = await readResponseWithLimit(response, params.maxBytes, {
    onOverflow: ({ maxBytes }) =>
      new Error(`LuckyNemo generated image download exceeds ${maxBytes} bytes`),
  });
  // Sniff magic bytes first: proxy/CDN content-type headers are not always
  // reliable for signed image URLs.
  const detected = sniffImageMimeType(buffer, contentType ?? DEFAULT_IMAGE_MIME_TYPE);
  return {
    buffer,
    mimeType: detected.mimeType,
    fileName: `image-${params.index + 1}.${detected.extension}`,
  };
}

async function parseImagesResponse(params: {
  payload: LuckyNemoImagesResponse;
  timeoutMs: number;
  fetchFn: typeof fetch;
  maxBytes: number;
}): Promise<GeneratedImageAsset[]> {
  const data = params.payload.data;
  if (!Array.isArray(data)) {
    throw new Error("LuckyNemo image generation response missing image data");
  }
  const images: GeneratedImageAsset[] = [];
  for (const [index, entry] of data.entries()) {
    if (!isRecord(entry)) {
      throw new Error("LuckyNemo image generation response malformed");
    }
    const base64 = normalizeOptionalString(entry.b64_json);
    if (base64) {
      const image = generatedImageAssetFromBase64({
        base64,
        index,
        sniffMimeType: true,
      });
      if (!image) {
        throw new Error("LuckyNemo image generation response malformed");
      }
      images.push(image);
      continue;
    }
    const url = normalizeOptionalString(entry.url);
    if (!url) {
      throw new Error("LuckyNemo image generation response malformed");
    }
    images.push(
      await downloadGeneratedImage({
        url,
        index,
        timeoutMs: params.timeoutMs,
        fetchFn: params.fetchFn,
        maxBytes: params.maxBytes,
      }),
    );
  }
  return images;
}

export function buildLuckyNemoImageGenerationProvider(): ImageGenerationProvider {
  return {
    id: PROVIDER_ID,
    label: "LuckyNemo",
    defaultModel: DEFAULT_IMAGE_MODEL,
    defaultTimeoutMs: DEFAULT_TIMEOUT_MS,
    models: [...IMAGE_MODELS],
    isConfigured: ({ agentDir }) =>
      isProviderApiKeyConfigured({
        provider: PROVIDER_ID,
        agentDir,
      }),
    capabilities: {
      generate: {
        maxCount: MAX_IMAGE_COUNT,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
      edit: {
        enabled: true,
        maxCount: MAX_IMAGE_COUNT,
        maxInputImages: MAX_INPUT_IMAGES,
        supportsSize: true,
        supportsAspectRatio: false,
        supportsResolution: false,
      },
    },
    async generateImage(req) {
      const inputImages = req.inputImages ?? [];
      if (inputImages.length > MAX_INPUT_IMAGES) {
        throw new Error("LuckyNemo image generation supports one reference image.");
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
        label: "LuckyNemo image generation",
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
          capability: "image",
          transport: "http",
        });

      const model = normalizeLuckyNemoImageModel(req.model);
      const size = normalizeOptionalString(req.size);
      const referenceImageUrl = resolveReferenceImageUrl(req);
      const requestHeaders = new Headers(headers);
      requestHeaders.set("Content-Type", "application/json");
      const create = await postJsonRequest({
        url: `${baseUrl}/images/generations`,
        headers: requestHeaders,
        body: {
          model,
          prompt: req.prompt,
          n: resolveImageCount(req),
          ...(size ? { size } : {}),
          ...(referenceImageUrl ? { image_url: referenceImageUrl } : {}),
        },
        timeoutMs,
        fetchFn: fetch,
        allowPrivateNetwork,
        ssrfPolicy: req.ssrfPolicy,
        dispatcherPolicy,
      });
      try {
        await assertOkOrThrowHttpError(create.response, "LuckyNemo image generation failed");
        const payload = await readProviderJsonResponse<LuckyNemoImagesResponse>(
          create.response,
          "LuckyNemo image generation failed",
        );
        const images = await parseImagesResponse({
          payload,
          timeoutMs,
          fetchFn: fetch,
          maxBytes: resolveGeneratedImageMaxBytes(req),
        });
        if (images.length === 0) {
          throw new Error("LuckyNemo image generation response missing image data");
        }
        return { images, model };
      } finally {
        await create.release();
      }
    },
  };
}
