// npm resolution tests cover CLI plugin package resolution from installed roots.
import { installedPluginRoot } from "openclaw/plugin-sdk/test-fixtures";
import { describe, expect, it } from "vitest";
import {
  buildNpmInstallRecordFields,
  resolvePinnedNpmInstallRecordForCli,
} from "./npm-resolution.js";

const CLI_STATE_ROOT = "/tmp/openclaw";
const ALPHA_INSTALL_PATH = installedPluginRoot(CLI_STATE_ROOT, "alpha");

describe("npm-resolution helpers", () => {
  it("builds common npm install record fields", () => {
    expect(
      buildNpmInstallRecordFields({
        spec: "@luckynemo/plugin-alpha@latest",
        installPath: ALPHA_INSTALL_PATH,
        version: "1.2.3",
        resolution: {
          name: "@luckynemo/plugin-alpha",
          version: "1.2.3",
          resolvedSpec: "@luckynemo/plugin-alpha@1.2.3",
          integrity: "sha512-abc",
        },
      }),
    ).toEqual({
      source: "npm",
      spec: "@luckynemo/plugin-alpha@latest",
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolvedName: "@luckynemo/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@luckynemo/plugin-alpha@1.2.3",
      integrity: "sha512-abc",
      shasum: undefined,
      resolvedAt: undefined,
    });
  });

  it("pins the install record to the resolved spec and logs a notice", () => {
    const logs: string[] = [];
    const record = resolvePinnedNpmInstallRecordForCli(
      "@luckynemo/plugin-alpha@latest",
      true,
      ALPHA_INSTALL_PATH,
      "1.2.3",
      {
        name: "@luckynemo/plugin-alpha",
        version: "1.2.3",
        resolvedSpec: "@luckynemo/plugin-alpha@1.2.3",
      },
      (message) => logs.push(message),
      (message) => `[warn] ${message}`,
    );

    expect(record).toEqual({
      source: "npm",
      spec: "@luckynemo/plugin-alpha@1.2.3",
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolvedName: "@luckynemo/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@luckynemo/plugin-alpha@1.2.3",
      integrity: undefined,
      shasum: undefined,
      resolvedAt: undefined,
    });
    expect(logs).toEqual(["Pinned npm install record to @luckynemo/plugin-alpha@1.2.3."]);
  });

  it("keeps the requested spec and formats a warning when pin resolution is missing", () => {
    const logs: string[] = [];
    const record = resolvePinnedNpmInstallRecordForCli(
      "@luckynemo/plugin-alpha@latest",
      true,
      ALPHA_INSTALL_PATH,
      "1.2.3",
      undefined,
      (message) => logs.push(message),
      (message) => `[warn] ${message}`,
    );

    expect(record).toEqual({
      source: "npm",
      spec: "@luckynemo/plugin-alpha@latest",
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolvedName: undefined,
      resolvedVersion: undefined,
      resolvedSpec: undefined,
      integrity: undefined,
      shasum: undefined,
      resolvedAt: undefined,
    });
    expect(logs).toEqual([
      "[warn] Could not resolve exact npm version for --pin; storing original npm spec.",
    ]);
  });

  it("keeps the requested selector and resolution metadata when pin is disabled", () => {
    const logs: string[] = [];
    const record = resolvePinnedNpmInstallRecordForCli(
      "@luckynemo/plugin-alpha",
      false,
      ALPHA_INSTALL_PATH,
      "1.2.3",
      {
        name: "@luckynemo/plugin-alpha",
        version: "1.2.3",
        resolvedSpec: "@luckynemo/plugin-alpha@1.2.3",
      },
      (message) => logs.push(message),
      (message) => `[warn] ${message}`,
    );

    expect(record).toEqual({
      source: "npm",
      spec: "@luckynemo/plugin-alpha",
      installPath: ALPHA_INSTALL_PATH,
      version: "1.2.3",
      resolvedName: "@luckynemo/plugin-alpha",
      resolvedVersion: "1.2.3",
      resolvedSpec: "@luckynemo/plugin-alpha@1.2.3",
      integrity: undefined,
      shasum: undefined,
      resolvedAt: undefined,
    });
    expect(logs).toEqual([]);
  });
});
