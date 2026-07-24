# G001 Plan Beta final manual QA v2

Verdict: PASS

The final production-preview evidence set is complete and current. The prior first-context capture-transition defect is resolved by recapturing the three affected PNGs after the visible button appeared and 500ms of settling. No product files were modified by QA.

## manualQa

### surfaceEvidence

| Scenario | Criterion reference | Surface | Exact invocation | Verdict | Artifact refs |
|---|---|---|---|---|---|
| PNG-01 | 42 fresh captures; exact viewport set; valid PNGs; unique payloads | `.omo/evidence/plan-beta-2026-07-24/*.png` | Independent PowerShell signature/IHDR/size/SHA-256/mtime audit | PASS | A01 |
| PNG-02 | All 320px screenshots and corrected first-context captures visually complete | 14 `*-narrow.png` files plus `13-first-context-*` | `view_image(detail=original)`; all 14 narrow files inspected, corrected 13 set re-opened | PASS | A02 |
| LIVE-01 | First visit and first-context reachability | `http://127.0.0.1:4176/?app=1` | Connected in-app browser; click `다른 시작 방법 보기`; inspect DOM | PASS | A03 |
| LIVE-02 | Blocked high-pain, allowed candidates, selection, active progress | Same live URL | Execute observed safety/block/retry/safe/candidate selection actions | PASS | A03 |
| TEST-01 | Targeted Plan Beta contracts/store | `app/` | `npm.cmd test -- --run src/screens/PlanBeta.contract.test.tsx src/domain/plan-beta-store.test.ts` | PASS | A04 |
| TYPE-01 | Type safety and production build | `app/` | `npm.cmd run typecheck`; `npm.cmd run build` | PASS | A04 |

### adversarialCases

| Scenario | Criterion reference | Adversarial class | Expected behavior | Verdict | Artifact refs |
|---|---|---|---|---|---|
| ADV-01 | Responsive CJK layout | 320px wrapping, overflow, clipped actions, fixed nav | All text/actions remain visible without overlap | PASS | A02, A03 |
| ADV-02 | Evidence freshness/integrity | Duplicate, malformed, stale capture payload | 42 unique valid PNGs, exact dimensions, newer than sources | PASS | A01 |
| ADV-03 | Safety-first reachability | High-pain/uncertain answer | Block plan generation and expose retry/human-check path | PASS | A03 |
| ADV-04 | First-context capture compositing | Delayed/partial screenshot render | Every first-context capture contains its rendered body | PASS | A02 |

## artifactRefs

| ID | Kind | Description | Path |
|---|---|---|---|
| A01 | JSON | Independent final PNG integrity, dimensions, duplicates, and freshness audit | `.omo/evidence/plan-beta-2026-07-24/png-audit-independent-v4.json` |
| A02 | visual review | Original-resolution review of corrected first-context captures and narrow layout | `.omo/evidence/plan-beta-2026-07-24/first-context-visual-review-final-v4.md` |
| A03 | browser action log | Live Home, first-context, safety, candidates, and active route evidence | `.omo/evidence/plan-beta-2026-07-24/live-qa-browser-actions-final-v3.json` |
| A04 | build/test transcript | Targeted tests, typecheck, and production build results | `.omo/evidence/plan-beta-2026-07-24/build-typecheck-test-final-v3.txt` |

## Completion gate

PASS. The current production-preview byte set is fresh, structurally valid, visually complete across all reviewed narrow states, and supported by live route and build/test evidence.
