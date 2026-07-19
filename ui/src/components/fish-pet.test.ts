/* @vitest-environment jsdom */

import { expectDefined } from "@luckynemo/normalization-core";
import { render } from "lit";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  FISH_LOGO_VISIT_EVENT,
  createFishPetLook,
  fishPetSeed,
  renderFishSvg,
  resolveFishPetMode,
  resolveFishRunOutcome,
  type FishLogoVisitDetail,
} from "./fish-pet.ts";
import { getMascotdex, getMascotdexEntries } from "./mascot-dex.ts";

type FishPetPaletteId = ReturnType<typeof createFishPetLook>["palette"]["id"];
type FishPetMode = ReturnType<typeof resolveFishPetMode>;

const LOBSTER_PET_PALETTE_IDS: FishPetPaletteId[] = [
  "crimson",
  "coral",
  "teal",
  "violet",
  "ink",
  "blue",
  "gold",
  "calico",
  "abyss",
  "ghost",
  "split",
  "retro",
];

const SPOT_ZONES = { left: [12, 38], right: [60, 84] } as const;

type FishPetElement = HTMLElement & {
  gatewayVersion: string | null;
  mode: FishPetMode;
  runOutcome: "ok" | "error" | "aborted";
  seed: number;
  soundsEnabled: boolean;
  updateComplete: Promise<boolean>;
  visitsEnabled: boolean;
};

function createPet(seed: number, mode: FishPetMode = "idle"): FishPetElement {
  const element = document.createElement("openclaw-fish-pet") as FishPetElement;
  element.seed = seed;
  element.mode = mode;
  document.body.append(element);
  return element;
}

function poke(element: FishPetElement): void {
  const sprite = element.querySelector(".fish-pet");
  sprite?.dispatchEvent(new Event("pointerdown"));
  sprite?.dispatchEvent(new Event("pointerup"));
}

function spriteClasses(element: FishPetElement): string {
  return element.querySelector(".fish-pet")?.className ?? "";
}

function spritePresent(element: FishPetElement): boolean {
  return element.querySelector(".fish-pet") !== null;
}

async function advanceUntilAct(element: FishPetElement, maxMs: number): Promise<string | null> {
  let elapsed = 0;
  while (elapsed < maxMs) {
    await vi.advanceTimersByTimeAsync(200);
    elapsed += 200;
    await element.updateComplete;
    const match = /fish-pet--act-([a-z]+)/.exec(spriteClasses(element));
    if (match) {
      return expectDefined(match[1], "mascot act name");
    }
  }
  return null;
}

async function advanceUntil(
  element: FishPetElement,
  predicate: () => boolean,
  maxMs: number,
  stepMs = 1000,
): Promise<boolean> {
  let elapsed = 0;
  while (elapsed < maxMs) {
    await vi.advanceTimersByTimeAsync(stepMs);
    elapsed += stepMs;
    await element.updateComplete;
    if (predicate()) {
      return true;
    }
  }
  return predicate();
}

// Seed 42's visit schedule is not shy and first arrives at ~89s; jump past
// the maximum first-arrival delay so tests start with a perched pet.
async function arrive(element: FishPetElement): Promise<void> {
  await advanceUntil(element, () => spritePresent(element), 200_000);
}

async function startVigilOnlyRun(outcome: FishPetElement["runOutcome"]): Promise<FishPetElement> {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-09T12:00:00"));
  // Seed 0 opts out of scheduled visits and passers, so vigil is the only
  // presence owner when the run finishes.
  const element = createPet(0, "busy");
  element.runOutcome = outcome;
  await element.updateComplete;
  expect(spritePresent(element)).toBe(false);
  await vi.advanceTimersByTimeAsync(600_500);
  await element.updateComplete;
  expect(spriteClasses(element)).toContain("fish-pet--vigil");
  return element;
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  document.body.innerHTML = "";
  localStorage.clear();
});

