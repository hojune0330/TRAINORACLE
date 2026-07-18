# Formation Research V2 Final Quality Review

```yaml
review_id: TO-FRV2-FINAL-QUALITY-2026-07-17
verdict: FAIL
confidence: HIGH
runtime_authority: false
prepared_validators: PASS
accepted_current_state: BLOCKED_AS_EXPECTED
adversarial_validator_integrity: FAIL
deterministic_rebuild: FAIL
```

## Verdict

**FAIL.** The current package is honestly marked as AI-prepared and all ordinary preparation
validators pass. The untouched screening, extraction, and appraisal packages also fail
`--accepted` for the expected 167 pending human rows, 2,668 extraction conflicts, and 208
appraisal conflicts. Those results do not establish gate integrity: isolated mutations of only
canonical status strings and conflict files make all three accepted validators return exit 0
without changing either raw lane or supplying a human attestation.

The latest owner direction is otherwise represented correctly in the refreshed package: fixed
9.5-day default automated prescription, one primary plan, private-note analysis zero-signal,
user-directed backup/share, and `runtime_authority=false`. The current synthesis validator also
rejects abstract-only supporting sources, and its regression test passes.

## Findings

### [CRITICAL] FQ-01: All three human acceptance gates can be bypassed by editing generated outputs

**Files/lines:**

- `specs/test-packages/validate-formation-screening.mjs:71-97`
- `specs/test-packages/validate-formation-extraction.mjs:84-101`
- `specs/test-packages/validate-formation-appraisal.mjs:47-66`

The validators count status markers in canonical files but do not recompute canonical rows from
the raw lanes, prove every conflict has an adjudication record, or bind `CONFIRMED` to a named,
qualified, hash-bound human decision. Appraisal also accepts a duplicate canonical row: appending
a second copy of one source produced `sources=167 ... pending_human=168` with exit 0.

**Executed reproduction (isolated copy):** after copying `specs/test-packages`,
`reports/research`, and `.omo/evidence/formation-research-v2` beneath a temporary root:

```bash
# Screening: only final markers changed.
perl -0pi -e 's/,PENDING_HUMAN,/,CONFIRMED,/g; s/,DEFER,AI disagreement/,INCLUDE,AI disagreement/g' \
  "$tmp/reports/research/evidence/FORMATION_SCREENING_LEDGER.csv"
node "$tmp/specs/test-packages/validate-formation-screening.mjs" --accepted
# FORMATION_SCREENING_ACCEPTED ... pending_human=0; exit=0

# Extraction: only canonical markers changed and conflict rows removed.
perl -0pi -e 's/PENDING_HUMAN_FIELD_ADJUDICATION|SCREENING_DEFERRED_PENDING_HUMAN|SCREENING_EXCLUDED_PENDING_HUMAN|AI_LANES_EXACT_AGREEMENT_PENDING_HUMAN/ACCEPTED_WITHOUT_ADJUDICATION/g' \
  "$tmp/reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv"
head -n 1 "$tmp/reports/research/evidence/FORMATION_EXTRACTION_CONFLICTS.csv" > "$tmp/conflicts.csv"
mv "$tmp/conflicts.csv" "$tmp/reports/research/evidence/FORMATION_EXTRACTION_CONFLICTS.csv"
node "$tmp/specs/test-packages/validate-formation-extraction.mjs" --accepted
# FORMATION_EXTRACTION_ACCEPTED ... conflicts=0 pending_rows=0; exit=0

# Appraisal: only confirmation markers changed and conflict rows removed.
perl -0pi -e 's/,PENDING_HUMAN_APPRAISAL_ADJUDICATION,PENDING_HUMAN,/,PENDING_HUMAN_APPRAISAL_ADJUDICATION,CONFIRMED,/g' \
  "$tmp/reports/research/evidence/FORMATION_APPRAISAL_LEDGER.csv"
head -n 1 "$tmp/reports/research/evidence/FORMATION_APPRAISAL_CONFLICTS.csv" > "$tmp/conflicts.csv"
mv "$tmp/conflicts.csv" "$tmp/reports/research/evidence/FORMATION_APPRAISAL_CONFLICTS.csv"
node "$tmp/specs/test-packages/validate-formation-appraisal.mjs" --accepted
# FORMATION_APPRAISAL_ACCEPTED ... conflicts=0 pending_human=0; exit=0
```

