# QUICK_LOG_PRESET_RESEARCH.md

```yaml
report_id: TO-QUICK-LOG-PRESET-RESEARCH-2026-07-14-001
scope: middle-school, high-school, and university middle-distance runners
decision_scope: review_only
spec_changed: false
confidence_limit: "No athlete cohort dataset is attached to this repository; population-frequency claims are UNKNOWN."
```

## Conclusion

**Keep the current quick-log preset values for the pilot.** They are entry shortcuts, not prescriptions. The application must keep manual entry and skip paths, and must not place larger values first as a training-volume prompt.

| Field | Current presets | Assessment | Reason |
|---|---|---|---|
| distance | 3, 5, 8, 10, 12 km | Keep | Covers short recovery through ordinary single-session running entries without claiming a universal prescription. Actual distribution by age/event is UNKNOWN. |
| duration | 20, 30, 40, 60, 90 min | Keep | Represents a practical logging range for a session; it is not a duration target. Event-specific usage frequency is UNKNOWN. |
| sleep | 6, 6.5, 7, 7.5, 8, 9 h | Keep | Half-hour spacing supports recall and avoids inventing precision. The value must remain a self-report, not a wellness judgment. |

## Repository Basis

- `SPEC_TAP_FIRST_LOGGING.md` establishes these exact pilot presets and prohibits turning them into a volume-up prompt.
- `CODEX_WORK_ORDER_008.md` requires the preset table to remain in the specification unless the owner separately approves a change.
- `TRAINING_PLAN_METHOD_DECISION.md` treats the 9.5-day rhythm as a first-pilot coaching convention, not a universal scientific fact; the same restraint applies here.

## Guardrails

1. Show the athlete's recent value before any generic preset when that value exists.
2. Keep blank/skip as a valid saved state. Do not convert an omitted value into a default fact.
3. Do not use the selected chip as a readiness, adherence, reward, or plan-generation signal without the provenance contract and a later owner decision.
4. Revisit these values only after de-identified pilot logs can show actual selection patterns by athlete context.
