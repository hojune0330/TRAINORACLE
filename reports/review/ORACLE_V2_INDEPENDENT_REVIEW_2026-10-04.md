# Oracle V2 Independent Review

**Review date:** 2026-10-04 (Asia/Seoul)  
**Scope:** Read-only review of the approved Oracle V2 contract, score/flow/snapshot/content-reader/content-adapter domains, supplemental context editor, account service/schema, controller integration, and current screens.  
**Disposition:** No P1 found. The three original interleaving/resume/status P2 concerns are addressed in the 2026-10-04 23:03 KST source recheck. The newly added optional-condition forms and in-progress adapter changes remain outside this recheck, so this is not a whole-scope sign-off. No tests or runtime validation are claimed; see the resolution addendum.

## Snapshot And Evidence Boundary

The checkout was already a moving working tree with concurrent agent edits. The reviewed repository-relative line positions below correspond to the source captured around 2026-10-04 22:50 KST; line numbers may move as implementation continues. Base `HEAD` observed: `9839a6fbc7c616b573fadc38bd7e2eea62b8e148`.

SHA-256 fingerprints for the interleaving-critical files at capture:

- `app/src/screens/OracleProfileV2.tsx`: `986B3BCC784E1864BBDC0D4442A327AA37E4EEF6D1F16F6D875D3254C8C425E1`
- `app/src/screens/OracleContextEditor.tsx`: `B754A1CE56011C31DEBF83981DA58F4BC6C4D307C25BE17DBCFB3B71865DB65F`
- `app/src/screens/OracleProfileExperience.tsx`: `40777E0918CC648FA206A9ADDBA60A1D25087C8456CD2AE0F3614A462AD5F2B1`
- `app/src/domain/account/account-oracle-v2-service.ts`: `E8C3962FF4923472EC152AC586E68676920F5539BD81D54EA72E51589F78F18B`
- `app/src/domain/account/account-oracle-v2-schema.ts`: `2AA51B8670667B097B595FE44C6AEF10557C757B0547D366925BB5608433A7E0`

Automated tests were **not run**. Existing focused contract tests were inspected statically; concurrent edits made execution a poor signal for this independent snapshot review. The 30 entries below are synthetic desk scenarios inferred from source, not executed tests, generated user data, human validation, or user research. No deployment or production verification was performed. The implementation contract itself records production verification as not performed (`specs/reconstruct/ORACLE_V2_IMPLEMENTATION_CONTRACT.md:5-9`).

The requested urgent parent-thread message was attempted, but the available messaging tool rejected the native-ancestor target. The findings are preserved here; they were not delivered through that tool.

## Initial Findings (22:50 Snapshot)

The findings in this section preserve the intermediate snapshot and are superseded by the later source recheck in the addendum. They are not current open findings.
Two intermediate findings are expanded below; the third original resume-position finding is recorded with its resolution in addendum item 2.

### Historical [P2] Context save overwrites an unchanged-answer unfinished score revision

**Evidence:** `OracleProfileV2.tsx:48` initializes the in-memory `scoreUnsafe` ref to false. `hasScoreDraft` at lines 98-100 compares only answer maps, then `onContext` at line 129 relies on that result plus the volatile ref. The account service exposes `draftState: EDITING` separately from `SUBMITTING` (`account-oracle-v2-service.ts:86-95`). The new context `onDraft` and `onSave` handlers at `OracleProfileV2.tsx:159-167` reject a draft only when its answer map differs, but otherwise clone `confirmedDocument` rather than `draftDocument`. This prevents the changed-answer cross-submit path, but replaces an unchanged-answer local editing revision with the confirmed revision plus context.

