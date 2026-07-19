/* @vitest-environment jsdom */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MASCOT_FAMILIARITY_TUNING,
  getMascotFamiliarity,
  getMascotdex,
  getMascotdexEntries,
  isFirstVisitAnniversary,
  mascotHonorific,
  recordMascotArrivalStats,
  recordMascotShoo,
  recordMascotVisit,
} from "./mascot-dex.ts";

beforeEach(() => {
  // getSafeLocalStorage only accepts an own value property under Vitest, so
  // tests opt in by stubbing jsdom's storage onto globalThis.
  vi.stubGlobal("localStorage", window.localStorage);
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("mascotdex", () => {
  it("records palettes once and round-trips through storage", () => {
    expect(getMascotdex().size).toBe(0);
    recordMascotVisit("crimson");
    recordMascotVisit("gold");
    recordMascotVisit("crimson");
    expect([...getMascotdex()].toSorted()).toEqual(["crimson", "gold"]);
  });

  it("remembers the first visitor's name and date, immutably", () => {
    const before = Date.now();
    recordMascotVisit("gold", { name: "Goldie" });
    const entry = getMascotdexEntries().get("gold");
    expect(entry?.name).toBe("Goldie");
    expect(entry?.firstSeenAt).toBeGreaterThanOrEqual(before);

    recordMascotVisit("gold", { name: "Impostor" });
    expect(getMascotdexEntries().get("gold")?.name).toBe("Goldie");
  });

  it("migrates v1 array entries and backfills memories on the next visit", () => {
    localStorage.setItem("openclaw.control.mascotdex.v1", JSON.stringify(["crimson"]));
    const migrated = getMascotdexEntries().get("crimson");
    expect(migrated).toEqual({ firstSeenAt: null, name: null });
    expect(getMascotdex().has("crimson")).toBe(true);

    recordMascotVisit("crimson", { name: "Pinchy" });
    const backfilled = getMascotdexEntries().get("crimson");
    expect(backfilled?.name).toBe("Pinchy");
    expect(backfilled?.firstSeenAt).not.toBeNull();
  });

  it("tolerates corrupt storage", () => {
    localStorage.setItem("openclaw.control.mascotdex.v1", "{not json");
    expect(getMascotdex().size).toBe(0);
    recordMascotVisit("teal");
    expect(getMascotdex().has("teal")).toBe(true);
  });
});

describe("mascot familiarity", () => {
  it("tiers by visit count and grows wary of frequent shooing", () => {
    expect(getMascotFamiliarity()).toMatchObject({ tier: "shy", wary: false });
    for (let i = 0; i < 3; i++) {
      recordMascotArrivalStats();
    }
    expect(getMascotFamiliarity().tier).toBe("regular");
    for (let i = 0; i < 12; i++) {
      recordMascotArrivalStats();
    }
    expect(getMascotFamiliarity().tier).toBe("friend");

    for (let i = 0; i < 3; i++) {
      recordMascotShoo();
    }
    // 3 shoos over 15 visits is not wary yet (<= 30%); a few more are.
    expect(getMascotFamiliarity().wary).toBe(false);
    for (let i = 0; i < 3; i++) {
      recordMascotShoo();
    }
    expect(getMascotFamiliarity().wary).toBe(true);
  });

  it("keeps the tuning table sane", () => {
    expect(MASCOT_FAMILIARITY_TUNING.shy.stayMul).toBeLessThan(1);
    expect(MASCOT_FAMILIARITY_TUNING.friend.stayMul).toBeGreaterThan(1);
    expect(MASCOT_FAMILIARITY_TUNING.waryGapMul).toBeGreaterThan(1);
  });
});

describe("long memory", () => {
  it("awards honorifics at visit milestones", () => {
    expect(mascotHonorific(0)).toBeNull();
    expect(mascotHonorific(49)).toBeNull();
    expect(mascotHonorific(50)).toBe("Sir");
    expect(mascotHonorific(99)).toBe("Sir");
    expect(mascotHonorific(100)).toBe("Captain");
    expect(mascotHonorific(250)).toBe("Elder");
    expect(mascotHonorific(9001)).toBe("Elder");
  });

  it("recognizes first-visit anniversaries by month and day", () => {
    const first = new Date("2025-07-09T15:30:00").getTime();
    expect(isFirstVisitAnniversary(first, new Date("2026-07-09T09:00:00"))).toBe(true);
    expect(isFirstVisitAnniversary(first, new Date("2027-07-09T21:00:00"))).toBe(true);
    expect(isFirstVisitAnniversary(first, new Date("2026-07-10T09:00:00"))).toBe(false);
    expect(isFirstVisitAnniversary(first, new Date("2026-06-09T09:00:00"))).toBe(false);
    expect(isFirstVisitAnniversary(null, new Date("2026-07-09T09:00:00"))).toBe(false);
  });

  it("does not celebrate fresh memories", () => {
    // Same month/day but same moment (a first visit today) and short gaps
    // stay quiet; the celebration needs a real year behind it.
    const now = new Date("2026-07-09T12:00:00");
    expect(isFirstVisitAnniversary(now.getTime(), now)).toBe(false);
    const lastMonth = new Date("2026-06-09T12:00:00").getTime();
    expect(isFirstVisitAnniversary(lastMonth, new Date("2026-07-09T12:00:00"))).toBe(false);
  });

  it("celebrates leap-day firsts only on leap years", () => {
    const leapFirst = new Date("2024-02-29T12:00:00").getTime();
    expect(isFirstVisitAnniversary(leapFirst, new Date("2028-02-29T12:00:00"))).toBe(true);
    expect(isFirstVisitAnniversary(leapFirst, new Date("2026-02-28T12:00:00"))).toBe(false);
    expect(isFirstVisitAnniversary(leapFirst, new Date("2026-03-01T12:00:00"))).toBe(false);
  });
});
