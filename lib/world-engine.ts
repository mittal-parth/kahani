import { Type } from "@google/genai";
import { ai, generateImage, toDataUrl } from "./gemini";
import type { Premise } from "./types";
import type {
  DialogueResponse,
  DialogueTurn,
  Hotspot,
  NpcDef,
  Rect,
  SceneData,
} from "./universe";

const TEXT_MODEL = process.env.TEXT_MODEL || "gemini-2.5-flash";
const IMAGE_MODEL = process.env.IMAGE_MODEL || "gemini-2.5-flash-image";
const VOICE_MODEL = process.env.VOICE_MODEL || "gemini-2.5-flash-preview-tts";

/* ------------------------------------------------------------------ */
/* Scene generation                                                    */
/* ------------------------------------------------------------------ */

const rectSchema = {
  type: Type.OBJECT,
  properties: {
    x: { type: Type.INTEGER, description: "Left edge, 0-100 (% of frame width)" },
    y: { type: Type.INTEGER, description: "Top edge, 0-100 (% of frame height)" },
    w: { type: Type.INTEGER, description: "Width, 0-100" },
    h: { type: Type.INTEGER, description: "Height, 0-100" },
  },
  required: ["x", "y", "w", "h"],
};

const streetSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Name of this street/area, 2-4 words." },
    ambient: {
      type: Type.STRING,
      description: "One atmospheric line shown on arrival, max 14 words.",
    },
    questHook: {
      type: Type.STRING,
      description:
        "A one-line open objective that pulls the player to explore, max 12 words.",
    },
    imagePrompt: {
      type: Type.STRING,
      description:
        "Rich prompt for a WIDE eye-level street/exterior shot. The lower third must be open walkable ground with NO people in the near foreground. Buildings with distinct doorways line the scene. Authentic Indian detail. No text in image.",
    },
    buildings: {
      type: Type.ARRAY,
      description:
        "Exactly 3 enterable places, positioned where their doorways appear in the image.",
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "e.g. 'Chai Tapri', 'Old Bookshop'" },
          hint: { type: Type.STRING, description: "Near-door hint, max 8 words." },
          interiorPrompt: {
            type: Type.STRING,
            description: "Seed describing what is inside, one sentence.",
          },
          rect: rectSchema,
        },
        required: ["name", "hint", "interiorPrompt", "rect"],
      },
    },
  },
  required: ["title", "ambient", "questHook", "imagePrompt", "buildings"],
};

const interiorSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Name of this interior, 2-4 words." },
    ambient: { type: Type.STRING, description: "One line on entering, max 14 words." },
    imagePrompt: {
      type: Type.STRING,
      description:
        "Rich prompt for a WIDE interior shot of this place with ONE character (the NPC) visible mid-frame. Lower third open floor, walkable, no other people in the near foreground. Authentic Indian detail. No text in image.",
    },
    npc: {
      type: Type.OBJECT,
      properties: {
        name: { type: Type.STRING },
        role: { type: Type.STRING, description: "e.g. 'chaiwala', 'retired archivist'" },
        persona: {
          type: Type.STRING,
          description: "2 sentences: temperament, what they know, what they want.",
        },
        opening: {
          type: Type.STRING,
          description: "The spoken line they greet the player with, max 20 words.",
        },
      },
      required: ["name", "role", "persona", "opening"],
    },
    npcZone: {
      ...rectSchema,
      description: "Where the NPC stands in the image (approach to talk).",
    },
    exitZone: {
      ...rectSchema,
      description: "Where the exit door is (walk there to leave).",
    },
  },
  required: ["title", "ambient", "imagePrompt", "npc", "npcZone", "exitZone"],
};

function clampRect(r: Rect): Rect {
  const c = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
  return { x: c(r.x), y: c(r.y), w: Math.max(4, c(r.w)), h: Math.max(4, c(r.h)) };
}

