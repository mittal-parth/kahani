import { NextRequest, NextResponse } from "next/server";
import { synthesizeVoice } from "@/lib/world-engine";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  let body: { text: string; voice?: string };
  try {
    body = (await req.json()) as { text: string; voice?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }
  if (!body.text?.trim()) {
    return NextResponse.json({ error: "Missing text." }, { status: 400 });
  }
  // Voice is best-effort: a null audio means the client plays nothing.
  const audio = await synthesizeVoice(body.text.slice(0, 500), body.voice);
  return NextResponse.json({ audio });
}