describe("mascot pet look", () => {
  it("is deterministic per seed", () => {
    expect(createFishPetLook(1234)).toEqual(createFishPetLook(1234));
  });

  it("stays within the variant catalog for many seeds", () => {
    const palettes = new Set<string>();
    const personalities = new Set<string>();
    const builds = new Set<string>();
    const clawSizes = new Set<string>();
    const tailFans = new Set<boolean>();
    const neutralDate = new Date("2026-07-15T12:00:00");
    for (let seed = 0; seed < 300; seed++) {
      const look = createFishPetLook(seed, neutralDate);
      palettes.add(look.palette.id);
      personalities.add(look.personality);
      builds.add(look.build);
      clawSizes.add(look.clawSize);
      tailFans.add(look.tailFan);
      expect(LOBSTER_PET_PALETTE_IDS).toContain(look.palette.id);
      expect([1.7, 2, 2.5]).toContain(look.scale);
      expect(["none", "crown", "sprout", "patch"]).toContain(look.accessory);
      expect(["perky", "droopy"]).toContain(look.antennae);
      expect(["round", "squat", "slender"]).toContain(look.build);
      expect(["dainty", "regular", "mighty"]).toContain(look.clawSize);
      const zone = SPOT_ZONES[look.side];
      expect(look.spotPct).toBeGreaterThanOrEqual(zone[0]);
      expect(look.spotPct).toBeLessThanOrEqual(zone[1]);
    }
    // Sessions should feel different: many seeds must not collapse onto one look.
    expect(palettes.size).toBeGreaterThan(2);
    expect(personalities.size).toBeGreaterThan(2);
    expect(builds.size).toBe(3);
    expect(clawSizes.size).toBe(3);
    expect(tailFans.size).toBe(2);
  });

  it("hatches every rarity tier, with rares staying rare", () => {
    const counts = new Map<string, number>();
    const total = 20_000;
    const neutralDate = new Date("2026-07-15T12:00:00");
    for (let seed = 0; seed < total; seed++) {
      const id = createFishPetLook(seed, neutralDate).palette.id;
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    // Every palette, including the 1% grails, must be reachable.
    for (const id of LOBSTER_PET_PALETTE_IDS) {
      expect(counts.get(id) ?? 0).toBeGreaterThan(0);
    }
    // Grails stay grails: ghost/split roll ~1%, retro ~0.5%; commons dominate.
    for (const grail of ["ghost", "split", "retro"]) {
      expect(counts.get(grail) ?? 0).toBeLessThan(total * 0.03);
    }
    expect((counts.get("crimson") ?? 0) + (counts.get("coral") ?? 0)).toBeGreaterThan(total * 0.4);
  });

  it("derives distinct salted seeds per session key, stable within a load", () => {
    expect(fishPetSeed("agent:a:main")).toBe(fishPetSeed("agent:a:main"));
    expect(fishPetSeed("agent:a:main")).not.toBe(fishPetSeed("agent:b:other"));
  });
});

describe("seasonal wardrobe", () => {
  it("adds santa hats in December and pumpkins in late October", () => {
    const december = new Date("2026-12-10T12:00:00");
    const october = new Date("2026-10-25T12:00:00");
    const july = new Date("2026-07-15T12:00:00");
    const accessoriesOn = (date: Date) =>
      new Set(Array.from({ length: 400 }, (_, seed) => createFishPetLook(seed, date).accessory));
    const decemberSet = accessoriesOn(december);
    expect(decemberSet.has("santa")).toBe(true);
    expect(decemberSet.has("pumpkin")).toBe(false);
    const octoberSet = accessoriesOn(october);
    expect(octoberSet.has("pumpkin")).toBe(true);
    expect(octoberSet.has("santa")).toBe(false);
    const julySet = accessoriesOn(july);
    expect(julySet.has("santa")).toBe(false);
    expect(julySet.has("pumpkin")).toBe(false);
    expect(julySet.has("party")).toBe(false);
  });

  it("dresses everyone as the classic logo on the repo anniversary", () => {
    const anniversary = new Date("2026-11-24T12:00:00");
    for (let seed = 0; seed < 50; seed++) {
      const look = createFishPetLook(seed, anniversary);
      expect(look.palette.id).toBe("retro");
      expect(look.accessory).toBe("party");
    }
    // The day after is business as usual.
    const after = createFishPetLook(7, new Date("2026-11-25T12:00:00"));
    expect(after.accessory).not.toBe("party");
  });
});

describe("resolveFishPetMode", () => {
  it("maps connection and run state to modes", () => {
    expect(resolveFishPetMode(false, [{ hasActiveRun: true }])).toBe("offline");
    expect(resolveFishPetMode(true, null)).toBe("idle");
    expect(resolveFishPetMode(true, [{ hasActiveRun: false }, {}])).toBe("idle");
    expect(resolveFishPetMode(true, [{ hasActiveRun: false }, { hasActiveRun: true }])).toBe(
      "busy",
    );
  });
});

describe("resolveFishRunOutcome", () => {
  it("uses the most recently active terminal session", () => {
    expect(resolveFishRunOutcome(null)).toBe("ok");
    expect(
      resolveFishRunOutcome([
        { status: "done", lastActivityAt: 10 },
        { status: "failed", lastActivityAt: 20 },
      ]),
    ).toBe("error");
    expect(
      resolveFishRunOutcome([
        { status: "failed", lastActivityAt: 10 },
        { status: "done", lastActivityAt: 20 },
      ]),
    ).toBe("ok");
    expect(resolveFishRunOutcome([{ status: "running", lastActivityAt: 99 }])).toBe("ok");
    expect(resolveFishRunOutcome([{ status: "timeout", updatedAt: 5 }])).toBe("error");
    // A user abort is neither success nor failure.
    expect(resolveFishRunOutcome([{ status: "killed", endedAt: 50 }])).toBe("aborted");
    // endedAt outranks activity stamps that unrelated events keep touching.
    expect(
      resolveFishRunOutcome([
        { status: "failed", endedAt: 30, lastActivityAt: 10 },
        { status: "done", endedAt: 20, lastActivityAt: 40 },
      ]),
    ).toBe("error");
  });
});

describe("mascot pet element", () => {
  it("starts hidden and arrives on its seeded visit schedule", async () => {
    vi.useFakeTimers();
    const element = createPet(42);
    await element.updateComplete;

    expect(spritePresent(element)).toBe(false);
    await arrive(element);
    expect(element.querySelector(".fish-pet__svg")).not.toBeNull();
    expect(spriteClasses(element)).toContain("fish-pet--idle");
    expect(["ledge", "bar"]).toContain(element.getAttribute("data-spot"));
  });

  it("shy seeds never visit on their own", async () => {
    vi.useFakeTimers();
    const element = createPet(7);
    await element.updateComplete;

    const arrived = await advanceUntil(element, () => spritePresent(element), 600_000);
    expect(arrived).toBe(false);
  });

  it("departs after its stay and returns for a later visit", async () => {
    vi.useFakeTimers();
    const element = createPet(42);
    await arrive(element);

    const departed = await advanceUntil(element, () => !spritePresent(element), 400_000);
    expect(departed).toBe(true);

    const returned = await advanceUntil(element, () => spritePresent(element), 1_300_000);
    expect(returned).toBe(true);
  });

  it("startles when poked", async () => {
    vi.useFakeTimers();
    const element = createPet(42);
    await arrive(element);

    poke(element);
    await element.updateComplete;
    expect(spriteClasses(element)).toContain("fish-pet--act-startle");
  });

  it("schedules acts while perched", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42);
    await arrive(element);

    const act = await advanceUntilAct(element, 20_000);

    expect(act).not.toBeNull();
    expect(spriteClasses(element)).toContain(`fish-pet--act-${act}`);
  });

  it("reacts to busy, idle, and offline mode changes", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42);
    await arrive(element);

    element.mode = "busy";
    await element.updateComplete;
    expect(spriteClasses(element)).toContain("fish-pet--act-startle");
    expect(spriteClasses(element)).toContain("fish-pet--busy");

    element.runOutcome = "ok";
    element.mode = "idle";
    await element.updateComplete;
    expect(spriteClasses(element)).toContain("fish-pet--act-cheer");

    const offline = createPet(7, "offline");
    await offline.updateComplete;
    expect(spritePresent(offline)).toBe(true);
    expect(spriteClasses(offline)).toContain("fish-pet--offline");
  });

  it("renders deterministic molt and twin load variants", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const molting = createPet(2);
    await arrive(molting);
    expect(await advanceUntilAct(molting, 30_000)).toBe("molt");
    expect(
      await advanceUntil(molting, () => molting.querySelector(".fish-pet--shell") !== null, 30_000),
    ).toBe(true);

    const twins = createPet(21);
    await arrive(twins);
    expect(twins.querySelectorAll(".fish-pet:not(.fish-pet--shell)")).toHaveLength(2);
    expect(twins.querySelector(".fish-pet--twin")?.getAttribute("title")).toMatch(/ Jr\.$/);
  });

  it("records arrivals in the mascotdex", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    vi.stubGlobal("localStorage", window.localStorage);
    const element = createPet(42);

    await arrive(element);

    const look = createFishPetLook(42, new Date("2026-07-09T12:00:00"));
    expect(getMascotdex().has(look.palette.id)).toBe(true);
    expect(getMascotdexEntries().get(look.palette.id)?.name).toBeTruthy();
  });

  it("right-click shoos it away for the rest of the load", async () => {
    vi.useFakeTimers();
    const element = createPet(42);
    await arrive(element);

    const shoo = new Event("contextmenu", { cancelable: true });
    element.querySelector(".fish-pet")?.dispatchEvent(shoo);
    await element.updateComplete;
    expect(shoo.defaultPrevented).toBe(true);

    const gone = await advanceUntil(element, () => !spritePresent(element), 5_000);
    expect(gone).toBe(true);

    // Dismissal outlasts later scheduled visits and even offline summons.
    const revisited = await advanceUntil(element, () => spritePresent(element), 2_400_000);
    expect(revisited).toBe(false);
    element.mode = "offline";
    await element.updateComplete;
    expect(spritePresent(element)).toBe(false);
  });

  it("never shows when visits are disabled, offline included", async () => {
    vi.useFakeTimers();
    const element = createPet(42, "offline");
    element.visitsEnabled = false;
    await element.updateComplete;

    expect(spritePresent(element)).toBe(false);
    const appeared = await advanceUntil(element, () => spritePresent(element), 1_200_000);
    expect(appeared).toBe(false);
  });

  it("stops timers on disconnect", async () => {
    vi.useFakeTimers();
    const element = createPet(42);
    await arrive(element);

    element.remove();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("gets grumpy after three fast pokes and recovers after a minute", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42);
    await arrive(element);

    for (let i = 0; i < 3; i++) {
      poke(element);
      await element.updateComplete;
    }
    expect(spriteClasses(element)).toContain("fish-pet--grumpy");

    await vi.advanceTimersByTimeAsync(61_000);
    await element.updateComplete;
    expect(spriteClasses(element)).not.toContain("fish-pet--grumpy");
  });

  it("leaves in a huff after ten pokes but returns for a later visit", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42);
    await arrive(element);

    for (let i = 0; i < 10; i++) {
      poke(element);
      await element.updateComplete;
    }
    const gone = await advanceUntil(element, () => !spritePresent(element), 5_000);
    expect(gone).toBe(true);

    const returned = await advanceUntil(element, () => spritePresent(element), 1_300_000);
    expect(returned).toBe(true);
  });

  it("old friends wave hello on their first arrival of the load", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    vi.stubGlobal("localStorage", window.localStorage);
    localStorage.setItem(
      "openclaw.control.fishpet.familiarity.v1",
      JSON.stringify({ visits: 30, shoos: 0 }),
    );
    const element = createPet(42);
    await arrive(element);

    // The greeting fires right after the entrance settles.
    await vi.advanceTimersByTimeAsync(600);
    await element.updateComplete;
    expect(spriteClasses(element)).toContain("fish-pet--act-wave");
  });

  it("shooing is remembered in the familiarity counters", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    vi.stubGlobal("localStorage", window.localStorage);
    const element = createPet(42);
    await arrive(element);

    element
      .querySelector(".fish-pet:not(.fish-pet--shell)")
      ?.dispatchEvent(new Event("contextmenu", { cancelable: true }));
    await element.updateComplete;
    const raw = JSON.parse(localStorage.getItem("openclaw.control.fishpet.familiarity.v1") ?? "{}");
    expect(raw.shoos).toBe(1);
  });

  it("cancels a pending pet when the pointer interaction is cancelled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42, "offline");
    await element.updateComplete;

    const sprite = element.querySelector(".fish-pet");
    sprite?.dispatchEvent(new Event("pointerdown"));
    await vi.advanceTimersByTimeAsync(300);
    sprite?.dispatchEvent(new Event("pointercancel"));
    await vi.advanceTimersByTimeAsync(400);
    await element.updateComplete;

    expect(spriteClasses(element)).not.toContain("fish-pet--act-pet");
  });

  it("droops instead of cheering when the finished run failed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42, "busy");
    element.runOutcome = "error";
    await arrive(element);

    element.mode = "idle";
    await element.updateComplete;
    expect(spriteClasses(element)).toContain("fish-pet--act-droop");
    expect(spriteClasses(element)).not.toContain("fish-pet--act-cheer");
  });

  it("keeps vigil during long runs and settles until the run ends", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42, "busy");
    await arrive(element);

    await vi.advanceTimersByTimeAsync(600_500);
    await element.updateComplete;
    expect(spriteClasses(element)).toContain("fish-pet--vigil");

    // No fidgeting while keeping vigil.
    const act = await advanceUntilAct(element, 30_000);
    expect(act).toBeNull();

    element.mode = "idle";
    await element.updateComplete;
    expect(spriteClasses(element)).not.toContain("fish-pet--vigil");
  });

  it.each([
    ["ok", "cheer"],
    ["error", "droop"],
    ["aborted", "startle"],
  ] as const)(
    "finishes a vigil-only %s run with a visible %s before leaving",
    async (outcome, act) => {
      const element = await startVigilOnlyRun(outcome);
      element.mode = "idle";
      await element.updateComplete;
      expect(spriteClasses(element)).toContain(`fish-pet--act-${act}`);
      expect(spriteClasses(element)).not.toContain("fish-pet--away");

      const reachedNextPhase = await advanceUntil(
        element,
        () =>
          spriteClasses(element).includes("fish-pet--away") ||
          spriteClasses(element).includes("fish-pet--act-sweep"),
        10_000,
        100,
      );
      expect(reachedNextPhase).toBe(true);
      if (outcome === "error") {
        expect(spriteClasses(element)).toContain("fish-pet--act-sweep");
        expect(spriteClasses(element)).not.toContain("fish-pet--away");
        expect(
          await advanceUntil(
            element,
            () => spriteClasses(element).includes("fish-pet--away"),
            10_000,
            100,
          ),
        ).toBe(true);
      }
      expect(spriteClasses(element)).toContain("fish-pet--away");

      await vi.advanceTimersByTimeAsync(400);
      await element.updateComplete;
      expect(spritePresent(element)).toBe(false);
    },
  );

  it.each(["seed reset", "page hide"] as const)(
    "releases vigil outcome presence on %s",
    async (cleanup) => {
      const element = await startVigilOnlyRun("ok");
      element.mode = "idle";
      await element.updateComplete;

      if (cleanup === "seed reset") {
        element.seed = 7;
      } else {
        const hidden = vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        document.dispatchEvent(new Event("visibilitychange"));
        hidden.mockRestore();
      }
      await element.updateComplete;
      expect(spriteClasses(element)).not.toContain("fish-pet--act-cheer");

      await vi.advanceTimersByTimeAsync(400);
      await element.updateComplete;
      expect(spritePresent(element)).toBe(false);
    },
  );

  it("watches the pointer between acts", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42);
    await arrive(element);

    // jsdom rects are zero, so any positive clientX is to the sprite's right
    // and any negative clientX is to its left.
    await vi.advanceTimersByTimeAsync(200);
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: 400 }));
    await element.updateComplete;
    expect(element.querySelector(".fish-pet")?.getAttribute("style")).toContain("--fish-face:1");

    await vi.advanceTimersByTimeAsync(200);
    document.dispatchEvent(new MouseEvent("pointermove", { clientX: -400 }));
    await element.updateComplete;
    expect(element.querySelector(".fish-pet")?.getAttribute("style")).toContain("--fish-face:-1");
  });

  it("carries a bindle on the first load after a gateway upgrade", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    vi.stubGlobal("localStorage", window.localStorage);
    localStorage.setItem("openclaw.control.fishpet.gatewayVersion.v1", "2026.6.1");
    const element = createPet(42);
    element.gatewayVersion = "2026.7.1";
    await arrive(element);

    expect(element.querySelector(".fish-bindle")).not.toBeNull();
    expect(element.querySelector(".fish-pet")?.getAttribute("title")).toContain("just moved in");
    expect(localStorage.getItem("openclaw.control.fishpet.gatewayVersion.v1")).toBe("2026.7.1");
  });

  it("travels light on first sighting and on same-version reloads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    vi.stubGlobal("localStorage", window.localStorage);
    // First version ever seen: record a baseline, no bindle.
    const first = createPet(42);
    first.gatewayVersion = "2026.7.1";
    await arrive(first);
    expect(first.querySelector(".fish-bindle")).toBeNull();
    expect(localStorage.getItem("openclaw.control.fishpet.gatewayVersion.v1")).toBe("2026.7.1");
    first.remove();

    // Same version on the next load: still no bindle.
    const second = createPet(42);
    second.gatewayVersion = "2026.7.1";
    await arrive(second);
    expect(second.querySelector(".fish-bindle")).toBeNull();
  });

  it("stays silent by default and chirps only when sounds are enabled", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const audioContextCtor = vi.fn(() => {
      const param = () => ({ setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() });
      return {
        state: "running",
        currentTime: 0,
        destination: {},
        resume: vi.fn(),
        close: vi.fn(() => Promise.resolve()),
        createOscillator: vi.fn(() => ({
          type: "sine",
          frequency: param(),
          connect: (node: unknown) => node,
          start: vi.fn(),
          stop: vi.fn(),
        })),
        createGain: vi.fn(() => ({ gain: param(), connect: vi.fn() })),
      };
    });
    vi.stubGlobal("AudioContext", audioContextCtor);
    const element = createPet(42);
    await arrive(element);

    poke(element);
    expect(audioContextCtor).not.toHaveBeenCalled();

    element.soundsEnabled = true;
    await element.updateComplete;
    poke(element);
    expect(audioContextCtor).toHaveBeenCalledTimes(1);
  });

  it("wears the party hat on its first-visit anniversary", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    vi.stubGlobal("localStorage", window.localStorage);
    const look = createFishPetLook(42, new Date("2026-07-09T12:00:00"));
    localStorage.setItem(
      "openclaw.control.mascotdex.v1",
      JSON.stringify({
        [look.palette.id]: {
          firstSeenAt: new Date("2025-07-09T12:00:00").getTime(),
          name: "Original",
        },
      }),
    );
    const element = createPet(42);
    await arrive(element);

    expect(spriteClasses(element)).toContain("fish-pet--party");
    // The memory itself stays immutable through the celebratory visit.
    expect(getMascotdexEntries().get(look.palette.id)?.name).toBe("Original");
  });

  it("wears the sailor cap on mascot days, deferring to rolled headwear", async () => {
    vi.useFakeTimers();
    // 2026-01-05 is a probed mascot day; seed 42 rolls the (face-worn)
    // eyepatch that day, so the cap fits.
    vi.setSystemTime(new Date("2026-01-05T12:00:00"));
    const element = createPet(42);
    await arrive(element);
    expect(element.querySelector(".fish-cap")).not.toBeNull();
    element.remove();

    // Ordinary days stay capless.
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const plain = createPet(42);
    await arrive(plain);
    expect(plain.querySelector(".fish-cap")).toBeNull();
  });

  it("ships a hidden peek eye only in sleeping renders", () => {
    const container = document.createElement("div");
    const look = createFishPetLook(42, new Date("2026-07-09T12:00:00"));
    render(renderFishSvg(look, { sleeping: true }), container);
    expect(container.querySelector(".fish-eye-peek")).not.toBeNull();
    render(renderFishSvg(look, { standalone: true }), container);
    expect(container.querySelector(".fish-eye-peek")).toBeNull();
  });

  it("stays static when reduced motion is preferred, including visibility resumes", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true }) as MediaQueryList),
    );
    const element = createPet(42);
    await arrive(element);

    expect(element.querySelector(".fish-pet__svg")).not.toBeNull();
    // Tab switches re-enter through the visibilitychange resume path, which
    // must stay inert under reduced motion too. Mode flips must not startle.
    document.dispatchEvent(new Event("visibilitychange"));
    element.mode = "busy";
    await element.updateComplete;
    const act = await advanceUntilAct(element, 30_000);
    expect(act).toBeNull();
  });
});

