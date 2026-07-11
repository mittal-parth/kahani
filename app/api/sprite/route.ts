import { NextRequest, NextResponse } from "next/server";
import { generateSprite } from "@/lib/world-engine";
import type { Premise } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  let body: { premise: Premise };
  try {
    body = (await req.json()) as { premise: Premise };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.premise?.id) {
    return NextResponse.json({ error: "Missing premise." }, { status: 400 });
  }
  try {
    const sprite = await generateSprite(body.premise);
    return NextResponse.json({ sprite });
  } catch (err) {
    console.error("[/api/sprite]", err);
    return NextResponse.json(
      { error: "Failed to generate the player sprite." },
      { status: 500 }
    );
  }
}
