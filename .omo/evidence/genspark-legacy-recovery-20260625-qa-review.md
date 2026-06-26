# Genspark Legacy Recovery QA Review

Verdict: PASS

Surface: local filesystem

Invocation: `powershell -NoProfile -ExecutionPolicy Bypass -File .omo\evidence\genspark-legacy-recovery-20260625-final-qa.ps1`

Cleanup state: no runtime resources spawned.

## manualQa.surfaceEvidence
| scenario id | criterion reference | surface | exact invocation | verdict | artifactRefs |
|---|---|---|---|---|---|
| S01 | required package artifacts are present/non-empty | filesystem | Get-ChildItem -Force -Recurse .omo\evidence\genspark-legacy-recovery-20260625 | PASS | package-dir, raw-json |
| S02 | local archive present | filesystem | Get-ChildItem -Force -Recurse 'D:\admin\Downloads\trainoracle_genspark_legacy_recovery_20260625' | PASS | local-archive, raw-json |
| S03 | 01-body-text.txt is greater than 400000 bytes | filesystem | (Get-Item .omo\evidence\genspark-legacy-recovery-20260625\01-body-text.txt).Length | PASS | package-dir, raw-json |
| S04 | browser and agent-response PNG artifacts decode and have meaningful dimensions | filesystem + System.Drawing decoder | ReadAllBytes + System.Drawing.Image::FromFile for 01-browser-screenshot.png and 02-agent-response.png | PASS | package-dir, raw-json |
| S05 | 01-link-manifest.json root counts and derived credential marker count | JSON parse | Get-Content -Raw .omo\evidence\genspark-legacy-recovery-20260625\01-link-manifest.json / ConvertFrom-Json | PASS | package-dir, raw-json |
| S06 | material index fields present and evidencePath values resolve to non-empty package artifacts | JSON parse + filesystem | ConvertFrom-Json 02-recovered-material-index.json; Test-Path each materials[].evidencePath | PASS | package-dir, raw-json |
| S07 | COUNT_DELTA and exact limit phrases are present in 03-recovery-report.md | text file | Select-String -Path .omo\evidence\genspark-legacy-recovery-20260625\03-recovery-report.md -Pattern <required literal phrases> | PASS | package-dir, raw-json |
| S08 | adversarial labels present | text file | Select-String -Path .omo\evidence\genspark-legacy-recovery-20260625\03-adversarial-compaction-expiry.md -Pattern <required labels> | PASS | package-dir, raw-json |

## manualQa.adversarialCases
| scenario id | criterion reference | adversarial class | expected behavior | verdict | artifactRefs |
|---|---|---|---|---|---|
| A01 | broad sensitive/credential/control scan has zero exposed hits | credential material exposure | No exposed bearer/API/secret/private-key/signed-query values appear in package or local archive text files. | PASS | package-dir, local-archive, raw-json |
| A02 | compacted history not over-claimed | compaction boundary | Report preserves the exact compacted-history limit phrase. | PASS | package-dir, raw-json |
| A03 | expired links not over-claimed | expiry boundary | Report preserves the exact expired/unavailable-link limit phrase. | PASS | package-dir, raw-json |
| A04 | agent-generated reconstruction not canonical | generated recollection boundary | Report preserves the exact generated-reconstruction limit phrase. | PASS | package-dir, raw-json |

## manualQa.artifactRefs
| id | kind | description | path |
|---|---|---|---|
| raw-json | json | Machine-readable QA review result. | D:\admin\Documents\트레인 오라클 진도\.omo\evidence\genspark-legacy-recovery-20260625-qa-review-raw.json |
| qa-report | markdown | Human-readable QA review report. | D:\admin\Documents\트레인 오라클 진도\.omo\evidence\genspark-legacy-recovery-20260625-qa-review.md |
| package-dir | directory | Scanned evidence package directory. | D:\admin\Documents\트레인 오라클 진도\.omo\evidence\genspark-legacy-recovery-20260625 |
| local-archive | directory | Scanned local raw archive directory. | D:\admin\Downloads\trainoracle_genspark_legacy_recovery_20260625 |

## Notes
- Sensitive scan matched values are not printed.
- Manifest observed: totalLinks=64, links.length=64, credentialQueryRemovedLinks=21, derived marker count=21.
- Body text observed byte length: 410076.
