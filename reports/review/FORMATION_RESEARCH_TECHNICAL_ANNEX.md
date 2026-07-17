# Formation Research Technical Annex

## Evidence Accounting

```yaml
protocol: FROZEN_FOR_SEARCH
owner_identity: 9_5_DAY_FORMATION
target_authority: DEFAULT_AUTOMATED_PRESCRIPTION
decision_precedence: LATEST_EXPLICIT_OWNER_DECISION_GOVERNS
runtime_authority: false
source_ledger: 167
existing_citation_occurrences_audited: 75/75
fresh_search_rows: 55
screening_lanes: 2
prepared_screening: 163_INCLUDE | 2_EXCLUDE | 2_DEFER
human_screening_confirmation: 0/167
extraction_lanes: 2
prepared_extraction_sources: 167/167
extraction_field_conflicts: 2824
appraisal_lanes: 2
prepared_appraisal_sources: 167/167
appraisal_controlled_conflicts: 208
whole_architecture_direct_sources: 0
claim_rows: 22
canonical_prepared_decision_packets: 2_NOT_REVIEWED
supplemental_decision_packets: 1_NOT_REVIEWED
supplemental_source_candidates: 18
supplemental_pubmed_identities_verified: 18
supplemental_canonical_duplicates: 5
supplemental_human_screening_confirmation: 0/18
```

## Research Dependency Result

RQ-B/C constrain RQ-A mechanics. RQ-D freezes descriptive data identity before RQ-E may
reference metrics. RQ-E and RQ-G constrain RQ-F pilot interpretation. The output is therefore
not a vote count of papers and not evidence that the whole Formation architecture is effective.

## Product Rule Candidates

1. `LOCAL_CIVIL_9_DAYS_12_HOURS` with one deterministic primary plan.
2. The one deterministic primary plan contains 2-3 planned MAIN exposure events; a race counts
   once and a missed MAIN creates no debt or catch-up.
3. 72 hours displayed only as target/elapsed interval.
4. Ordered composite components with parent/leaf dedupe and no proportional sRPE split.
5. Provenance-bearing internal/external/derived/contextual values with method compatibility.
6. Four-level within-athlete claim ladder and fail-closed promotion.
7. Structured participant-visible concern states; no medical inference; qualified handoff.
8. `PRIVATE_SELF_ONLY` zero-signal; user-directed backup/share remains a separate operation.
9. No eligible candidate becomes
   `NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`, not a newly invented exception
   plan or alternate-cycle roulette.
10. One calendar competition anchor may preserve multiple completed competition bouts; the
    anchor contributes zero and each approved completed bout contributes at most one, pending
    owner review of the supplemental packet.

## Acceptance Boundary

These are prepared rule candidates, not canonical runtime rules. Human-trained screening and
extraction adjudication, source appraisal review, exact packet decisions, spec conflict patches,
privacy/safeguarding review, user testing, accessibility/AT review, and product-owner activation
must all remain separately visible. AI cannot populate their approvals.

## Artifact Map

- Protocol: `reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md`
- Source/search/screening/extraction/appraisal/claim ledgers: `reports/research/evidence/`
- Five synthesis reviews: `reports/research/FORMATION_*_REVIEW*.md`
- Counterevidence: `FORMATION_COUNTEREVIDENCE_AND_UNCERTAINTY_REVIEW.md`
- Decision packets: `reports/review/FORMATION_*_DECISION_PACKET_V2.md`
- Supplemental competition packet: `FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md`
- Supplemental candidates/search: `FORMATION_SUPPLEMENTAL_*_20260717.*`
- Supplemental PubMed identity audit: `FORMATION_SUPPLEMENTAL_IDENTITY_AUDIT_20260717.csv`
- Competition synthesis: `FORMATION_COMPETITION_ANCHOR_EVIDENCE_SUPPLEMENT.md`
- User/spec audit: `reports/review/FORMATION_USER_SPEC_ALIGNMENT_REVIEW.md`
- Detailed user audit: `.omo/evidence/formation-research-v2/user-spec-alignment-audit.md`
- User scenarios/teach-back: `reports/review/FORMATION_USER_SCENARIOS_AND_TEACH_BACK_V1.md`