**Reachable sequence:** Start from a confirmed profile and edit a completed axis. Answer its first question with the same value already stored. `OracleProfileExperience.tsx:106-110` calls `onDraft` after every answer; `prepare` creates a new current revision even when answer values are unchanged (`account-oracle-v2-service.ts:194-203`). The local copy is an `EDITING` draft, not a queued submission. After reload, the volatile ref is false, answer-map equality makes `hasScoreDraft` false, and the resume action is hidden by the same equality test (`OracleProfileExperience.tsx:132`). Context can now open. Its autosave clones the confirmed document and `saveDraft`s that instead of preserving the editing revision (`OracleProfileV2.tsx:160-161`); the account save at lines 163-166 then submits confirmed answers plus context. The score revision is not cross-submitted, but the unfinished editing state is silently discarded. A changed-answer score draft is blocked by the current guard, which is an improvement over the prior handler.

This is a draft-preservation and interrupted-flow defect, not evidence that changed score values are submitted by this latest handler.

**Minimal fix guidance:** Define pending score work from `draftState === "EDITING"` and the full current revision (including revision identity), not answer-map equality or a component ref. Re-check it in both context handlers against one captured snapshot. When it exists, never replace it with `confirmedDocument`: merge context into the existing `draftDocument` and use `saveDraft` only, never account `save`/flush. Give the editor a distinct `LOCAL_DRAFT` result so it truthfully says the context is device-local and not yet on the account; keep the unsaved-navigation guard active. Provide a path to finish the score while retaining the local context draft; `responsesDisabled={contextEditing}` at line 128 currently blocks that path if the local context differs from confirmed. The explicit final score commit may submit the combined document only after the three-question axis flow is complete.

**Regression coverage:** Confirmed profile; edit axis; answer question 1 with its existing value; reload; edit context. Assert the score `EDITING` revision is not replaced, neither draft is submitted as part of context-only save, and both remain recoverable. Then finish the axis and assert the final score commit submits the combined document once. Also cover a changed-answer draft (context remains blocked/preserved) and a context-only edit (normal account save).

### Historical [P2] Device-only editing drafts are presented as being sent to the account

**Evidence:** `account-oracle-v2-service.ts:86-95` marks an unqueued local edit as `draftState: EDITING` but also sets overall `status: PENDING`. Hydration explicitly says it only replays already queued submissions and never auto-submits in-progress answers (`account-oracle-v2-service.ts:123-131`). The experience maps all `PENDING` states to “계정으로 보내는 중” and renders a retry action (`OracleProfileExperience.tsx:125, 139`). The parent wires retry to `hydrate` (`OracleProfileV2.tsx:119`), which does not submit an `EDITING` draft. Thus an offline or reloaded local draft can appear to be uploading indefinitely; “다시 확인” does not perform the implied send.

**Minimal fix guidance:** Surface `draftState` to the experience or expose separate `LOCAL_DRAFT` and `SUBMITTING` statuses. Label `EDITING` as device-local and explain that account save follows completion/confirmation; show retry only for a queued submission or actual transport failure. Keep `PENDING`/“sending” reserved for a persisted submission intent. Preserve the current encrypted local draft and avoid turning hydration/retry into implicit submission.

**Regression coverage:** The existing service contract already asserts that a reloaded editing draft stays local, retry returns false, and no write occurs (`account-oracle-v2-service.contract.test.ts:116-131`). Add a screen assertion for the local-only wording and absence of a misleading retry action, while retaining a separate queued-submission retry test.

## Resolution Addendum (2026-10-04 23:03 KST)

The following dispositions are based on a fresh read of the current source after the parent reported fixes. They are not backed by executed tests. Current recheck fingerprints:

- `app/src/screens/OracleProfileV2.tsx`: `F1404F46C6D157181AF3DAA104113FCB27E92C495BF0C8D2E3E7C0C57BF4D218`
- `app/src/screens/OracleProfileExperience.tsx`: `2851D1E818BFE1882E59F9F7FE09B20E51BA6F0E3EBB0AA0A598F5562855E830`
- `app/src/domain/oracle-profile-flow.ts`: `F1E8E5FC31151E3B053AB1913BC9BD5BE5EE4F2CF6DA91C92B1FB891CBF8DF83`
- `app/src/domain/account/account-oracle-v2-service.ts`: `E8C3962FF4923472EC152AC586E68676920F5539BD81D54EA72E51589F78F18B`
- `app/src/screens/OracleContextEditor.tsx`: `E3035F3616D3ABC45C424F0EC10E3AFBF99022214F7B929F2842C55D0E3D322B`

