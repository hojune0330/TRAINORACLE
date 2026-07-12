# CODEX_PARALLEL_IMPROVEMENT_DISCOVERY_20260711.md

```yaml
report_id: CODEX_PARALLEL_IMPROVEMENT_DISCOVERY_20260711
created_at: "2026-07-11"
base_ref: origin/main
base_commit: 471a0e4
purpose: "Fable 작업과 별개로 TrainOracle main 기준에서 개선 후보를 발굴한다."
scope:
  - app/src/**
  - specs/reconstruct/**
  - CODEX_WORK_ORDER_006.md
  - CODEX_WORK_ORDER_007.md
  - README.md
  - TRAINORACLE_SPEC_INDEX.md
  - SPEC_DOCUMENTATION_REPORT.md
non_goals:
  - app code modification
  - issue closure
  - canonical promotion
  - runtime evidence claim
```

---

## 1. Current State Snapshot

- Local `main` was fast-forwarded to `origin/main` at `471a0e4`.
- Open PR count observed through GitHub API: `0`.
- Open non-PR issues observed: `#42` ORDER_006 tracking, `#21` app CI build-step permission gap.
- ORDER_006 Task A/B/C outputs are now present on main:
  - `specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md`
  - `specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md`
  - `specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md`

This report is intentionally not the official ORDER_007 eight-persona review. It is a parallel improvement-discovery note so the next planning pass has more than defect verification.

---

## 2. Highest Priority Findings

### IMP-001 — ORDER_006 Task D index update is still missing

```yaml
severity: S2
type: documentation_handoff_gap
evidence:
  - CODEX_WORK_ORDER_006.md:106-110
  - specs/reconstruct/README.md:5-17
  - TRAINORACLE_SPEC_INDEX.md:196-203
  - SPEC_DOCUMENTATION_REPORT.md:92-103
```

ORDER_006 explicitly required Task D to update `specs/reconstruct/README.md` and counts after Task A-C. The three new contract files exist, but the reconstructed-spec README still lists only the older reconstructed/productization drafts. The top-level index and documentation report also do not reference the new journal decoration, local-first sync, or federated SSO contracts.

Suggested direction:

- Open a small Task D patch only for indexes/status docs.
- Add the three ORDER_006 contracts to `specs/reconstruct/README.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_DOCUMENTATION_REPORT.md`, and the README spec table if owner wants them visible from the repo front page.
- Keep all statuses as draft/review. Do not mark accepted, canonical, or runtime-tested.

### IMP-002 — Save failure can be reported as success

```yaml
severity: S2
type: data_loss_risk
evidence:
  - app/src/domain/journal-store.ts:83-93
  - app/src/screens/LogEntry.tsx:94-101
  - app/src/screens/LogEntry.tsx:236-244
  - app/src/screens/LogEntry.tsx:346-353
  - app/src/AppShell.tsx:90-109
```

`saveEntry` returns `{ ok: false }` when localStorage is unavailable or write fails, but all three form flows ignore the result and navigate home. The toast then says the entry was saved. This is a product trust problem because the app's current promise is "회원가입 없이, 이 기기에 저장".

Suggested direction:

- Make `persist` check `saveEntry(entry).ok`.
- On failure, keep the user on the form and show a non-destructive inline error with "내용을 복사/다시 시도" style recovery.
- Add a small storage-failure test path that simulates unavailable localStorage.

### IMP-003 — Race journal ships with real-looking default data

```yaml
severity: S2
type: data_integrity_risk
evidence:
  - app/src/screens/LogEntry.tsx:340-344
  - app/src/screens/LogEntry.tsx:346-353
  - app/src/screens/LogDetail.tsx:97-118
  - app/src/screens/Home.tsx:233-243
```

The race form initializes `rank`, `result`, and `memo` with plausible real values such as `2위`, `결승 진출`, and a race narrative. If a user saves without editing, fake race content enters the real local journal and later appears in Home/Detail.

Suggested direction:

