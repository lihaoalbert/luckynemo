// LuckyNemo Router plugin entrypoint registers credential-scoped model routing and quota reporting.
import {
  definePluginEntry,
  type ProviderAuthMethod,
  type ProviderResolveDynamicModelContext,
  type ProviderRuntimeModel,
} from "openclaw/plugin-sdk/plugin-entry";
import { createProviderApiKeyAuthMethod } from "openclaw/plugin-sdk/provider-auth-api-key";
import { buildProviderReplayFamilyHooks } from "openclaw/plugin-sdk/provider-model-shared";
import { buildProviderToolCompatFamilyHooks } from "openclaw/plugin-sdk/provider-tools";
import {
  buildLuckyNemoRouterProviderConfig,
  normalizeLuckyNemoRouterApiBaseUrl,
  normalizeLuckyNemoRouterRootUrl,
  normalizeLuckyNemoRouterResolvedModel,
} from "./provider-catalog.js";
import { wrapLuckyNemoRouterProviderStream } from "./stream.js";
import { fetchLuckyNemoRouterUsage } from "./usage.js";

const PLUGIN_ID = "luckynemo-router";
const PROVIDER_ID = "luckynemo";
const ENV_VAR = "LUCKYNEMO_API_KEY";

const openAiReplay = buildProviderReplayFamilyHooks({
  family: "openai-compatible",
  dropReasoningFromHistory: false,
});
const anthropicReplay = buildProviderReplayFamilyHooks({
  family: "native-anthropic-by-model",
});
const googleReplay = buildProviderReplayFamilyHooks({ family: "google-gemini" });
const openAiTools = buildProviderToolCompatFamilyHooks("openai");
const deepSeekTools = buildProviderToolCompatFamilyHooks("deepseek");
const geminiTools = buildProviderToolCompatFamilyHooks("gemini");

function buildApiKeyAuth(): ProviderAuthMethod {
  return createProviderApiKeyAuthMethod({
    providerId: PROVIDER_ID,
    methodId: "api-key",
    label: "LuckyNemo proxy key",
    hint: "Credential-scoped access to approved models and budgets",
    optionKey: "luckynemoApiKey",
    flagName: "--luckynemo-api-key",
    envVar: ENV_VAR,
    promptMessage: "Enter LuckyNemo proxy key",
    noteTitle: "LuckyNemo",
    noteMessage: [
      "Use the proxy key issued by your LuckyNemo administrator.",
      "LuckyNemo discovers only the models granted to that key.",
    ].join("\n"),
    wizard: {
      choiceId: "luckynemo-api-key",
      choiceLabel: "LuckyNemo proxy key",
      choiceHint: "Approved models through one managed key",
      groupId: PROVIDER_ID,
      groupLabel: "LuckyNemo",
      groupHint: "Managed model access and quotas",
    },
  });
}

function configuredBaseUrl(
  config: { models?: { providers?: Record<string, { baseUrl?: unknown }> } } | null | undefined,
): string | undefined {
  const value = config?.models?.providers?.[PROVIDER_ID]?.baseUrl;
  return typeof value === "string" ? value : undefined;
}

function dynamicModelScope(ctx: ProviderResolveDynamicModelContext): string {
  return JSON.stringify([
    ctx.agentDir ?? "",
    ctx.workspaceDir ?? "",
    ctx.authProfileId ?? "",
    normalizeLuckyNemoRouterRootUrl(ctx.providerConfig?.baseUrl ?? configuredBaseUrl(ctx.config)),
  ]);
}

function buildRuntimeModels(
  providerConfig: Awaited<ReturnType<typeof buildLuckyNemoRouterProviderConfig>>,
): Map<string, ProviderRuntimeModel> {
  const models = new Map<string, ProviderRuntimeModel>();
  for (const model of providerConfig.models) {
    const api = model.api ?? providerConfig.api;
    const baseUrl = model.baseUrl ?? providerConfig.baseUrl;
    if (!api || !baseUrl) {
      continue;
    }
    models.set(model.id, {
      ...model,
      api,
      baseUrl,
      provider: PROVIDER_ID,
      input: model.input.filter(
        (entry): entry is "text" | "image" => entry === "text" || entry === "image",
      ),
    });
  }
  return models;
}

function resolveToolFamily(modelId: string) {
  const normalized = modelId.toLowerCase();
  if (normalized.startsWith("deepseek/")) {
    return deepSeekTools;
  }
  if (normalized.startsWith("google/")) {
    return geminiTools;
  }
  return openAiTools;
}

