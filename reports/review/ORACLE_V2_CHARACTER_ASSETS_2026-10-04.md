# Oracle V2 Character Asset Provenance

Date: 2026-10-04  
Status: SEVEN_ASSETS_SAVED_AND_LOCALLY_VERIFIED  
UI integration: NOT_PERFORMED (parent-owned)  
Public activation / deployment: NOT_PERFORMED

## Approved Scope

This slice adds only seven new PNG assets in `app/public/oracle-v2/`, the new
`app/src/domain/oracle-character-assets.ts` manifest, and this report.
No existing artwork, Oracle scoring, selection, account logic, UI, CSS, dependencies,
or configuration was edited. No commit, push, deployment, or external paid API fallback.

The working tree already contained substantial parent-owned Oracle V2 work.
That work was preserved. The names and the six core keys below were read from the
current `app/src/domain/oracle-profile-v2.ts`; SU and WE are not character keys.
NEUTRAL retains the current label "나의 러닝 프로필" and is an equal-status
finished human runner, not an empty or inferior placeholder.

## Inputs and Generation

- Read `AGENTS.md`, `PRODUCT_NORTH_STAR.md`,
  `specs/reconstruct/ORACLE_V2_IMPLEMENTATION_CONTRACT.md`,
  `app/src/domain/oracle-profile-v2.ts`, the relevant visual standard,
  and the current root color tokens.
- Visually inspected `app/public/decorations/avatar-easy-jog.webp`.
  Its fine ink outlines and restrained flat clothing informed the new drawings.
  It was a style reference only, not an edit target or a replaced file.
- Tool: built-in `image_gen.imagegen`; seven separate generation calls,
  exactly one call per character, each with `transparent_background: true`.
  No CLI/API fallback, API key, download of stock art, or installation was used.
- No image was supplied as an edit/reference attachment to the generator.
  The inspected aesthetic was described in the prompts below.
- Built-in source directory:
  `C:/Users/admin/.codex/generated_images/01a10714-ac9e-7ff2-83ca-412cb7834e15/`.
  The native tool did not expose a model identifier, seed, or revision.
- Each source PNG was copied byte-for-byte into the workspace, without replacing
  an existing file. Source files were left intact. No alpha stripping, background
  removal, palette remapping, rescaling, cropping, or lossy re-encoding was applied.
- The prompt requested 1024 square; the tool actually returned **1254 x 1254**
  for every asset. The manifest uses the measured dimensions.
- These are newly AI-generated fictional human illustrations, not commissioned
  portraits of identifiable people. Prompts exclude famous people, franchise
  characters, logos, mystical diagnoses, rankings, and ability claims.
  No claim of legal exclusivity or exhaustive third-party similarity clearance is made.

## Deliverables

All assets are PNG RGBA (PNG color type 6), 1254 x 1254.
Total: **4,775,248 bytes** (approximately 4.55 MiB).
The paths below are public-root URLs; corresponding files live under `app/public`.

| ID | Public asset path | Bytes | Fully transparent pixels |
|---|---|---:|---:|
| CHALLENGE | `/oracle-v2/character-challenge-v1.png` | 667642 | 83.56% |
| INTENSITY | `/oracle-v2/character-intensity-v1.png` | 708002 | 83.59% |
| STRUCTURE | `/oracle-v2/character-structure-v1.png` | 668664 | 83.85% |
| SOCIAL | `/oracle-v2/character-social-v1.png` | 654224 | 84.17% |
| EXPLORE | `/oracle-v2/character-explore-v1.png` | 701323 | 83.48% |
| REFRESH | `/oracle-v2/character-refresh-v1.png` | 733515 | 82.97% |
| NEUTRAL | `/oracle-v2/character-neutral-v1.png` | 641878 | 83.81% |

Distinctive cues:
- CHALLENGE: bob haircut, teal singlet, looking at a wristwatch.
- INTENSITY: curly hair, ink-blue shirt, active running stride.
- STRUCTURE: glasses, tied hair, sage jacket, notebook and pencil.
- SOCIAL: wavy hair, pale yellow shirt, open-hand greeting.
- EXPLORE: braided hair, cap, pale windbreaker, folded paper.
- REFRESH: tied longer hair, sage shirt, bottle and relaxed walking step.
- NEUTRAL: short hair, pale tee, gray-green shorts, balanced standing pose.

The body, outfit, expression and gesture communicate each illustration's subject.
They do not infer a user's sex, ethnicity, body type, ability, fitness, actual
training frequency, health state, or recommended exercise from questionnaire answers.

## Manifest Handoff

