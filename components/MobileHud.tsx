"use client";

import { useState } from "react";
import {
  DoorOpen,
  Eye,
  Flame,
  Hourglass,
  Map,
  Menu,
  Music,
  Package,
  Search,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { GameBible } from "@/lib/universe";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Minimap, type MinimapCell } from "@/components/Minimap";

/** Compact, collapsible in-game HUD for touch / mobile landscape play. */
export function MobileHud({
  premiseTitle,
  sceneTitle,
  questHook,
  secondsLeft,
  inventory,
  bible,
  cluesFound,
  heat,
  allCluesFound,
  finale,
  finaleLoading,
  onRunFinale,
  showVisionToggle,
  showVision,
  onToggleVision,
  musicOn,
  onToggleMusic,
  voiceOn,
  onToggleVoice,
  onLeaveWorld,
  minimapHidden,
  knownStreets,
  walkedStreets,
  minimapCoord,
  playerPos,
  inside,
}: {
  premiseTitle: string;
  sceneTitle: string;
  questHook: string;
  secondsLeft: number;
  inventory: string[];
  bible: GameBible | null;
  cluesFound: boolean[];
  heat: number;
  allCluesFound: boolean;
  finale: boolean;
  finaleLoading: boolean;
  onRunFinale: () => void;
  showVisionToggle: boolean;
  showVision: boolean;
  onToggleVision: () => void;
  musicOn: boolean;
  onToggleMusic: () => void;
  voiceOn: boolean;
  onToggleVoice: () => void;
  onLeaveWorld: () => void;
  minimapHidden: boolean;
  knownStreets: MinimapCell[];
  walkedStreets: string[];
  minimapCoord: { x: number; y: number } | null;
  playerPos: { x: number; y: number } | null;
  inside: boolean;
}) {
  const [statsOpen, setStatsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);

  const cluesCount = cluesFound.filter(Boolean).length;
  const lowTime = secondsLeft <= 60;

  const closeAll = () => {
    setStatsOpen(false);
    setMenuOpen(false);
    setMapOpen(false);
  };

  const toggleStats = () => {
    setMenuOpen(false);
    setMapOpen(false);
    setStatsOpen((open) => !open);
  };

  const toggleMenu = () => {
    setStatsOpen(false);
    setMapOpen(false);
    setMenuOpen((open) => !open);
  };

  const toggleMap = () => {
    setStatsOpen(false);
    setMenuOpen(false);
    setMapOpen((open) => !open);
  };

  return (
    <>
      {(statsOpen || menuOpen || mapOpen) && (
        <button
          type="button"
          className="pointer-events-auto fixed inset-0 z-10 bg-transparent"
          aria-label="Close HUD panel"
          onClick={closeAll}
        />
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-1.5 p-1.5 pt-[max(0.375rem,env(safe-area-inset-top))] pl-[max(0.375rem,env(safe-area-inset-left))] pr-[max(0.375rem,env(safe-area-inset-right))]">
        <div className="pointer-events-auto relative">
          <Button
            type="button"
            variant="neutral"
            size="icon"
            sound="tap"
            hoverSound="hover"
            aria-expanded={statsOpen}
            aria-label={statsOpen ? "Hide quest info" : "Show quest info"}
            className="size-8 rounded-base text-[10px] font-bold tabular-nums shadow-shadow"
            onClick={toggleStats}
          >
            {statsOpen ? (
              <X size={14} strokeWidth={2.5} />
            ) : (
              <span className="flex items-center gap-1 px-0.5">
                <Hourglass
                  size={11}
                  strokeWidth={2.5}
                  className={lowTime ? "text-health" : "text-main"}
                />
                <span className={lowTime ? "text-health" : "text-foreground"}>
                  {formatSessionTime(secondsLeft)}
                </span>
              </span>
            )}
          </Button>

          {statsOpen && (
            <Card className="absolute left-0 top-9 z-30 flex max-h-[min(52vh,16rem)] w-[min(72vw,16rem)] flex-col gap-1 overflow-y-auto px-2.5 py-2 shadow-shadow">
              <p className="line-clamp-1 text-[9px] font-bold uppercase tracking-widest text-inksoft">
                {premiseTitle} · {sceneTitle}
              </p>
              {questHook && (
                <p className="text-xs font-semibold leading-snug text-foreground">
                  {questHook}
                </p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border/60 pt-1.5">
                <span className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-inksoft">
                  <Hourglass
                    size={10}
                    strokeWidth={2.5}
                    className={lowTime ? "text-health" : "text-main"}
                  />
                  Time
                  <span
                    className={`tabular-nums ${lowTime ? "text-health" : "text-foreground"}`}
                  >
                    {formatSessionTime(secondsLeft)}
                  </span>
                </span>
                {bible && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                    <Search size={10} strokeWidth={2.5} className="text-main" />
                    <span className="flex gap-0.5">
                      {cluesFound.map((found, i) => (
                        <span
                          key={i}
                          className={`h-1 w-2.5 rounded-full ${
                            found ? "bg-main" : "bg-foreground/15"
                          }`}
                        />
                      ))}
                    </span>
                    {cluesCount}/{cluesFound.length}
                  </span>
                )}
                {bible && heat > 0 && (
                  <span className="flex items-center gap-1 text-[10px] font-bold text-foreground">
                    <Flame
                      size={10}
                      strokeWidth={2.5}
                      className={heat >= 60 ? "text-health" : "text-inksoft"}
                    />
                    {bible.heatLabel}
                    <Progress
                      value={heat}
                      className="h-1 w-10 [&_[data-slot=progress-indicator]]:bg-health"
                    />
                    {heat}
                  </span>
                )}
              </div>
              {inventory.length > 0 && (
                <div className="flex flex-wrap items-center gap-1 border-t border-border/60 pt-1.5">
                  <Package size={10} strokeWidth={2.5} className="text-main" />
                  {inventory.map((it) => (
                    <Badge key={it} variant="neutral" className="px-1.5 py-0 text-[9px]">
                      {it}
                    </Badge>
                  ))}
                </div>
              )}
              {bible && allCluesFound && !finale && (
                <Button
                  size="sm"
                  className="mt-1 h-7 w-full px-2 text-[10px]"
                  onClick={onRunFinale}
                  disabled={finaleLoading}
                >
                  {finaleLoading ? "Unraveling…" : "Unravel the truth"}
                </Button>
              )}
            </Card>
          )}
        </div>

        <div className="pointer-events-auto relative flex items-start gap-1">
          <Button
            type="button"
            variant={menuOpen ? "default" : "neutral"}
            size="icon"
            sound="tap"
            hoverSound="hover"
            aria-expanded={menuOpen}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            className="size-8 shadow-shadow"
            onClick={toggleMenu}
          >
            {menuOpen ? (
              <X size={14} strokeWidth={2.5} />
            ) : (
              <Menu size={14} strokeWidth={2.5} />
            )}
          </Button>

          {!minimapHidden && (
            <Button
              type="button"
              variant={mapOpen ? "default" : "neutral"}
              size="icon"
              sound="tap"
              hoverSound="hover"
              aria-expanded={mapOpen}
              aria-label={mapOpen ? "Hide map" : "Show map"}
              className="size-8 shadow-shadow"
              onClick={toggleMap}
            >
              <Map size={14} strokeWidth={2.5} />
            </Button>
          )}

          {menuOpen && (
            <Card className="absolute right-0 top-9 z-30 flex flex-col gap-1 p-1.5 shadow-shadow">
              {showVisionToggle && (
                <Button
                  variant={showVision ? "default" : "neutral"}
                  size="sm"
                  hoverSound="hover"
                  className="h-8 justify-start gap-2 px-2 text-[11px]"
                  onClick={onToggleVision}
                >
                  <Eye size={13} />
                  {showVision ? "Hide vision" : "Show vision"}
                </Button>
              )}
              <Button
                variant={musicOn ? "default" : "neutral"}
                size="sm"
                sound={musicOn ? "toggleOff" : "toggleOn"}
                hoverSound="hover"
                className="h-8 justify-start gap-2 px-2 text-[11px]"
                onClick={onToggleMusic}
              >
                <Music size={13} className={musicOn ? "" : "opacity-40"} />
                {musicOn ? "Music on" : "Music off"}
              </Button>
              <Button
                variant={voiceOn ? "default" : "neutral"}
                size="sm"
                sound={voiceOn ? "toggleOff" : "toggleOn"}
                hoverSound="hover"
                className="h-8 justify-start gap-2 px-2 text-[11px]"
                onClick={onToggleVoice}
              >
                {voiceOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
                {voiceOn ? "Voice on" : "Voice off"}
              </Button>
              <Button
                variant="neutral"
                size="sm"
                sound="close"
                hoverSound="hover"
                className="h-8 justify-start gap-2 px-2 text-[11px]"
                onClick={onLeaveWorld}
              >
                <DoorOpen size={13} />
                Leave world
              </Button>
            </Card>
          )}

          {mapOpen && !minimapHidden && (
            <div className="absolute right-0 top-9 z-30">
              <Minimap
                known={knownStreets}
                walked={walkedStreets}
                currentCoord={minimapCoord}
                player={playerPos}
                inside={inside}
                compact
                mini
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function formatSessionTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}
