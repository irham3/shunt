# Shunt Three-Minute Pitch Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and import a visually polished, judge-focused six-slide Canva pitch deck that completes in three minutes including the live demo.

**Architecture:** Create a standalone HTML presentation whose six top-level page elements carry Canva page annotations and speaker notes. Keep detailed narration in a separate three-minute Markdown script, render the HTML locally for visual QA, and import the verified artifact into Canva as a new editable presentation. Use a Superdesign 16:9 graphic draft as an art-direction check for the title slide before finalizing the HTML deck.

**Tech Stack:** Semantic HTML, CSS, Canva presentation import, Canva editing transactions, Playwright/Chromium for local rendering, Superdesign CLI.

## Global Constraints

- Exactly six slides at 1920 × 1080.
- Total delivery target is 180 seconds including a 100-second live demo.
- Slide copy is limited to hooks, labels, diagrams, and proof numbers; explanatory detail belongs in speaker notes and Markdown.
- Use near-black, warm white, Shunt green, and restrained Stellar cyan; no generic purple gradients.
- Use one modern sans-serif family and no more than two font weights.
- Avoid stock photography, decorative blobs, fake dashboards, excessive glass cards, logo walls, and unsupported metrics.
- Contracts, balances, hashes, and the SDF anchor are labeled Stellar testnet.
- Provider integrations remain labeled sandbox, provider staging, or onboarding pending.
- Never claim a live IDR route, audit, production readiness, automatic signing, or user traction.

---

### Task 1: Three-Minute Narration and Slide Copy

**Files:**
- Create: `docs/pitch-deck-3min.md`

**Interfaces:**
- Consumes: `docs/pitch-deck.md`, `docs/demo-script.md`, and the approved redesign spec.
- Produces: exact on-slide copy, per-slide timing, speaker notes, and live-demo cues used by the HTML deck.

- [ ] **Step 1: Draft the exact six-slide script**

Write slide copy and speaker notes with this timing:

```text
Slide 1 — 0:00–0:10
Slide 2 — 0:10–0:30
Slide 3 — 0:30–0:50
Slide 4 / live demo — 0:50–2:30
Slide 5 — 2:30–2:50
Slide 6 — 2:50–3:00
```

The product loop must read: `GET PAID → SPLIT → PROTECT → GROW → EXIT`.

- [ ] **Step 2: Validate claims and word count**

Run:

```powershell
rg -n -i "live IDR|automatic signing|audited|production ready|user traction" docs/pitch-deck-3min.md
```

Expected: no unsupported affirmative claim. Any occurrence must be an explicit negation or boundary.

- [ ] **Step 3: Commit the script**

```powershell
git add -f docs/pitch-deck-3min.md
git commit -m "docs: add three-minute Shunt pitch script"
```

### Task 2: Title-Slide Art Direction in Superdesign

**Files:**
- No repository file changes required.

**Interfaces:**
- Consumes: approved visual system and exact title-slide copy from Task 1.
- Produces: a 1920 × 1080 Superdesign graphic draft and a visual reference for the HTML title slide.

- [ ] **Step 1: Run the Superdesign preflight**

Run:

```powershell
npx --yes @superdesign/cli@latest
```

Expected: CLI output includes an authentication status.

- [ ] **Step 2: Authenticate if required**

If and only if the preflight says `not authenticated`, run:

```powershell
npx --yes @superdesign/cli@latest login
```

Expected: successful authentication before continuing.

- [ ] **Step 3: Create the graphics project**

Run:

```powershell
npx --yes @superdesign/cli@latest create-project --title "Shunt Pitch Graphics"
```

Capture the returned project ID and canvas URL.

- [ ] **Step 4: Generate one title-slide draft**

Run `create-design-draft` with `--kind graphic --width 1920 --height 1080` and one prompt that reproduces the exact strings:

```text
Shunt
Split freelance income before you spend it.
Set rules once. Review the split. Sign with your wallet.
USDC · Non-custodial · Built on Stellar
```

The composition is a dark fintech editorial type-hero with a dense income-to-four-lanes transaction motif, Shunt green accents, warm-white typography, and no stock imagery, decorative blobs, generic gradients, or invented copy.

- [ ] **Step 5: Inspect the preview**

Open the returned preview URL and check exact copy, legibility, safe margins, visual density, and absence of generic AI decoration. Perform at most one `iterate-design-draft --mode replace` correction if a concrete issue is visible.

### Task 3: Build the Six-Slide HTML Presentation

