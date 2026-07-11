# Kahani — an AI story you play

A cinematic, choice-driven interactive story set in India where **every scene is
generated in real time**. Pick a world, make a choice, and a fresh 1K image + the
next beat of narrative are generated on the fly. No two playthroughs are alike.

Built for the **Nano Banana 2 Lite** hackathon — real-time, high-volume image
generation is load-bearing to the experience, not a bolt-on prompt box.

## The per-turn pipeline

Each choice fires a two-stage generative pipeline server-side:

1. **Story** — a Gemini text model takes the story-so-far + the player's choice and
   returns structured JSON: `narrative`, 4 `choices`, an `imagePrompt`, and an
   `isEnding` flag (`lib/gemini.ts` → `generateBeat`).
2. **Image** — NB2 Lite turns that `imagePrompt` (+ a per-world style bible + the
   **previous frame as a visual reference** for character/style continuity) into the
   scene image (`generateImage`).

Orchestrated in `app/api/turn/route.ts`; the API key never leaves the server.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev                  # http://localhost:3000
```

In `.env.local`:

```
GEMINI_API_KEY=...           # from https://aistudio.google.com/apikey
TEXT_MODEL=gemini-2.5-flash
IMAGE_MODEL=gemini-2.5-flash-image   # ← swap for the NB2 Lite model ID
```

`IMAGE_MODEL` defaults to a public image model so the app runs before you have
NB2 Lite access. Point it at the hackathon's NB2 Lite ID when ready — no code
changes needed.

## Project map

| Path                       | Role                                              |
| -------------------------- | ------------------------------------------------- |
| `lib/premises.ts`          | The four India-set starting worlds + style bibles |
| `lib/gemini.ts`            | Text (structured) + image generation              |
| `app/api/turn/route.ts`    | Per-turn orchestration                            |
| `components/Game.tsx`      | Client state machine (landing → playing → ending) |
| `components/SceneView.tsx` | The cinematic gameplay screen                     |
| `components/Ending.tsx`    | Journey recap filmstrip                           |

## Ideas to push further

- **Prefetch all 4 branches** while the player reads — generate the next image for
  every choice in parallel so the next scene is instant. This is the strongest
  showcase of NB2 Lite's speed + cost (4× the generation, still cheap/fast).
- Per-world aspect ratios and a shareable "story card" of the finished journey.
- Runtime genre picker / custom premise input.
