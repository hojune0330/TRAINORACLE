# APPT packet documentation code-quality review, post-fix pass

Review date: 2026-07-22 Asia/Seoul

Goal: Second read-only review of every current file under `reports/review/appt-packets/` plus the complete Git diff, with explicit rechecks of source-snapshot reproducibility at `9cf33692741167e1563a881ffec934477c41794d`, `review_head_sha` coverage, restricted identity references, opaque participant IDs, naming, authority, D9/privacy invariants, source-path truth, and handoff links.

Result: `codeQualityStatus: WATCH`

Recommendation: `APPROVE`

## Scope and repository state

- Reviewed all 15 current bundle files: `README.md` plus APPT-01 through APPT-14 (14 unique packet IDs and 14 index rows).
- Reviewed the complete unstaged diff for:
  - `HANDOFF_NEXT_CHAT.md`
  - `SPEC_WORK_STATUS.md`
  - `reports/review/APPT_PRE_REVIEW_AND_EVIDENCE_AUDIT_20260722.md`
  - `reports/work-harness/NEXT_WORKER_HANDOFF.md`
  - `reports/work-harness/OWNER_DECISION_CHECKLIST_20260722.md`
- Staged diff is empty. The packet directory and this evidence area are untracked; the five documents above are modified.
- Current branch/head: `codex/share-terra-sol-router@9cf33692741167e1563a881ffec934477c41794d`.
- The `omo` aggregate executable was not on this PowerShell session's PATH. Calling the installed ULW component directly with `node .../components/ulw-loop/dist/cli.js status --json` returned `ULW_LOOP_PLAN_MISSING`; no `.omo/evidence/ulw/` plan directory exists. The required fallback report path is therefore `.omo/evidence/appt-packets-code-review.md`.
- No goal-specific notepad path was supplied and no ULW goal exists. Existing `.omo/notepads/` files concern other work orders and were not treated as task input.
- Inspected the supplied manual-QA artifacts under `.omo/evidence/appt-packets-manual-qa-20260722/` as untrusted evidence. Their `Observed tree: a56a51b...` is the committed tree of HEAD and does not contain the untracked packet bundle, so that older set was used only as navigation transcripts, not as immutable bundle provenance.
- A concurrent worker added the post-fix set `.omo/evidence/trainoracle-appt-postfix-*` during this review. It was also inspected as untrusted evidence and corroborates 14 links, 72 source declarations / 46 unique snapshot paths, 15 review-head fields, restricted identity rules, UTF-8, final markers, and false-activation guards. Its recorded tree is likewise the committed source tree rather than a committed packet revision, so all approval checks below were still rerun independently.

## Findings

### CRITICAL

None.

### HIGH

None.

### MEDIUM

#### M1. A pre-existing evidence test pins exact natural-language prose

`specs/test-packages/formation-research-integrity.test.mjs:244-252` replaces the exact Korean sentence `아직 실제 계획에는 쓰지 않아요` and expects the validator to fail. The validator mirrors that literal at `specs/test-packages/validate-formation-final-review-preparation.mjs:61-71`. This is an implementation/prose-constant test: legitimate rewording would require synchronized validator and test edits without proving a machine-consumed behavior.

This test and validator are unchanged by the current diff, and the APPT bundle does not depend on this assertion for the verdict. It is therefore a non-blocking, pre-existing evidence-quality warning. The test's pass was excluded from the approval rationale; source snapshot, metadata, authority, privacy, and link checks were independently observed.

### LOW

None.

## Prior-finding recheck

### H1 source snapshot reproducibility: RESOLVED

- `reports/review/appt-packets/README.md:10-12` now separates the immutable `source_document_snapshot_sha: 9cf33692741167e1563a881ffec934477c41794d` from the packet bundle revision and assignment-time `review_head_sha`.
- `reports/review/appt-packets/README.md:35-37` explains that the snapshot SHA identifies the source originals, while the packet plus sources must be reviewed at the exact PR head frozen into `review_head_sha`.
- Independently parsed all APPT `먼저 읽을 원문` sections: 72 declarations resolve to 46 unique repository paths. All 46 exist in the working tree and all 46 resolve with `git cat-file -e 9cf33692741167e1563a881ffec934477c41794d:<path>`; each produced an immutable blob ID.
- The two paths previously absent from the old declared baseline now resolve at the declared snapshot: `reports/review/APPT_PRE_REVIEW_AND_EVIDENCE_AUDIT_20260722.md` and `reports/work-harness/OWNER_DECISION_CHECKLIST_20260722.md`.

### M1 common review-head field: RESOLVED

- Every APPT-01 through APPT-14 header contains exactly one `review_head_sha: TO_BE_FROZEN_ON_ASSIGNMENT`.
- The four previous omissions are fixed at `APPT-06_ATHLETE_COACH_USABILITY.md:11`, `APPT-07_ACCESSIBILITY_AT.md:10`, `APPT-10_INDEPENDENT_PILOT.md:12`, and `APPT-11_PILOT_SAFETY.md:11`.
- Role-specific reviewed-build/path fields remain in the decision records, so the common packet freeze and role evidence are both retained.

### M2 participant identity handling: RESOLVED