describe("mascot pet logo stand-in", () => {
  function trackLogoPhases(element: FishPetElement): FishLogoVisitDetail[] {
    const phases: FishLogoVisitDetail[] = [];
    element.addEventListener(FISH_LOGO_VISIT_EVENT, (event) => {
      phases.push((event as CustomEvent<FishLogoVisitDetail>).detail);
    });
    return phases;
  }

  // Seed 70 is a planned logo load, not shy, first arrival ~25s.
  const LOGO_SEED = 70;

  it("spends the first visit in the brand slot, then returns to the ledge", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(LOGO_SEED);
    const phases = trackLogoPhases(element);
    await element.updateComplete;

    const arrived = await advanceUntil(element, () => phases.length > 0, 200_000);
    expect(arrived).toBe(true);
    const firstPhase = expectDefined(phases[0], "first logo phase");
    expect(firstPhase.phase).toBe("in");
    expect(firstPhase.look).not.toBeNull();
    expect(firstPhase.name).toBeTruthy();
    // One crab, two homes: the ledge stays empty while it plays logo.
    expect(spritePresent(element)).toBe(false);

    const left = await advanceUntil(element, () => phases.some((p) => p.phase === "out"), 400_000);
    expect(left).toBe(true);
    expect(phases.map((p) => p.phase)).toEqual(["in", "leaving", "out"]);
    expect(expectDefined(phases[2], "logo exit phase").look).toBeNull();

    // Logo visits are once per load: the next arrival is a normal ledge perch.
    const returned = await advanceUntil(element, () => spritePresent(element), 1_300_000);
    expect(returned).toBe(true);
    expect(phases.length).toBe(3);
  });

  it("recalls the stand-in to ledge duty when the gateway drops", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(LOGO_SEED);
    const phases = trackLogoPhases(element);
    await advanceUntil(element, () => phases.length > 0, 200_000);
    expect(phases.at(-1)?.phase).toBe("in");
    expect(spritePresent(element)).toBe(false);

    element.mode = "offline";
    await element.updateComplete;
    expect(phases.at(-1)?.phase).toBe("out");
    expect(spritePresent(element)).toBe(true);
  });

  it("sends offline summons to the ledge even on planned logo loads", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(LOGO_SEED, "offline");
    const phases = trackLogoPhases(element);
    await element.updateComplete;
    expect(spritePresent(element)).toBe(true);
    expect(phases).toEqual([]);
  });

  it("disabling visits mid-stand-in clears the brand slot immediately", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(LOGO_SEED);
    const phases = trackLogoPhases(element);
    await advanceUntil(element, () => phases.length > 0, 200_000);
    expect(phases.at(-1)?.phase).toBe("in");

    element.visitsEnabled = false;
    await element.updateComplete;
    expect(phases.at(-1)?.phase).toBe("out");
    expect(spritePresent(element)).toBe(false);
  });

  it("keeps unplanned loads on the ledge without logo events", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-09T12:00:00"));
    const element = createPet(42);
    const phases = trackLogoPhases(element);

    await arrive(element);

    expect(spritePresent(element)).toBe(true);
    expect(phases).toEqual([]);
  });
});
