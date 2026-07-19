// Shared 徐大恩 banner: the pixel mascot above the 徐大恩 wordmark,
// with a short startup animation on rich interactive terminals.
// Used by the wizard flows (doctor/onboard/configure) and the foreground
// gateway run; non-TTY and CI paths always get the plain static banner.
import {
  decorativeEmoji,
  supportsDecorativeEmoji,
} from "../../packages/terminal-core/src/decorative-emoji.js";
import { restoreTerminalState } from "../../packages/terminal-core/src/restore.js";
import { isRich, theme } from "../../packages/terminal-core/src/theme.js";
import type { RuntimeEnv } from "../runtime.js";

// Art is pregenerated from pixel bitmaps (two pixel rows per terminal row via
// ▀▄█). Mascot sits above the wordmark so each can be tinted independently.
// Chibi-clownfish: eye + body + dorsal/pectoral stripe + tail.
const MASCOT_ART = [
  "    ▄██▄     ",
  "   ██ ▐█▄    ",
  "  ▄████████▄ ",
  "  ██ ▌ ▐ ██  ",
  "  ▀██▌▌██▀   ",
  "    ▀▄▄▄▀    ",
] as const;
// Animation frames: eye blink swaps the top row for a closed-eye row, so the
// mascot appears to blink during the entrance.
const MASCOT_OPEN_ROWS = ["    ▄██▄     ", "   █▄▄▄█▄    "] as const;
const MASCOT_WIDTH = 15;

const WORDMARK = "徐大恩";
const WORDMARK_VISIBLE_WIDTH = 6; // 3 CJK chars × 2 cells each
const GAP = 3;
const BANNER_WIDTH = MASCOT_WIDTH + GAP + WORDMARK_VISIBLE_WIDTH;
const ROWS = MASCOT_ART.length + 1;

type ClawBannerOptions = {
  columns?: number;
  isTty?: boolean;
  rich?: boolean;
  env?: NodeJS.ProcessEnv;
  /** Injectable randomness for the animation garnish (tests pin it). */
  rng?: () => number;
  /** Ends the animation on its static frame when parallel startup work settles. */
  settleWhen?: PromiseLike<unknown>;
  sleep?: (ms: number) => Promise<void>;
  write?: (chunk: string) => void;
};

export type ClawBannerResult = "static" | "completed" | "settled";

type CellTint = (col: number) => (text: string) => string;

const identityTint: (text: string) => string = (text) => text;

// Composes one banner frame. Tints run per glyph column so the wipe edge and
// shimmer band can cut through individual mascot cells. The wordmark sits on
// its own row beneath the mascot so the animation only needs to drive the
// mascot column tints.
function composeFrame(params: {
  mascotRows?: readonly string[];
  mascotTint?: CellTint;
  wordmarkTint?: CellTint;
}): string[] {
  const mascotRows = params.mascotRows ?? MASCOT_ART;
  const lines: string[] = [];
  for (let row = 0; row < mascotRows.length; row++) {
    const mascotRow = (mascotRows[row] ?? "").padEnd(MASCOT_WIDTH).slice(0, MASCOT_WIDTH);
    let out = "";
    for (let col = 0; col < mascotRow.length; col++) {
      const ch = mascotRow[col] ?? " ";
      out += ch === " " ? " " : (params.mascotTint?.(col) ?? theme.accent)(ch);
    }
    lines.push(out.replace(/\s+$/, ""));
  }
  const wordmarkIndent = " ".repeat(MASCOT_WIDTH + GAP);
  lines.push((wordmarkIndent + theme.heading(WORDMARK)).replace(/\s+$/, ""));
  return lines;
}

function staticBannerLines(): string[] {
  return composeFrame({});
}

function plainTitleLine(): string {
  const icon = decorativeEmoji("🐠");
  return supportsDecorativeEmoji() && icon ? `${icon} 徐大恩 ${icon}` : "徐大恩";
}

const defaultSleep = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

