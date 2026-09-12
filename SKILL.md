---
name: trainoracle-design
description: Preserve TrainOracle's current product wording, flows and domain contracts while applying its existing paper-journal and scientific-minimal UI system. Read PRODUCT_NORTH_STAR.md and docs/UX_UI_VISUAL_STANDARD.md first. Root tokens and self-hosted Pretendard serve the app; historical design-kit rules below are not authority to add confidence scores, remove Korean explanations, or remove approved decoration features.
user-invocable: true
---

# TRAINORACLE Design System — Skill Map

## Current app scope (2026-09-12)

The owner approved the [design-system improvement plan](reports/plans/TRAINORACLE_DESIGN_SYSTEM_IMPROVEMENT_PLAN_2026-09-12.md). Preserve current words, routes, training values, storage semantics and approved editor behavior. Reuse visual assets and components selectively; a design handoff does not activate its proposed functionality.

Read `PRODUCT_NORTH_STAR.md`, `AGENTS.md`, then `docs/UX_UI_VISUAL_STANDARD.md`. The sections below preserve the original kit, not a replacement product contract:

- Inter/JetBrains Mono are historical kit choices. The current app uses self-hosted Pretendard and existing root tokens, including tabular numerals.
- Rules 8 and 9 do not authorize confidence percentages or English-only labels in the app. Existing evidence contracts and Korean terminology/help govern those displays.
- Rule 10 does not remove approved points, collections or journal decoration. Those features retain their own safety and acquisition boundaries.
- The original elite-only audience and fixed CycleRail description do not redefine the current plan eligibility or calendar calculation.
- Motion, compact chrome and v3 free placement follow their current approved scoped contracts. Do not roll them back to a static kit.

Historical skill description retained for provenance: TRAINORACLE — an AI coaching platform for elite 1500m–10000m runners. Scientific Minimalism (Tufte × Linear): warm off-white surfaces, teal-tinted ink, Deep Teal as the sole brand accent, Inter + JetBrains Mono, square corners, hairline borders. Color is for information, never decoration. Energy systems (BASE/LT/VO2/GLY/ATP/REST) are encoded as 7px dot + 2-char mono code + 1.5px underline — never as background. AI verdicts (CONFIRM/RECOMMEND/UNC/LACK) with confidence % accompany every AI utterance.

## Historical kit reference (original content preserved)

## What this is
A **thinking tool** for elite middle-distance running coaches and athletes.
Tone: scientific journal, not sportswear ad. Honest uncertainty. Evidence-first.

## File map

| Where | What |
|---|---|
| `README.md` | High-level identity, content tone, visual foundations, iconography. **Read first.** |
| `PHILOSOPHY.md` | 10 design rules + 10 absolute prohibitions |
| `DESIGN_DECISIONS.md` | Why this direction (v1 → v2 pivot) |
| `colors_and_type.css` | All CSS variables — link this in every artifact |
| `design-system/DESIGN_TOKENS.md` | Color / type / spacing tokens (Tailwind-ready) |
| `design-system/COMPONENT_INVENTORY.md` | 47 reusable components, prop sketches |
| `design-system/SYSTEM_FOUNDATIONS.md` | 4 horizontal systems: Identity / Visualization / Trust / Feedback |
| `preview/` | Design-system cards (visible in the DS tab) |
| `ui_kits/trainoracle-app/` | Mobile + desktop UI kit — JSX components + index.html |
| `reference_designs/` | Original hi-fi HTML (Landing, Session, Dashboard, AI Chat, etc.) |
| `assets/` | Logos, marks, icon refs |

## The 10 brand-specific rules (do not break)

1. **No gradients.** Linear / radial / conic — all banned. Subtle highlighter underline is OK.
2. **No serif anywhere** (Instrument Serif was removed in v2).
3. **No emoji in UI.** User input is free.
4. **No emoji-card aesthetics.** No pastel backgrounds. No bluish-purple gradients.
5. **Square corners** (radius 0). Inputs/buttons max `4px`. Avatar circles `50%` are the only exception.
6. **Energy colors only as dot + underline.** Never as background fill.
7. **Mono for all numerics.** Pace, HR, TSS, time codes — `font-variant-numeric: tabular-nums`.
8. **AI always has a verdict + confidence %.** Plus an "alternative view" section.
9. **Preserve training terminology in English** (VO2, LT, BASE, MAIN, AUX, CK, RPE, TSS).
10. **No gamification.** No badges, streaks, levels, "great job!" toasts.

## Quick CSS hook
```html
<link rel="stylesheet" href="colors_and_type.css">
<!-- variables: --bg, --ink, --brand, --e-base...--e-rest, --sans, --mono -->
<!-- helpers: .mono, .t-h1, .t-mono-sm, .etag.vo2, .verdict.recommend -->
```

## Signature components
- **EnergyTag** — `<span class="etag vo2"><span class="d"></span><span class="c">V2</span><span class="n">VO2-Long</span></span>`
- **Verdict** — `<span class="verdict recommend">RECOMMEND · 87%</span>`
- **MAIN marker** — `※ MAIN` (mono, asterisk prefix)
- **CycleRail** — 10-cell horizontal 9.5-day timeline (the differentiator — no other product has this)

## When in doubt
> "This tool helps the coach think — it does not replace the coach."

If a design decision can't pass that line, redo it.
