# Formation Research V2 Final Security Review

```yaml
review_date: 2026-07-17
review_scope: SECURITY_PRIVACY_SAFEGUARDING_AUTHORITY
overall_verdict: FAIL
documentation_only_containment: PASS
pilot_or_runtime_approval: BLOCKED
blocker_findings: 1
high_findings: 2
medium_findings: 0
human_reviews_recorded: 0/6
manual_scenarios_run: 0/5
production_code_changed_by_package: false
runtime_authority: false
```

## Verdict

The package is safe to retain as a documentation-only research package, but it is not an
acceptable security, privacy, or safeguarding baseline for participant enrollment, a pilot,
recipient delivery, or runtime activation. One disclosure/notification blocker and two high
severity contract gaps remain. Runtime must stay disabled.

## Findings

### [BLOCKER] SEC-01: Declining a concern question can become an observable health handoff

`FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md:41-48` groups
`PREFER_NOT_TO_ANSWER`, `NOT_ASKED`, and concern states into candidate suppression and a handoff.
The detailed RQ-G record is more explicit: `search-rq-g.md:547-564` makes
`PREFER_NOT_TO_ANSWER` fail closed and, for some domains, assigns a clinician route. At the same
time, `user-spec-alignment-audit.md:303-324` says automatic recipient notification is forbidden
and that no network notification may occur before explicit confirmation. That protection has not
been promoted into the protocol, youth synthesis, or claim matrix.

This can make non-disclosure itself visible to a coach, guardian, clinician, or safeguarding
lead. An athlete may feel forced to answer `NO_CONCERN_REPORTED` to avoid disclosure or to obtain
a plan. The current wording also leaves room for a hidden notification because "handoff" does
not specify whether it is only a local state or an outbound delivery.

Required closure:

1. Bind `PREFER_NOT_TO_ANSWER` and `NOT_ASKED` to `SUPPRESS_ONLY_NO_OUTBOUND_DISCLOSURE`.
   They must not imply concern and must not create recipient-visible, network, audit, or telemetry
   events.
2. Before any non-emergency handoff, show the exact recipient, fields, purpose, retention,
   acknowledgement behavior, and withdrawal limits, then require a separate explicit action.
3. Define any mandatory-reporting or immediate-danger exception separately, with approved
   jurisdiction/age copy and a clear notice of what will happen before collection where law permits.
4. Add executable cases proving zero outbound requests for decline, unknown, cancel, offline,
   reviewer-unassigned, and recipient-change states.

### [HIGH] PRIV-02: Private-note zero-signal and user-directed transport conflict in the final trace

The strongest definition is correct: `adversarial-methods-claims.md:407-421` excludes raw text
and metadata-derived proxies including presence, length, token count, entry time, frequency,
sentiment, embeddings, streaks, missingness, and cross-record linkage, while making explicit
export/share a separate user-controlled transport action. The owner baseline also separates local
full backup, recipient share, and analysis consent (`FORMATION_LATEST_OWNER_DECISION_BASELINE.md:21-26`).

The required claim trace is not consistent with those rules. `FORMATION_CLAIM_MATRIX.csv`, row
`FRV2-CLAIM-G-003`, says the note is completely zero-signal in "sharing", without the explicit
user-directed transport exception. The youth synthesis permits explicit inclusion
(`FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md:50-59`), while the authoritative baseline names
only presence for some consumers and does not enumerate all metadata side channels. An
implementation could therefore either remove the owner's backup/share choice or log note-derived
metadata through an omitted audit, cache, idempotency, linkage, or research path.

Required closure:

1. Split the claim matrix into two rows: absolute content/metadata non-use, and the narrowly
   scoped `USER_DIRECTED_FILE_OPERATION` transport exception.
2. Put one normative zero-signal list in the owner baseline and reference it from the protocol,
   youth review, claim matrix, decision packets, and future target contracts.
3. State that preview, backup, and recipient-share controls do not reclassify the note, grant
   analysis consent, create coach access, or emit analytics/reward/Formation events.
4. Preserve the already-proposed default exclusion, two explicit actions for local backup,
   recipient/scope/expiry confirmation for sharing, and the warning that exported files cannot
   be recalled from a recipient's device.

### [HIGH] SAFE-03: Fail-closed states still have a known dead-end that can pressure disclosure

The summary correctly flags the issue (`FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md:61`), and the
detailed audit documents reviewer-unassigned, coach-unlinked, offline, stale-source, guardian
dispute, and urgent-support dead ends (`user-spec-alignment-audit.md:303-324`). The youth review
offers generic pause, ask-a-person, and exit controls (`FORMATION_YOUTH_TRANSFER_AND_PILOT_REVIEW.md:61-67`),
but it does not bind an actionable fallback when no approved reviewer or delivery route exists.
The reviewer ledger confirms every role is currently `UNASSIGNED` and `NOT_REVIEWED`.

