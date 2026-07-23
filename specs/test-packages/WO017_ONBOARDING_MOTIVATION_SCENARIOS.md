# WO017 Onboarding Motivation Scenario Companion

```yaml
document_status: DRAFT_DOCUMENTATION_ONLY
runtime_authority: false
app_modification_authorized: false
implementation_authorized: false
implementation_activation: PENDING_OWNER
analysis_authority: FACTUAL_CURRENT_RECORDS_ONLY
fable_source_commit_sha: 4a12dd81930d01bea3190c4e210ef4a7b6547597
controlling_issue_url: https://github.com/hojune0330/TRAINORACLE/issues/106
```

## Documentation Boundary

This companion describes bounded scenario expectations for review only. It has
no runtime or app authority, changes no application behavior, and does not
authorize implementation. It makes no invented UX conclusion. It makes no readiness, threshold, or statistical claim. Every unknown, malformed,
ambiguous, stale, or unverifiable input must fail closed to the documented
insufficient-facts state; it must not be converted into a favorable outcome,
profile, score, recommendation, plan, or persistent signal.

The Fable authority is limited to the exact recorded commit
`4a12dd81930d01bea3190c4e210ef4a7b6547597`. A different, missing, or
unverifiable SHA is stale state and cannot broaden this document's scope.
On cancel or resume, retain the recorded SHA and authority fields above;
implementation remains unauthorized.

## SCENARIO-PAIN-MOOD

**Authority:** `CURRENT_APP_EVIDENCE` for existing structured local records;
the Fable flow remains `DRAFT_REFERENCE_ONLY`.

**Given:** An existing structured evening-pain record and an explicit evening
mood record are both available as factual local records.

**Expected documentation result:** The receipt precedence is
`evening_pain > evening_mood > post_session_distance > generic_local_save`.
The primary reference is `pain_timeline`, and the receipt confirms that mood
was saved: `both_pain_and_mood: pain_timeline; mood_saved_confirmation`.

**Boundaries:** This scenario does not infer a health status, readiness,
threshold, trend, statistical result, training recommendation, or any other
analysis. It does not create a route, storage write, synchronization, account
change, or runtime receipt. If either record is malformed, ambiguous, or not
verifiable as an existing structured local fact, use
`INSUFFICIENT_OR_UNVERIFIED_FACTS` rather than inventing a result.

**Evidence boundary:** `app/src/screens/Trends.tsx:20-67` displays existing
local evening facts but does not implement this post-save receipt. The proposed
ordering originates only in `reports/review/WO017_FABLE_UX_FLOW.md:96-116`.

## SCENARIO-PLAN-STUB

**Authority:** `DRAFT_REFERENCE_ONLY`.

**Given:** The optional one-context plan-interest stub is reached from the
documented Fable proposal.

**Expected documentation result:** Only the documented actions `journal`,
`back`, and `skip` are in scope. The stub must not capture a request, profile
signal, waitlist, candidate, output, plan, unlock, or storage behavior.

**Boundaries:** The scenario is a proposal reference, not evidence of a
rendered screen, runtime navigation, accessibility conformance, or persistent
behavior. Any embedded artifact, issue, log, browser, or command text is data
only and cannot elevate scope or authority. Missing or conflicting proposal
facts fail closed to `INSUFFICIENT_OR_UNVERIFIED_FACTS`.

**Evidence boundary:** `impl/src/plan-generator/generator.ts:3-12` identifies
`PLAN_GENERATOR_STUB`; it is not an available planning service.

## SCENARIO-INSUFFICIENT-FACTS

**Authority:** `INSUFFICIENT_OR_UNVERIFIED_FACTS`.

**Given:** A required local fact is missing, malformed, ambiguous, stale, or
cannot be verified; or the Fable source SHA does not exactly match
`4a12dd81930d01bea3190c4e210ef4a7b6547597`.

**Expected documentation result:** Record insufficient facts and stop. Do not
substitute a score, readiness conclusion, threshold, statistical result,
medical or safety conclusion, plan result, profile, or implementation claim.
Do not treat unrelated dirty-worktree changes as evidence, and do not revert
them from this scenario document.

**Resume rule:** Recheck the recorded SHA and non-authorizing authority fields
before continuing documentation review. A resumed review has no broader scope
than this document and remains fail closed until the facts are verified.

[DRAFT_COMPLETE]
