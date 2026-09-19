# PROGRAMMED_FILE_ANALYSIS_PROGRESS_2026-09-19.md

## 쉽게 보는 결과

구현한 흐름은 `파일 가져오기 → 필요한 값 확인 → 계정 저장 확인 → 거리·시간·구간 분석 → 원래 계획과 비교 → 다음 계획 직접 선택`이다.
외부 AI를 부르지 않고, 확인된 수치를 정해진 계산으로 가공한다. TCX 외 CSV·JSON·GPX도 같은 저장·분석 흐름에 연결했다.

- 사용자가 입력한 메모·RPE와 워치 파일의 수치를 구분한다. 정정 파일을 넣어도 직접 쓴 내용을 덮어쓰지 않는다.
- 시간이 무엇을 뜻하는지 불분명하면 그 시간으로 페이스를 만들지 않는다. 거리처럼 확인된 값까지 버리지는 않는다.
- 구간 비교는 실제 계정에 저장된 당시 계획과 사용자가 확인한 대응만 사용한다. 현재 계획으로 바꿔치기하지 않는다.
- 다음 계획은 기존 후보·개인 참고 페이스·안전 규칙을 재사용한다. 파일을 넣었다는 이유로 훈련량·강도·빈도를 늘리지 않는다.
- 새 기능은 아직 공개 사이트에 반영하지 않았다. 서버 호환 업데이트 전 앱만 배포하면 기존 일지 저장이 거절되는 문제를 재현했으므로 서버 먼저 적용해야 한다.

아래 PASS는 합성 데이터로 실행한 로컬 검증이다. 실제 사용자 계정·운영 DB·공개 배포 검증과 구분한다.

## Execution baseline

- Owner authorization: 2026-09-19, execute the reviewed work order using the current high-capability model.
- Source baseline: 27cc6d5705a58f55eb3e07140a7f932d1118269c, main fast-forwarded from 4b1a083.
- Remote main verified through GitHub connector and git fetch. Open PRs observed: 338, 337, 320. Not merged by this task.
- No credentials/private athlete data accessed; synthetic tests only.
- Work order v1.2, original reports preserved. Scoped file-analysis adoption added; no canonical promotion.

## Stage status

| Stage | State | Evidence / next dependency |
|---|---|---|
| P0 | VERIFIED | Main baseline and existing designer work preserved; scoped adoption and six downstream clauses patched; existing next-plan engine reused |
| P1 | VERIFIED | Four strict adapters and identity handling: 151 focused tests per UTC/KST, mutation checks; no automatic provider trust or PB promotion |
| P2A | VERIFIED | Exact explanation/session identity, retained tabs/focus/scroll and RPE label: 34 focused tests per timezone; three mutations detected |
| P2B | VERIFIED | V2/V3, durable correction/comparison commands, current confirmation and backup restore fixed; full local database/handler rehearsal 184/184; native browser record-service 62/62 |
| P3 | VERIFIED | Source-aware report and shared distance projection; stale cached ACK excluded without deleting data; exact display precision and missing values preserved |
| P4 | VERIFIED | Immutable original and explicit lap mapping; current and restored relation namespaces; compatible prior performance comparison; browser confirmation/save/reload passed |
| P5 | VERIFIED | Actual synthetic browser flow reaches existing eligible method/pace selection, account-plan save, new-context reopen and original-plan comparison; no duplicate recommendation engine |
| P6 | VERIFIED | Local frozen-core review found no unresolved P1/P2 in its scope; full UTC/KST unit checks, focused browser flows, mutation checks and presentation checks passed. Full publication CI and live checks remain P7/P9 dependencies |
| P7 | BLOCKED | Compatible server must precede new client publication; production migration/server/flags and actual public verification not performed |
| P8 | VERIFIED | CSV, JSON and GPX each parsed, validated, acknowledged, reloaded and displayed in browser tests; each remains default-off and not publicly enabled |
| P9 | BLOCKED | Local multi-format integration exists; production R1/R2 verification and minimum compatible release evidence remain outstanding |

## Scope preservation

VERIFIED in this table means the stated local synthetic scope only, not deployment or the whole stage's operational finish line.
App implementation is not released. Existing device-import semantics remain available when the new flags are off.
Focused local test passes above are not production verification, completed migration, deployment or provider connection evidence.
The final integration section below supersedes intermediate checkpoints, which are retained as history.

## Intermediate integration checks (historical)

- Main worker: five import/restore test files, 108 tests passed before later integration edits.
- Main worker: current import/evidence/privacy/legacy-analysis notice subset, three files, 31 tests passed.
- TypeScript integration check passed once before later P4/P8/client correction changes; must rerun on final patch.
- A new test exposed binary km presentation precision; stored arithmetic stays unrounded, UI uses display-only formatting.
- Review caught reliance on a persisted `synced` string as account confirmation. Being replaced by matching the current account's acknowledged projection.
- Owner full backups use v4 when file observations exist; safe sharing omits evidence and rejects incoming evidence in safe payloads. Legacy full formats remain readable.
- Source identity and observation content revision are separate. Reimporting a confirmed observation reuses the original journal instead of overwriting its memo/RPE or creating another exercise.
- Local migration `0038_file_analysis_write_control.sql` is prepared with the gate false. The final local PostgreSQL-compatible rehearsal applies it to an ephemeral test database; it has not been applied to production.

## Independent review checkpoint (2026-09-19)

Huygens reproduced four P2 findings in a read-only synthetic snapshot. This is not final-patch approval.

