# Work Order 011 Qualified Privacy Review Handoff

```yaml
packet_id: TO-WO011-QUALIFIED-HANDOFF-2026-07-16
source_commit: a6857bcdcd9f2989799c505f52773256ce492e14
legal_advice_status: NOT_LEGAL_ADVICE
decision: NOT_ACCEPTED
reviewer: UNASSIGNED
reviewer_qualification: UNVERIFIED
runtime_authority: false
formation_activation: false
```

## What This Packet Does

This packet gives a named privacy/youth reviewer a decision-complete route through Work
Order 011. It separates facts that the product owner must supply from legal conclusions
that only the qualified reviewer may make. It does not assert compliance, appoint a
reviewer, accept policy, or authorize server persistence, in-app sharing, guardian access,
Formation, or any runtime change.

The reviewer must read this handoff together with:

1. `reports/review/WO011_PRODUCT_FACT_QUESTIONNAIRE.md`
2. `reports/review/PRIVACY_YOUTH_QUALIFIED_REVIEW_PACKET.md`
3. `specs/reconstruct/NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md`
4. `specs/reconstruct/FORMATION_RECORD_GOVERNANCE_CONTRACT.md`
5. `specs/test-packages/FORMATION_PRIVACY_GOVERNANCE_FIXTURES.md`
6. `FORMATION_PRIVACY_GOVERNANCE_DECISION.md`

## Non-Negotiable Product Boundary

- `PRIVATE_SELF_ONLY` remains **zero-signal** outside the private local view and the
  athlete's explicit local `OWNER_FULL_BACKUP`. Content, presence, length, frequency,
  timestamps attributable to note use, hashes, embeddings, derived signals, telemetry,
  audit reasons, and purpose-selector events cannot escape that boundary.
- `ANALYZABLE_TRAINING_NOTE` raw text is allowed only in the approved explicit-purpose
  transient local athlete analysis. Raw text is not persisted to analytics, server,
  model context, coach/guardian view, Formation, audit, sync, rewards, or marketing.
- Default export excludes memos. The athlete may explicitly confirm a local
  `OWNER_FULL_BACKUP` containing their own memos. Creating that file makes no network
  request and grants no other processing right.
- An athlete may independently show or send the created file. This does not create an
  application recipient flow; **in-app recipient sharing remains blocked** until a
  separate accepted contract exists.
- A note-origin safety result is non-diagnostic, may only hold or request review, and can
  never clear training, release a plan, or replace qualified medical or human judgment.

Any proposed legal interpretation that requires weakening these owner guardrails must be
returned as `REVISED` with a separately identified product decision. It is not silently
incorporated into this review.

## Product-Fact Intake Gate

The product owner completes every row in the questionnaire using only:

- `CONFIRMED`: supported by a named, versioned source or accountable owner attestation.
- `UNKNOWN`: not decided or not evidenced; the row states who must answer next.
- `NOT_APPLICABLE`: supported by a reason and scope boundary.
- `CONFLICTING_EVIDENCE`: sources disagree; both sources and a resolution owner are named.

Blank cells, assumed defaults, `TBD`, and an unexplained `NOT_APPLICABLE` are invalid.
Every P1 question in the existing qualified-review packet remains unresolved while a
required product fact is `UNKNOWN` or `CONFLICTING_EVIDENCE`.

## Reviewer Work Sequence

1. Verify identity, qualifications, covered jurisdictions, independence, and conflicts.
2. Freeze the reviewed source commit and document versions.
3. Reject the intake as incomplete if a legal conclusion depends on an unresolved fact.
4. Classify every field and inference by jurisdiction and processing context.
5. Decide controller, processor, joint-controller, recipient, and third-party roles per
   purpose and vendor rather than globally.
6. Decide lawful basis, youth/guardian rule, notice, rights, retention, deletion, transfer,
   breach, and profiling requirements per launch jurisdiction.
7. Test each conclusion against the zero-signal, local-backup, access, and safety fixtures.
8. Record every required product/spec/test change with severity and responsible owner.
9. Return a scoped overall decision. Only a fully evidenced `ACCEPTED` result may be used
   by the total responsibility holder in a separate acceptance decision.

## Required Decision Matrix

| Review area | Required output | Fail-closed condition |
|---|---|---|
| launch scope and ages | country, residence rule, age bands, release date | unknown country or age policy |
| role allocation | entity-by-purpose controller/processor determination | entity or processing chain unknown |
| field/inference classification | category and sensitive/health/biometric/inferred decision | field or derived output omitted |
| purpose and lawful basis | separate basis and necessity assessment per purpose | bundled or generic basis |
| youth and guardian | age assurance, authority, assent/refusal, transition, dispute | blanket guardian access |
| recipient and vendor | exact fields, purpose, region, subprocessor, retention | unregistered recipient/vendor |
| retention and deletion | event/duration, cascade, backup, restore suppression, key erasure | indefinite or inherited period |
| rights and sharing | access, correction, deletion, stop, export, portability, contest | export treated as analytics consent |
| incident and transfer | triggers, clocks, contacts, transfer mechanism, re-review | one jurisdictional rule used globally |
| profiling and safety | profiling/ADM decision, human intervention, appeal, prohibited scope | note used to clear or diagnose |

## Reviewer Deliverables

The signed review bundle must contain:

- completed product-fact questionnaire with evidence links and owner attestation;
- one response for every Q01-Q22 in the existing qualified-review packet;
- a field/inference classification annex and purpose/lawful-basis matrix;
- recipient/vendor/region/subprocessor inventory;
- retention/deletion/backup/key-erasure schedule;
- youth, guardian, age-transition, rights, breach, and transfer determinations;
- product/spec/test changes, each tied to a file/version and acceptance test;
- launch-date source snapshot and an explicit re-review trigger list;
- the qualified reviewer record below.

## Qualified Reviewer Decision Record

```yaml
reviewer:
  legal_name: REQUIRED
  organization_or_independent_status: REQUIRED
  qualification_and_jurisdictions: REQUIRED
  conflicts_of_interest: REQUIRED
  professional_contact_or_verification_ref: REQUIRED
review_scope:
  source_commit: REQUIRED
  reviewed_document_versions: REQUIRED
  launch_countries_and_ages: REQUIRED
  exclusions: REQUIRED
decision:
  decision_date: REQUIRED
  responses_q01_q22: REQUIRED
  unresolved_p1_count: REQUIRED
  required_changes: REQUIRED
  residual_risks: REQUIRED
  signature_or_verifiable_approval_ref: REQUIRED
  overall_decision: ACCEPTED | REVISED | REJECTED
```

`ACCEPTED` is invalid when `unresolved_p1_count` is not zero, the reviewer is unnamed or
unverified, the questionnaire has unresolved facts required for a conclusion, the source
commit is missing, or a required change lacks executable acceptance evidence.

## Current Response State

```yaml
qualified_review_performed: false
reviewer: UNASSIGNED
product_fact_intake: INCOMPLETE_WITH_EXPLICIT_UNKNOWNS
overall_decision: NOT_ACCEPTED
runtime_authority: false
next_owner_action: COMPLETE_PRODUCT_FACTS_AND_ENGAGE_NAMED_QUALIFIED_REVIEWER
```

[HANDOFF_READY_REVIEW_NOT_PERFORMED]