**Expected invariant:** accepted state is derived from both immutable lane inputs plus one
attestation per disagreement/source containing reviewer identity, qualification, decision,
reviewed artifact hashes, and date. Generated canonical state alone is never authority.

**Minimum fix:** make accepted validation rebuild/compare every canonical field, require exact
row cardinality and uniqueness, require a complete conflict-to-adjudication bijection, and join
each accepted source to a schema-validated reviewer-ledger attestation whose hashes match the
lane and canonical inputs. Add the three mutations above as negative tests.

### [HIGH] FQ-02: The extraction repair is destructive and cannot be rerun

**Files/lines:** `specs/test-packages/repair-formation-extraction-preparation.mjs:87-114`.

The script reads `FRV2-F-015` and `FRV2-F-016` from lane 2 at lines 87-89, then removes those
IDs from the same persisted lane at lines 100 and 114. The current checked-in preparation is
already post-repair, so a second run fails before rebuilding extraction.

**Executed reproduction:**

```bash
node specs/test-packages/repair-formation-extraction-preparation.mjs
# Error: Missing pilot-method preparation FRV2-F-015 (line 89); exit=1
```

The same failure occurred as step four of an isolated full rebuild after source and screening
builders succeeded.

**Expected invariant:** running the documented builder chain twice from the same persisted inputs
produces identical bytes and exit 0 both times.

**Minimum fix:** preserve immutable pre-repair lane seeds in a separate input artifact, or make
the repair recognize already-relocated rows and reconstruct them without depending on data it
deleted. Add a two-pass hash-equality test for every generated ledger.

### [HIGH] FQ-03: Five non-independent gap fills are labeled as exact dual-lane agreement

**Files/lines:**

- `specs/test-packages/repair-formation-extraction-preparation.mjs:74-109`
- `specs/test-packages/build-formation-extraction.mjs:85-110`
- `reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv:96,116,143,166,168`
- `.omo/evidence/formation-research-v2/appraisal-lane-2.csv:116,143,166,168`
- `.omo/evidence/formation-research-v2/task-04.md:31-34`
- `reports/research/FORMATION_FRAME_RECOVERY_EVIDENCE_REVIEW_V2.md:69-74`

Six rows are correctly marked `AI_ROOT_GAP_FILL_NOT_INDEPENDENT` in raw evidence, but the
extraction builder compares values only. Five copied rows therefore become
`AI_LANES_EXACT_AGREEMENT_PENDING_HUMAN`; only `FRV2-F-016` remains deferred. Four lane-2
appraisal rows also state `independent_lane=2` even though lane 2 was root-filled from lane 1.
This contradicts Task 04's statement that the six are not represented as independent agreement
and overstates the official report's claim that double extraction is prepared.

**Executed reproduction:**

```bash
rg -n 'AI_ROOT_GAP_FILL_NOT_INDEPENDENT' \
  reports/research/evidence/FORMATION_EVIDENCE_EXTRACTION.csv
# Five matching rows end in AI_LANES_EXACT_AGREEMENT_PENDING_HUMAN.

rg -n '^("?(SRC-DOI-10\.1136-BMJ\.H1793|SRC-PMID-34250468|SRC-WEB-COCHRANE-HB-CH14|SRC-WEB-PRISMA-2020)"?,)' \
  .omo/evidence/formation-research-v2/appraisal-lane-2.csv
# Each note contains independent_lane=2.
```

**Expected invariant:** provenance non-independence dominates value equality; copied values can
never become independent agreement or seed an appraisal lane described as independent.

**Minimum fix:** propagate a typed `independence_state` into canonical extraction and appraisal.
Emit `NON_INDEPENDENT_GAP_FILL_PENDING_HUMAN_REEXTRACTION` for all six, exclude them from exact
agreement counts, and qualify both official reports until genuine re-extraction replaces them.

### [HIGH] FQ-04: Malformed CSV is silently accepted

