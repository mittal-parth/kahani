import type { Choice, Effects, EndingKind, Stats } from "./stats";

export type Premise = {
  id: string;
  title: string;
  tagline: string;
  /** Seed context handed to the game master to open the story. */
  setup: string;
  /** Two-emoji motif shown on the premise card. */
  emoji: string;
  /** Art-direction hint that anchors the visual style for this world. */
  styleBible: string;
  /** The concrete objective the player is travelling toward. */
  goal: string;
  /** Short name for the destination, shown on the journey trail. */
  goalLabel: string;
  /** Pin emoji for the destination. */
  goalEmoji: string;
  /** What the draining clock represents in this world. */
  clockLabel: string;
};

/** One completed beat, used to rebuild compact context for the model. */
export type HistoryEntry = {
  caption: string;
  choice: string;
};

export type TurnRequest = {
  premise: Premise;
  history: HistoryEntry[];
  /** The option the player just picked. null on the opening turn. */
  choice: string | null;
  /** Previous frame (base64, no data-url prefix) for visual continuity. */
  prevImage: string | null;
  /** Current stats, so the model applies sensible consequences. */
  stats: Stats;
  /** Current time budget 0..100. */
  clock: number;
  /** Current journey progress 0..100. */
  progress: number;
};

export type TurnResponse = {
  /** ≤12-word line describing the moment on screen. */
  caption: string;
  /** ≤8-word flash of what the last action did (empty on opening). */
  outcomeFlash: string;
  choices: Choice[];
  /** Fully-formed data URL, ready to drop into an <img src>. */
  image: string;
  /** Stat deltas caused by the action that led here (empty on opening). */
  effects: Effects;
  /** Time the action spent from the clock (0 on opening). */
  timeCost: number;
  /** Name of the place the player has arrived at. */
  location: string;
  /** Cumulative journey progress toward the goal, 0..100. */
  progress: number;
  isEnding: boolean;
  endingKind?: EndingKind;
  /** Short evocative title for the ending screen. */
  endingTitle?: string;
};

/** Client-side record of a single game state (a "frame" the player sees). */
export type Scene = {
  turn: number;
  image: string;
  caption: string;
  outcomeFlash: string;
  choices: Choice[];
  effects: Effects;
  timeCost: number;
  location: string;
  progress: number;
  isEnding: boolean;
  endingKind?: EndingKind;
  endingTitle?: string;
  /** The choice the player made to leave this scene, filled in on advance. */
  chosen?: string;
};
