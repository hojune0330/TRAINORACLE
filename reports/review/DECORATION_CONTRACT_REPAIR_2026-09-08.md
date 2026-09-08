# Decoration Contract Repair - 2026-09-08

## Scope and State

- Worktree: `TRAINORACLE-decoration-contract-repair` only.
- Branch: `codex/decoration-contract-repair-20260908`.
- Base and unchanged HEAD: `4a3f47fade4fbcb77563aa07a9307ba2fa514b6b` (PR #317).
- Initial working tree was clean. No commit, push, merge, workflow edit, or other worktree operation.
- Result: bounded local repair verified; not a claim that the full CI run or deployment passed.

## Reproduced Failure

The owner identified CI run `33838696095`. Running the exact asset test command locally on Node `v24.11.1` reproduced exit 1 before the tests could load:

```text
ENOENT: no such file or directory, open '.../app/public/decorations/open-license-assets.json'
```

The validator still expected a schema-1, single-directory manifest. The actual PR #317 architecture has:

- 35 base WebP files in `app/public/decorations/`.
- `DECORATION_COLLECTIONS` and `LICENSES` in `app/src/domain/decoration-collections.ts` as source data.
- 28 current collection WebP files plus schema-2 `assets.json` in `app/public/collections/open-cute-v1/`.
- License copies in `app/public/licenses/`, relative to public rather than the asset directory.
- A commit-only Fluent revision and a package-version-plus-commit Open Peeps revision.

After repairing discovery, execution exposed stale base-image dimensions as well. All 35 committed files were inspected: themes are 576x768, tapes 640x160, and other base assets 288x288. The old validator expected 512x512, 512x128, and 256x256 respectively. Git history identifies `4a3f47f` as the base-material replacement commit. Only validator expectations changed; no artwork was edited. Collection dimensions remain registry-defined, currently 256x256.

## Changed Paths

| Path | Change |
| --- | --- |
| `specs/test-packages/validate-decoration-assets.mjs` | Shared validator reading the actual collection registry and schema-2 ledgers. Retains the explicit 35-file base inventory and fixed current base dimensions. |
| `specs/test-packages/validate-decoration-assets.test.mjs` | Same CI entry point, now exercising the shared validator against real files and isolated mutation fixtures. |
| `reports/review/DECORATION_CONTRACT_REPAIR_2026-09-08.md` | This evidence report. |

No art, UI, catalog, prices, manifests, license documents, runtime code, package dependencies, or workflows changed. Node 24 is already selected by the CI contract job; its native TypeScript support imports the dependency-free registry without installing app dependencies.

## Retained Enforcement

- The registry determines required collection paths, including RETIRED collections. Missing manifests or entire collection directories fail, rather than disappearing from disk-driven discovery.
- Manifest contents must agree exactly with registry IDs, files, license metadata, provenance, acquisition, costs, render settings and hashes.
- Every collection asset requires a valid SHA-256 in both the registry and manifest, checked against actual bytes. Matching but incorrect hashes in both data sources still fail.
- Unknown license IDs, missing open-license file references, absent or empty license copies, and unpinned revisions fail. License copies retain the prior greater-than-500-byte requirement.
- Exact file/directory inventories reject missing, duplicate and unknown assets/collections. Unsafe asset paths fail before asset reads.
- RIFF/WEBP checks, fixed dimensions, 120 KiB per-file limit and 2 MiB combined asset limit remain enforced.
- The new fixtures live under `specs/test-packages/.decoration-assets-*` in this worktree and are removed in `finally`. No fixture directories remained after the tests.

## Executed CI Commands

Working directory for every command below was the repair worktree root. These are the exact affected commands at `.github/workflows/ci.yml:53-55`; no workflow adjustment was needed.

| Command | Observed result |
| --- | --- |
| `node --test specs/test-packages/validate-decoration-assets.test.mjs` | Original: exit 1, ENOENT. Intermediate: 31 of 32 tests failed on stale base dimensions. Final: exit 0; 34 passed, 0 failed, 0 skipped; 5196.7738 ms. |
| `node specs/test-packages/validate-journal-decoration-contract.mjs` | Exit 0; `journal decoration contract validation passed: 8 catalog items, 4 date slots`. |
| `node --test specs/test-packages/validate-journal-decoration-contract.test.mjs` | Exit 0; 16 passed, 0 failed, 0 skipped; 1338.2161 ms. |

The follow-up journal validator and its tests were inspected and executed before the asset edits. Their inputs and implementation remained unchanged: they validate the finalized V1-beta document, not the runtime collection ledger. They do not have the missing-manifest failure and were intentionally left alone.

The 34 asset tests include a real-tree positive control, an unchanged fixture positive control, 31 named fail-closed mutation cases, and a RETIRED-collection positive/negative lifecycle case. Mutations cover missing manifests/directories, both license copies, license metadata, source provenance, unknown licenses, missing/malformed/wrong hashes, actual byte tampering, missing/unknown/duplicate assets, unknown collections, stale costs, unsafe paths, invalid WebP headers, changed dimensions, and individual/aggregate size violations. Each rejection asserts the expected error category, not just any failure.

## Boundaries

- `git diff --check` passed after the code changes; only the normal Windows LF/CRLF warning was emitted.
- Full CI, app build, browser/device QA, and a remote rerun of `33838696095` were not performed or claimed.
- This is local Windows/Node 24 execution of the affected CI commands, not an Ubuntu runner result.
- Changes are uncommitted for the parent task to review and integrate. Other worktrees remain the parent's responsibility.
