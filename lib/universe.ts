/** Types for the explorable world. Percent coordinates are 0–100 of the frame. */

export type Rect = { x: number; y: number; w: number; h: number };

export type NpcDef = {
  name: string;
  role: string;
  persona: string;
  /** The line the NPC opens with when the player approaches. */
  opening: string;
};

export type Hotspot = {
  id: string;
  kind: "building" | "npc" | "exit";
  name: string;
  /** Short hint shown when the player is near ("A tea stall, lamps lit"). */
  hint: string;
  rect: Rect;
  /** For buildings: the prompt seed used to generate the interior. */
  interiorPrompt?: string;
  /** Which story clue this building's NPC guards. */
  clueIndex?: number;
};

/** The hidden arc the whole world converges toward. */
export type StoryArc = {
  /** Player-facing objective. */
  goal: string;
  /** The hidden truth, revealed only at the finale. */
  secret: string;
  /** Three clues, each guarded by one NPC. */
  clues: string[];
};

export type SceneData = {
  id: string;
  kind: "street" | "interior";
  title: string;
  /** One ambient line shown when the scene loads. */
  ambient: string;
  /** Data URL of the generated frame. */
  image: string;
  hotspots: Hotspot[];
  npc?: NpcDef;
  /** Interior scenes remember the street they came from. */
  parentId?: string;
  /** Vision-derived: y (%) where walkable ground begins (the horizon). */
  groundTop?: number;
  /** Vision-derived no-walk boxes: water, people, stalls, furniture, vehicles. */
  obstacles?: Rect[];
  /** For interiors: which story clue this scene's NPC guards. */
  clueIndex?: number;
  /** Vision-derived coarse depth: 16×10 row-major grid, 0 = near … 100 = far. */
  depthGrid?: number[];
};

export type DialogueTurn = {
  speaker: "npc" | "player";
  text: string;
};

export type DialogueResponse = {
  line: string;
  options: string[];
  /** Updated one-line quest objective, when the conversation moves the story. */
  questUpdate?: string;
  /** True on the turn where this NPC's guarded clue is revealed. */
  clueRevealed?: boolean;
  done: boolean;
};
