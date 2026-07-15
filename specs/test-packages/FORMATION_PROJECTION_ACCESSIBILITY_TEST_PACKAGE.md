# Formation Projection Accessibility Test Package

```yaml
fixture_pack_id: TO-WO015-PROJECTION-A11Y-2026-07-15
status: READINESS_ONLY
fixture_count: 40
executed_tests_total: 0
```

| ID | Check | Expected result |
|---|---|---|
| PX-01 | audience missing | reject projection |
| PX-02 | authority/action missing | reject |
| PX-03 | source/freshness missing | reject |
| PX-04 | uncertainty/missingness hidden | reject |
| PX-05 | immutable `FB-COMPOSITE-001` rendered at explanation levels 1-5 | same canonical fact/result hash, authority, action, privacy, horizon, source watermark, uncertainty, and real-plan hash |
| PX-06 | level changes authority/action | reject |
| PX-07 | composite collapsed to MIXED | reject |
| PX-08 | whole RPE split among components | reject |
| PX-09 | readiness/fatigue scalar | reject |
| PX-10 | ready/recovered/medical copy | reject |
| PX-11 | shadow progress looks like success | reject |
| PX-12 | rest/injury/withdrawal penalty | reject |
| PX-13 | horizon missing | reject projection |
| PX-14 | privacy policy or audience redaction missing | reject |
| PX-15 | required human action missing | reject |
| PX-16 | correction path missing or edits candidate/real plan | reject |
| PX-17 | immutable source watermark missing or mismatched | reject |
| PX-18 | audience/authority/action combination not in matrix | reject |
| PX-19 | parent and component leaves both aggregated | reject double count |
| PX-20 | unknown component shares visualized as proportions | reject inference |
| PX-21 | otherwise identical `PRIVATE_SELF_ONLY` variants are absent, text A, text B, and metadata-only changes to timestamp/hash/source/reason/provenance/audit correlation | projection, cache, audit, telemetry, accessibility announcement, review packet, and error bytes are pairwise identical; no presence event |
| PX-22 | raw analyzable note, excerpt, summary, translation, token, hash, embedding, or human-readable note-derived reason reaches projection | reject; no projection, audit detail, telemetry detail, or candidate |
| PX-23 | note-derived `D9_CLEARED` or `D9_CLEARED_WITH_ADVISORY` | emit no downstream result, projection, source marker, presence signal, or plan permission |
| PX-24 | accepted target-bound note-derived block/review envelope | expose only generic opaque `SAFETY_REVIEW_REQUIRED`; any note source, timestamp, reason, category detail, provenance, stale/revoked scope, or wrong target rejects with no candidate |
| AX-01 | color-only meaning | reject |
| AX-02 | hover-only information | reject |
| AX-03 | unnamed icon/control | reject |
| AX-04 | keyboard trap or invisible focus | reject |
| AX-05 | 200% clip/overlap/horizontal loss | reject |
| AX-06 | 320/375 px overflow | reject |
| AX-07 | reduced-motion violation | reject |
| AX-08 | private/unauthorized guardian data | reject |
| AX-09 | normal text contrast below 4.5:1 or large text below 3:1 | reject |
| AX-10 | meaningful control/graphic/state contrast below 3:1 | reject |
| AX-11 | non-inline custom product control target below 44x44 CSS px | reject |
| AX-12 | illogical focus order or focused control obscured | reject |
| AX-13 | progress/status change not programmatically announced or steals focus | reject |
| AX-14 | screen-reader output omits authority, state, fact, uncertainty, or action meaning | reject |
| AX-15 | desktop layout clips, overlaps, or loses equivalent meaning | reject |
| AX-16 | reduced-motion mode retains nonessential motion or delayed state | reject |

Automated trace: `WO015-T01` PX-01..04, PX-13..18, and PX-21..24; `WO015-T02`
PX-05..12 and PX-19..20; `WO015-T03` AX-01..16. Manual QA requires actual rendered multi-viewport,
keyboard, screen-reader,
contrast, reflow, and comprehension evidence; this package cannot substitute for it.

[DRAFT_COMPLETE]