**Files/lines:** the representative parser is
`specs/test-packages/validate-formation-source-audit.mjs:7-40`; equivalent permissive copies
appear in the other builders/validators. `validate-formation-final-review-preparation.mjs:6-12`
is weaker still and uses `split(",")`.

The parser never rejects an unterminated quoted field, duplicate/blank headers, or a row whose
width differs from the header. Extra cells are silently discarded.

**Executed reproduction (isolated source ledger):**

```bash
perl -0pi -e 's/\n$/"\n/' reports/research/evidence/FORMATION_SOURCE_LEDGER.csv
node specs/test-packages/validate-formation-source-audit.mjs
# FORMATION_SOURCE_AUDIT_VALID ...; exit=0

perl -0pi -e 's/\n/,UNDECLARED_EXTRA_COLUMN\n/' reports/research/evidence/FORMATION_SOURCE_LEDGER.csv
node specs/test-packages/validate-formation-source-audit.mjs
# FORMATION_SOURCE_AUDIT_VALID ...; exit=0
```

**Expected invariant:** every CSV is RFC-4180-parseable, has one exact schema header, and every
row has exactly that column count before any semantic validation runs.

**Minimum fix:** replace the duplicated parsers with one strict shared CSV boundary module or a
maintained parser; fail on open quotes, illegal quote placement, duplicate headers, blank headers,
and row-width mismatch. Add malformed-quote, embedded-newline, escaped-quote, extra-cell, and
missing-cell regression tests.

### [HIGH] FQ-05: The frozen protocol provenance hash is stale

**Files/lines:** `.omo/evidence/formation-research-v2/task-01.md:54` and
`.omo/start-work/ledger.jsonl:17` record `5fda23...f38`; the current protocol hashes to
`c02388...88a`.

**Executed reproduction:**

```bash
sha256sum reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md
rg -n '[a-f0-9]{64}' .omo/evidence/formation-research-v2/task-01.md .omo/start-work/ledger.jsonl
```

**Expected invariant:** a frozen protocol's bytes match its recorded hash, or a dated amendment
records why it changed and the search/screening/extraction/synthesis impact.

**Minimum fix:** restore the frozen bytes or add a truthful amendment and update provenance; add
the hash check to `validate-formation-research-v2.mjs`.

### [MAJOR] FQ-06: Decision packets can lose every owned field and still validate

**Files/lines:** `specs/test-packages/validate-formation-decision-packets.mjs:13-39`.

`yamlList()` returns an empty list when the block is missing, and the validator only checks that
the two empty sets do not collide. Removing both `owned_fields` bodies produced:

```text
FORMATION_PACKETS_PREPARED load_fields=0 minimum_fields=0 collisions=0 decisions=NOT_REVIEWED runtime=false
exit=0
```

**Expected invariant:** both packets conform to an exact typed schema and contain their complete,
nonempty, unique ownership sets; ownership and decision status are read from the intended YAML
document, not arbitrary substrings elsewhere in Markdown.

**Minimum fix:** parse the fenced YAML structurally, assert the exact expected field sets and
disjointness, reject duplicates/unknowns, and validate decision/reviewer/hash coherence. Add the
empty-ownership mutation as a negative test.

### [MAJOR] FQ-07: Appraisal treats `NOT_APPLICABLE` as a worse directness rank

**Files/lines:** `specs/test-packages/build-formation-appraisal.mjs:58-72,92-105` and
`reports/research/evidence/FORMATION_APPRAISAL_CONFLICTS.csv`.

The ordinal `DIRECT -> PARTIAL -> INDIRECT -> NOT_APPLICABLE` conflates strength of directness
with applicability. Ninety lane disagreements currently resolve to `NOT_APPLICABLE`, including
`PARTIAL` versus `NOT_APPLICABLE`, instead of remaining unresolved.

**Executed reproduction:**

```bash
awk -F, 'NR>1 && $5=="NOT_APPLICABLE" && $3!=$4 {n++} END {print n}' \
  reports/research/evidence/FORMATION_APPRAISAL_CONFLICTS.csv
# 90
```

**Expected invariant:** `NOT_APPLICABLE` is a separate semantic variant, not an ordinal severity;
disagreement about applicability is `NOT_VERIFIED` until adjudicated.

