# ANALYSIS_INTEGRITY_ADOPTION_2026-09-04.md

```yaml
doc_id: trainoracle-analysis-integrity-adoption-20260904
status: OWNER_APPROVED_SCOPED_IMPLEMENTATION
owner: COACH_HOJUNE
version: "1.0"
canonical_promotion: false
external_data_analysis_activation: false
provider_authentication: false
production_release_claim: false
```

## Approved scope

Owner approval: implement the training analysis review plan in this conversation.
This decision amends only the descriptive analysis bindings below, not safety,
prescription, private-text processing, or provider data activation.

## Field eligibility

Projection may attest individual EXPLICIT fields as accepted while the overall
observation remains SOURCE_NOT_VERIFIED because another field was imported.
An overall MISSING, STALE or CONFLICTING record is not rehabilitated by a field
attestation. Legacy observations without attestations retain their existing trust
requirement. Imported fields remain excluded. Attestations are generated in memory
from parsed journal provenance, never read from backup or provider payloads.
Purpose-only explicit session records count in the energy ledger, with missing
distance, duration and RPE remaining null. No raw/private memo signal is used.

## Identity and evidence

Group all scoped observations before eligibility filtering. Identical signatures
count once; conflicting signatures exclude the entire key. Blank IDs are invalid.
Reporting windows remain local-date scoped. Do not choose a conflicting winner by
timestamp or array order. Current journal revisions remain the storage layer's job.
includedSourceCount/excludedSourceCount count unique source keys;
duplicateSourceCount counts redundant identical copies only;
conflictingSourceCount counts conflicting keys. These units must not be added.
Oracle maturity counts the union of eligible identities actually used by distance
or energy insights, not repeated rows. Maturity is not physiological confidence.

## Metric and presentation semantics

Expose distanceSampleCount, durationSampleCount and rpeSampleCount independently.
Session totals grouped by selected purpose are not time spent exclusively in one
metabolic pathway. RPE remains an unweighted arithmetic mean of recorded values.
MIX remains unallocated. No inferred energy percentages, deficiency or adaptation.
Both comparison periods expose included/excluded/conflict/duplicate counts and
their date boundaries. No-data differs from data excluded by eligibility.
Compact panels disclose coverage. Show all recorded energy categories, with MIX
visible once. Bar length is proportional, with no minimum percentage; readability
is provided by thickness and numeric labels, not inflated quantitative length.

## Precision and COROS preparation

Prepare a separate allowlisted activity envelope preserving seconds, meters,
time semantics, original identity and timezone. Do not reconstruct old precision.
Use synthetic fixtures only. No OAuth registration, tokens, network ingestion,
background sync, workout writes or automatic analysis activation are authorized.
Provider update/delete, ambiguous AM/PM matching and cross-provider deduplication
need explicit future binding before activation; do not invent a winner.

## Verification

Require RED/GREEN tests for mixed fields, purpose-only records, duplicate/conflict
ordering, sample denominators, Oracle identity union and compact/chart semantics.
Record actual execution separately. Existing issue tables and historical evidence
remain unchanged; this document does not close them.

[DRAFT_COMPLETE]
