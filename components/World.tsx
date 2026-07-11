"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Volume2, VolumeX } from "lucide-react";
import type { Premise } from "@/lib/types";
import type {
  DialogueResponse,
  DialogueTurn,
  Hotspot,
  SceneData,
} from "@/lib/universe";
import { Landing } from "./Landing";
import { GameCanvas } from "./GameCanvas";
import { DialogueBox } from "./DialogueBox";

type Phase = "select" | "booting" | "playing";

const OPENING_OPTIONS = [
  "Who are you?",
  "What is this place?",
  "I'm looking for something.",
];

/** Turn a white-background sprite render into a transparent-canvas sprite. */
async function chromaKeySprite(dataUrl: string): Promise<HTMLCanvasElement> {
  const img = new Image();
  img.src = dataUrl;
  await new Promise<void>((res, rej) => {
    img.onload = () => res();
    img.onerror = () => rej(new Error("sprite load failed"));
  });
  const c = document.createElement("canvas");
  c.width = img.naturalWidth;
  c.height = img.naturalHeight;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const data = ctx.getImageData(0, 0, c.width, c.height);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    const r = px[i];
    const g = px[i + 1];
    const b = px[i + 2];
    // near-white → transparent; softly feather off-whites
    if (r > 232 && g > 232 && b > 232) {
      px[i + 3] = 0;
    } else if (r > 215 && g > 215 && b > 215) {
      px[i + 3] = Math.round(px[i + 3] * 0.4);
    }
  }
  ctx.putImageData(data, 0, 0);
  return c;
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status}).`);
  return data as T;
}

function stripDataUrl(dataUrl: string): string {
  const comma = dataUrl.indexOf(",");
  return comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
}

export function World() {
  const [phase, setPhase] = useState<Phase>("select");
  const [premise, setPremise] = useState<Premise | null>(null);
  const [scene, setScene] = useState<SceneData | null>(null);
  const [questHook, setQuestHook] = useState("");
  const [sprite, setSprite] = useState<HTMLCanvasElement | null>(null);
  const [bootStatus, setBootStatus] = useState("Dreaming up the world…");
  const [entering, setEntering] = useState<string | null>(null);
  const [ambient, setAmbient] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);

  // Dialogue state
  const [dialogue, setDialogue] = useState<{
    npc: SceneData["npc"] & object;
    history: DialogueTurn[];
    options: string[];
    thinking: boolean;
  } | null>(null);

  const scenesRef = useRef<Map<string, SceneData>>(new Map());
  const interiorPromises = useRef<Map<string, Promise<SceneData>>>(new Map());
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceOnRef = useRef(voiceOn);
  voiceOnRef.current = voiceOn;

  /* ---------------- voice ---------------- */

  const speak = useCallback(async (text: string) => {
    if (!voiceOnRef.current || !text.trim()) return;
    try {
      const { audio } = await post<{ audio: string | null }>("/api/voice", {
        text,
      });
      if (!audio || !voiceOnRef.current) return;
      audioRef.current?.pause();
      const el = new Audio(audio);
      audioRef.current = el;
      setSpeaking(true);
      el.onended = () => setSpeaking(false);
      el.onerror = () => setSpeaking(false);
      await el.play().catch(() => setSpeaking(false));
    } catch {
      // voice is best-effort
    }
  }, []);

  const stopVoice = useCallback(() => {
    audioRef.current?.pause();
    setSpeaking(false);
  }, []);

  /* ---------------- scene helpers ---------------- */

  const showScene = useCallback((s: SceneData) => {
    scenesRef.current.set(s.id, s);
    setScene(s);
    setAmbient(s.ambient);
    setTimeout(() => setAmbient((a) => (a === s.ambient ? null : a)), 5000);
  }, []);

  const prefetchInterior = useCallback(
    (thePremise: Premise, hook: string, h: Hotspot) => {
      if (!h.interiorPrompt || interiorPromises.current.has(h.id)) return;
      const p = post<{ scene: SceneData }>("/api/scene", {
        premise: thePremise,
        building: { id: h.id, name: h.name, interiorPrompt: h.interiorPrompt },
        questHook: hook,
      }).then(({ scene: s }) => {
        scenesRef.current.set(s.id, s);
        return s;
      });
      p.catch(() => interiorPromises.current.delete(h.id));
      interiorPromises.current.set(h.id, p);
    },
    []
  );

  /* ---------------- boot ---------------- */

  const begin = useCallback(
    async (idea: string) => {
      setPhase("booting");
      setError(null);
      setScene(null);
      setSprite(null);
      setDialogue(null);
      setPremise(null);
      scenesRef.current = new Map();
      interiorPromises.current = new Map();

      try {
        // 1) Expand the player's idea into a universe spec.
        setBootStatus("Reading your idea…");
        const { spec } = await post<{
          spec: { title: string; setup: string; styleBible: string };
        }>("/api/universe", { idea });
        const chosen: Premise = {
          id: "custom",
          title: spec.title,
          tagline: "",
          setup: spec.setup,
          emoji: "✦",
          styleBible: spec.styleBible,
          goal: "",
          goalLabel: "",
          goalEmoji: "",
          clockLabel: "",
        };
        setPremise(chosen);

        // 2) Paint the opening street.
        setBootStatus("Painting your opening scene…");
        const { scene: street, questHook: hook } = await post<{
          scene: SceneData;
          questHook: string;
        }>("/api/scene", { premise: chosen });
        setQuestHook(hook || "");
        showScene(street);
        setPhase("playing");

        // 3) Forge the character FROM the street frame, so the sprite shares
        //    the scene's exact art style and lighting (a marker stands in
        //    until it lands).
        post<{ sprite: string }>("/api/sprite", {
          premise: chosen,
          referenceFrame: stripDataUrl(street.image),
        })
          .then(({ sprite: s }) => chromaKeySprite(s))
          .then(setSprite)
          .catch(() => {});

        // 4) Pre-generate every interior while the player walks around.
        street.hotspots
          .filter((h) => h.kind === "building")
          .forEach((h) => prefetchInterior(chosen, hook || "", h));
      } catch (e) {
        setError(e instanceof Error ? e.message : "World generation failed.");
        setPhase("select");
      }
    },
    [prefetchInterior, showScene]
  );

  /* ---------------- interaction ---------------- */

  const onInteract = useCallback(
    async (h: Hotspot) => {
      if (!premise || !scene) return;

      if (h.kind === "exit") {
        stopVoice();
        setDialogue(null);
        const parent = scenesRef.current.get(scene.parentId ?? "street");
        if (parent) showScene(parent);
        return;
      }

      if (h.kind === "npc" && scene.npc) {
        const opening = scene.npc.opening;
        setDialogue({
          npc: scene.npc,
          history: [{ speaker: "npc", text: opening }],
          options: OPENING_OPTIONS,
          thinking: false,
        });
        speak(opening);
        return;
      }

      if (h.kind === "building") {
        setEntering(h.name);
        try {
          let interior = scenesRef.current.get(h.id);
          if (!interior) {
            prefetchInterior(premise, questHook, h);
            interior = await interiorPromises.current.get(h.id);
          }
          if (interior) showScene(interior);
        } catch {
          setError(`Couldn't step into ${h.name}. Try again.`);
          setTimeout(() => setError(null), 4000);
        } finally {
          setEntering(null);
        }
      }
    },
    [premise, scene, questHook, prefetchInterior, showScene, speak, stopVoice]
  );

  const onSay = useCallback(
    async (line: string) => {
      if (!premise || !scene?.npc || !dialogue) return;
      const history: DialogueTurn[] = [
        ...dialogue.history,
        { speaker: "player", text: line },
      ];
      setDialogue({ ...dialogue, history, options: [], thinking: true });
      try {
        const reply = await post<DialogueResponse>("/api/dialogue", {
          premise,
          npc: dialogue.npc,
          sceneTitle: scene.title,
          questHook,
          history: dialogue.history,
          playerLine: line,
        });
        if (reply.questUpdate?.trim()) setQuestHook(reply.questUpdate.trim());
        setDialogue({
          npc: dialogue.npc,
          history: [...history, { speaker: "npc", text: reply.line }],
          options: reply.done ? [] : reply.options,
          thinking: false,
        });
        speak(reply.line);
      } catch {
        setDialogue({
          ...dialogue,
          history,
          options: OPENING_OPTIONS,
          thinking: false,
        });
      }
    },
    [premise, scene, dialogue, questHook, speak]
  );

  const closeDialogue = useCallback(() => {
    stopVoice();
    setDialogue(null);
  }, [stopVoice]);

  const leaveWorld = useCallback(() => {
    stopVoice();
    setPhase("select");
    setPremise(null);
    setScene(null);
    setDialogue(null);
  }, [stopVoice]);

  // Global Esc: close dialogue handled in DialogueBox; nothing else here.
  useEffect(() => stopVoice, [stopVoice]);

  /* ---------------- render ---------------- */

  if (phase === "select") {
    return (
      <div>
        <Landing onStart={begin} />
        {error && (
          <p className="pb-8 text-center text-sm font-semibold text-health">
            {error}
          </p>
        )}
      </div>
    );
  }

  if (phase === "booting" || !scene || !premise) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
        <div className="shimmer relative mb-8 h-1.5 w-44 overflow-hidden rounded-full bg-ink/10" />
        <h2 className="font-display text-3xl font-extrabold text-ink">
          {premise?.title ?? "Building your world"}
        </h2>
        <p className="mt-3 text-sm font-semibold text-inksoft">{bootStatus}</p>
        <p className="mt-1 text-xs font-medium text-inksoft/70">
          world · scene · character · interiors — all generated live
        </p>
      </div>
    );
  }

  return (
    <div className="relative h-dvh w-full overflow-hidden bg-ink">
      <GameCanvas
        scene={scene}
        sprite={sprite}
        paused={dialogue !== null || entering !== null}
        onInteract={onInteract}
      />

      {/* --- HUD: world / scene / quest --- */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-start justify-between gap-3 p-4">
        <div className="panel max-w-sm rounded-2xl px-4 py-2.5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-inksoft">
            {premise.title} · {scene.title}
          </p>
          {questHook && (
            <p className="mt-0.5 text-sm font-semibold leading-snug text-ink">
              {questHook}
            </p>
          )}
        </div>
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            onClick={() => setVoiceOn((v) => !v)}
            className={`panel flex h-9 w-9 items-center justify-center rounded-full transition active:scale-95 ${
              voiceOn ? "text-primary" : "text-inksoft"
            }`}
            title={voiceOn ? "Voice on" : "Voice off"}
          >
            {voiceOn ? <Volume2 size={15} /> : <VolumeX size={15} />}
          </button>
          <button
            onClick={leaveWorld}
            className="panel rounded-full px-3.5 py-2 text-xs font-bold text-ink transition active:scale-95"
          >
            Leave world
          </button>
        </div>
      </div>

      {/* --- Ambient line --- */}
      <AnimatePresence>
        {ambient && (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="pointer-events-none absolute inset-x-0 top-24 z-10 mx-auto w-fit max-w-[80%] rounded-full bg-black/55 px-4 py-2 text-center text-sm font-medium text-white backdrop-blur-sm"
          >
            {ambient}
          </motion.p>
        )}
      </AnimatePresence>

      {/* --- Controls hint --- */}
      {!dialogue && (
        <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/55 px-4 py-2 text-xs font-semibold text-white/90 backdrop-blur-sm">
          WASD / arrows — move · E — enter / talk
        </div>
      )}

      {/* --- Entering overlay --- */}
      <AnimatePresence>
        {entering && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center justify-center bg-black/60"
          >
            <div className="panel rounded-2xl px-6 py-4 text-center">
              <p className="font-display text-xl font-bold text-ink">
                {entering}
              </p>
              <p className="mt-1 flex items-center justify-center gap-1.5 text-sm font-medium text-inksoft">
                <span className="animate-breathe inline-block h-1.5 w-1.5 rounded-full bg-primary" />
                stepping inside…
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- Dialogue --- */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center sm:p-4">
        <AnimatePresence>
          {dialogue && scene.npc && (
            <DialogueBox
              npc={dialogue.npc}
              history={dialogue.history}
              options={dialogue.options}
              thinking={dialogue.thinking}
              speaking={speaking}
              voiceOn={voiceOn}
              onToggleVoice={() => setVoiceOn((v) => !v)}
              onSay={onSay}
              onClose={closeDialogue}
            />
          )}
        </AnimatePresence>
      </div>

      {/* --- Error toast --- */}
      <AnimatePresence>
        {error && phase === "playing" && (
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="card absolute bottom-16 left-1/2 z-30 -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-semibold text-health"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}
