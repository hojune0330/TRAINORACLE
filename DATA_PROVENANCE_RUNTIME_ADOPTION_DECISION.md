# DATA_PROVENANCE_RUNTIME_ADOPTION_DECISION.md

```yaml
decision_id: TO-DECISION-DATA-PROVENANCE-RUNTIME-2026-07-14-001
status: IMPLEMENTING
owner_direction: "2026-07-14: Fable review proceeds; Codex proceeds with work items 2 and 3."
scope:
  applies_to: new device-local journal writes
  metadata_field: fieldProvenance
  states: [EXPLICIT, DERIVED, MISSING]
  legacy_read_rule: "An entry without fieldProvenance remains readable as LEGACY_MISSING_PROVENANCE."
analysis_rule: "MISSING, legacy, invalid, and ineligible derived values are excluded from analytics and future plan evidence."
privacy_rule: "Provenance stores only field identifiers and no memo, symptom, or raw-text evidence."
```

## Current Runtime Boundary

- New form writes record whether each coaching-relevant numeric value was directly entered or skipped.
- Existing entries remain visible in the owner journal, export safely without raw memo text, and do not become analysis input merely because their metadata is absent.
- `DERIVED` is stored only with its named inputs and a stable rule ID. It is eligible only when every named input is direct (`EXPLICIT`); nested or incomplete derivation is excluded.
- Race self-check values remain display-only. This decision does not make them training-plan or statistics input.

## Follow-up Before Plan Generation

1. Adopt a reviewed list of permitted derivation rule IDs before any UI writes `DERIVED` values.
2. Bind this provenance gate to the Formation/Adaptation plan-input contract.
3. Keep imported or demo data excluded until a separate owner decision defines their provenance labels.
