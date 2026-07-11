"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import type { Premise, Scene } from "@/lib/types";
import {
  CLOCK_META,
  computeGrade,
  STAT_META,
  STAT_ORDER,
  type Stats,
} from "@/lib/stats";
import { CLOCK_ICON, STAT_ICON } from "./icons";

export function Ending({
  premise,
  scenes,
  stats,
  clock,
  onReplay,
}: {
  premise: Premise;
  scenes: Scene[];
  stats: Stats;
  clock: number;
  onReplay: () => void;
}) {
  const finale = scenes[scenes.length - 1];
  const kind = finale?.endingKind ?? "neutral";
  const grade = computeGrade(stats, clock, kind);

  const headline =
    kind === "victory"
      ? "You made it."
      : kind === "defeat"
        ? "The journey claimed you."
        : "The road ran out.";
  const kicker =
    kind === "victory" ? "Victory" : kind === "defeat" ? "Defeat" : "Fin";

  return (
    <div className="relative min-h-dvh w-full overflow-y-auto">
      <div className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
        {/* Hero: finale image */}
        {finale?.image && (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="relative mx-auto mb-[-3.5rem] max-w-md overflow-hidden rounded-2xl shadow-soft"
          >
            <img
              src={finale.image}
              alt=""
              className="aspect-[4/3] w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
          </motion.div>
        )}

        {/* Grade badge */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          className="relative z-10 mx-auto flex h-28 w-28 items-center justify-center rounded-full bg-surface shadow-soft"
          style={{ border: `5px solid ${grade.color}` }}
        >
          <span
            className="font-display text-6xl font-extrabold"
            style={{ color: grade.color }}
          >
            {grade.grade}
          </span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-5 text-center"
        >
          <p
            className="text-xs font-extrabold uppercase tracking-[0.3em]"
            style={{ color: grade.color }}
          >
            {kicker} · {grade.label}
          </p>
          <h1 className="mt-2 font-display text-4xl font-extrabold text-ink sm:text-5xl">
            {finale?.endingTitle || headline}
          </h1>
          <p className="mt-2 text-sm font-semibold text-inksoft">
            {premise.title}
          </p>
        </motion.div>

        {/* Final stat sheet */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mx-auto mt-8 flex max-w-md flex-wrap items-center justify-center gap-2.5"
        >
          {STAT_ORDER.map((key) => {
            const meta = STAT_META[key];
            return (
              <StatChip
                key={key}
                Icon={STAT_ICON[key]}
                label={meta.label}
                color={meta.color}
                value={
                  meta.kind === "counter"
                    ? `₹${stats[key].toLocaleString("en-IN")}`
                    : String(stats[key])
                }
              />
            );
          })}
          <StatChip
            Icon={CLOCK_ICON}
            label="Time"
            color={CLOCK_META.color}
            value={String(clock)}
          />
        </motion.div>

        {/* Journey recap */}
        <div className="mt-12 space-y-3">
          <p className="text-center text-xs font-bold uppercase tracking-widest text-inksoft">
            Your journey · {scenes.length} frames
          </p>
          {scenes.map((scene, i) => (
            <motion.div
              key={scene.turn}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.4 }}
              className="card flex items-center gap-3.5 rounded-2xl p-2.5"
            >
              <div className="relative shrink-0 overflow-hidden rounded-xl">
                <img
                  src={scene.image}
                  alt=""
                  className="h-20 w-28 object-cover sm:h-24 sm:w-36"
                />
                <span className="absolute left-1.5 top-1.5 rounded-md bg-surface/90 px-1.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-primary">
                  {scene.location || `Ch. ${i + 1}`}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold leading-snug text-ink sm:text-lg">
                  {scene.caption}
                </p>
                {scene.chosen && (
                  <p className="mt-1 truncate text-sm font-semibold text-primary">
                    → {scene.chosen}
                  </p>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-12 flex flex-col items-center gap-3"
        >
          <p className="text-xs font-semibold text-inksoft">
            All frames generated in real time
          </p>
          <button
            onClick={onReplay}
            className="rounded-full bg-primary px-9 py-3.5 text-sm font-extrabold text-white shadow-soft transition hover:brightness-105 active:scale-95"
          >
            Play again
          </button>
        </motion.div>
      </div>
    </div>
  );
}

function StatChip({
  Icon,
  label,
  color,
  value,
}: {
  Icon: LucideIcon;
  label: string;
  color: string;
  value: string;
}) {
  return (
    <div className="card flex items-center gap-2 rounded-full px-4 py-2">
      <Icon size={14} strokeWidth={2.25} style={{ color }} />
      <span className="text-xs font-semibold text-inksoft">{label}</span>
      <span className="text-sm font-extrabold tabular-nums" style={{ color }}>
        {value}
      </span>
    </div>
  );
}