export async function generateStreetScene(
  premise: Premise
): Promise<SceneData & { questHook: string }> {
  const res = await ai().models.generateContent({
    model: TEXT_MODEL,
    contents: [
      `UNIVERSE: ${premise.title} — ${premise.setup}`,
      `ART DIRECTION: ${premise.styleBible}`,
      "Design the opening explorable street for this universe.",
    ].join("\n"),
    config: {
      systemInstruction:
        "You are the level designer of an explorable adventure game set in India. You design scenes as images plus interactive hotspots with accurate percent-coordinate boxes. Doorways sit at ground level (y of the box bottom around 55-75). Return ONLY the structured object.",
      responseMimeType: "application/json",
      responseSchema: streetSchema,
      temperature: 1.0,
    },
  });
  if (!res.text) throw new Error("Empty street spec from text model.");
  const spec = JSON.parse(res.text) as {
    title: string;
    ambient: string;
    questHook: string;
    imagePrompt: string;
    buildings: { name: string; hint: string; interiorPrompt: string; rect: Rect }[];
  };

  const img = await generateImage(spec.imagePrompt, premise.styleBible, null);

  const hotspots: Hotspot[] = spec.buildings.slice(0, 4).map((b, i) => ({
    id: `b${i}`,
    kind: "building",
    name: b.name,
    hint: b.hint,
    rect: clampRect(b.rect),
    interiorPrompt: b.interiorPrompt,
  }));

  return {
    id: "street",
    kind: "street",
    title: spec.title,
    ambient: spec.ambient,
    image: toDataUrl(img.b64, img.mimeType),
    hotspots,
    questHook: spec.questHook,
  };
}

export async function generateInteriorScene(
  premise: Premise,
  building: { id: string; name: string; interiorPrompt: string },
  questHook: string
): Promise<SceneData> {
  const res = await ai().models.generateContent({
    model: TEXT_MODEL,
    contents: [
      `UNIVERSE: ${premise.title} — ${premise.setup}`,
      `ART DIRECTION: ${premise.styleBible}`,
      `WORLD QUEST HOOK: ${questHook}`,
      `PLACE: "${building.name}" — ${building.interiorPrompt}`,
      "Design the interior of this place and the single NPC inside it. The NPC should know something connected to the quest hook.",
    ].join("\n"),
    config: {
      systemInstruction:
        "You are the level + character designer of an explorable adventure game set in India. Percent-coordinate boxes must match where things appear in the image you describe. Return ONLY the structured object.",
      responseMimeType: "application/json",
      responseSchema: interiorSchema,
      temperature: 1.0,
    },
  });
  if (!res.text) throw new Error("Empty interior spec from text model.");
  const spec = JSON.parse(res.text) as {
    title: string;
    ambient: string;
    imagePrompt: string;
    npc: NpcDef;
    npcZone: Rect;
    exitZone: Rect;
  };

  const img = await generateImage(spec.imagePrompt, premise.styleBible, null);

  const hotspots: Hotspot[] = [
    {
      id: `${building.id}-npc`,
      kind: "npc",
      name: spec.npc.name,
      hint: `${spec.npc.role} — press E to talk`,
      rect: clampRect(spec.npcZone),
    },
    {
      id: `${building.id}-exit`,
      kind: "exit",
      name: "Back to the street",
      hint: "press E to leave",
      rect: clampRect(spec.exitZone),
    },
  ];

  return {
    id: building.id,
    kind: "interior",
    title: spec.title,
    ambient: spec.ambient,
    image: toDataUrl(img.b64, img.mimeType),
    hotspots,
    npc: spec.npc,
    parentId: "street",
  };
}

/* ------------------------------------------------------------------ */
/* Player sprite                                                       */
/* ------------------------------------------------------------------ */

export async function generateSprite(premise: Premise): Promise<string> {
  const prompt = [
    `Full-body 2D adventure-game player character for this world: ${premise.setup}`,
    `Style: ${premise.styleBible}`,
    "Single character, standing, relaxed, facing right, full body head to feet.",
    "Isolated on a PURE WHITE background, no shadow, no ground, no text, no border. Character fills most of the frame height.",
  ].join(" ");
  const img = await generateImage(prompt, "clean game-asset render", null);
  return toDataUrl(img.b64, img.mimeType);
}

