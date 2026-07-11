"use client";

import { useCallback, useEffect, useRef } from "react";
import type { Hotspot, SceneData } from "@/lib/universe";

/** Default depth band the player walks in, as % of frame height (pseudo-2.5D). */
const DEFAULT_BAND_TOP = 58;
const BAND_BOTTOM = 92;
const SPEED_X = 26; // % of width per second
const SPEED_DEPTH = 0.55; // band fraction per second

export type PlayerState = {
  x: number; // 0-100 (% of width)
  depth: number; // 0..1 within the walk band
  dir: 1 | -1;
  moving: boolean;
};

export function GameCanvas({
  scene,
  sprite,
  paused,
  onInteract,
}: {
  scene: SceneData;
  sprite: HTMLCanvasElement | null;
  /** True while dialogue / overlays own the keyboard. */
  paused: boolean;
  onInteract: (hotspot: Hotspot) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const keysRef = useRef<Record<string, boolean>>({});
  const playerRef = useRef<PlayerState>({ x: 12, depth: 0.5, dir: 1, moving: false });
  const nearRef = useRef<Hotspot | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  // (Re)load the backdrop when the scene changes; reset spawn position.
  useEffect(() => {
    const img = new Image();
    img.src = scene.image;
    img.onload = () => {
      imgRef.current = img;
    };
    playerRef.current = {
      x: scene.kind === "interior" ? 50 : 12,
      depth: 0.6,
      dir: 1,
      moving: false,
    };
  }, [scene.id, scene.image, scene.kind]);

  // Ground horizon from the vision pass over the actual frame.
  const bandTop = Math.max(
    45,
    Math.min(80, scene.groundTop ?? DEFAULT_BAND_TOP)
  );

  const playerFoot = useCallback((): { px: number; py: number } => {
    const p = playerRef.current;
    return { px: p.x, py: bandTop + (BAND_BOTTOM - bandTop) * p.depth };
  }, [bandTop]);

  /** True when the point is inside a no-walk obstacle box (water, people,
   *  stalls…) — unless it's within an interaction zone, which stays reachable. */
  const isBlocked = useCallback(
    (px: number, py: number): boolean => {
      const obstacles = scene.obstacles ?? [];
      if (obstacles.length === 0) return false;
      const m = 4;
      for (const h of scene.hotspots) {
        if (
          px >= h.rect.x - m &&
          px <= h.rect.x + h.rect.w + m &&
          py >= h.rect.y - m &&
          py <= h.rect.y + h.rect.h + m
        ) {
          return false; // doors and NPCs must stay approachable
        }
      }
      for (const o of obstacles) {
        if (px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h) {
          return true;
        }
      }
      return false;
    },
    [scene.obstacles, scene.hotspots]
  );

  // Keyboard
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const k = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", "e", "enter"].includes(k)) {
        e.preventDefault();
      }
      if (k === "e" || k === "enter") {
        const near = nearRef.current;
        if (near) onInteract(near);
        return;
      }
      keysRef.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.key.toLowerCase()] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [onInteract]);

  // Render loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      if (!parent) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = parent.clientWidth;
      const ch = parent.clientHeight;
      if (canvas.width !== cw * dpr || canvas.height !== ch * dpr) {
        canvas.width = cw * dpr;
        canvas.height = ch * dpr;
        canvas.style.width = `${cw}px`;
        canvas.style.height = `${ch}px`;
      }
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // --- Move (with obstacle collision; slide along the blocked axis) ---
      const p = playerRef.current;
      if (!pausedRef.current) {
        const keys = keysRef.current;
        let vx = 0;
        let vd = 0;
        if (keys["arrowleft"] || keys["a"]) vx -= 1;
        if (keys["arrowright"] || keys["d"]) vx += 1;
        if (keys["arrowup"] || keys["w"]) vd -= 1;
        if (keys["arrowdown"] || keys["s"]) vd += 1;
        if (vx !== 0) p.dir = vx > 0 ? 1 : -1;
        p.moving = vx !== 0 || vd !== 0;

        const footY = (depth: number) =>
          bandTop + (BAND_BOTTOM - bandTop) * depth;
        const nx = Math.max(2, Math.min(98, p.x + vx * SPEED_X * dt));
        const nd = Math.max(0, Math.min(1, p.depth + vd * SPEED_DEPTH * dt));

        if (!isBlocked(nx, footY(nd))) {
          p.x = nx;
          p.depth = nd;
        } else if (!isBlocked(nx, footY(p.depth))) {
          p.x = nx; // slide horizontally along the obstacle
        } else if (!isBlocked(p.x, footY(nd))) {
          p.depth = nd; // slide in depth along the obstacle
        }
      } else {
        p.moving = false;
      }

      // --- Near hotspot? ---
      const { px, py } = playerFoot();
      let near: Hotspot | null = null;
      for (const h of scene.hotspots) {
        const m = 4; // forgiving margin (percent)
        if (
          px >= h.rect.x - m &&
          px <= h.rect.x + h.rect.w + m &&
          py >= h.rect.y - m &&
          py <= h.rect.y + h.rect.h + m
        ) {
          near = h;
          break;
        }
      }
      nearRef.current = near;

      // --- Draw backdrop (cover fit) ---
      ctx.clearRect(0, 0, cw, ch);
      const img = imgRef.current;
      if (img && img.naturalWidth > 0) {
        const s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
        const dw = img.naturalWidth * s;
        const dh = img.naturalHeight * s;
        ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
      } else {
        ctx.fillStyle = "#1a1410";
        ctx.fillRect(0, 0, cw, ch);
      }

      // --- Hotspot affordances ---
      for (const h of scene.hotspots) {
        const hx = (h.rect.x / 100) * cw;
        const hy = (h.rect.y / 100) * ch;
        const hw = (h.rect.w / 100) * cw;
        const hh = (h.rect.h / 100) * ch;
        const isNear = near?.id === h.id;

        // Marker dot above the zone
        const t = now / 500;
        const bob = Math.sin(t + h.rect.x) * 3;
        ctx.beginPath();
        ctx.arc(hx + hw / 2, hy - 10 + bob, isNear ? 6 : 4, 0, Math.PI * 2);
        ctx.fillStyle = isNear ? "#ffb24d" : "rgba(255,255,255,0.75)";
        ctx.shadowColor = "rgba(0,0,0,0.6)";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;

        if (isNear) {
          ctx.strokeStyle = "rgba(255,178,77,0.9)";
          ctx.lineWidth = 2;
          ctx.setLineDash([6, 5]);
          ctx.strokeRect(hx, hy, hw, hh);
          ctx.setLineDash([]);
        }
      }

      // --- Player sprite ---
      const footX = (px / 100) * cw;
      const footY = (py / 100) * ch;
      const scale = 0.62 + 0.48 * p.depth;
      const spriteH = ch * 0.34 * scale;

      // soft ground shadow
      ctx.beginPath();
      ctx.ellipse(footX, footY, spriteH * 0.18, spriteH * 0.05, 0, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fill();

      if (sprite) {
        const ratio = sprite.width / sprite.height;
        const sh = spriteH;
        const sw = sh * ratio;
        const bob = p.moving ? Math.abs(Math.sin(now / 110)) * sh * 0.03 : 0;
        ctx.save();
        ctx.translate(footX, footY - bob);
        if (p.dir === -1) ctx.scale(-1, 1);
        ctx.drawImage(sprite, -sw / 2, -sh, sw, sh);
        ctx.restore();
      } else {
        // fallback marker while the sprite generates
        ctx.beginPath();
        ctx.arc(footX, footY - spriteH * 0.5, spriteH * 0.16, 0, Math.PI * 2);
        ctx.fillStyle = "#c8552e";
        ctx.fill();
      }

      // --- Interaction prompt ---
      if (near && !pausedRef.current) {
        const label =
          near.kind === "building"
            ? `E — enter ${near.name}`
            : near.kind === "npc"
              ? `E — talk to ${near.name}`
              : `E — ${near.name}`;
        ctx.font = "600 14px var(--font-sans), system-ui, sans-serif";
        const tw = ctx.measureText(label).width;
        const bx = footX - tw / 2 - 12;
        const by = footY - spriteH - 40;
        ctx.fillStyle = "rgba(20,14,10,0.82)";
        ctx.beginPath();
        ctx.roundRect(bx, by, tw + 24, 30, 15);
        ctx.fill();
        ctx.fillStyle = "#ffb24d";
        ctx.fillText(label, bx + 12, by + 20);
        if (near.hint) {
          ctx.font = "500 11px var(--font-sans), system-ui, sans-serif";
          const hw2 = ctx.measureText(near.hint).width;
          ctx.fillStyle = "rgba(255,255,255,0.85)";
          ctx.fillText(near.hint, footX - hw2 / 2, by - 8);
        }
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [scene, sprite, playerFoot, isBlocked, bandTop]);

  return <canvas ref={canvasRef} className="block h-full w-full" />;
}