**Files:**
- Create: `docs/shunt-demo-pitch-3min.html`

**Interfaces:**
- Consumes: exact copy and notes from `docs/pitch-deck-3min.md`, plus the title-slide art direction from Task 2.
- Produces: a self-contained HTML presentation importable by Canva.

- [ ] **Step 1: Create the page structure**

Create six top-level slide elements:

```html
<section class="slide" data-document-role="page" data-label="Slide title" data-speaker-notes="Exact notes">
  ...
</section>
```

No slide may be nested inside another page element.

- [ ] **Step 2: Implement the visual system**

Define CSS variables for:

```css
--bg: #07110d;
--panel: #0d1a14;
--ink: #f2f0e9;
--muted: #9ea9a3;
--green: #42f59e;
--cyan: #4cc9f0;
--line: rgba(242, 240, 233, 0.14);
```

Use a 12-column grid, 96px outer margins, 8px spacing increments, and compact evidence rails. Each slide must contain one dominant visual structure and one secondary proof/context rail.

- [ ] **Step 3: Implement the six slide layouts**

Use these layouts:

```text
1. Type-hero title + four-lane allocation motif
2. Single-payment problem + four competing lane cards
3. Five-stage transaction rail: Get Paid / Split / Protect / Grow / Exit
4. Live-demo control panel with a six-step progress rail and a proof-hash callout
5. Product-to-Stellar protocol map plus test-count proof rail
6. Closing statement + proven/next/ask triptych
```

Keep body copy off the canvas unless it is a label or a single short qualifier.

- [ ] **Step 4: Add speaker notes**

Copy each slide's detailed narration into `data-speaker-notes`. Escape quotes so the HTML remains valid.

- [ ] **Step 5: Validate HTML structure**

Run a Node script or DOM parser to assert:

```text
exactly 6 elements with data-document-role="page"
each page has a non-empty data-label
each page has non-empty data-speaker-notes
no page element is nested inside another page element
```

Expected: all assertions pass.

### Task 4: Render and Visually Verify the Deck

**Files:**
- Create: `docs/rendered-pitch/slide-01.png`
- Create: `docs/rendered-pitch/slide-02.png`
- Create: `docs/rendered-pitch/slide-03.png`
- Create: `docs/rendered-pitch/slide-04.png`
- Create: `docs/rendered-pitch/slide-05.png`
- Create: `docs/rendered-pitch/slide-06.png`

**Interfaces:**
- Consumes: `docs/shunt-demo-pitch-3min.html`.
- Produces: six rendered PNGs used for visual QA before Canva import.

- [ ] **Step 1: Render each slide at 1920 × 1080**

Use the bundled Playwright/Chromium runtime to open the local HTML and capture each `.slide` element individually.

- [ ] **Step 2: Inspect all six renders**

Check:

```text
no overflow or clipping
minimum readable label size
intentional density without clutter
consistent alignment and spacing
no generic decorative filler
title slide unmistakably functions as the opening slide
```

- [ ] **Step 3: Correct concrete issues**

Edit the HTML once, re-render affected slides, and repeat the checks. Do not add decoration solely to fill space; add a meaningful product diagram, proof rail, or status label.

- [ ] **Step 4: Commit the source artifacts**

```powershell
git add -f docs/pitch-deck-3min.md docs/shunt-demo-pitch-3min.html
git commit -m "feat: build six-slide Shunt pitch deck"
```

### Task 5: Import and Verify in Canva

**Files:**
- No additional repository file changes required.

**Interfaces:**
- Consumes: `docs/shunt-demo-pitch-3min.html`.
- Produces: a new editable six-page Canva presentation.

- [ ] **Step 1: Import the HTML presentation**

Call Canva import with:

```text
intended_design_type: presentation
name: Shunt — 3 Minute Judge Pitch
design_file: absolute path to docs/shunt-demo-pitch-3min.html
```

- [ ] **Step 2: Inspect the imported design**

Confirm:

```text
page_count = 6
slide 1 is the title slide
presenter notes exist
all page thumbnails render correctly
```

- [ ] **Step 3: Apply only necessary Canva corrections**

Start one editing transaction only if the import introduced text wrapping or alignment problems. Preview every changed page and ask for explicit approval before committing the transaction.

- [ ] **Step 4: Deliver the Canva links**

Provide the direct edit and view URLs and disclose that Canva connector animation controls are unavailable. Include the intended motion recipe: short fade/rise for titles, sequential reveal for process rails, and quick dissolve transitions.