1. **Context/score interleaving: resolved in current source by static inspection.** `hasScoreDraft` now compares the full current revision against confirmed current (`OracleProfileV2.tsx:96-100`), and both context autosave and submit handlers fail closed on that full comparison before constructing a document from confirmed state (`:160-168`). Editing an axis first removes its three old answer keys from the draft while preserving the confirmed `completed` answers (`oracle-profile-flow.ts:48-52`), so re-answering question 1 with the same value still leaves questions 2 and 3 missing and the draft distinguishable from confirmed. The normal path is blocked from opening context while that score draft exists (`OracleProfileV2.tsx:129-131`). The original risk that context `save` submits `snapshot.draftDocument` is no longer present in this source. No interleaving test was run.

2. **Partial-axis resume: resolved in current source by static inspection.** The three previous values are removed from the editable draft only; `completed` remains intact (`oracle-profile-flow.ts:48-52`). After the first answer, `startOracleQuestionFlow` finds the next missing question (`oracle-profile-flow.ts:18-22`); `restoredFlow` and the resume action use the draft/confirmed difference and that position (`OracleProfileExperience.tsx:62-65, 144-149`). A fully populated legacy draft restarts at question 1; dirty/pending guards reopen the active flow instead of switching axes (`OracleProfileExperience.tsx:112-127, 144-149`). This preserves inline flow state in the inspected path. No reload or keyboard test was run.

3. **Device-only status/retry: resolved at the UI boundary.** The service still represents local editing as overall `PENDING` while separately reporting `draftState: EDITING` (`account-oracle-v2-service.ts:86-95`), but the experience now shows device-local wording for that combination and hides the retry action while `EDITING` (`OracleProfileExperience.tsx:137, 152`). Retry remains available for non-editing pending submissions. This is a display/interaction correction; the service status enum itself remains shared.

The latest source check also found `dirty.current` set before async draft persistence, checked together with `hasPendingScore` before an axis switch, and retained in the in-memory flow until a successful commit (`OracleProfileExperience.tsx:102-127`). Owner-keyed remount/conflict reset and deletion reset are present in the current screen (`OracleProfileV2.tsx:30, 50, 101-104, 142-143`). No inline axis-switch loss was identified by static tracing; persistence-failure and reload behavior still need the focused regression coverage described above.

The newly added optional condition forms and the in-progress content-adapter changes were not re-reviewed to completion in this bounded addendum. No claim is made about their final behavior. Automated tests remain unrun; no human validation, release, or production verification is claimed.

## 30 Synthetic Scenario Analysis

These are anticipated outcomes from source inspection, not execution receipts. Scores are self-report organization only: the contract says three numeric answers are required, partial/missing/error values are not zero, and the index is not ability or diagnosis (`ORACLE_V2_IMPLEMENTATION_CONTRACT.md:25-52`). The synthetic age/experience labels are not score inputs.

