// Streams LLM responses through registered providers and normalizes events.
// This facade owns the process-default AI runtime wiring: it installs the
// OpenClaw host policy ports and registers built-in providers exactly once,
// before any caller imports the stream API.
import { defaultApiRegistry } from "@luckynemo/ai/internal/runtime";
import { registerBuiltInApiProviders } from "@luckynemo/ai/providers";
import "./ai-transport-host.js";

registerBuiltInApiProviders(defaultApiRegistry);

export { complete, completeSimple, stream, streamSimple } from "@luckynemo/ai/internal/runtime";
