import { NextRequest, NextResponse } from "next/server";
import { generateInteriorScene, generateStreetScene } from "@/lib/world-engine";
import type { Premise } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

type SceneRequest = {
  premise: Premise;
  /** Omitted for the opening street; set to enter a building. */
  building?: { id: string; name: string; interiorPrompt: string };
  questHook?: string;
};

export async function POST(req: NextRequest) {
  let body: SceneRequest;
  try {
    body = (await req.json()) as SceneRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.premise?.id) {
    return NextResponse.json({ error: "Missing premise." }, { status: 400 });
  }

  try {
    if (body.building) {
      const scene = await generateInteriorScene(
        body.premise,
        body.building,
        body.questHook ?? ""
      );
      return NextResponse.json({ scene });
    }
    const scene = await generateStreetScene(body.premise);
    return NextResponse.json({ scene, questHook: scene.questHook });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate the scene.";
    console.error("[/api/scene]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
