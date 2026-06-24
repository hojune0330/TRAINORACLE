# PLAN_GENERATOR_SPEC Count-Related Lines

Exact/count-relevant lines only; this does not classify stale by itself.

44:  open_issues_total: 7
45:  open_issues_canonical_blocking_count: 2
126:| Rule safety hard-stop runtime binding | `RULE_SPEC_D1_D9.md v1.4` / `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Runtime detection and binding tracked by `OI-PG-RULE-SAFETY-GATE-BINDING-001` | PARTIAL_OPEN |
133:| Physiological source trust | `APP_IMPLEMENTATION_BRIDGE.md v1.1` | Physiological source consumption policy remains open through `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | PARTIAL_OPEN |
357:      tracked_by: OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
801:  option_rationale_privacy_tracked_by: OI-PG-OPTION-RATIONALE-PRIVACY-001
826:| `OI-PG-RULE-SAFETY-GATE-BINDING-001` | P1 | YES | OPEN | Runtime binding between active `RULE_SPEC_D1_D9.D-9` state and generation block must be finalized. | Define exact bridge query and active-state interpretation. |
827:| `OI-PG-PHYSIO-SOURCE-CONSUMPTION-001` | P1 | YES | OPEN | Trusted physiological source consumption remains unresolved. | Bind to APP Bridge physiology source-trust resolution. |
828:| `OI-PG-OUTPUT-FORMAT-BINDING-001` | P2 | NO | OPEN | Final export format is not fixed. | Decide UI/export schema later. |
829:| `OI-PG-OPTION-RATIONALE-PRIVACY-001` | P2 | NO | OPEN | Rationale text may accidentally reveal sensitive data. | Add redaction templates before production. |
830:| `OI-PG-COMPETITION-TAPER-POLICY-001` | P2 | NO | OPEN | Competition taper details are not fully specified. | Create taper sub-policy or competition-prep template. |
831:| `OI-PG-MICROCYCLE-CALENDAR-MAPPING-001` | P2 | NO | OPEN | 9.5-day reference cycle to 7-day calendar output needs final mapping. | Define mapping and display policy. |
832:| `OI-PG-AIB-V1_1-CANONICAL-PROMOTION-001` | P2 | NO | OPEN | This spec depends on APP Bridge v1.1 local baseline candidate. | Plan Generator cannot canonical-promote before APP Bridge canonical promotion. |
935:  expected_open_issues_total: 7
936:  expected_canonical_blocking_count: 2
979:  remaining_canonical_blocking_open_issues:
980:    - OI-PG-RULE-SAFETY-GATE-BINDING-001
981:    - OI-PG-PHYSIO-SOURCE-CONSUMPTION-001
983:    - OI-PG-OUTPUT-FORMAT-BINDING-001
984:    - OI-PG-OPTION-RATIONALE-PRIVACY-001
985:    - OI-PG-COMPETITION-TAPER-POLICY-001
986:    - OI-PG-MICROCYCLE-CALENDAR-MAPPING-001
987:    - OI-PG-AIB-V1_1-CANONICAL-PROMOTION-001