Export: `ORACLE_CHARACTER_ASSETS`. Each entry has `src`, `label`, `alt`,
`width`, and `height`. The outer map and individual entries are frozen.
`OracleCharacterAssetId` derives the non-optional core IDs from `ORACLE_AXES`
and adds NEUTRAL. A compile-time Record requires all seven entries and excludes
SU/WE. No scoring or character-selection behavior is implemented here.

Use the selected representative supplied by existing Oracle V2 logic to index
the manifest. Preserve the square aspect ratio and use contain sizing; avoid a
face-only crop that removes the differentiating pose and prop. The Korean
nickname remains necessary because illustrations are not self-sufficient labels.
When visible neighboring text fully duplicates the image's purpose, the parent
can apply its accessible decorative-image policy instead of repeating the alt.
Do not use asset order, clothing color, or apparent body build as a rank or score.

## Local Verification

PASS:
- Seven PNGs decoded in installed Playwright Chromium.
- Seven unique byte hashes and public paths; every copied hash matches a native
  generated source. All dimensions match the manifest.
- Every PNG contains transparent, partially transparent and opaque pixels.
  All outermost canvas pixels have alpha zero; there is no solid rectangular matte.
  The original generated antialiasing and internal pencil texture were preserved.
- Visual review of all seven full figures individually and in a browser-rendered
  comparison on `#FAFAF7`, `#0E1412`, and `#F7F3E8` backgrounds.
  Full heads/feet remain visible, silhouettes and clothing differ, and no visible
  backdrop, sticker frame, halo, ranking badge, diagnostic symbol, or text appears.
  All share the same ink-and-pencil stationery vocabulary.
- Review contact sheet rendered with each asset in a 200 x 264 contain box.
  This was an isolated asset harness, not the Oracle application.
  Temporary QA screenshot: `%TEMP%/oracle-v2-asset-review-20261004.png`;
  it is not a shipped eighth character or a permanent project deliverable.
- Manifest key coverage, exact current nickname equality, nonempty Korean
  descriptive alt text, PNG path pattern, file existence, PNG RGBA header,
  dimensions, and readonly objects checked at runtime.
- In-memory negative checks rejected four injected defects: missing NEUTRAL,
  invalid asset path, wrong nickname, and wrong dimensions.
  No defects were written into application files.
- Focused TypeScript check completed with exit code 0:

```text
cd app
node node_modules/typescript/bin/tsc --noEmit --strict --skipLibCheck --target ES2022 --module ESNext --moduleResolution Bundler src/domain/oracle-character-assets.ts
```

This ordinary additive-artwork slice did not run the full application test suite,
application build, CI, production deployment, account flows, or the two contract
release journeys. Asset rendering checks do not establish parent UI integration,
320/375px application layout, zoom, accessibility, clinical validity, or public
release readiness. Parent owns those integration/release checks. PNGs deliberately
remain original quality; any later responsive derivative is a separate change.

## SHA-256 Receipts

- CHALLENGE: `a91a60ad36ddb5e80383b9c812fcaf91f1d2ba03dd3ef6f2592be66264157f51`
  - Built-in source filename: `exec-12ae415f-9615-430c-9cd4-fa191aee374c.png`
- INTENSITY: `bba6f9b715f591c3f6e852f4b69e2b53bc319a63488ba87282d41f1b45a08c22`
  - Built-in source filename: `exec-cfca0b80-de02-417c-8e87-6b3c7d3677d7.png`
- STRUCTURE: `361e37a67f606c6727111e53b356cada44ecafe2cf328995deb94106d0d54959`
  - Built-in source filename: `exec-fc58cec8-2d19-4b7f-a7d6-11f1a2ae5d9d.png`
- SOCIAL: `3d810e1651234d31bdb5c4650fab3e6f15d4c6841e63128fc5264597e9152fc3`
  - Built-in source filename: `exec-5e41910d-560e-46f4-8678-a3f5a51d31d2.png`
- EXPLORE: `a0894702c47ade4670fbe56a3996618d9f47287c454807fd374decafa6e4444f`
  - Built-in source filename: `exec-44b43666-d25a-4e97-b8a1-5ea8a46160c8.png`
- REFRESH: `628d541d767c58a6cfe4c963b9af8985b9fa014de6a35e34c66adcd5254dbbe2`
  - Built-in source filename: `exec-7a5c8f76-013a-4218-8592-9573a0764995.png`
- NEUTRAL: `ac6aaa092944c242e9c13ee52d5c74839474ac6370c52d50dc9b7809a01fad9c`
  - Built-in source filename: `exec-4a318781-88a9-424b-ac0f-9819185fb77a.png`

## Exact Prompt Set

Each tool prompt was the following shared prefix followed by the corresponding
character paragraph, separated by one space. No references/previous-image
parameters were supplied. All seven calls set `transparent_background: true`.

### Shared Prefix

