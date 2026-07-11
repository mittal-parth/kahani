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
  done: boolean;
};