A blocked athlete could be left with no usable next step, or could submit more sensitive detail
in an attempt to unlock a plan. This is a safeguarding and coercion risk even though the current
runtime is off.

Required closure:

1. Require `what_happened`, `what_remains_unchanged`, `what_the_athlete_can_do_now`, and
   `who_can_resolve` for every block/pause state.
2. Provide no-send paths for record correction, local export, direct user-controlled sharing,
   later review, and locally approved support information.
3. Preserve the current coach-authored plan and base journal; do not penalize refusal, withdrawal,
   missing answers, or concern reports through rewards, streaks, ranking, or plan quality.
4. Do not describe a safeguarding lead or clinician as available until a named route is configured
   and approved. `NOT_CONFIGURED` must never simulate acknowledgement or delivery.

## Control Trace

| Control | Result | Evidence |
|---|---|---|
| Private-note content and metadata are zero-signal | `FAIL` | Strong detailed definition exists, but the claim matrix and baseline are not fully normalized; see PRIV-02. |
| Local full backup is separate from recipient share and analysis consent | `PASS` | Latest owner baseline 21-26; user/spec audit 220-259; adversarial methods 414-421. |
| Youth, guardian, coach, clinician, and safeguarding authority are separated | `PASS` | Protocol 177-192; `search-rq-g.md:553-569`; youth review 41-48. A route still cannot be activated before SEC-01 closes. |
| Structured concern handling is non-diagnostic | `PASS` | Four visible states; no-concern is not clearance; concern suppresses a candidate. |
| No readiness, recovery, diagnosis, RED-S, injury-risk, or clearance automation | `PASS` | Protocol 106-107, 139-141, 157-159, 185-192, 315-331; claim rows B-002, D-004, G-002. |
| No hidden notifications | `FAIL` | Private-note notification is prohibited, but decline/concern handoff delivery semantics are ambiguous; see SEC-01. |
| No fabricated human approvals | `PASS` | Reviewer ledger has 0/6 assigned approvals; both decision packets remain `NOT_REVIEWED`; technical annex records human confirmation 0/167. |
| No runtime activation or production implementation | `PASS` | Protocol metadata is false; activation is outside scope; package paths are research reports, evidence, and validators only. |
| Latest explicit owner decision governs old conflicting documents | `PASS_WITH_OPEN_PATCHES` | Latest-owner baseline is authoritative; conflict register lists nine exact patches. Old clauses remain historical or patch-required and cannot authorize runtime. |
| Coercion and dead-end resistance | `FAIL` | Decline may be observable and known no-reviewer/offline paths remain incomplete; see SEC-01 and SAFE-03. |

## Authority And Activation Boundary

The protocol correctly separates fixed product direction from scientific evidence and runtime
authority. The claim ledger does not claim whole-architecture safety. The reviewer ledger does
not invent identities, qualifications, hashes, decisions, or responses. The decision packets are
templates with `NOT_REVIEWED` decisions, not approvals. The conflict register and latest-owner
baseline correctly make older contrary product-direction language subordinate while retaining it
as historical runtime evidence.

These strengths do not authorize enrollment or execution. Required human-trained screening and
adjudication, youth sports-science, N-of-1 statistics, youth medicine/safeguarding, privacy,
athlete/coach/accessibility, local legal/ethics, exact owner packet decisions, canonical spec
patches, and a separate activation record all remain outstanding.

## Executed Verification

The package validators were executed from the exact worktree and reported:

```text
FORMATION_SYNTHESIS_PREPARED reports=5 claims=21 rqs=7 runtime=false
FORMATION_PACKETS_PREPARED load_fields=16 minimum_fields=17 collisions=0 decisions=NOT_REVIEWED runtime=false
FORMATION_OWNER_BASELINE_VALID conflicts=9 latest_decision=governs runtime=false
FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_improvements=15 runtime=false
```

An activation/approval scan found no active `runtime_authority=true`, production activation,
completed human review, or approved decision. The only `APPROVE` strings are unselected decision
template options. Worktree scope inspection found no `app/`, `impl/`, migration, backend, or
production-configuration changes in this research package.

## Exit Criteria

Change the verdict only after SEC-01, PRIV-02, and SAFE-03 are corrected in the final trace,
their negative tests are added and run, the five manual scenarios are executed, and the required
named reviewers record hash-bound decisions. Even then, this review can approve only the research
and contract package; runtime activation requires its own later authority record.

[FINAL_SECURITY_REVIEW_FAIL_RUNTIME_BLOCKED]
