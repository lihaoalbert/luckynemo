import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { afterEach, describe, expect, it } from "vitest";
import {
  createOpenClawTestInstance,
  type OpenClawTestInstance,
} from "./helpers/openclaw-test-instance.js";

// Live end-to-end proof against the deployed LuckyNemo platform proxy.
// Gated: only runs when both env vars are set, e.g.
//   LUCKYNEMO_ROUTER_LIVE_BASE_URL=https://kidsai.ibi.ren \
//   LUCKYNEMO_ROUTER_LIVE_API_KEY=sk-ln-... \
//   node scripts/run-vitest.mjs test/luckynemo-router-live.e2e.test.ts
const LIVE_BASE_URL = process.env.LUCKYNEMO_ROUTER_LIVE_BASE_URL;
const LIVE_API_KEY = process.env.LUCKYNEMO_ROUTER_LIVE_API_KEY;
const MODEL_ID = process.env.LUCKYNEMO_ROUTER_LIVE_MODEL ?? "minimax/MiniMax-M2";
const MODEL_REF = `luckynemo/${MODEL_ID}`;
const SUCCESS_MARKER = "LUCKYNEMO_LIVE_OK";

const instances: OpenClawTestInstance[] = [];

afterEach(async () => {
  await Promise.allSettled(instances.splice(0).map((instance) => instance.cleanup()));
});

async function liveBalance(): Promise<number> {
  const response = await fetch(`${LIVE_BASE_URL}/api/v1/me/balance`, {
    headers: { Authorization: `Bearer ${LIVE_API_KEY}` },
  });
  expect(response.status).toBe(200);
  const body = (await response.json()) as { balance: number };
  return body.balance;
}

const describeLive = LIVE_BASE_URL && LIVE_API_KEY ? describe : describe.skip;

describeLive("LuckyNemo Router live platform chain", () => {
  it("discovers catalog, probes, and runs an agent turn that deducts credits", async () => {
    const instance = await createOpenClawTestInstance({
      name: "luckynemo-router-live",
      env: {
        LUCKYNEMO_API_KEY: LIVE_API_KEY,
        OPENCLAW_SKIP_PROVIDERS: undefined,
        OPENCLAW_TEST_FAST: "1",
        OPENCLAW_TEST_MINIMAL_GATEWAY: undefined,
      },
    });
    instances.push(instance);
    const logFile = path.join(instance.stateDir, "luckynemo-router-live.log");
    // Preserve the gateway log on failure so live debugging survives instance cleanup.
    const preserveLogOnFailure = async (error: unknown): Promise<never> => {
      try {
        const fs = await import("node:fs/promises");
        await fs.copyFile(logFile, "/tmp/luckynemo-live-gateway.log");
      } catch {
        // Log file may not exist yet.
      }
      throw error;
    };

    const patchPath = await instance.state.writeText(
      "luckynemo-router-live.patch.json5",
      JSON.stringify(
        {
          plugins: {
            allow: ["luckynemo-router"],
            entries: { "luckynemo-router": { enabled: true } },
          },
          models: {
            providers: {
              luckynemo: {
                // OpenAI-compatible baseUrl includes the /v1 suffix; the runtime
                // appends /chat/completions, /catalog, /usage to it.
                baseUrl: `${LIVE_BASE_URL}/v1`,
                apiKey: { source: "env", provider: "default", id: "LUCKYNEMO_API_KEY" },
              },
            },
          },
          logging: { file: logFile },
          agents: { defaults: { model: { primary: MODEL_REF } } },
        },
        null,
        2,
      ),
    );
    const bootstrap = await instance.cli(["config", "patch", "--file", patchPath], {
      timeoutMs: 120_000,
    });
    expect(bootstrap.code, bootstrap.stderr).toBe(0);

    const health = await fetch(`${LIVE_BASE_URL}/v1/health`);
    expect(health.status).toBe(200);

    await instance.startGateway();
    const readiness = await waitForGatewayReadiness(instance);
    expect(readiness).toMatchObject({ ready: true, failing: [] });

    const catalog = await instance.cli(
      ["models", "list", "--all", "--provider", "luckynemo", "--json"],
      { timeoutMs: 120_000 },
    );
    expect(catalog.code, catalog.stderr).toBe(0);
    expect(catalog.stdout).toContain(MODEL_REF);

    const probe = await instance.cli(
      [
        "models",
        "status",
        "--probe",
        "--probe-provider",
        "luckynemo",
        "--probe-max-tokens",
        "8",
        "--json",
      ],
      { timeoutMs: 120_000 },
    );
    expect(probe.code, probe.stderr).toBe(0);
    try {
      expect(probe.stdout).toMatch(/"status"\s*:\s*"ok"/u);
    } catch (error) {
      await preserveLogOnFailure(error);
    }

    const balanceBefore = await liveBalance();

    const agent = await instance.cli(
      [
        "agent",
        "--agent",
        "main",
        "--model",
        MODEL_REF,
        "--message",
        `Reply exactly: ${SUCCESS_MARKER}`,
        "--json",
      ],
      { timeoutMs: 240_000 },
    );
    expect(agent.code, agent.stderr).toBe(0);
    expect(agent.stdout).toContain(SUCCESS_MARKER);

    const balanceAfter = await liveBalance();
    expect(balanceAfter).toBeLessThan(balanceBefore);
  }, 360_000);
});

async function waitForGatewayReadiness(
  instance: OpenClawTestInstance,
): Promise<{ ready: boolean; failing: string[] }> {
  const url = `http://127.0.0.1:${instance.port}/readyz`;
  for (let attempt = 0; attempt < 1_000; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok) {
        return (await response.json()) as { ready: boolean; failing: string[] };
      }
    } catch {
      // The listener can open before startup readiness settles.
    }
    await delay(10);
  }
  throw new Error(`gateway did not become ready: ${instance.logs()}`);
}
