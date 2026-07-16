/** ACP runtime error exports wired to OpenClaw secret redaction. */
import { configureAcpErrorRedactor } from "@luckynemo/acp-core";
import { redactSensitiveText } from "../../logging/redact.js";

// Ensure ACP-core runtime errors use OpenClaw's secret redaction before re-export.
configureAcpErrorRedactor(redactSensitiveText);

export * from "@luckynemo/acp-core/runtime/errors";
