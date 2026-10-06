# Workout Memo Tool Contract

## Scope

The owner's ten printed/handwritten workout memo reference photographs are design
references only. Do not use image generation, reproduce their baked dates/numbers,
or treat sample coaching cues/results as a training authority. This tool presents
and exports an existing prescription; it neither prescribes new training nor
creates a second diary or memo storage system.

## Presentation

- Flat yellow/pink/white paper; actual date and AM/PM when supplied by the caller.
- Existing Pretendard and Lucide controls; no 3D magnet, shadow or generated asset.
- Exact work, per-segment target, repeat/set recovery mode, preparation and cooldown.
- Mark unapplied preview, planned training and historical prescription distinctly.
- No invented target when only duration/RPE is stored. Failed catalog version
  resolution retains the stored duration/RPE with an explicit limitation.
- Unknown dates stay unknown; do not substitute today's date for a historical plan.
- Open inline within the current reader, not another navigation/modal layer.
- 44px controls, wrapping at 320px and enlarged text, reduced-motion support.

## Owner Follow-Up: Plain Language and Modular Layouts (2026-10-06)

- Keep the familiar `5 x 1000m`, `@4:10/km`, and precise short-repetition targets.
  Explain exercise/recovery words plainly: RPE -> perceived difficulty out of 10,
  RP -> race average pace, Build-up -> progressive acceleration (not all-out),
  Walk/Jog -> walking/jogging. These are display changes, not new intensity rules.
- Preserve any additional qualifier attached to an effort cue, especially stop
  instructions. Do not shorten a cue to the RPE number alone in plain mode.
- The internal layouts are Full and Compact. Compact has tighter spacing and
  fewer large headings, not a partial prescription. It retains every line,
  recovery level, preparation, cooldown, source basis, state and safety notice.
- No extra mandatory step before copying or downloading. Layout and color are
  optional, local choices; they do not create a diary entry or account mutation.
- A layout change invalidates the PNG cache. Screen and image use the same layout,
  and copied text retains the complete prescription in either layout.
- Corrupt repeat counts, recovery numbers or support values fail closed instead
  of producing a plausible-looking downloadable prescription.

## Module Boundaries

1. `workout-memo.ts`: prescription snapshot -> safe memo content, plain wording.
   No source-record reload, storage or layout decisions.
2. `workout-memo-presentation.ts`: memo -> registered layout presentation.
   No numerical recomputation or removed steps.
3. `WorkoutMemoSheet.tsx`: read-only paper surface. No commands, editor state,
   history manipulation or account writes.
4. `WorkoutMemoTool.tsx`: optional layout/color controls and explicit export
   actions, account-scope invalidation and failure notices.
5. `workout-memo-export.ts`: local deterministic PNG from the same presentation.

## Prepared Decoration Extension (Not Yet an Editor)

Future decorated layouts reuse these modules rather than copying prescription
rendering or creating a separate results store. The current product exposes only
Full and Compact; do not add a nonfunctional decorated option.

- Add a reviewed layout entry and a typed, decorative-only rail outside the
  prescription/safety body. No absolute sticker positioning over workout text.
- Keep ornament settings distinct from the immutable prescription snapshot.
  Ornament text cannot replace or edit target numbers, recovery, state or basis.
- Reuse approved catalog assets and ownership/license checks. No arbitrary remote
  URLs, diary prose, health values, new generative service or hidden network fetch.
- Define asset loading, image-export parity and failure fallback before exposing
  the decorated option. Failed ornaments must not erase or delay prescription text.
- Preserve reduced motion, 44px controls, contrast, text enlargement and privacy.
- Existing diary-decoration purchases, points, limits, and saved coordinates are
  not changed by this presentation contract. Reusing that editor or persisting
  memo decorations needs its own narrow design/storage integration review.

The owner has approved preparing expansion, not an unimplemented editor claim.

## Owner Flow Correction: Direct Choice (2026-10-06)

- Display `쉽게 보기` (Full) and `간단하게 보기` (Compact) immediately, even when
  the paper is closed. No preliminary "open memo" tap is required.
- One tap selects the layout and opens its paper. The same two controls remain
  visible while reading; switching layout does not add history or a confirmation.
- Expose selected/expanded state and the controlled panel to assistive technology.
- A separate collapse icon returns to the visible choices. Collapsing invalidates
  pending image export, so a delayed download is not triggered after closing.
- Preserve paper colors, exact prescription, safety information and explicit
  copy/save/share actions. Neither choice applies or saves a training plan.

## Owner Follow-Up: Separate Depth From Wording (2026-10-06)

This supersedes the two public labels in Direct Choice above. `쉽게 보기` and
`간단하게 보기` must not remain competing names for identical content.

- Always-visible major choices: `간단히` / `자세히`. One tap opens a memo.
- `간단히` offers `핵심만` / `기본` (default); `자세히` offers `방법`
  (default) / `설명까지`. Remember each group's local choice while switching.
- Independent wording choice: `쉬운 말` (default) / `훈련 표기`. It changes
  words such as RPE, RP, min, Jog, not doses, dates or source records.
- Core combines duplicate work/target rows and stop notices without deleting
  quantities, repeat/set/terminal recovery, preparation, cooldown, basis or state.
  Standard presents separate compact rows. Method orders stored preparation,
  work/recovery and cooldown. Explained adds existing reviewed explanation
  content, version and source references, never invented personal/cycle reasons.
- Current general explanation and catalog-bound explanation must be distinguished.
  Historical mode states that this is not reconstruction of the original reason.
- Missing/stale catalog explanation falls back to labelled common information;
  it must not attach another catalog's dose rationale to the saved prescription.
- Screen, copy and PNG consume the same selected presentation. Every choice
  invalidates pending export/cache; account-scope changes still invalidate all.
- No new persistent preference store, training mutation, AI service or unimplemented
  decoration choice. Legacy `full`/`compact` module inputs remain readable aliases.

## Export and Privacy

- Screen, plain text and deterministic local PNG use one immutable display model.
- Only explicit Copy / Save / Share actions export. No remote image service.
- Include prescription safety/stop rules; never crop steps or recovery to fit paper.
- Exclude diary prose, private notes, health measurements, account identifiers,
  raw source-record IDs and original PB history. Show basis category/event only.
- Do not reload the latest PB or reinterpret completion checks as achieved targets.
- Export is not diary persistence, active-plan application or online-save success.
- Clipboard blocked: selectable text. File sharing unavailable: local download.
- Share cancellation is not an error. Generation failure reports failure, not success.
- Invalidate pending work on unmount, prescription change and account-scope change.
- iOS transient activation may require a fresh share tap after preparing the PNG.

## Checks

Verify decimals, AM/PM and real weekdays, repeat/set recovery, mixed structures,
legacy conditional recovery and V3 terminal recovery, stale catalog binding,
unknown dates, planned-vs-actual labels, private-data exclusion, clipboard failure,
scope change during export, no nested modal/history entry, and local PNG pixels.
Build/local preview, production deployment and real-account persistence are separate
evidence levels. This read-only tool does not establish the latter two.
