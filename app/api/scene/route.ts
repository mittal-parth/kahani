import { NextRequest, NextResponse } from "next/server";
import { generateInteriorScene, generateStreetScene } from "@/lib/world-engine";
import type { Premise } from "@/lib/types";
import type { StoryArc } from "@/lib/universe";

export const runtime = "nodejs";
export const maxDuration = 60;

type SceneRequest = {
  premise: Premise;
  story: StoryArc;
  /** Omitted for the opening street; set to enter a building. */
  building?: {
    id: string;
    name: string;
    interiorPrompt: string;
    clueIndex?: number;
  };
  questHook?: string;
};

export async function POST(req: NextRequest) {
  let body: SceneRequest;
  try {
    body = (await req.json()) as SceneRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.premise?.id || !body.story?.goal) {
    return NextResponse.json(
      { error: "Missing premise or story." },
      { status: 400 }
    );
  }

  try {
    if (body.building) {
      const scene = await generateInteriorScene(
        body.premise,
        body.building,
        body.questHook ?? "",
        body.story
      );
      return NextResponse.json({ scene });
    }
    const scene = await generateStreetScene(body.premise, body.story);
    return NextResponse.json({ scene, questHook: scene.questHook });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to generate the scene.";
    console.error("[/api/scene]", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
