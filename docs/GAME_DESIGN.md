# Kahani World — an AI-generated universe you walk through

**Pivot:** not a branching storybook. A **playable world**. The game studio *is*
the AI: every street, interior, character, and line of dialogue is manufactured
in real time as the player explores.

## The loop

1. Pick a universe (Mumbai monsoon, Himalayan village, Old Delhi, Kerala
   backwaters).
2. NB2 Lite paints the **street** — a wide, walkable establishing shot — while
   Gemini invents its **buildings** (each a hotspot with a name and an interior
   prompt) and a **quest hook**.
3. Your **player sprite** (also NB2-generated, chroma-keyed) walks the street
   with **WASD/arrows** — left/right along the street, up/down for depth
   (pseudo-2.5D scaling).
4. Walk up to a doorway → **E** → the interior is generated (or served from
   prefetch) and you step inside.
5. Inside lives an **NPC** (invented by Gemini: name, role, persona). Approach
   them → dialogue opens → they speak **out loud** (TTS voice) — reply by
   picking a line (1–3) or typing anything.
6. NPCs advance a light **quest thread** that follows you across buildings.
   Esc / the door returns you to the street. Free roam, no rails.

## Tech mapping (the hackathon story)

| Layer | Model | Use |
| --- | --- | --- |
| World & interiors | **NB2 Lite** (`IMAGE_MODEL`) | street + interior frames, generated live; interiors **prefetched in parallel** while you walk |
| Player asset | **NB2 Lite** | full-body sprite on white, chroma-keyed client-side |
| World brain | **Gemini flash** (`TEXT_MODEL`) | scene layouts (hotspot boxes), NPC personas, dialogue turns, quest thread |
| NPC voice | **Gemini TTS / Live** (`VOICE_MODEL`) | every NPC line spoken aloud |

High-volume generation is load-bearing: a 5-minute session generates a street,
a sprite, 3–4 interiors (prefetched), and a voice clip per dialogue line.

## Architecture

- `lib/universe.ts` — Scene/Hotspot/NPC types
- `lib/gemini.ts` — `generateSceneSpec`, `generateSprite`, `generateDialogue`, `synthesizeVoice`
- `app/api/scene` · `app/api/sprite` · `app/api/dialogue` · `app/api/voice`
- `components/World.tsx` — orchestrator: scene cache, prefetch, dialogue, voice
- `components/GameCanvas.tsx` — canvas render loop, keyboard, hotspot detection
- `components/DialogueBox.tsx` — talk UI (choices + free text)

Controls: **WASD/←→↑↓** move · **E** enter/talk · **1–3** replies · **Esc** leave.

**Mobile (landscape):** bottom-right **joystick** move · bottom-left **Action** enter/talk/pick up · tap dialogue chips.