- `APPT-06_ATHLETE_COACH_USABILITY.md:48-61` requires opaque athlete/coach participant IDs, an out-of-Git restricted identity reference, and explicitly prohibits names, birth dates, contact details, guardian identity, and original consent from the repository packet.
- `APPT-07_ACCESSIBILITY_AT.md:48-60` requires an opaque reviewer/participant ID plus an out-of-Git restricted identity reference and keeps names, contact details, disability/health information, and qualification originals in the restricted trust store.
- The prior direct-ID field names `athlete_and_coach_verified_ids` and `reviewer_or_participant_verified_id` are absent.
- APPT-10 and APPT-11 also route legal identity through `restricted_legal_identity_record_ref: REQUIRED_OUTSIDE_GIT` at lines 49 and 48 respectively.

## Documentation and invariant checks

- Naming: all 14 packets contain exactly one `service_name: TrainOracle` and one `provisional_service_provider_name: aaclub`. The index and all five changed handoff/audit documents consistently describe `aaclub` as provisional and the legal provider/controller identity as unconfirmed; no changed text presents it as a confirmed company or controller.
- Authority: all 14 packets contain exactly one `runtime_authority: false`. Packet language consistently prevents AI/pre-review material, `[DRAFT_COMPLETE]`, assignment, or an individual packet decision from granting canonical promotion, issue closure, participant recruitment, runtime activation, medical authority, or automatic approval of other packets.
- D9: index lines 60-61 and the role packets preserve `ACTIVE` and `UNKNOWN` as plan-generation blockers. `CLEARED` remains a point-in-time absence of a detected D9 signal, not medical clearance, plan approval, return-to-play authority, or runtime approval. This matches `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md:264-281` at the declared snapshot.
- Note privacy: index line 62 and APPT-08, APPT-09, APPT-11, and APPT-12 consistently exclude raw athlete memo, symptom, medical, guardian, hash, length, and presence signals from audit/sync/analysis surfaces. This matches the source snapshot's local-first contract and privacy fixtures.
- Source-path truth: 46/46 unique source paths exist in both the current working tree and the declared `9cf3369...` source snapshot; 0 missing or empty snapshot targets were found.
- Handoff links: parsed 137 local Markdown links across all 15 bundle files and the five modified handoff/audit documents; 0 broken targets. The packet-index links added to all handoff surfaces resolve from their actual document directories.
- Packet structure: 14 packet files, 14 unique packet IDs, 14 index rows, 14/14 service/provider/runtime/freeze fields, and 15/15 `[DRAFT_COMPLETE]` markers.

## Verification evidence

- `git diff --check`: PASS; Git emitted LF-to-CRLF conversion warnings for the five modified tracked files, with no whitespace error.
- `git diff --cached --check`: PASS; staged diff is empty.
- Independent source manifest check: PASS, 72 declared references / 46 unique paths / 0 missing in working tree / 0 missing at `9cf3369...`.
- Independent local-link check: PASS, 20 documents / 137 local links / 0 broken.
- Packet metadata check: PASS, 14/14 unique IDs, `review_head_sha`, service name, provisional provider name, runtime false, and final marker.
- Concurrent post-fix evidence inspection: corroborated the independently observed 14 packet links, 46 snapshot paths, 15 review-head fields, and identity/activation boundaries; no synthetic reviewer record was treated as actual human approval.
- `node --test specs/test-packages/formation-attestations.test.mjs specs/test-packages/formation-research-integrity.test.mjs`: 21 passed, 0 failed. The exact-prose case identified in M1 was not counted as meaningful coverage; the signed-attestation, tampering, source-integrity, and fail-closed cases are relevant evidence.
- `node specs/test-packages/reasoning-tier-harness.mjs validate`: PASS, `catalog tasks=18 stages=3 runtime=false`.

## Required skill-perspective review

The `remove-ai-slops` and `programming` skills were fully consulted before judging maintainability and test relevance.

- `remove-ai-slops`: the current diff and packet bundle add no production code or tests, so deletion-only tests, requested-removal tests, tautologies, implementation-constant extraction, and unnecessary production parsing/normalization are N/A to the changed files. Repeated packet structure is intentional reviewer workflow, not needless abstraction. The pre-existing exact-prose test in M1 violates this perspective by mirroring a validator constant.
- `programming`: no Python/Rust/TypeScript/Go production change, untyped escape hatch, parser/validator addition, or needless abstraction is present in the diff. No brittle prompt/prose test was added by this change. The pre-existing M1 test violates the prose-test perspective but is outside the current diff and does not alter the bundle verdict.
- Diff verdict under both perspectives: no violation introduced by the current change.

## Residual risk and blockers

- The packet bundle is still untracked and `review_head_sha` is intentionally pending. Before any named reviewer signs, the bundle must be committed and the exact PR review head must replace the placeholder as described in `README.md:35-37`. This is the documented workflow state, not a current documentation defect.
- The older manual-QA set is not commit-reproducible for the untracked bundle because its recorded tree excludes it. The newer post-fix set correctly exercises the working-tree bundle and snapshot objects, but it is corroborative evidence until the bundle itself is committed. This review does not rely on either set for the final verdict.
- Blockers before approval: none.

`codeQualityStatus: WATCH`

`recommendation: APPROVE`