| # | Synthetic persona / setup | Static trace or risk noted |
|---:|---|---|
| 1 | Youth beginner; no answers | No axis has a score; no zero should be inferred. |
| 2 | Amateur; one numeric answer | Axis remains incomplete; current flow should preserve the answer locally until all three. |
| 3 | Youth; two numeric answers and one missing | No score yet; missing is distinct from a low response. |
| 4 | Elite runner; three numeric answers, all high | Self-report index/candidate rules apply; elite status is not consulted. |
| 5 | Amateur; three numeric answers, all low | A low self-report is not a fitness or ability judgment. |
| 6 | Youth; mixed low/high answers | `mixed` evidence should be exposed; candidate eligibility excludes mixed axes. |
| 7 | Experienced runner; `UNKNOWN` plus numeric answers | Non-numeric response prevents a complete numeric score. |
| 8 | New runner; `INEXPERIENCED` and `SKIPPED` values | These are preserved as distinct responses, not imputed as zero. |
| 9 | Elite; `VARIES` on one item | No numeric score for that axis; no false precision. |
| 10 | Amateur; multiple qualifying core axes | Candidate list is not a rank; representative choice remains explicit. |
| 11 | Youth; same answers as adult | Age is not an input to score or character selection. |
| 12 | Elite; same answers as novice | Experience/competition level is not an input to score. |
| 13 | Any age; core score just below the candidate threshold | Candidate eligibility follows the stated product threshold, not an inferred population norm. |
| 14 | Any age; score reaches threshold but is mixed | Mixed axis must not become a candidate. |
| 15 | Any age; no qualifying candidate | Neutral representative is expected; no trait should be inferred. |
| 16 | Any age; one candidate plus previously selected valid candidate | Valid prior selection should be preserved; stale/ineligible selection should not be silently replaced. |
| 17 | Keyboard-only user; interrupt a completed-axis edit after a changed first answer, then reload | Current flow removes prior axis values from the draft and resumes at the first missing question (q2); source-only expectation, not keyboard-executed. |
| 18 | Keyboard-only user; same-value first answer in an axis edit, then reload | Cleared q2/q3 fields make the current revision differ; context guard should block context writes. Not keyboard-executed. |
| 19 | Screen-reader user; local partial answer followed by reconnect | Current UI announces device-local storage and hides retry for `EDITING`; accessibility behavior not manually validated. |
| 20 | Reduced-motion user; opens question and context dialogs | Focus/dialog logic was read statically; no rendered reduced-motion or assistive-tech validation performed. |
| 21 | 320 px viewport with long labels and keyboard visible | Contract requires this viewport; no browser screenshot or layout execution was performed. |
| 22 | 375 px viewport with 200% zoom and keyboard navigation | Contract requires responsive/zoom validation; no browser test performed. |
| 23 | New account; context-only answers before any score | Service contract has a context-only save path and score commit preservation test; not executed in this review. |
| 24 | Existing account; same-value partial edit plus context save after reload | Full-current-revision guard should retain the local score draft and block context writes until the axis is finished. Not executed. |
| 25 | Existing account; context edit draft and completed score commit | `commitAnswers` prepares from the draft document, so combined submission is possible; product must ensure only explicit completion submits it. |
| 26 | Old server without Oracle V2 capability | Capability negotiation fails closed before write; no old-server runtime test was run. |
| 27 | Auth owner switches while local work is queued | Service checks current owner/token around serialized operations; no live auth-switch test was run. |
| 28 | User deletes profile, then chooses restart | Screen exposes explicit restart path in this snapshot; controller/server behavior was only source-reviewed, not executed. |
| 29 | Concurrent remote update conflicts with local score/context draft | Service exposes conflict state and local/remote resolution; static tests include context retention on rebase, but no tests were run here. |
| 30 | Friend revokes comparison/share while view/export is open | Session revocation clears peer and share state; read/export recompute against current permission. No browser revocation flow was executed. |

## Scope Notes

- The current contract and score implementation preserve the stated missing/partial/mixed distinctions; no P1/P2 scoring formula defect was established in static review.
- The adapter projects a narrow set of structured fields and explicitly excludes names/memos from its safe-entry projection (`oracle-content-adapter.ts:47-64`). The reader distinguishes `MISSING`, `UNAVAILABLE`, and `REVOKED` states in its source contract (`oracle-content-reader.ts:12-17`). No concrete P1/P2 privacy leak was established in those reviewed paths.
- Friend comparison is documented as memory-only, with no server fetch/storage/clipboard path, and revocation clears peer/share state; read/export re-check current permission (`oracle-friend-comparison-v2.ts:90-103, 138-157`). This is static code evidence, not a privacy or human-validated release claim.
- Existing tests are evidence of authored assertions only; none were executed during this review. No test, deployment, production, release-gate, or human-validation success is claimed.
