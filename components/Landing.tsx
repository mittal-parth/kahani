"use client";

import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";
import { PREMISES } from "@/lib/premises";
import type { Premise } from "@/lib/types";
import { PREMISE_ICON } from "./icons";

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

export function Landing({
  onSelect,
}: {
  onSelect: (premise: Premise) => void;
}) {
  return (
    <div className="mx-auto grid min-h-dvh max-w-5xl grid-cols-1 items-start gap-10 px-6 py-14 md:grid-cols-[minmax(0,1fr)_1.25fr] md:gap-16 md:py-24">
      {/* Left-biased title block (no centred hero) */}
      <motion.header
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: EASE_OUT }}
        className="md:sticky md:top-24"
      >
        <div className="mb-6 inline-flex items-center gap-2 text-xs font-bold text-primary">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Generated live · Nano Banana 2 Lite
        </div>

        <h1 className="font-display text-6xl font-extrabold leading-[0.95] tracking-tight text-ink sm:text-7xl">
          Kahani
        </h1>
        <p className="mt-4 max-w-xs text-lg font-semibold text-ink">
          An AI story you play — set in India.
        </p>
        <p className="mt-4 max-w-sm text-sm font-medium leading-relaxed text-inksoft">
          Pick a world. Every move rewrites what happens next, and a fresh scene
          is generated in seconds. No two runs are the same.
        </p>
      </motion.header>

      {/* Worlds as an editorial index list (not a symmetric card grid) */}
      <div>
        <p className="mb-1 text-xs font-bold uppercase tracking-widest text-inksoft">
          Choose a world
        </p>
        <ul>
          {PREMISES.map((premise, i) => {
            const Icon = PREMISE_ICON[premise.id];
            return (
              <motion.li
                key={premise.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.1 + i * 0.06,
                  ease: EASE_OUT,
                }}
              >
                <button
                  onClick={() => onSelect(premise)}
                  className="group flex w-full items-center gap-4 border-t border-ink/10 py-5 text-left transition-colors hover:border-primary/40"
                >
                  {Icon ? (
                    <Icon
                      size={26}
                      strokeWidth={1.75}
                      className="shrink-0 text-primary transition-transform duration-300 group-hover:-translate-y-0.5"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-display text-xl font-bold text-ink sm:text-2xl">
                      {premise.title}
                    </h2>
                    <p className="mt-0.5 text-sm font-medium text-inksoft">
                      {premise.tagline}
                    </p>
                  </div>
                  <ChevronRight
                    size={20}
                    className="shrink-0 text-inksoft/40 transition-all duration-300 group-hover:translate-x-1 group-hover:text-primary"
                  />
                </button>
              </motion.li>
            );
          })}
        </ul>

        <p className="mt-10 border-t border-ink/10 pt-5 text-xs font-medium text-inksoft/70">
          Real-time generative storytelling · built for the NB2 Lite hackathon
        </p>
      </div>
    </div>
  );
}