- Replace those state defaults with empty strings.
- Move examples into placeholders or Guide-only demo surfaces.
- Add a regression check that real app screens do not seed non-test journal content.

### IMP-004 — Transient memo D9 assessment exists but is not wired into journal save

```yaml
severity: S2
type: safety_chain_gap
evidence:
  - app/src/safety/memo-safety.ts:28-49
  - app/src/screens/LogEntry.tsx:9
  - app/src/screens/LogEntry.tsx:94-100
  - app/src/screens/LogEntry.tsx:236-244
  - app/src/screens/LogEntry.tsx:346-353
  - specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md:151-158
```

`assessMemoTransient` correctly wraps the D9 evaluator and returns only disposition plus reason codes, but it has no callers. Current save flows persist memo/note/race memo without running the transient assessment path. This does not mean raw text is sent to a server; it means the "free text can raise risk" invariant is not yet reflected in the app flow.

Suggested direction:

- Before saving each free-text field, run transient assessment locally.
- Store only structured non-sensitive assessment metadata if storage is needed, never raw evidence clauses.
- Do not block journal saving. Instead, surface review state and ensure future plan generation sees `D9_ACTIVE` / `D9_UNKNOWN`.

### IMP-005 — High pain review disappears after save

```yaml
severity: S3
type: safety_ux_gap
evidence:
  - app/src/screens/LogEntry.tsx:292-296
  - app/src/screens/LogEntry.tsx:564-588
  - app/src/screens/LogDetail.tsx:123-145
  - app/src/screens/Trends.tsx:134-154
  - app/src/domain/glossary.ts:91-97
```

The app shows a Review banner while the evening form is open, but after save the day detail only renders pain rows, and Trends only renders week-level pain color. The "review required" state is therefore not durable in the user's daily loop.

Suggested direction:

- Derive and show a persistent local Review chip/banner on the day detail when any pain level is 4-5.
- Add a Home nudge for today's high pain record: "오늘 고통증 기록 있음 · 무리하지 말고 확인".
- Keep language non-diagnostic and non-medical. Do not claim plan blocking until the backend/safety gate path is actually wired.

### IMP-006 — Local-first data control UX is not first-class yet

```yaml
severity: S3
type: trust_and_privacy_product_gap
evidence:
  - specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:205-223
  - specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:231-234
  - app/src/domain/journal-store.ts:70-109
  - app/src/screens/Home.tsx:245-288
  - app/src/AppShell.tsx:90-109
```

The sync contract correctly leaves export/delete/unlink UX open. The app currently has local storage, recent listing, and sync chips, but no user-facing controls for export, delete, clear device data, or storage status. For a local-first product, those controls are part of trust, not just settings polish.

Suggested direction:

- Add an F0-e "이 기기의 일지 관리" task before account sync.
- Include export JSON/CSV, clear-all with confirmation, local entry count, and storage unavailable/quota messaging.
- Keep account-sync upsell informational until consent/back-end work is ready.

### IMP-007 — Memo sync policy needs a visible product decision before account sync

```yaml
severity: S3
type: sync_ux_decision_gap
evidence:
  - specs/reconstruct/LOCAL_FIRST_SYNC_AND_PROMOTION_CONTRACT.md:134-183
  - app/src/screens/LogEntry.tsx:595-609
  - app/src/screens/Guide.tsx:120-124
  - specs/reconstruct/FEDERATED_ACCOUNT_SSO_CONTRACT.md:213-223
```

The contract keeps raw memo/note server persistence forbidden until an owner decision. The app copy says free text stays on-device and server storage does not happen. That is coherent today, but it will become confusing when "online backup" is introduced unless the UI explains which parts sync and which parts remain local-only.

Suggested direction:

- Before F2/F3 account sync, create a consent copy/spec patch: "구조화 기록은 백업, 손글씨 메모는 이 기기 전용" unless E2E memo backup is accepted.
- Add redaction-state display for cross-device entries, as the contract already suggests.

### IMP-008 — Journal-only mode is specified but not exposed as an app state