| Finding | State | Response |
|---|---|---|
| File correction overwrites independently explicit distance/time | FIXED_LOCALLY_VERIFIED | Preserve direct input and only update file-owned compatibility summaries with consistent provenance |
| Persisted ACK cache becomes current evidence after failed hydration | FIXED_LOCALLY_VERIFIED | Separate cached availability from current-session server-confirmed analysis authority; retain data and disclose exclusion |
| Fresh V4 restoration rejects an entire journal when it contains valid comparison relations | FIXED_LOCALLY_VERIFIED | Revalidate owner-scoped original plans, observation and mapping; preserve historical revision without granting request authority |
| Selecting a real parsed correction passes derived output keys into the strict builder | FIXED_FOCUSED_VERIFIED | Explicit field projection; real TCX component regression passed. Injecting the old spread made the named regression fail. Product file SHA-256 restored to 923411F56D88BB209AAA41F8CF05A1F202B1CAD0F1438C0B86F6A986D7E2BFE7 before later UI-state additions |

Additional main-worker execution, all local synthetic and before the final freeze:

- Import/analysis/comparison focused run: 11 files, 269 tests passed.
- Full-backup/read/restore subset: 3 files, 54 tests passed.
- Correction/comparison UI after close/reopen hardening: 2 files, 14 tests passed.
- Hosted environment guard: 16 tests passed, including independent TCX/CSV/JSON/GPX account and account-journal prerequisites.
- Latest earlier TypeScript check passed; further concurrent edits require a final rerun.
- At this intermediate checkpoint there was no commit, push, production migration, server deployment, feature activation or public runtime proof.

The counts above are distinct commands at different patch states. They are not added together as a final release test total.

## Final integration update

- Local PostgreSQL rehearsal dependencies installed from the exact lockfile. Full maintained `supabase/tests/local-postgres` gate: 184/184 PASS, including actual SQL migrations and synthetic owner isolation. This supersedes the earlier unavailable-tool note.
- Generated account journal validator: 636,303 bytes, source-generation check and 93/93 tests PASS. Existing account-state validators: 2/2 PASS.
- D9 evaluator: 11/11 PASS. Existing training implementation suite: 891/891 PASS and typecheck PASS. No training-dose or safety semantics were changed.
- Hosted environment guard: 16/16 PASS. Device integration preparation tests: 10/10 PASS. These do not prove live COROS integration.
- Full app unit checks on the final runtime patch: UTC 4,086 PASS / 0 FAIL / 35 existing SKIP; Asia/Seoul 4,086 PASS / 0 FAIL / 35 existing SKIP. These are the same suite in two timezones, not 8,172 distinct tests.
- App typecheck, e2e typecheck and production build PASS. Build still reports the existing runtime font resolution, mixed static/dynamic imports and large-chunk warnings; it is not warning-free.
- New nine-scenario browser matrix: 9/9 PASS with synthetic account transport. Real parsers, native browser storage, plan selection/save/reopen, correction, all four formats, 320/375px and 200% text are covered. Screenshot review caught table legibility beyond the original assertions; the final 20em table/9em secondary-cell layout and actual text-boundary checks passed.
- Independent old V2 source-baseline browser test: 7/7 PASS; destructive cache-clear mutation failed by name, restored source passed 7/7. Follow-up uses the actual unmodified public deployment bundle `index-L0x0TA97.js`: warm-session and reload 426 preservation/retry/recovery scenarios 2/2 PASS. This closes the source-only evidence gap for those scenarios, not service-worker upgrade, complete failure UX or live server behavior.
- Independent reverse compatibility: 9/9 tests confirmed the new client sends `supportedJournalVersions` while the old server rejects it with 400. Flags being off do not avoid that protocol difference. **Do not push to auto-deploying main before the compatible server is deployed or a separately reviewed bridge exists.**
- Existing main CI at baseline already failed eight assertions after designer changes. Bounded fixes retain current labels and behavior, strengthen semantic/callback assertions, and replace the forbidden inset shadow with the same-width token border. Focused UTC/KST: 55 PASS / one pre-existing SKIP; eight mutations killed nine named tests.
- Main motion test now preloads its lazy route before testing direction, separating compiler latency from motion behavior. Independent 18/18 PASS; production motion unchanged.
- Existing device-import browser suite: 20/20 PASS across desktop, mobile, narrow touch and reduced motion. Two exact numeric expectations now use canonical `8` rather than display-padded `8.00`, with duration `40` and absent inferred pace asserted. The actual month/calendar navigation is used before checking the imported journal. No privacy, provenance, deduplication or RPE assertions were removed.
- Existing session-explanation and original-plan browser flows: 24/24 PASS across those same four profiles in the preceding unchanged-runtime run. These and the corrected device-import run are separate executions, not one clean 44-case run.
- All 28 existing contract-test command groups from the repository workflow completed successfully. This is a command-group count, not a count of test cases or a GitHub CI run.
- The full four-project application browser suite has not been rerun in this task. The release candidate still requires its complete publication gate after compatible-server readiness; focused checks do not replace that gate.

## Release handoff boundary

Independent final review, the exact 96-file source manifest, actual deployed V2 preservation results and selected synthetic screenshots are retained in
[the evidence index](../evidence/programmed-file-analysis-2026-09-19/README.md).
The reviewed runtime/configuration subset contains 56 files. All 96 captured source hashes matched before local commit.
The reviewer found no unresolved P1/P2 in that reviewed scope; this does not approve the unfinished production rollout.

The exact operational sequence and eight missing hosted build-variable mappings are in
[the release runbook](PROGRAMMED_FILE_ANALYSIS_RELEASE_RUNBOOK_2026-09-19.md).
No production database, server function, feature flag, workflow, or deployed app has been changed by this task.
The current environment has no configured Supabase deployment tool. Secrets were not sought or read to bypass that boundary.
Safe code integration is distinct from production activation; new-client publication is blocked by the verified server-first requirement.

[DRAFT_COMPLETE]
