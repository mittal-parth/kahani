"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import type { Premise, Scene } from "@/lib/types";
import { MAX_TURNS } from "@/lib/constants";
import { TAG_META, type Choice, type Stats } from "@/lib/stats";
import { Hud } from "./Hud";
import { InstantIcon, PREMISE_ICON, TAG_ICON } from "./icons";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function SceneView({
  premise,
  scene,
  stats,
  clock,
  progress,
  scenes,
  busy,
  pendingChoice,
  readyIndices,
  error,
  onChoose,
  onRetry,
  onFinish,
  onQuit,
}: {
  premise: Premise;
  scene: Scene | null;
  stats: Stats;
  clock: number;
  progress: number;
  scenes: Scene[];
  busy: boolean;
  pendingChoice: string | null;
  readyIndices: Set<number>;
  error: string | null;
  onChoose: (option: string, index: number) => void;
  onRetry: () => void;
  onFinish: () => void;
  onQuit: () => void;
}) {
  const isFirstLoad = !scene && busy;
  const readyCount = scene
    ? scene.choices.filter((_, i) => readyIndices.has(i)).length
    : 0;

  if (isFirstLoad || !scene) {
    return <FirstLoad premise={premise} error={error} onRetry={onRetry} />;
  }

  return (
    <div className="relative min-h-dvh w-full overflow-hidden bg-ink">
      {/* --- Scene image fills the screen --- */}
      <div className="absolute inset-0">
        <AnimatePresence mode="popLayout">
          <motion.img
            key={scene.turn}
            src={scene.image}
            alt=""
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
            className="animate-kenburns absolute inset-0 h-full w-full object-cover"
          />
        </AnimatePresence>
        <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-black/45 to-transparent" />
      </div>

      {/* --- Top chrome + HUD --- */}
      <div className="relative z-10 flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0 flex-1">
          <Hud
            premise={premise}
            stats={stats}
            clock={clock}
            effects={scene.effects}
            timeCost={scene.timeCost}
            effectKey={scene.turn}
            progress={progress}
            location={scene.location}
            scenes={scenes}
          />
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={onQuit}
            className="panel rounded-full px-3 py-1.5 text-xs font-bold text-ink transition active:scale-95"
          >
            Leave
          </button>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/70 text-shadow-soft">
            Ch. {Math.min(scene.turn, MAX_TURNS)}
          </span>
        </div>
      </div>

      {/* --- Bottom sheet: caption + actions --- */}
      <div className="absolute inset-x-0 bottom-0 z-10 flex justify-center px-0 sm:px-4 sm:pb-4">
        <motion.div
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.45, ease: EASE_OUT }}
          className="sheet w-full max-w-2xl rounded-t-2xl px-5 pb-7 pt-5 sm:rounded-2xl"
        >
          {/* Outcome flash */}
          <AnimatePresence mode="wait">
            {scene.outcomeFlash && !scene.isEnding && (
              <motion.div
                key={`flash-${scene.turn}`}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="mb-2.5 inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                {scene.outcomeFlash}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Caption */}
          <AnimatePresence mode="wait">
            <motion.p
              key={scene.turn}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.4, ease: EASE_OUT }}
              className="font-display text-2xl font-bold leading-tight text-ink sm:text-3xl"
            >
              {scene.caption}
            </motion.p>
          </AnimatePresence>

          {scene.isEnding ? (
            <EndingBlock
              title={scene.endingTitle}
              kind={scene.endingKind}
              onFinish={onFinish}
            />
          ) : (
            <>
              <div className="mt-4 mb-2.5 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-bold uppercase tracking-widest text-inksoft">
                  Choose your move
                </span>
                <PregenMeter ready={readyCount} total={scene.choices.length} />
              </div>
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {scene.choices.map((choice, i) => (
                  <ChoiceButton
                    key={`${scene.turn}-${i}`}
                    index={i}
                    choice={choice}
                    disabled={busy}
                    pending={pendingChoice === choice.text}
                    dimmed={busy && pendingChoice !== choice.text}
                    ready={readyIndices.has(i)}
                    onClick={() => onChoose(choice.text, i)}
                  />
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* --- Error toast --- */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ ease: EASE_OUT }}
            className="card absolute inset-x-0 top-24 z-30 mx-auto flex w-[min(92%,28rem)] items-center gap-3 rounded-xl px-4 py-3"
          >
            <span className="text-sm font-semibold text-ink">{error}</span>
            <button
              onClick={onRetry}
              className="ml-auto shrink-0 rounded-full bg-health px-3 py-1.5 text-xs font-bold text-white transition active:scale-95"
            >
              Retry
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function ChoiceButton({
  index,
  choice,
  disabled,
  pending,
  dimmed,
  ready,
  onClick,
}: {
  index: number;
  choice: Choice;
  disabled: boolean;
  pending: boolean;
  dimmed: boolean;
  ready: boolean;
  onClick: () => void;
}) {
  const tag = TAG_META[choice.tag];
  const Icon = TAG_ICON[choice.tag];
  return (
    <motion.button
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: dimmed ? 0.45 : 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.04 + index * 0.05, ease: EASE_OUT }}
      whileHover={disabled ? undefined : { y: -2 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      disabled={disabled}
      onClick={onClick}
      className={`relative flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
        pending
          ? "border-primary/40 bg-primary/8"
          : "border-ink/8 bg-surface hover:border-ink/20"
      } ${disabled ? "cursor-default" : "cursor-pointer"} shadow-soft`}
    >
      <span
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
        style={{ backgroundColor: `${tag.color}18`, color: tag.color }}
        title={`${tag.label} approach`}
      >
        <Icon size={18} strokeWidth={2.25} />
      </span>
      <span className="flex-1 text-[15px] font-bold leading-tight text-ink">
        {choice.text}
      </span>
      {pending ? (
        <span className="flex gap-1 pr-1">
          <Dot delay={0} />
          <Dot delay={0.15} />
          <Dot delay={0.3} />
        </span>
      ) : ready ? (
        <span
          className="flex h-6 w-6 items-center justify-center rounded-full bg-kind/12 text-kind"
          title="Pre-generated — instant"
        >
          <InstantIcon size={13} strokeWidth={2.5} />
        </span>
      ) : (
        <ChevronRight size={16} className="text-inksoft/40" />
      )}
    </motion.button>
  );
}

function PregenMeter({ ready, total }: { ready: number; total: number }) {
  const done = ready >= total;
  return (
    <motion.div
      layout
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
        done ? "bg-kind/12 text-kind" : "bg-ink/6 text-inksoft"
      }`}
      title={
        done
          ? "All four outcomes pre-generated — tapping is instant"
          : "Generating all four branches in parallel while you decide"
      }
    >
      <InstantIcon
        size={12}
        strokeWidth={2.5}
        className={done ? "" : "animate-breathe"}
      />
      <span className="flex gap-0.5">
        {Array.from({ length: total }).map((_, i) => (
          <span
            key={i}
            className={`h-1.5 w-3 rounded-full transition-colors duration-300 ${
              i < ready ? "bg-kind" : "animate-breathe bg-ink/15"
            }`}
          />
        ))}
      </span>
      <span>
        {done ? "Moves ready · instant" : `Pre-generating ${ready}/${total}`}
      </span>
    </motion.div>
  );
}

function EndingBlock({
  title,
  kind,
  onFinish,
}: {
  title?: string;
  kind?: "victory" | "defeat" | "neutral";
  onFinish: () => void;
}) {
  const label =
    kind === "victory"
      ? "You reached your goal"
      : kind === "defeat"
        ? "Your journey ends here"
        : "Your story ends";
  const accent =
    kind === "victory"
      ? "text-kind"
      : kind === "defeat"
        ? "text-health"
        : "text-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15, ease: EASE_OUT }}
      className="mt-4 flex flex-col items-start gap-3"
    >
      <p className={`text-xs font-bold uppercase tracking-[0.2em] ${accent}`}>
        {label}
      </p>
      {title && (
        <h2 className="font-display text-2xl font-extrabold text-ink">
          {title}
        </h2>
      )}
      <button
        onClick={onFinish}
        className="mt-1 rounded-full bg-primary px-6 py-3 text-sm font-bold text-white shadow-soft transition hover:brightness-105 active:scale-95"
      >
        See your journey →
      </button>
    </motion.div>
  );
}

function FirstLoad({
  premise,
  error,
  onRetry,
}: {
  premise: Premise;
  error: string | null;
  onRetry: () => void;
}) {
  const Icon = PREMISE_ICON[premise.id];
  return (
    <div className="relative flex min-h-dvh w-full flex-col items-center justify-center px-6 text-center">
      <div className="shimmer relative mb-8 h-1.5 w-44 overflow-hidden rounded-full bg-ink/10" />
      <div className="card flex h-20 w-20 items-center justify-center rounded-2xl text-primary">
        {Icon ? <Icon size={34} strokeWidth={2} /> : null}
      </div>
      <h2 className="mt-5 font-display text-3xl font-extrabold text-ink">
        {premise.title}
      </h2>
      {error ? (
        <div className="mt-5 flex flex-col items-center gap-3">
          <p className="max-w-sm text-sm font-semibold text-health">{error}</p>
          <button
            onClick={onRetry}
            className="rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-surface transition active:scale-95"
          >
            Try again
          </button>
        </div>
      ) : (
        <p className="mt-3 flex items-center gap-2 text-sm font-semibold text-inksoft">
          <Dot delay={0} />
          <Dot delay={0.15} />
          <Dot delay={0.3} />
          <span className="ml-1">Setting the scene…</span>
        </p>
      )}
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="animate-breathe inline-block h-1.5 w-1.5 rounded-full bg-primary"
      style={{ animationDelay: `${delay}s` }}
    />
  );
}