```yaml
severity: S3
type: product_positioning_gap
evidence:
  - specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:200-216
  - app/src/AppShell.tsx:14-24
  - app/src/AppShell.tsx:115-121
  - app/src/screens/Home.tsx:157-173
```

The new decoration contract defines a `journal_only` path for users who want diary/reflection without plan generation. The current app shell has Home/Log/Trends/Guide, but no explicit mode state, settings path, or copy that says "일지만 쓰기" is a supported first-class use case.

Suggested direction:

- Add a light settings/profile state later: `mode: journal_only | training`.
- In journal-only mode, hide/soften plan-generation language and keep safety evaluation only as review context.
- Make switching to training mode run the normal D9/RVE/Safety Gate precondition before plan generation.

### IMP-009 — Safe streak contract lacks an implementation surface

```yaml
severity: S4
type: engagement_opportunity
evidence:
  - specs/reconstruct/JOURNAL_DELIGHT_AND_DECORATION_SPEC.md:175-196
  - app/src/screens/Home.tsx:193-204
  - app/src/screens/Guide.tsx:120-124
```

The app already nudges the user with "N일만 더 쓰면 한 주가 채워져요", and the spec defines a safe streak model where rest and injury days count. There is no current streak object or rest-day journal kind, so implementing the nudge further without the safe model could accidentally create pressure.

Suggested direction:

- Implement "기록한 날" rather than "훈련한 날".
- Add rest/injury-friendly entry copy before any streak reward.
- Keep unlock thresholds owner-approved, per `OI-JDD-UNLOCK-NUMBERS-001`.

### IMP-010 — App CI/build coverage is still outside the current workflow

```yaml
severity: S3
type: quality_gate_gap
evidence:
  - app/package.json:6-10
  - .github/workflows/ci.yml:26-44
```

The app has `npm run build` and `npm run typecheck`, but the current workflow runs D9 evaluator and `impl/` tests only. This is already tracked by open issue `#21`, but it should remain a near-term blocker for app-facing changes.

Suggested direction:

- Add an app CI job: `npm ci && npm run build`.
- Later add browser smoke for `?app=1` journal save and `?uitest=seed` render evidence.

---

## 3. Suggested Next Work Packages

### Package A — ORDER_006 Task D closeout

Scope:

- Index/status docs only.
- No spec semantics changes.

Acceptance:

- New ORDER_006 docs are discoverable from `specs/reconstruct/README.md`, `TRAINORACLE_SPEC_INDEX.md`, `SPEC_DOCUMENTATION_REPORT.md`, and optionally root README.
- Issue #42 can then be reviewed for whether it remains open only for ORDER_007-R.

### Package B — F0-e local journal reliability and data control

Scope:

- Handle `saveEntry().ok`.
- Remove race-form fake defaults.
- Add export/delete/local storage management controls.

Acceptance:

- Storage failure does not show success.
- No real app form can save demo defaults without user input.
- User can see and control local-only data before account sync exists.

### Package C — Safety signal persistence for diary flow

Scope:

- Wire `assessMemoTransient` into free-text save paths.
- Persist only non-sensitive reason-code/disposition metadata if needed.
- Show durable high-pain review cues in Home/Detail.

Acceptance:

- Free text can raise risk locally without raw clause storage.
- High pain remains visible after save.
- Journal saving remains allowed; plan-generation blocking remains owned by RVE/Safety Gate.

### Package D — Journal-only and safe engagement design

Scope:

- Define user-visible `journal_only` mode.
- Define safe streak/recorded-day UI copy and data shape.
- Avoid any reward tied to distance, pace, pain-free streak, weight, or safety clearance.

Acceptance:

- A user can understand "I can use this only as a diary".
- Rest/injury records count as valid journal days before any streak-like reward is introduced.

---

## 4. Non-Claims

- This report did not run browser visual QA or Lighthouse.
- This report did not run app build or tests.
- This report did not close issue #42 or #21.
- This report did not modify `app/` or any SPEC source file.
- No finding here is canonical approval; it is input for the next planning/review pass.
