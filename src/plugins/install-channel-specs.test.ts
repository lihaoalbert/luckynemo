import { describe, expect, it } from "vitest";
import {
  resolveClawHubInstallSpecsForUpdateChannel,
  resolveNpmInstallSpecsForUpdateChannel,
} from "./install-channel-specs.js";

describe("resolveNpmInstallSpecsForUpdateChannel", () => {
  it.each(["@luckynemo/discord", "@luckynemo/discord@latest"])(
    "targets the exact core version for official extended-stable intent %s",
    (spec) => {
      expect(
        resolveNpmInstallSpecsForUpdateChannel({
          spec,
          updateChannel: "extended-stable",
          officialPackageName: "@luckynemo/discord",
          coreVersion: "2026.7.33",
        }),
      ).toEqual({
        installSpec: "@luckynemo/discord@2026.7.33",
        recordSpec: spec,
      });
    },
  );

  it.each([
    "@luckynemo/discord@2026.6.33",
    "@luckynemo/discord@next",
    "@luckynemo/discord@beta",
    "@luckynemo/discord@^2026.6.0",
    "https://registry.example.test/discord.tgz",
  ])("preserves explicit extended-stable intent %s", (spec) => {
    expect(
      resolveNpmInstallSpecsForUpdateChannel({
        spec,
        updateChannel: "extended-stable",
        officialPackageName: "@luckynemo/discord",
        coreVersion: "2026.7.33",
      }),
    ).toEqual({ installSpec: spec, recordSpec: spec });
  });

  it("does not rewrite a third-party package", () => {
    expect(
      resolveNpmInstallSpecsForUpdateChannel({
        spec: "@acme/discord",
        updateChannel: "extended-stable",
        officialPackageName: "@luckynemo/discord",
        coreVersion: "2026.7.33",
      }),
    ).toEqual({ installSpec: "@acme/discord", recordSpec: "@acme/discord" });
  });

  it("fails closed without an authoritative extended-stable core version", () => {
    expect(() =>
      resolveNpmInstallSpecsForUpdateChannel({
        spec: "@luckynemo/discord",
        updateChannel: "extended-stable",
        officialPackageName: "@luckynemo/discord",
      }),
    ).toThrow("requires an exact core version");
  });

  it("preserves beta behavior", () => {
    expect(
      resolveNpmInstallSpecsForUpdateChannel({
        spec: "@luckynemo/discord@latest",
        updateChannel: "beta",
        officialPackageName: "@luckynemo/discord",
        coreVersion: "2026.7.33",
      }),
    ).toEqual({
      installSpec: "@luckynemo/discord@beta",
      recordSpec: "@luckynemo/discord@latest",
      fallbackSpec: "@luckynemo/discord@latest",
      fallbackLabel: "@luckynemo/discord@beta",
    });
  });
});

describe("resolveClawHubInstallSpecsForUpdateChannel", () => {
  it("does not rewrite ClawHub on extended-stable", () => {
    expect(
      resolveClawHubInstallSpecsForUpdateChannel({
        spec: "clawhub:@luckynemo/discord",
        updateChannel: "extended-stable",
      }),
    ).toEqual({
      installSpec: "clawhub:@luckynemo/discord",
      recordSpec: "clawhub:@luckynemo/discord",
    });
  });
});
