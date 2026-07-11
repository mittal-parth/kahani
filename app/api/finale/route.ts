import { NextRequest, NextResponse } from "next/server";
import { generateFinale } from "@/lib/world-engine";
import type { Premise } from "@/lib/types";
import type { StoryArc } from "@/lib/universe";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { premise: Premise; story: StoryArc };
  try {
    body = (await req.json()) as { premise: Premise; story: StoryArc };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.premise?.id || !body.story?.secret) {
    return NextResponse.json(
      { error: "Missing premise or story." },
      { status: 400 }
    );
  }
  try {
    const finale = await generateFinale(body.premise, body.story);
    return NextResponse.json({ finale });
  } catch (err) {
    console.error("[/api/finale]", err);
    return NextResponse.json(
      { error: "The ending slipped away. Try again." },
      { status: 500 }
    );
  }
}
