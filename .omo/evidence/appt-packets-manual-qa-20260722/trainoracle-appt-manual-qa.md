# TrainOracle APPT packet bundle manual QA

Bundle: `reports/review/appt-packets/`

Observed tree: `a56a51b`

Scope: reviewer-facing packet navigation only; no product files edited.

## Verdict

PASS. All three reader journeys were executed. The README exposes 14 roles and all 14 links resolve. The selected reviewer packet gives exact review questions and recording fields. The handoff resumes at the packet index and preserves the no-activation boundary. UTF-8 readability, source availability, final markers, TrainOracle/aaclub distinction, and runtime false markers are consistent.

## surfaceEvidence

| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| QA-OWNER-01 | owner finds a role and understands packet boundary | local UTF-8 filesystem / CLI-shaped document | `Get-Content -Encoding UTF8 reports/review/appt-packets/README.md`; extract role rows and markers with PowerShell regex | PASS | `owner-role-discovery`, `bundle-link-source-audit` |
| QA-REVIEWER-01 | named reviewer knows what to review and record | local UTF-8 packet text / CLI-shaped document | `Get-Content -Encoding UTF8 reports/review/appt-packets/APPT-09_INDEPENDENT_SECURITY.md`; extract headings, front matter, sources, questions, and record fields | PASS | `named-reviewer-appt09`, `bundle-link-source-audit` |
| QA-HANDOFF-01 | another laptop worker can resume from handoff | repository-root fresh-checkout-style text surface | `Get-Content -Encoding UTF8 HANDOFF_NEXT_CHAT.md`; resolve `./reports/review/appt-packets/README.md` from repository root | PASS | `fresh-laptop-handoff`, `bundle-link-source-audit` |
| QA-LINKS-01 | all 14 README packet links navigate to usable files | local filesystem / Node parsed-data audit | inline Node `fs` audit parses README links and runs `fs.statSync` on each target | PASS | `bundle-link-source-audit` |
| QA-MARKERS-01 | readability, source availability, final markers, provider distinction, no false activation | local UTF-8 filesystem / Node parsed-data audit | inline Node `fs` audit reads README + APPT-01..14, checks UTF-8, `[DRAFT_COMPLETE]`, 68 source refs, `TrainOracle`, provisional `aaclub`, and `runtime_authority: false` | PASS | `bundle-link-source-audit` |

## adversarialCases

| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| ADV-LINK-01 | QA-LINKS-01 | missing/broken navigation target | every advertised APPT link resolves to a non-empty file; any missing target would fail the audit | PASS | `bundle-link-source-audit` |
| ADV-SOURCE-01 | QA-MARKERS-01 | unavailable source | every packet source reference is present and non-empty; no packet relies on an unavailable cited source | PASS | `bundle-link-source-audit` |
| ADV-ACTIVATE-01 | QA-OWNER-01, QA-HANDOFF-01 | misleading success / false activation | preparation, AI review, or `[DRAFT_COMPLETE]` must not imply human approval, runtime authority, participant enrollment, or approved plans | PASS | `owner-role-discovery`, `fresh-laptop-handoff`, `bundle-link-source-audit` |
| ADV-STALE-01 | QA-HANDOFF-01 | stale handoff/source identity | handoff and packet index expose the same source SHA and direct next entry point; worker is told to freeze the review SHA on assignment | PASS | `fresh-laptop-handoff`, `owner-role-discovery` |
| ADV-ENCODING-01 | QA-OWNER-01, QA-REVIEWER-01 | unreadable/malformed text encoding | UTF-8 content must decode without replacement characters and retain headings/markers | PASS | `owner-role-discovery`, `named-reviewer-appt09`, `bundle-link-source-audit` |
| ADV-DIRTY-01 | all scenarios | dirty worktree / unrelated changes | QA must not overwrite or normalize pre-existing work; observe and report dirty state | PASS | `bundle-link-source-audit` |

## artifactRefs

| id | kind | description | path |
|---|---|---|---|
| owner-role-discovery | CLI transcript | Owner README role discovery, read order, provider distinction, and no-activation observations | `.omo/evidence/appt-packets-manual-qa-20260722/01-owner-role-discovery.txt` |
| named-reviewer-appt09 | CLI transcript | APPT-09 review scope, source list, questions, required record, and boundary | `.omo/evidence/appt-packets-manual-qa-20260722/02-named-reviewer-appt09.txt` |
| fresh-laptop-handoff | CLI transcript | Handoff resume path, actor, SHA, provider distinction, and activation boundary | `.omo/evidence/appt-packets-manual-qa-20260722/03-fresh-laptop-handoff.txt` |
| bundle-link-source-audit | parsed-data audit | 14/14 links, 68/68 source refs, UTF-8, final markers, service/provider/runtime checks | `.omo/evidence/appt-packets-manual-qa-20260722/04-bundle-link-source-audit.json` |
| manual-qa-matrix | manualQa matrix | This QA matrix | `.omo/evidence/appt-packets-manual-qa-20260722/trainoracle-appt-manual-qa.md` |

Cleanup receipt: no process, browser, port, tmux session, or temporary QA resource was created.