**Minimum fix:** use an exhaustive field-specific merge table. Only order comparable concern or
directness values; any applicability disagreement must remain `NOT_VERIFIED` with a conflict.

### [MAJOR] FQ-08: Exclusion records discard the actual controlled exclusion reason

**Files/lines:** `specs/test-packages/build-formation-screening-ledgers.mjs:94-107`,
`reports/research/evidence/FORMATION_EXCLUSION_LEDGER.csv:2-3`, and protocol
`reports/research/FORMATION_RESEARCH_PROTOCOL_V2.md:279-289`.

Both excluded sources have specific, agreeing lane reasons, but the exclusion ledger replaces
them with `AI lanes agree; human-trained confirmation remains required`. That records review
state, not the controlled primary exclusion reason required by the protocol. The validator only
requires a nonempty reason.

**Expected invariant:** every excluded record preserves one controlled primary reason code plus
the lane explanations and human-confirmation state separately.

**Minimum fix:** add a controlled exclusion reason enum, map/adjudicate both lane reasons into it,
and validate it against source identity/full-text state. Keep the pending-human message in its own
field.

### [MINOR] FQ-09: Hard-coded corpus counts and one oversized generator raise maintenance risk

**Files/lines:**

- `.omo/evidence/formation-research-v2/appraisal-lane-1-generator.mjs:449-490` (460 pure LOC)
- `.omo/evidence/formation-research-v2/build-appraisal-lane-2.mjs:196-199,262-263`
- `specs/test-packages/validate-formation-final-review-preparation.mjs:26-40`

Both appraisal generators hard-code `167`, while final preparation embeds current accounting
counts in string checks. A legitimate protocol amendment that changes the source corpus will
false-fail until code is manually synchronized. The 490-line lane-1 generator combines parsing,
large source-ID policy tables, appraisal classification, and serialization in one file.

**Minimum fix:** derive corpus counts from a versioned manifest/source ledger, keep only genuinely
fixed workflow cardinalities explicit, and split lane-1 parsing/schema, appraisal policy, and CLI
generation into focused modules with unit tests.

## Blocking Fix Order

1. Close FQ-01 with recomputation, exact cardinality, conflict/adjudication joins, and hash-bound
   human attestations. Keep `runtime_authority=false`.
2. Make the extraction preparation idempotent (FQ-02) and add a two-pass deterministic rebuild
   test before regenerating any downstream files.
3. Rebuild all six gap fills as explicitly non-independent and correct the extraction/appraisal
   labels and report wording (FQ-03).
4. Install one strict CSV boundary and migrate all Formation builders/validators (FQ-04).
5. Reconcile the protocol hash (FQ-05) before claiming the search protocol remained frozen.
6. Close FQ-06 through FQ-08 before owner packet or human review begins; otherwise later approval
   data can be malformed or semantically misleading.

## Executed Verification

The refreshed ordinary package run produced:

```text
FORMATION_RESEARCH_V2_VALID rqs=7 owner_identity=9_5_DAY_FORMATION target=AUTOMATED_PRESCRIPTION runtime=false
FORMATION_SOURCE_AUDIT_VALID sources=167 occurrences=75 rqs=7
FORMATION_SCREENING_PREPARED sources=167 excluded=2 deferred=2 pending_human=167
FORMATION_EXTRACTION_PREPARED sources=167 conflicts=2668 pending_rows=167
FORMATION_APPRAISAL_PREPARED sources=167 conflicts=208 pending_human=167
FORMATION_SYNTHESIS_PREPARED reports=5 claims=22 rqs=7 runtime=false
FORMATION_PACKETS_PREPARED load_fields=16 minimum_fields=17 collisions=0 decisions=NOT_REVIEWED runtime=false
FORMATION_OWNER_BASELINE_VALID conflicts=9 latest_decision=governs runtime=false
FORMATION_FINAL_PREPARED reviewers=0/6 manual=0/5 user_improvements=15 runtime=false
```

Untouched `--accepted` runs exited 1 for the expected open gates. The synthesis boundary test
passed and current claim support contains zero non-full-text supporting references. These passes
confirm the package's present prepared state; they do not mitigate the adversarial false-pass and
rebuild defects above.

[FINAL_QUALITY_REVIEW_FAIL]
