Exit code: 0
Wall time: 0.2 seconds
Output:
# TrainOracle APPT post-fix manual QA

Attempt directory: `.omo/evidence` (no ulw-loop plan exists; fallback caller evidence directory used)
Observed tree: `a56a51bc6bbc0bbdb95c1df261b59ff165ce1bf4`
Scope: owner navigation, named-reviewer completion workflow, fresh-laptop resume, 14 links, 46 source paths at declared snapshot, review-head fields, restricted identity, TrainOracle/aaclub distinction, final markers, and false-activation guard. No product docs edited.

## Verdict

PASS. The post-fix packet bundle is navigable and reproducible for the declared 46 source paths. All 14 packet links resolve to non-empty files; all 15 index/packet documents expose `review_head_sha`; restricted identity rules are present in the affected packets; final markers and UTF-8 checks pass. Named-reviewer completion is only simulated as an `UNRESOLVED` record with an opaque identity reference; no human approval or activation is asserted.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| QA-OWNER-POSTFIX | owner navigation and boundary comprehension | local UTF-8 filesystem / CLI-shaped README | `Get-Content -Encoding UTF8 reports/review/appt-packets/README.md; parse 14 role rows and boundary markers` | PASS | `owner-navigation` |
| QA-REVIEWER-POSTFIX | named reviewer can complete the required record without repository identity leakage | local UTF-8 APPT-09 / in-memory parsed record | `Get-Content -Encoding UTF8 reports/review/appt-packets/APPT-09_INDEPENDENT_SECURITY.md; verify required completion fields; validate in-memory synthetic completion` | PASS | `named-reviewer` |
| QA-HANDOFF-POSTFIX | fresh laptop resumes from handoff to packet index | repository-root fresh PowerShell process | `Get-Content HANDOFF_NEXT_CHAT.md; resolve reports/review/appt-packets/README.md; read bundle metadata` | PASS | `fresh-laptop` |
| QA-LINKS-POSTFIX | all 14 advertised links resolve | local filesystem / parsed-data audit | `Parse README links and run non-empty file checks` | PASS | `bundle-audit` |
| QA-SNAPSHOT-POSTFIX | all 46 unique source paths exist at declared source snapshot | Git object database / parsed-data audit | `git cat-file -e 9cf33692741167e1563a881ffec934477c41794d:<each unique source path>` | PASS | `bundle-audit` |
| QA-METADATA-POSTFIX | review_head, identity, naming, markers, and false activation state | local UTF-8 filesystem / parsed-data audit | `Parse README + APPT-01..14 headers and markers` | PASS | `bundle-audit` |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-LINK-POSTFIX | QA-LINKS-POSTFIX | missing/broken navigation target | any missing or empty target fails; observed 14/14 non-empty | PASS | `bundle-audit` |
| ADV-SOURCE-POSTFIX | QA-SNAPSHOT-POSTFIX | unavailable source at declared snapshot | every unique source path must resolve in the declared Git snapshot; observed 0 missing of 46 | PASS | `bundle-audit` |
| ADV-STALE-POSTFIX | QA-SNAPSHOT-POSTFIX, QA-HANDOFF-POSTFIX | stale source identity | handoff and bundle expose explicit SHAs; `review_head_sha` remains `TO_BE_FROZEN_ON_ASSIGNMENT`, so the bundle cannot masquerade as a completed human review | PASS | `bundle-audit`, `fresh-laptop` |
| ADV-IDENTITY-POSTFIX | QA-REVIEWER-POSTFIX | restricted identity leakage | use opaque IDs and restricted outside-Git references; synthetic completion writes no repository identity | PASS | `named-reviewer`, `bundle-audit` |
| ADV-ACTIVATE-POSTFIX | QA-OWNER-POSTFIX, QA-HANDOFF-POSTFIX | misleading success / false activation | retain `runtime_authority: false`, `participant_enrollment: false`, zero named reviews, and no approval effect | PASS | `owner-navigation`, `fresh-laptop`, `bundle-audit` |
| ADV-ENCODING-POSTFIX | QA-METADATA-POSTFIX | unreadable/malformed encoding | UTF-8 decode has zero replacement characters and all 15 final markers remain | PASS | `bundle-audit` |
| ADV-DIRTY-POSTFIX | all scenarios | dirty worktree / unrelated changes | QA must not overwrite or normalize existing changes; dirty state was observed and preserved | PASS | `bundle-audit` |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| `owner-navigation` | CLI transcript | Owner role discovery, 14 IDs, link targets, TrainOracle/aaclub distinction, and activation boundary | `.omo/evidence/trainoracle-appt-postfix-owner-navigation.txt` |
| `named-reviewer` | CLI/data transcript | APPT-09 required fields and in-memory opaque/restricted synthetic completion with no approval effect | `.omo/evidence/trainoracle-appt-postfix-named-reviewer.txt` |
| `fresh-laptop` | CLI transcript | Fresh-process handoff resolution, source SHA, packet count, and false-activation guard | `.omo/evidence/trainoracle-appt-postfix-fresh-laptop.txt` |
| `bundle-audit` | parsed-data audit | 14 links, 46 unique source paths at snapshot, 15 review-head fields, restricted identity, markers, encoding, and state flags | `.omo/evidence/trainoracle-appt-postfix-bundle-audit.json` |
| `manual-qa-matrix` | manualQa matrix | This matrix | `.omo/evidence/trainoracle-appt-postfix-20260722-manual-qa.md` |

Cleanup receipt: no server, browser, port, tmux session, container, temporary directory, or persistent QA process was created; the fresh PowerShell process exited.