export default definePluginEntry({
  id: PLUGIN_ID,
  name: "LuckyNemo Router",
  description:
    "Managed multi-provider model routing and quotas (default endpoint: https://kidsai.ibi.ren (temporary, pending luckynemo.com ICP备案))",
  register(api) {
    const dynamicModels = new Map<string, Map<string, ProviderRuntimeModel>>();

    api.registerProvider({
      id: PROVIDER_ID,
      label: "LuckyNemo",
      docsPath: "/providers/luckynemo-router",
      envVars: [ENV_VAR],
      auth: [buildApiKeyAuth()],
      catalog: {
        order: "simple",
        run: async (ctx) => {
          const auth = ctx.resolveProviderAuth(PROVIDER_ID);
          let discoveryApiKey = auth.discoveryApiKey;
          if (!discoveryApiKey) {
            try {
              const { resolveApiKeyForProvider } =
                await import("openclaw/plugin-sdk/provider-auth-runtime");
              discoveryApiKey = (
                await resolveApiKeyForProvider({
                  provider: PROVIDER_ID,
                  cfg: ctx.config,
                  ...(ctx.agentDir ? { agentDir: ctx.agentDir } : {}),
                  ...(ctx.workspaceDir ? { workspaceDir: ctx.workspaceDir } : {}),
                  ...(auth.profileId ? { profileId: auth.profileId, lockedProfile: true } : {}),
                })
              )?.apiKey;
            } catch {
              return null;
            }
          }
          const apiKey = auth.apiKey ?? discoveryApiKey;
          if (!apiKey || !discoveryApiKey) {
            return null;
          }
          return {
            provider: await buildLuckyNemoRouterProviderConfig({
              apiKey,
              discoveryApiKey,
              baseUrl: configuredBaseUrl(ctx.config),
            }),
          };
        },
      },
      resolveDynamicModel: (ctx) => dynamicModels.get(dynamicModelScope(ctx))?.get(ctx.modelId),
      prepareDynamicModel: async (ctx) => {
        const scope = dynamicModelScope(ctx);
        dynamicModels.delete(scope);
        const { resolveApiKeyForProvider } =
          await import("openclaw/plugin-sdk/provider-auth-runtime");
        const apiKey = (
          await resolveApiKeyForProvider({
            provider: PROVIDER_ID,
            cfg: ctx.config,
            ...(ctx.agentDir ? { agentDir: ctx.agentDir } : {}),
            ...(ctx.workspaceDir ? { workspaceDir: ctx.workspaceDir } : {}),
            ...(ctx.authProfileId ? { profileId: ctx.authProfileId, lockedProfile: true } : {}),
          })
        )?.apiKey;
        if (!apiKey) {
          return;
        }
        const providerConfig = await buildLuckyNemoRouterProviderConfig({
          apiKey,
          discoveryApiKey: apiKey,
          baseUrl: ctx.providerConfig?.baseUrl ?? configuredBaseUrl(ctx.config),
        });
        dynamicModels.set(scope, buildRuntimeModels(providerConfig));
      },
      normalizeConfig: ({ providerConfig }) => {
        const baseUrl = normalizeLuckyNemoRouterApiBaseUrl(providerConfig.baseUrl);
        return baseUrl !== providerConfig.baseUrl ? { ...providerConfig, baseUrl } : undefined;
      },
      normalizeResolvedModel: ({ model }) => normalizeLuckyNemoRouterResolvedModel(model),
      wrapSimpleCompletionStreamFn: wrapLuckyNemoRouterProviderStream,
      wrapStreamFn: wrapLuckyNemoRouterProviderStream,
      buildReplayPolicy: (ctx) => {
        if (ctx.modelApi === "anthropic-messages") {
          return anthropicReplay.buildReplayPolicy?.(ctx);
        }
        if (ctx.modelApi === "google-generative-ai") {
          return googleReplay.buildReplayPolicy?.(ctx);
        }
        return openAiReplay.buildReplayPolicy?.(ctx);
      },
      sanitizeReplayHistory: (ctx) =>
        ctx.modelApi === "google-generative-ai"
          ? googleReplay.sanitizeReplayHistory?.(ctx)
          : undefined,
      resolveReasoningOutputMode: (ctx) =>
        ctx.modelApi === "google-generative-ai"
          ? googleReplay.resolveReasoningOutputMode?.(ctx)
          : undefined,
      normalizeToolSchemas: (ctx) => resolveToolFamily(ctx.modelId ?? "").normalizeToolSchemas(ctx),
      inspectToolSchemas: (ctx) => resolveToolFamily(ctx.modelId ?? "").inspectToolSchemas(ctx),
      isModernModelRef: () => true,
      resolveUsageAuth: async (ctx) => {
        const apiKey = ctx.resolveApiKeyFromConfigAndStore({
          envDirect: [ctx.env[ENV_VAR]],
        });
        return apiKey ? { token: apiKey } : null;
      },
      fetchUsageSnapshot: async (ctx) =>
        await fetchLuckyNemoRouterUsage({
          token: ctx.token,
          baseUrl: configuredBaseUrl(ctx.config),
          timeoutMs: ctx.timeoutMs,
        }),
    });
  },
});