```text
Use case: illustration-story. Create ONE original full-body adult human runner character bitmap for TrainOracle Oracle V2, square 1024x1024, genuinely transparent RGBA background. Restrained paper-and-ink running diary stationery illustration: fine charcoal #2B3330 hand-ink outlines, simplified but anatomically natural human proportions, small readable expressive face, delicate dry-pencil hatching only within figure and matte flat colored clothing. Not faceless, not chibi, not anime, not photorealistic, not 3D. Inspired by the visually inspected reference avatar-easy-jog.webp's restrained thin-line runner aesthetic, but a completely new distinct human. Center complete body in square with generous transparent margins, feet fully visible, figure about 82 percent image height, equal visual status to other characters. No background paper rectangle, no ground, no cast shadow, no white sticker border, no aura, no scenery, no floating symbols, no lettering, no numerals, no logos, no watermarks. Ordinary welcoming runner with plausible limbs/hands. Each nickname expresses a preference, never ability, rank, diagnosis, elite physique, pain tolerance, a mystical personality, or training prescription. Do not depict famous people or recognizable franchise characters. Clothing accents use existing stationery tokens #0D5F5A deep teal, #1A3A6F ink blue, #DDE3D2 sage, #E8DCB0 tape yellow, #F7F3E8 paper cream, #FFFFFF white, #5F6965 gray-green; skin and hair natural. Palette is guidance, not exact flat indexed color.
```

### CHALLENGE

```text
Character: CHALLENGE, nickname 기록 도전자, personal record-goal preference. Adult woman, short straight dark bob, warm light-medium skin. Standing in an easy three-quarter pose, pleasantly focused, glancing down at her wristwatch with opposite hand near its button, no readable watch display. Teal sleeveless running top, ink-blue shorts, white socks and sage running shoes. No medal, podium, race bib, victory gesture or speed comparison.
```

### INTENSITY

```text
Character: INTENSITY, nickname 강한 달리기 애호가, enjoyment of vigorous running when recovered. Adult man with short curly dark hair and medium-brown skin, ordinary non-exaggerated build. Full-body side three-quarter running stride, arms bent naturally, composed lively expression and open relaxed hands. Ink-blue short-sleeve running shirt with small tape-yellow side accent, charcoal running shorts, cream socks and teal shoes. No pain, grimace, fire, sweat symbols, speed lines or giant muscles.
```

### STRUCTURE

```text
Character: STRUCTURE, nickname 계획을 즐기는 러너, enjoyment of planning. Adult woman with dark hair in low bun, thin round glasses and medium skin. Standing with weight softly shifted, holding a small open cream running notebook at waist level and pencil above it; pages blank, no legible marks. Sage lightweight running jacket over white shirt, charcoal tapered running trousers and ink-blue running shoes. Calm attentive smile, visibly sportswear rather than office attire.
```

### SOCIAL

```text
Character: SOCIAL, nickname 함께 달리는 러너, enjoyment of running with others. ONE adult man with wavy dark hair and warm light skin. Full-body casual jogging-step pose, head gently turned toward an imagined companion outside frame, one open hand raised in a friendly greeting, other arm bent naturally, easy genuine smile. Tape-yellow short-sleeve running shirt with white side panel, teal shorts, cream socks and ink-blue shoes. No second figure, speech bubble, heart symbol or leader/follower implication.
```

### EXPLORE

```text
Character: EXPLORE, nickname 새로움을 찾는 러너, preference for new running experiences. Adult woman with dark braided ponytail and deep brown skin, wearing a sage running cap. Three-quarter full-body paused walking step, curious head turned slightly to the side, holding a small folded blank route paper low in one hand, other arm relaxed. Off-white running windbreaker with small ink-blue panel, teal running shorts, charcoal socks and sage shoes. No mountains, compass symbols, location data or explorer costume.
```

### REFRESH

```text
Character: REFRESH, nickname 기분 전환 러너, running for a change of mood. Adult man with loosely tied shoulder-length dark hair and medium tan skin. Full-body gentle walking step, head comfortably upright, shoulders relaxed, soft contented expression, arms loose with one hand carrying a small plain water bottle. Sage running tee, ink-blue shorts, white socks and muted tape-yellow shoes. No meditation pose, halo, spiritual symbols, healing claims or exhaustion.
```

### NEUTRAL

```text
Character: NEUTRAL, existing label 나의 러닝 프로필. Distinct adult human runner of androgynous appearance, cropped slightly wavy dark hair and warm medium skin. Full-body balanced front three-quarter standing pose, one foot slightly forward, arms relaxed beside body, gently attentive neutral expression. White running tee with a small sage shoulder panel, gray-green running shorts, cream socks and ink-blue shoes. This is a complete equal-status person, not a faceless silhouette, gray placeholder, question mark, indecisive gesture, empty state or inferior character. No salient special preference prop.
```

