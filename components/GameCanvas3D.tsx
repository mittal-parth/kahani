"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useLoader, useThree } from "@react-three/fiber";
import * as THREE from "three";
import type { Hotspot, SceneData } from "@/lib/universe";
import { coarseDepth, refineDepth, type DepthField } from "@/lib/depth";

/** Same walk-band model as the 2D canvas — coordinates stay percent-space. */
const DEFAULT_BAND_TOP = 58;
const BAND_BOTTOM = 92;
const SPEED_X = 26;
const SPEED_DEPTH = 0.55;

type PlayerState = { x: number; depth: number; dir: 1 | -1; moving: boolean };

export function GameCanvas3D({
  scene,
  sprite,
  paused,
  onInteract,
}: {
  scene: SceneData;
  sprite: HTMLCanvasElement | null;
  paused: boolean;
  onInteract: (hotspot: Hotspot) => void;
}) {
  const playerRef = useRef<PlayerState>({ x: 12, depth: 0.6, dir: 1, moving: false });
  const keysRef = useRef<Record<string, boolean>>({});
  const nearRef = useRef<Hotspot | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;
  const [near, setNear] = useState<Hotspot | null>(null);
  const [depth, setDepth] = useState<DepthField | null>(null);

  const bandTop = Math.max(45, Math.min(80, scene.groundTop ?? DEFAULT_BAND_TOP));

  /* ---------- depth: instant coarse field, refined in the background ---------- */
  useEffect(() => {
    setDepth(coarseDepth(scene));
    let alive = true;
    refineDepth(scene).then((d) => {
      if (alive) setDepth(d);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  /* ---------- spawn (safe, outside obstacles) ---------- */
  useEffect(() => {
    const startX = scene.kind === "interior" ? 50 : 12;
    const d = 0.6;
    const py = bandTop + (BAND_BOTTOM - bandTop) * d;
    const blockedAt = (x: number) =>
      (scene.obstacles ?? []).some(
        (o) => x >= o.x && x <= o.x + o.w && py >= o.y && py <= o.y + o.h
      );
    let x = startX;
    if (blockedAt(x)) {
      outer: for (let dx = 4; dx <= 92; dx += 4) {
        for (const cand of [startX + dx, startX - dx]) {
          if (cand >= 2 && cand <= 98 && !blockedAt(cand)) {
            x = cand;
            break outer;
          }
        }
      }
    }
    playerRef.current = { x, depth: d, dir: 1, moving: false };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id]);

  /* ---------- collision (identical semantics to the 2D canvas) ---------- */
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
          return false;
        }
      }
      return obstacles.some(
        (o) => px >= o.x && px <= o.x + o.w && py >= o.y && py <= o.y + o.h
      );
    },
    [scene.obstacles, scene.hotspots]
  );

  const stuckRef = useRef(0);
  const advanceSim = useCallback(
    (dt: number) => {
      const p = playerRef.current;
      if (pausedRef.current) {
        p.moving = false;
        return;
      }
      const keys = keysRef.current;
      let vx = 0;
      let vd = 0;
      if (keys["arrowleft"] || keys["a"]) vx -= 1;
      if (keys["arrowright"] || keys["d"]) vx += 1;
      if (keys["arrowup"] || keys["w"]) vd -= 1;
      if (keys["arrowdown"] || keys["s"]) vd += 1;
      if (vx !== 0) p.dir = vx > 0 ? 1 : -1;
      p.moving = vx !== 0 || vd !== 0;

      const footY = (d: number) => bandTop + (BAND_BOTTOM - bandTop) * d;
      const nx = Math.max(2, Math.min(98, p.x + vx * SPEED_X * dt));
      const nd = Math.max(0, Math.min(1, p.depth + vd * SPEED_DEPTH * dt));
      const relaxed = stuckRef.current > 30;

      if (relaxed || !isBlocked(nx, footY(nd))) {
        p.x = nx;
        p.depth = nd;
        stuckRef.current = 0;
      } else if (!isBlocked(nx, footY(p.depth))) {
        p.x = nx;
        stuckRef.current = 0;
      } else if (!isBlocked(p.x, footY(nd))) {
        p.depth = nd;
        stuckRef.current = 0;
      } else if (p.moving) {
        stuckRef.current++;
      }

      // proximity
      const px = p.x;
      const py = footY(p.depth);
      let found: Hotspot | null = null;
      for (const h of scene.hotspots) {
        const m = 4;
        if (
          px >= h.rect.x - m &&
          px <= h.rect.x + h.rect.w + m &&
          py >= h.rect.y - m &&
          py <= h.rect.y + h.rect.h + m
        ) {
          found = h;
          break;
        }
      }
      if (nearRef.current?.id !== found?.id) {
        nearRef.current = found;
        setNear(found);
      }
    },
    [bandTop, isBlocked, scene.hotspots]
  );

  /* ---------- keyboard ---------- */
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (pausedRef.current) return;
      const k = e.key.toLowerCase();
      if (
        ["arrowleft", "arrowright", "arrowup", "arrowdown", "a", "d", "w", "s", "e", "enter"].includes(k)
      ) {
        e.preventDefault();
      }
      if (k === "e" || k === "enter") {
        if (nearRef.current) onInteract(nearRef.current);
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

  /* ---------- hidden-tab fallback ticking + debug hooks ---------- */
  const lastFrameRef = useRef(performance.now());
  useEffect(() => {
    const iv = setInterval(() => {
      if (performance.now() - lastFrameRef.current > 250) advanceSim(0.05);
    }, 120);
    if (new URLSearchParams(window.location.search).has("debug")) {
      (window as unknown as Record<string, unknown>).__kahani = {
        setKey: (k: string, v: boolean) => {
          keysRef.current[k] = v;
        },
        state: () => ({ ...playerRef.current, near: nearRef.current?.name ?? null }),
      };
    }
    return () => {
      clearInterval(iv);
      delete (window as unknown as Record<string, unknown>).__kahani;
    };
  }, [advanceSim]);

  return (
    <div className="relative h-full w-full bg-[#14100c]">
      <Canvas
        flat
        dpr={[1, 2]}
        camera={{ fov: 45, position: [0, 0, 8], near: 0.1, far: 50 }}
        gl={{ antialias: true }}
      >
        <Suspense fallback={null}>
          <SceneRig
            key={scene.id}
            scene={scene}
            sprite={sprite}
            depth={depth}
            bandTop={bandTop}
            playerRef={playerRef}
            nearRef={nearRef}
            advanceSim={advanceSim}
            lastFrameRef={lastFrameRef}
          />
        </Suspense>
      </Canvas>

      {/* Interaction prompt — DOM overlay */}
      {near && !paused && (
        <div className="pointer-events-none absolute bottom-16 left-1/2 z-10 -translate-x-1/2 text-center">
          <p className="rounded-full bg-black/70 px-4 py-2 text-sm font-bold text-[#ffb24d] backdrop-blur-sm">
            E — {near.kind === "building" ? `enter ${near.name}` : near.kind === "npc" ? `talk to ${near.name}` : near.name}
          </p>
          {near.hint && (
            <p className="mt-1 text-xs font-medium text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.9)]">
              {near.hint}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

/* ================================================================== */
/* The 3D rig: depth-displaced frame, billboarded sprite, markers      */
/* ================================================================== */

function SceneRig({
  scene,
  sprite,
  depth,
  bandTop,
  playerRef,
  nearRef,
  advanceSim,
  lastFrameRef,
}: {
  scene: SceneData;
  sprite: HTMLCanvasElement | null;
  depth: DepthField | null;
  bandTop: number;
  playerRef: React.MutableRefObject<PlayerState>;
  nearRef: React.MutableRefObject<Hotspot | null>;
  advanceSim: (dt: number) => void;
  lastFrameRef: React.MutableRefObject<number>;
}) {
  const tex = useLoader(THREE.TextureLoader, scene.image);
  tex.colorSpace = THREE.SRGBColorSpace;

  const { viewport, advance } = useThree();

  // Debug/test hook: force a synchronous frame even when rAF is suspended
  // (hidden tabs, automation harnesses).
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("debug")) return;
    (window as unknown as Record<string, unknown>).__kahaniRender = () =>
      advance(performance.now(), true);
    return () => {
      delete (window as unknown as Record<string, unknown>).__kahaniRender;
    };
  }, [advance]);
  const imgAspect =
    tex.image && tex.image.width ? tex.image.width / tex.image.height : 16 / 9;

  // Cover-fit the frame to the viewport with overscan so bounded camera
  // sway never reveals the void beyond the frame's edges.
  const [planeW, planeH] = useMemo(() => {
    const overscan = 1.12;
    let h = viewport.height * overscan;
    let w = h * imgAspect;
    if (w < viewport.width * overscan) {
      w = viewport.width * overscan;
      h = w / imgAspect;
    }
    return [w, h];
  }, [viewport.width, viewport.height, imgAspect]);

  const dispScale = planeH * 0.22;

  const depthTex = useMemo(() => {
    if (!depth) return null;
    const t = new THREE.CanvasTexture(depth.canvas);
    t.colorSpace = THREE.NoColorSpace;
    return t;
  }, [depth]);

  const spriteTex = useMemo(
    () => (sprite ? new THREE.CanvasTexture(sprite) : null),
    [sprite]
  );
  const spriteAspect = sprite ? sprite.width / sprite.height : 0.5;

  const spriteMesh = useRef<THREE.Mesh>(null);
  const shadowMesh = useRef<THREE.Mesh>(null);
  const markerGroup = useRef<THREE.Group>(null);

  // percent coords → plane space
  const toPlane = useCallback(
    (xPct: number, yPct: number): [number, number] => [
      (xPct / 100 - 0.5) * planeW,
      -(yPct / 100 - 0.5) * planeH,
    ],
    [planeW, planeH]
  );

  useFrame((state, delta) => {
    lastFrameRef.current = performance.now();
    advanceSim(Math.min(0.05, delta));

    const p = playerRef.current;
    const pyPct = bandTop + (BAND_BOTTOM - bandTop) * p.depth;
    const [wx, wy] = toPlane(p.x, pyPct);
    const zHere = (depth ? depth.sample(p.x, pyPct) : 0.5) * dispScale;

    // player sprite
    if (spriteMesh.current) {
      const scale = 0.62 + 0.48 * p.depth;
      const h = planeH * 0.3 * scale;
      const w = h * spriteAspect;
      const bob = p.moving ? Math.abs(Math.sin(state.clock.elapsedTime * 9)) * h * 0.03 : 0;
      spriteMesh.current.position.set(wx, wy + h / 2 + bob, zHere + 0.25);
      spriteMesh.current.scale.set(w * p.dir, h, 1);
    }
    if (shadowMesh.current) {
      shadowMesh.current.position.set(wx, wy + 0.02, zHere + 0.2);
      const s = 0.32 * (0.62 + 0.48 * p.depth);
      shadowMesh.current.scale.set(planeH * s * 0.55, planeH * s * 0.16, 1);
    }

    // hotspot markers: bob + highlight when near
    if (markerGroup.current) {
      markerGroup.current.children.forEach((child, i) => {
        const h = scene.hotspots[i];
        if (!h) return;
        const bob = Math.sin(state.clock.elapsedTime * 2 + h.rect.x) * 0.06;
        const [mx, my] = toPlane(h.rect.x + h.rect.w / 2, h.rect.y);
        const mz = (depth ? depth.sample(h.rect.x + h.rect.w / 2, h.rect.y + h.rect.h) : 0.5) * dispScale;
        child.position.set(mx, my + 0.25 + bob, mz + 0.3);
        const isNear = nearRef.current?.id === h.id;
        child.scale.setScalar(isNear ? 1.6 : 1);
        const mat = (child as THREE.Mesh).material as THREE.MeshBasicMaterial;
        mat.color.set(isNear ? "#ffb24d" : "#ffffff");
        mat.opacity = isNear ? 1 : 0.75;
      });
    }

    // bounded camera parallax — the "3D" the player feels
    const cam = state.camera;
    const targetX = (p.x / 100 - 0.5) * 1.1;
    const targetY = (0.5 - p.depth) * 0.45 + Math.sin(state.clock.elapsedTime * 0.25) * 0.06;
    cam.position.x += (Math.max(-0.55, Math.min(0.55, targetX)) - cam.position.x) * 0.04;
    cam.position.y += (Math.max(-0.35, Math.min(0.35, targetY)) - cam.position.y) * 0.04;
    cam.lookAt(cam.position.x * 0.35, cam.position.y * 0.3, 0);
  });

  return (
    <>
      {/* The NB frame, given volume by its depth map */}
      <mesh position={[0, 0, 0]}>
        <planeGeometry args={[planeW, planeH, 192, 120]} />
        <meshStandardMaterial
          color="black"
          emissive="white"
          emissiveMap={tex}
          displacementMap={depthTex ?? undefined}
          displacementScale={depthTex ? dispScale : 0}
          displacementBias={depthTex ? -dispScale * 0.5 : 0}
          roughness={1}
          metalness={0}
        />
      </mesh>

      {/* soft contact shadow under the player */}
      <mesh ref={shadowMesh} rotation={[0, 0, 0]}>
        <circleGeometry args={[0.5, 24]} />
        <meshBasicMaterial color="black" transparent opacity={0.35} />
      </mesh>

      {/* the player */}
      {spriteTex ? (
        <mesh ref={spriteMesh}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial map={spriteTex} transparent alphaTest={0.05} toneMapped={false} />
        </mesh>
      ) : (
        <mesh ref={spriteMesh}>
          <circleGeometry args={[0.14, 24]} />
          <meshBasicMaterial color="#c8552e" />
        </mesh>
      )}

      {/* hotspot markers */}
      <group ref={markerGroup}>
        {scene.hotspots.map((h) => (
          <mesh key={h.id}>
            <sphereGeometry args={[0.07, 16, 16]} />
            <meshBasicMaterial color="white" transparent opacity={0.75} />
          </mesh>
        ))}
      </group>
    </>
  );
}