/* ------------------------------------------------------------------ */
/* Dialogue                                                            */
/* ------------------------------------------------------------------ */

const dialogueSchema = {
  type: Type.OBJECT,
  properties: {
    line: {
      type: Type.STRING,
      description: "The NPC's spoken reply, max 30 words, in-character.",
    },
    options: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Exactly 3 short reply options for the player, 2-7 words each.",
    },
    questUpdate: {
      type: Type.STRING,
      description:
        "When this exchange moves the story, the player's updated one-line objective. Empty otherwise.",
    },
    done: {
      type: Type.BOOLEAN,
      description: "True when the NPC naturally closes the conversation.",
    },
  },
  required: ["line", "options", "done"],
};

export async function generateDialogue(
  premise: Premise,
  npc: NpcDef,
  sceneTitle: string,
  questHook: string,
  history: DialogueTurn[],
  playerLine: string | null
): Promise<DialogueResponse> {
  const lines: string[] = [
    `UNIVERSE: ${premise.title} — ${premise.setup}`,
    `SCENE: ${sceneTitle}`,
    `QUEST THREAD: ${questHook}`,
    `YOU ARE: ${npc.name}, ${npc.role}. ${npc.persona}`,
    "",
    "CONVERSATION SO FAR:",
    ...history.map((t) => `${t.speaker === "npc" ? npc.name : "Player"}: ${t.text}`),
  ];
  if (playerLine) lines.push(`Player: ${playerLine}`);
  lines.push(
    "",
    "Reply in character. Keep it alive and specific; drip the quest thread forward. Offer 3 reply options."
  );

  const res = await ai().models.generateContent({
    model: TEXT_MODEL,
    contents: lines.join("\n"),
    config: {
      systemInstruction:
        "You are an NPC in an explorable adventure game set in India. Speak naturally and briefly — these lines are voiced aloud. Never break character, never mention being an AI. Return ONLY the structured object.",
      responseMimeType: "application/json",
      responseSchema: dialogueSchema,
      temperature: 1.0,
    },
  });
  if (!res.text) throw new Error("Empty dialogue from text model.");
  const out = JSON.parse(res.text) as DialogueResponse;
  out.options = (out.options ?? []).slice(0, 3);
  while (out.options.length < 3) out.options.push("Hmm… tell me more.");
  return out;
}

/* ------------------------------------------------------------------ */
/* Voice (TTS)                                                         */
/* ------------------------------------------------------------------ */

/** Wrap raw 16-bit mono PCM (24 kHz, Gemini TTS output) in a WAV container. */
function pcmToWav(pcm: Buffer, sampleRate = 24000): Buffer {
  const header = Buffer.alloc(44);
  const dataSize = pcm.length;
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // fmt chunk size
  header.writeUInt16LE(1, 20); // PCM
  header.writeUInt16LE(1, 22); // mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // byte rate
  header.writeUInt16LE(2, 32); // block align
  header.writeUInt16LE(16, 34); // bits per sample
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);
  return Buffer.concat([header, pcm]);
}

/** Synthesize a spoken line. Returns a data-URL WAV, or null on failure. */
export async function synthesizeVoice(
  text: string,
  voiceName = "Kore"
): Promise<string | null> {
  try {
    const res = await ai().models.generateContent({
      model: VOICE_MODEL,
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName } },
        },
      },
    });
    const data = res.candidates?.[0]?.content?.parts?.find(
      (p) => p.inlineData?.data
    )?.inlineData?.data;
    if (!data) return null;
    const wav = pcmToWav(Buffer.from(data, "base64"));
    return `data:audio/wav;base64,${wav.toString("base64")}`;
  } catch (err) {
    console.error("[synthesizeVoice] voice unavailable:", err);
    return null;
  }
}
