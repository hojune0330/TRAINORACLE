# Task 02 Evidence: Source Audit And Fresh Search

## Product Boundary

- Fixed product identity: `9_5_DAY_FORMATION`
- Target authority: `AUTOMATED_PRESCRIPTION`
- Current runtime authority: `false`
- This audit tests evidence provenance and claim boundaries. It does not reconsider the
  product identity or activate prescription behavior.

## RED

Command:

```text
node specs/test-packages/validate-formation-source-audit.mjs
```

Observed result on 2026-07-17:

```text
FORMATION_SOURCE_AUDIT_INVALID source ledger has no audited sources
FORMATION_SOURCE_AUDIT_INVALID citation occurrence coverage 0/75
FORMATION_SOURCE_AUDIT_INVALID missing file coverage reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md
FORMATION_SOURCE_AUDIT_INVALID missing file coverage specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md
FORMATION_SOURCE_AUDIT_INVALID missing file coverage .omo/drafts/formation-followup-deep-research.md
FORMATION_SOURCE_AUDIT_INVALID missing file coverage .omo/drafts/formation-followup-source-map.md
FORMATION_SOURCE_AUDIT_INVALID no executed search logged for RQ-A
FORMATION_SOURCE_AUDIT_INVALID no executed search logged for RQ-B
FORMATION_SOURCE_AUDIT_INVALID no executed search logged for RQ-C
FORMATION_SOURCE_AUDIT_INVALID no executed search logged for RQ-D
FORMATION_SOURCE_AUDIT_INVALID no executed search logged for RQ-E
FORMATION_SOURCE_AUDIT_INVALID no executed search logged for RQ-F
FORMATION_SOURCE_AUDIT_INVALID no executed search logged for RQ-G
FORMATION_SOURCE_AUDIT_INVALID search log is still NOT_STARTED
FORMATION_SOURCE_AUDIT_INVALID database access limitations are not recorded
```

## GREEN

Command:

```text
node specs/test-packages/build-formation-source-ledgers.mjs
node specs/test-packages/validate-formation-source-audit.mjs
```

Observed result on 2026-07-17:

```text
FORMATION_SOURCE_LEDGERS_BUILT fragments=8 sources=167 occurrences=75 searches=55
FORMATION_SOURCE_AUDIT_VALID sources=167 occurrences=75 rqs=7
```

Audit result:

- Pre-existing occurrence coverage: `75/75` across all four required files.
- Normalized source identities in the pre-existing audit: `53`; unique cited URLs: `57`.
- Deduplicated combined ledger after RQ-A-G fresh searches: `167` sources.
- Fresh executed search rows: `55`, with at least one actual PubMed or ranked-web search for
  every RQ.
- SPORTDiscus, Scopus, Web of Science, and authenticated Cochrane advanced search were not
  available in this environment; each limitation is explicit in the search log.
- Wrong identifiers quarantined: invalid Papanikolaou DOI and the `sms.14231` swimming-paper
  mismatch. CENT and IOC RED-S corrections are recorded.
- Exact 9.5-day comparative evidence and exact 9.5-day coaching-use precedent were not found.
  Named 9-day and 10-day practice cases were found, but common-use prevalence remains
  unverified. This limits scientific wording and does not reopen the fixed product identity.
