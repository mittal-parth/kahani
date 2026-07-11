"use client";

import type { SceneData } from "./universe";

/**
 * A normalized depth field for a scene frame.
 * Convention everywhere: brightness/value 1 = NEAREST to camera, 0 = farthest.
 */
export type DepthField = {
  /** Grayscale canvas usable as a displacement map (white = near). */
  canvas: HTMLCanvasElement;
  /** Sample depth (0..1, 1 = near) at percent coords of the frame. */
  sample: (xPct: number, yPct: number) => number;
  source: "depth-anything" | "gemini-grid" | "gradient";
};

const GRID_W = 16;
const GRID_H = 10;

/* ------------------------------------------------------------------ */
/* Depth Anything V2 (in-browser, WebGPU) — best quality, lazy-loaded  */
/* ------------------------------------------------------------------ */

// Cached across scenes; the ~50MB model downloads once then lives in cache.
let daPipeline: unknown | null = null;
let daFailed = false;

async function depthAnything(imageDataUrl: string): Promise<DepthField> {
  if (daFailed) throw new Error("depth-anything unavailable");
  const { pipeline } = await import("@huggingface/transformers");
  if (!daPipeline) {
    daPipeline = await pipeline(
      "depth-estimation",
      "onnx-community/depth-anything-v2-small",
      { device: "webgpu", dtype: "fp16" }
    );
  }
  const pipe = daPipeline as (
    img: string
  ) => Promise<{ depth: { width: number; height: number; data: Uint8Array } }>;
  const out = await pipe(imageDataUrl);
  const { width, height, data } = out.depth;

  // Depth-Anything emits inverse depth: bright = near. Matches our convention.
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;
  const imgData = ctx.createImageData(width, height);
  for (let i = 0; i < width * height; i++) {
    const v = data[i];
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  return {
    canvas,
    sample: (xPct, yPct) => {
      const x = Math.max(0, Math.min(width - 1, Math.round((xPct / 100) * (width - 1))));
      const y = Math.max(0, Math.min(height - 1, Math.round((yPct / 100) * (height - 1))));
      return data[y * width + x] / 255;
    },
    source: "depth-anything",
  };
}

/* ------------------------------------------------------------------ */
/* Fallbacks: Gemini coarse grid → plain ground gradient               */
/* ------------------------------------------------------------------ */

function gridField(scene: SceneData): DepthField {
  const grid = scene.depthGrid;
  const groundTop = scene.groundTop ?? 55;

  // values[y][x] in 0..1, 1 = near
  const values: number[][] = [];
  if (grid && grid.length >= GRID_W * GRID_H) {
    for (let gy = 0; gy < GRID_H; gy++) {
      const row: number[] = [];
      for (let gx = 0; gx < GRID_W; gx++) {
        row.push(1 - grid[gy * GRID_W + gx] / 100);
      }
      values.push(row);
    }
  } else {
    // No grid: a believable default — sky/far above the horizon, ground
    // sweeping nearer toward the bottom of the frame.
    for (let gy = 0; gy < GRID_H; gy++) {
      const yPct = (gy / (GRID_H - 1)) * 100;
      const v =
        yPct <= groundTop
          ? 0.06
          : 0.12 + 0.88 * ((yPct - groundTop) / Math.max(1, 100 - groundTop));
      values.push(new Array(GRID_W).fill(v));
    }
  }

  // Render smoothed to a small canvas; browser upscaling blurs it further.
  const canvas = document.createElement("canvas");
  canvas.width = GRID_W * 8;
  canvas.height = GRID_H * 8;
  const ctx = canvas.getContext("2d")!;
  const tmp = document.createElement("canvas");
  tmp.width = GRID_W;
  tmp.height = GRID_H;
  const tctx = tmp.getContext("2d")!;
  const imgData = tctx.createImageData(GRID_W, GRID_H);
  for (let gy = 0; gy < GRID_H; gy++) {
    for (let gx = 0; gx < GRID_W; gx++) {
      const v = Math.round(values[gy][gx] * 255);
      const i = (gy * GRID_W + gx) * 4;
      imgData.data[i] = v;
      imgData.data[i + 1] = v;
      imgData.data[i + 2] = v;
      imgData.data[i + 3] = 255;
    }
  }
  tctx.putImageData(imgData, 0, 0);
  ctx.filter = "blur(2px)";
  ctx.drawImage(tmp, 0, 0, canvas.width, canvas.height);

  const sample = (xPct: number, yPct: number) => {
    const fx = (xPct / 100) * (GRID_W - 1);
    const fy = (yPct / 100) * (GRID_H - 1);
    const x0 = Math.max(0, Math.min(GRID_W - 1, Math.floor(fx)));
    const y0 = Math.max(0, Math.min(GRID_H - 1, Math.floor(fy)));
    const x1 = Math.min(GRID_W - 1, x0 + 1);
    const y1 = Math.min(GRID_H - 1, y0 + 1);
    const tx = fx - x0;
    const ty = fy - y0;
    const a = values[y0][x0] * (1 - tx) + values[y0][x1] * tx;
    const b = values[y1][x0] * (1 - tx) + values[y1][x1] * tx;
    return a * (1 - ty) + b * ty;
  };

  return {
    canvas,
    sample,
    source: grid && grid.length >= GRID_W * GRID_H ? "gemini-grid" : "gradient",
  };
}

/* ------------------------------------------------------------------ */

/**
 * Instant coarse depth (Gemini grid / gradient) — always succeeds, no await
 * on any model. Use for the first paint.
 */
export function coarseDepth(scene: SceneData): DepthField {
  return gridField(scene);
}

/**
 * Best-available depth: tries Depth Anything V2 in the browser (WebGPU),
 * falls back to the coarse field. Call after the scene is showing; swap the
 * displacement map when it resolves.
 */
export async function refineDepth(scene: SceneData): Promise<DepthField> {
  try {
    return await depthAnything(scene.image);
  } catch (err) {
    daFailed = true;
    console.warn("[depth] Depth-Anything unavailable, using coarse field:", err);
    return gridField(scene);
  }
}
