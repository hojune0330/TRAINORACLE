# TrainOracle Open-License Cute Sticker Collection Implementation Report

## Scope

- implementation branch: `codex/cute-open-sticker-collection`
- base main: `113a00bbbed3649738389f512d2be3c3c23393a1`
- collection id: `OPEN_CUTE_V1`
- catalog: 28 illustrated stickers
- price: every item costs a fixed `4P`
- placement: a nested `귀여운 스티커` collection inside the existing material drawer

The collection adds 24 Microsoft Fluent Emoji Flat illustrations and four Open Peeps
character illustrations. The Open Peeps characters are ordinary stickers, not a new
avatar system. Existing TrainOracle materials, Unicode emoji, the 24-item page limit,
Undo/Redo, and the editor storage schema remain unchanged.

## Source And License Boundary

- Microsoft Fluent Emoji source revision:
  `1ffb34c752ecf5d402f04cfb4b392c77f57c54bc` (`MIT`)
- Open Peeps source packaged by `@dicebear/open-peeps@9.4.2`:
  `73e2dd6cfb471a36871851cf0707b5f2f6b48c32` (`CC0` artwork, `MIT` package code)
- local license copies:
  - `app/public/licenses/fluentui-emoji-MIT.txt`
  - `app/public/licenses/dicebear-open-peeps-LICENSE.txt`
- public notice: `app/public/legal/open-source.html`
- immutable asset ledger: `app/public/decorations/open-license-assets.json`

All 28 assets are bundled locally as transparent 256-by-256 WebP files. The runtime
does not request artwork from a third-party host. The ledger pins the original source,
revision, transformation description, file name, and SHA-256 for every asset.

## Product Behavior

1. The normal material drawer remains compact and shows one collection entry rather
   than inserting 28 additional cards into the primary list.
2. Opening the entry shows five Korean groups: `달리기·도구`, `기분·회복`,
   `날씨·시간`, `응원·성취`, and `낙서 친구`.
3. Every tile shows the same `4P` price before purchase.
4. Purchase uses the existing inline confirmation row and the authoritative V3
   decoration store. A 4P balance becomes 0P after one purchase.
5. Purchased stickers use the existing canvas placement, drag, resize, rotate,
   copy, delete, Undo/Redo, backup, and page-limit behavior.
6. The More screen and collection drawer both expose the public source and license
   notice without making legal text dominate the editor.

## Verification Before Push

- default unit and contract suite: `1,863/1,863 PASS`
- KST unit and contract suite: `1,863/1,863 PASS`
- hosted release environment: `11/11 PASS`
- device integration: `10/10 PASS`
- open-license asset validation: `2/2 PASS`
- E2E TypeScript: `PASS`
- production build: `PASS`
- cute collection purchase flow across desktop, mobile, 320-pixel touch, and
  reduced-motion projects: `4/4 PASS`
- complete decoration-editor E2E file across the same four projects: `52/52 PASS`
- direct visual inspection: 320-by-568 and 1440-by-900; no horizontal drawer overflow

The production build retains the repository's pre-existing Pretendard runtime-resolution
warning. Build output completes successfully. Physical iOS/Android device performance,
Korean screen-reader speech, and long-session memory behavior are not claimed by this
local evidence and remain separate release evidence gaps.

## Release Boundary

This report records implementation evidence before review. It does not by itself prove
GitHub CI, merge, Pages deployment, or live-site behavior. Those claims require exact-SHA
evidence after push and merge.
