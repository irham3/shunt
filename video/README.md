# Shunt — Hero Video (Remotion)

Standalone [Remotion](https://www.remotion.dev/) project that renders the Shunt
hero animation. It is **fully isolated** from the Vite web app in `../web` — its
own `package.json`, `node_modules`, and TypeScript config — so Remotion's
bundler never touches the app's build.

## Composition

| | |
|---|---|
| id | `ShuntHero` |
| size | 1080 × 1080 |
| fps | 30 |
| length | 8s (`durationInFrames = 240`) |

### Storyboard

1. **Brand intro** — the split-node motif draws itself and the *Shunt* wordmark springs up.
2. **Incoming payment** — a glass card lands and counts to **+1,000 USDC**.
3. **Split** — the current branches down three circuit traces into **Spend 500 · Save 300 · Invest 200**.
4. **Vault** — the Save allocation pours into a timelocked savings vault.
5. **Final CTA** — *Shunt · Automated money routing on Stellar.*

Palette and fonts (Montserrat / Plus Jakarta Sans) mirror
`web/src/styles/tokens.css`. Rendering is deterministic — no `Math.random()`,
no browser-only APIs in render logic.

## Setup

```bash
cd video
npm install
```

## Scripts

```bash
npm run dev          # open Remotion Studio to preview/scrub ShuntHero
npm run render:hero  # render out/shunt-hero.mp4
npm run render:still # render out/shunt-hero.png (poster — the split frame, 160)
npm run copy:web     # copy out/shunt-hero.mp4 → ../web/public/videos/shunt-hero.mp4
npm run build:web    # render:hero + copy:web in one step
npm run typecheck    # tsc --noEmit
```

## Using it in the web app

After `npm run build:web`, the MP4 lives at `web/public/videos/shunt-hero.mp4`
and is served at `/videos/shunt-hero.mp4`. Drop the component anywhere in the app:

```tsx
import { HeroVideo } from "./components/HeroVideo";

<HeroVideo poster="/videos/shunt-hero.png" />;
```

`HeroVideo` uses a plain `<video>` tag — `@remotion/player` is intentionally not
added to the Vite app.