// One combined entrance: a left-to-right molt wipe reveals the color, a
// shimmer band sweeps the mascot right edge, and the claws snip. The rng
// varies the shimmer passes and snip count a little so back-to-back runs
// don't feel canned; every sequence ends on the exact static banner.
async function animateBanner(opts: {
  rng: () => number;
  settleWhen?: PromiseLike<unknown>;
  sleep: (ms: number) => Promise<void>;
  write: (chunk: string) => void;
}): Promise<Exclude<ClawBannerResult, "static">> {
  const { rng, settleWhen, sleep, write } = opts;
  let settleRequested = false;
  const settleSignal = settleWhen
    ? Promise.resolve(settleWhen).then(
        () => {
          settleRequested = true;
        },
        () => {
          settleRequested = true;
        },
      )
    : null;
  const pause = async (ms: number): Promise<boolean> => {
    if (!settleSignal) {
      await sleep(ms);
      return true;
    }
    await Promise.race([sleep(ms), settleSignal]);
    return !settleRequested;
  };
  let drewFrame = false;
  const draw = (lines: string[]) => {
    const prefix = drewFrame ? `\x1b[${ROWS}F` : "";
    drewFrame = true;
    write(`${prefix}${lines.map((line) => `\x1b[K${line}`).join("\n")}\n`);
  };
  // Ctrl-C during the ~1s sequence would otherwise kill the process with the
  // cursor still hidden: default signal death skips the finally block. The
  // banner runs before any other component installs signal handlers, so a
  // scoped restore-and-exit handler is safe here and removed right after.
  const onSignal = (signal: "SIGINT" | "SIGTERM") => {
    restoreTerminalState(`claw banner ${signal}`);
    process.exit(signal === "SIGINT" ? 130 : 143);
  };
  const onSigint = () => onSignal("SIGINT");
  const onSigterm = () => onSignal("SIGTERM");
  process.once("SIGINT", onSigint);
  process.once("SIGTERM", onSigterm);
  write("\x1b[?25l");
  try {
    // Molt wipe: dim shell ahead of a bright 2-column edge, color behind it.
    const wipeSteps = 9;
    for (let step = 0; step <= wipeSteps; step++) {
      const edge = Math.round((BANNER_WIDTH * step) / wipeSteps);
      const tintAt =
        (colored: (text: string) => string): CellTint =>
        (col) =>
          col < edge ? colored : col < edge + 2 ? theme.accentBright : theme.muted;
      draw(
        composeFrame({
          mascotTint: tintAt(theme.accent),
          wordmarkTint: tintAt(identityTint),
        }),
      );
      if (!(await pause(45))) {
        return "settled";
      }
    }
    // Shimmer: a bright band sweeps the wordmark; rarely it runs twice.
    const shimmerPasses = rng() < 0.2 ? 2 : 1;
    for (let pass = 0; pass < shimmerPasses; pass++) {
      for (let x = MASCOT_WIDTH; x < BANNER_WIDTH + 6; x += 4) {
        const band: CellTint = (col) =>
          col >= x && col < x + 6 ? theme.accentBright : identityTint;
        draw(composeFrame({ wordmarkTint: band }));
        if (!(await pause(40))) {
          return "settled";
        }
      }
    }
    // Snip: claws open and close once, sometimes twice.
    const snips = rng() < 0.4 ? 2 : 1;
    for (let snip = 0; snip < snips; snip++) {
      draw(composeFrame({ mascotRows: [...MASCOT_OPEN_ROWS, ...MASCOT_ART.slice(2)] }));
      if (!(await pause(95))) {
        return "settled";
      }
      draw(staticBannerLines());
      if (!(await pause(115))) {
        return "settled";
      }
    }
    draw(staticBannerLines());
    return "completed";
  } finally {
    try {
      // Parallel work owns startup latency; leave a complete banner instead of
      // an interrupted frame before its logs or errors take over the terminal.
      if (settleRequested && drewFrame) {
        draw(staticBannerLines());
      }
    } finally {
      process.off("SIGINT", onSigint);
      process.off("SIGTERM", onSigterm);
      write("\x1b[?25h");
    }
  }
}

/**
 * Prints the 徐大恩 banner: animated on rich interactive terminals, static
 * otherwise, plain title on terminals too narrow for the art.
 */
export async function printClawBanner(
  runtime: RuntimeEnv,
  options: ClawBannerOptions = {},
): Promise<ClawBannerResult> {
  const columns = options.columns ?? process.stdout.columns ?? 80;
  if (columns < BANNER_WIDTH) {
    runtime.log(`${plainTitleLine()}\n`);
    return "static";
  }
  const env = options.env ?? process.env;
  const animate =
    (options.isTty ?? process.stdout.isTTY ?? false) &&
    (options.rich ?? isRich()) &&
    !env.CI &&
    !env.VITEST;
  if (!animate) {
    runtime.log(`${staticBannerLines().join("\n")}\n`);
    return "static";
  }
  const result = await animateBanner({
    rng: options.rng ?? Math.random,
    settleWhen: options.settleWhen,
    sleep: options.sleep ?? defaultSleep,
    write: options.write ?? ((chunk) => process.stdout.write(chunk)),
  });
  (options.write ?? ((chunk: string) => process.stdout.write(chunk)))("\n");
  return result;
}
