/**
 * Synthesized UI/game sound effects (issue #21).
 *
 * Like the background music (`lib/music.ts`), effects are performed live
 * with the Web Audio API instead of shipping audio files: zero assets, zero
 * network, and every sound stays consistent with the game's synth palette.
 *
 * Components opt in by name; the shared `Button` plays "click" by default
 * and accepts a `sound` prop for anything else (or "none" to stay silent).
 */

/** Names of the available sound effects. */
export type SfxName =
  | "click"
  | "tap"
  | "toggle"
  | "open"
  | "close"
  | "pickup"
  | "success"
  | "error";

/** One synthesized voice inside an effect: a short enveloped sweep. */
type SfxVoice = {
  wave: OscillatorType;
  /** Start frequency in Hz. */
  from: number;
  /** End frequency in Hz (equal to `from` for a flat blip). */
  to: number;
  /** Seconds after the trigger this voice begins. */
  delay: number;
  /** Total voice length in seconds. */
  duration: number;
  /** Peak gain, pre master. */
  level: number;
};

/**
 * The effect library. Recipes are tuned to be short and quiet: UI feedback,
 * not fanfare. Multi-voice entries play tiny arpeggios or dyads.
 */
const SFX_LIBRARY: Record<SfxName, SfxVoice[]> = {
  // Neutral press: a soft high blip with a slight downward tick.
  click: [{ wave: "sine", from: 1650, to: 1150, delay: 0, duration: 0.07, level: 0.5 }],
  // Softer, lower sibling for secondary/inline buttons (dialogue chips).
  tap: [{ wave: "sine", from: 950, to: 780, delay: 0, duration: 0.05, level: 0.4 }],
  // Two quick rising blips, reads as a state flip.
  toggle: [
    { wave: "sine", from: 660, to: 660, delay: 0, duration: 0.05, level: 0.4 },
    { wave: "sine", from: 990, to: 990, delay: 0.07, duration: 0.06, level: 0.4 },
  ],
  // Rising sweep: a panel or conversation opening.
  open: [{ wave: "triangle", from: 320, to: 900, delay: 0, duration: 0.14, level: 0.45 }],
  // Falling sweep: leaving/closing.
  close: [{ wave: "triangle", from: 900, to: 320, delay: 0, duration: 0.12, level: 0.4 }],
  // Sparkly upward chirp for grabbing an item.
  pickup: [
    { wave: "sine", from: 1050, to: 2100, delay: 0, duration: 0.09, level: 0.45 },
    { wave: "sine", from: 2100, to: 2600, delay: 0.09, duration: 0.08, level: 0.35 },
  ],
  // Small major arpeggio: a clue found, a milestone reached.
  success: [
    { wave: "sine", from: 523, to: 523, delay: 0, duration: 0.1, level: 0.45 },
    { wave: "sine", from: 659, to: 659, delay: 0.09, duration: 0.1, level: 0.45 },
    { wave: "sine", from: 784, to: 784, delay: 0.18, duration: 0.16, level: 0.5 },
  ],
  // Low descending buzz: something went wrong.
  error: [
    { wave: "square", from: 220, to: 160, delay: 0, duration: 0.12, level: 0.2 },
    { wave: "square", from: 180, to: 130, delay: 0.13, duration: 0.14, level: 0.2 },
  ],
};

/** Master level for all effects; they sit under voice and music. */
const MASTER_LEVEL = 0.25;

/** Shared lazy context; created inside the first user gesture. */
let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!Ctor) return null;
  ctx = new Ctor();
  return ctx;
}

/**
 * Play a named effect. Safe anywhere: no-ops during SSR or without Web
 * Audio. Effects triggered from real input handlers also satisfy browser
 * autoplay rules, since the gesture itself creates/resumes the context.
 */
export function playSfx(name: SfxName): void {
  const audio = getContext();
  if (!audio) return;
  if (audio.state === "suspended") void audio.resume().catch(() => {});

  const t0 = audio.currentTime;
  for (const v of SFX_LIBRARY[name]) {
    const osc = audio.createOscillator();
    osc.type = v.wave;
    const at = t0 + v.delay;
    osc.frequency.setValueAtTime(v.from, at);
    if (v.to !== v.from) {
      osc.frequency.exponentialRampToValueAtTime(v.to, at + v.duration);
    }
    const gain = audio.createGain();
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(v.level * MASTER_LEVEL, at + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + v.duration);
    osc.connect(gain);
    gain.connect(audio.destination);
    osc.start(at);
    osc.stop(at + v.duration + 0.05);
  }
}
