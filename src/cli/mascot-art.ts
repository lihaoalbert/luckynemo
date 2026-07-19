import { expectDefined } from "@luckynemo/normalization-core";
// The Control UI pet has a CLI cousin: on roughly one day in sixteen
// the interactive banner gains a tiny ASCII chibi clownfish. The day comes
// from the shared mascot-day hash (the sidebar pet dresses up on the same
// days), so every surface agrees on the calendar and tests can pin dates.
import { isMascotDay, mascotDayHash } from "../shared/mascot-day.js";

const MASCOT_ARTS: readonly string[] = [
  // Bubbles + a chibi clownfish waving hi:
  //  top row:     o   o    .       <- two bubble dots above the waterline
  //  mid row:    ><((°>  <°)><      <- eyes + body, mirrored — recognizable fish
  //  bottom:      ~~~~ ~~  ~~~     <- waterline + tail flick
  ["    o     . ", "><((°>  <°))><", "  ~~~~~~~~~~ "].join("\n"),
  // Just the eyes, watching from below the waterline.
  ["     o   o", "     )   (", "  ~~~~~~~~~~~"].join("\n"),
] as const;

/**
 * Return the ASCII mascot for `now`'s calendar day, or null on non-mascot
 * days and in CI/test environments (banner tests assert exact bytes).
 */
export function pickCliMascotArt(now: Date, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.CI || env.VITEST) {
    return null;
  }
  if (!isMascotDay(now)) {
    return null;
  }
  return expectDefined(
    MASCOT_ARTS[(mascotDayHash(now) >>> 8) % MASCOT_ARTS.length],
    "mascot arts entry at (mascot day hash(now) >>> 8) % mascot arts.length",
  );
}
