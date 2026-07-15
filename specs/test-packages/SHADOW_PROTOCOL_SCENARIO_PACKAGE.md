# Shadow Protocol Scenario Package

```yaml
fixture_pack_id: TO-WO014-SHADOW-2026-07-15
status: SYNTHETIC_READINESS_ONLY
fixture_count: 37
```

| ID | Scenario | Expected result |
|---|---|---|
| SP-01 | hidden enrollment | reject |
| SP-02 | bundled/preselected consent | reject |
| SP-03 | withdrawal path missing | reject protocol |
| SP-04 | stop rules missing | reject protocol |
| SP-05 | real plan/calendar write | abort; zero mutation |
| SP-06 | progress says success/safe | reject copy |
| SP-07 | refusal | journal unchanged; zero penalty |
| SP-08 | revoked consent | stop new processing |
| SP-09 | athlete pause | paused; no coach override |
| SP-10 | rest/pain/injury report | acknowledgment eligible, no penalty |
| SP-11 | comprehension check is 3/4 | return to explanation; create no consent or shadow state |
| SP-12 | coach attempts resume without all resume proofs | reject resume; remain paused |
| SP-13 | repeated adverse event after unresolved pause or urgent-support report | abort; no automatic recipient notification |
| SP-14 | final review completes | freeze new processing; enter `COMPLETED_PENDING_DISPOSITION`; no adoption |
| SP-15 | baseline identity, version, or digest missing | remain `BASELINE_PENDING`; no inherited baseline |
| SP-16 | scheduled frame checkpoint is missed | pause; no backfill, compression, or progress mark |
| SP-17 | source uncertainty is missing/stale/conflicting/unverified | typed insufficient/blocked result; no imputation or favorable fallback |
| SP-18 | process threshold or descriptive feedback is unfavorable | `REVISE_AND_REPEAT_SYNTHETIC` or reject; no safety/efficacy conclusion |
| SH-01 | private note absent/A/B | byte-identical workflow |
| SH-02 | raw training note | reject delivery |
| SH-03 | recipient unspecified | hold |
| SH-04 | generic coach role | hold |
| SH-05 | automatic notification | reject/abort |
| SH-06 | stale/revoked share grant | hold |
| SH-07 | exact-field preview | still hold pending Order 011 |
| SH-08 | local export shown independently | no app share record |
| SH-09 | friend versus guardian scope | separate; no inheritance |
| SH-10 | recipient changed after confirm | invalidate confirmation |
| HR-01 | two reviewers blind-lock | accept process record |
| HR-02 | packet digest mismatch | reject verdict |
| HR-03 | reviewer conflict | not independent |
| HR-04 | disagreement with adjudicator | append adjudication |
| HR-05 | disagreement without adjudicator | unresolved; stop completion |
| HR-06 | threshold version changes mid-run | reject/restart review |
| HR-07 | feedback attempts plan mutation | reject |
| HR-08 | review record leaks note/reason | reject record |
| HR-09 | adjudicator authored a verdict/packet or has a declared conflict | adjudicator invalid; unresolved; stop completion |

Trace: `WO014-T01` SP; `WO014-T02` SH; `WO014-T03` HR. All are synthetic and cannot
enroll a real participant.

The package is validated by `validate-shadow-protocol-readiness.sh`. That validator
checks document presence, blocked authority, declared/actual/unique fixture counts,
required failure IDs, required contract topics, and forbidden enabled states. Passing it
is synthetic document evidence only, not runtime or participant evidence.

[DRAFT_COMPLETE]
