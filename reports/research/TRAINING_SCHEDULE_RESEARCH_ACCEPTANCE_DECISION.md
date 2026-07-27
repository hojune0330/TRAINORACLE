# TRAINING_SCHEDULE_RESEARCH_ACCEPTANCE_DECISION.md

```yaml
document_metadata:
  doc_id: trainoracle-training-schedule-research-acceptance-decision
  title: Training Schedule Research Intake and Runtime-Use Decision
  version: "0.1"
  status: WORKING_DRAFT_FOR_OWNER_REVIEW
  owner: COACH_HOJUNE
  prepared_at: "2026-07-27 Asia/Seoul"
  source_branch: agent/training-schedule-research-index
  source_commit: d07147e
  canonical_promotion: false
  issue_closure_granted_by_this_document: false
  runtime_evidence_claimed: false
  numeric_template_activation_authorized: false
```

---

## 1. Decision Scope

This review covers the three research documents introduced from the source branch:

| Research artifact | Purpose | Count or scope |
| --- | --- | --- |
| `TRAINING_SCHEDULE_SOURCE_INDEX_2026-07.md` | Public-source and paper discovery index | 60 public records, 24 paper candidates |
| `TRAINING_SCHEDULE_PUBLIC_SOURCES_2026-07.md` | Interpretation limits and representative cases | Marathon, 800-5000 m, 400 m, 400 m hurdles |
| `README_TRAINING_SCHEDULE_RESEARCH.md` | Handoff, grading, and reading order | Research process only |

The branch is accepted into this review as an **evidence inventory and template
synthesis input**, not as a direct-copy training-template library. This document
makes no claim that every link was independently re-opened in the current
environment.

```yaml
research_intake_recommendation:
  proposed_status: ACCEPT_AS_RESEARCH_REFERENCE_AND_TEMPLATE_SYNTHESIS_INPUT
  owner_acceptance_recorded: false
  usable_now:
    - provenance-aware research comparison
    - source-card and glossary vocabulary design
    - manual reviewer worklist
    - test fixtures that are explicitly non-prescriptive
    - candidate extraction for a source-backed session-template review
    - personal-plan candidate design after the exact template gate passes
  not_usable_now:
    - direct copying of a named athlete's numeric dose to another athlete
    - automatic plan selection without a template, athlete input, and safety gate
    - pace, volume, recovery, or progression calculation from an unreviewed source row
    - D9 or medical clearance
```

---

## 2. Verification Performed in This Review

The index was structurally recounted as 60 public records and 24 paper
candidates. The direct-source checks below verify what the cited public pages
say; they do not transfer a session to another athlete.

| Source | Current review result | What is verified | What remains prohibited |
| --- | --- | --- | --- |
| Sweat Elite, Kipchoge typical week | `DIRECT_PAGE_OPENED` | The page reports the named 2017 Kaptagat context and several interval/fartlek examples, including recovery values. | Treating the week, pace, distance, doubles, or recovery as a default plan for any TrainOracle athlete. |
| SpeedEndurance, Richard Buck session/taper | `DIRECT_PAGE_OPENED` | The page reports one named 400 m session and a 10-day taper snapshot for Richard Buck. | Converting 400 m examples into the current non-sprint plan generator or a youth/solo default. |
| World Athletics 400H typology | `URL_RECORDED_DIRECT_FETCH_UNAVAILABLE` | The research index records an official technical source and its event scope. | Repeating detailed 400H numbers without an independently reviewable extraction. |
| PubMed paper candidates | `BIBLIOGRAPHIC_CANDIDATE_ONLY_IN_THIS_REVIEW` | The index records identifiers and stated transfer cautions. | Treating a title, abstract, or blocked page as dose authority or youth applicability evidence. |

The direct-page review supports provenance labels and source cards. It does not
upgrade any catalog entry or paper candidate to runtime authority.

---

## 3. Source-Class Use Policy

| Source class | May be used now | Required label | Never use it for |
| --- | --- | --- | --- |
| `A_OBSERVED` | Public case comparison, attributed example card, and exact-template extraction candidate | `공개 사례 · 검토 후 개인화 가능` | Copying a named athlete's dose, pace, double day, or taper directly into another athlete's plan |
| `B_TECHNICAL` | Session-purpose vocabulary, reviewer worklist, and source-backed template candidate | `기술 자료 · 선수별 검토 필요` | A universal repetition, intensity, recovery, or periodization rule |
| `C_MEDIA` | Discovery and provenance context | `기사 요약 · 원문 재확인 필요` | Numeric template activation before a primary/technical source is verified |
| `D_CREATOR` | Search discovery and user-language research | `영상/크리에이터 · 타임스탬프 확인 전 후보` | Visible repetitions, pace, or recovery values unless the exact video segment is reviewed |
| `E_REDDIT` | User questions, misunderstanding patterns, and UX research | `사용자 경험담 · 처방 근거 아님` | Performance, safety, dosing, or elite-practice claims |
| Paper candidate | Research question framing and human-review queue | `논문 후보 · 표본/종목/연령 검토 필요` | Automatic transfer to minors, solo users, another event, or another phase |

The labels must stay visible whenever a research example appears in a future
product surface. A source class is provenance, not a safety state and not a
quality score for a specific athlete. `A_OBSERVED` and `B_TECHNICAL` can become
inputs to a personal plan only through the exact gate in Section 5; all other
classes remain research/discovery inputs until upgraded with new evidence.

---

## 4. Runtime Boundary

The current detailed catalog is deliberately a reconstructed draft. Its empty
event and experience eligibility arrays are a zero-eligibility fence. This
research intake neither changes those fields nor creates a mapping to the
Template Library.

```yaml
runtime_boundary:
  research_index_is_template_library: false
  research_index_is_runtime_import_source: false
  research_index_can_seed_template_synthesis: true
  current_catalog_runtime_authority: false
  current_catalog_numeric_template_activation: forbidden
  all_current_catalog_entries_remain:
    lifecycleStatus: DRAFT
    eligibilityStatus: REVIEW_REQUIRED
  high_intensity_candidate_policy:
    visible_to_solo_user: true
    numeric_detail_without_accepted_template: forbidden
    allowed_fallback: RPE_ONLY_SELECTABLE
  D9_ACTIVE_or_UNKNOWN:
    blocks_plan_generation: true
    can_be_cleared_by_research_source: false
```

Research may improve a future explanation such as “why this session purpose is
often discussed in a distance-running context.” Once the Section 5 gate passes
for a specific template, the **accepted template** may supply the session
structure while the athlete's permitted same-event anchor, chosen goal, available
days, requested 7/9/10-day frame, and selected candidate determine the personal
plan. The raw research row itself may not set a person's pace, distance, repeat
count, recovery, readiness, medical status, or next-cycle progression.

---

## 5. Required Gate Before Personal Numeric Use

An exact notation such as `2×(10×400m) @5000m RP · r60″ · R3′` may appear in a
reader, a test fixture, or an attributed research example. It may become a
selectable **personalized** detailed plan only after **every** gate below records
a pass for the exact template ID and version.

| Gate | Required evidence | Failure outcome |
| --- | --- | --- |
| Exact extraction | Original source URL, quotation-sized factual extraction, event, phase, repeat/distance, anchor, and recovery all independently recorded | `REVIEW_REQUIRED_DETAIL` |
| Source and transfer review | Named reviewer accepts the source population, event, phase, and transfer limits | `REVIEW_REQUIRED_DETAIL` |
| Template mapping | Explicit Template Library event group and experience-band mapping; no empty eligibility arrays | `REVIEW_REQUIRED_DETAIL` |
| Minor policy | Exact youth evidence and any required consent/human-review policy are recorded | No minor numeric activation |
| Athlete anchor | Same-event, fresh, permitted anchor with its provenance; otherwise RPE-only | `RPE_ONLY_SELECTABLE` |
| Personal-plan input | User-selected event, goal, available days, requested 7/9/10-day frame, and candidate choice are present | Do not create a personal plan |
| Safety gate | `D9_CLEARED` through the existing Safety Gate; never a medical-clearance label | No plan activation |
| Numeric integrity | Parsed/derived repetitions, distance, and recovery are safe integers within documented limits | Reject the detail instead of rounding it |
| Runtime evidence | Unit, migration, browser, and deployed build evidence for the exact path | Keep source/template state non-runtime |

`GOAL` alone, raw free text, a stale result, a cross-event result, or a favorable
physiological source cannot satisfy the anchor or safety gate. A valid goal can
participate in candidate selection but cannot masquerade as a current performance
record.

---

## 6. Enabled Next Uses for the Implementation Track

The following work can start without pretending the corpus is a prescription
library:

1. Preserve the original event family, phase, source class, uncertainty, and
   “what the source does not say” on future research cards.
2. Use the public taxonomy to improve plain Korean labels for planned intent:
   recovery, basic endurance, sustained pace, repeat intervals, late-race
   tolerance, and short acceleration. These are plan-purpose labels, not a
   measured energy-system result.
3. Extract `A_OBSERVED` and `B_TECHNICAL` material into reviewable session
   templates. After the exact gate passes, use the template structure plus the
   athlete's same-event anchor and chosen 7/9/10-day candidate to create a
   personal plan; never copy the source athlete's number as the new athlete's
   number.
4. Offer self-guided users every high-intensity intent candidate. Before a
   detailed template and valid anchor exist it is RPE-only; afterward it may show
   the accepted repeat, recovery, and pace structure with its provenance.
5. Keep `100 m`, `200 m`, and `400 m` dedicated plan generation deferred while
   allowing current supported event groups to describe a 30 m acceleration
   component only when its own template gate passes.
6. Create a reviewer queue for the high-value gaps named in the research report:
   another observed marathon week, first-hand middle-distance and 400 m/400H
   cycles, and timestamped video extraction.

No item in this section authorizes automatic volume changes, a default double
threshold day, an elite-plan copy, or a user-facing claim that TrainOracle has
validated a particular famous athlete's programme. The desired result is a
personal plan with transparent evidence, not a celebrity-plan copier.

---

## 7. Open Decisions and Handoff

| ID | Status | Decision needed before numeric runtime use |
| --- | --- | --- |
| `OI-RESEARCH-OWNER-ACCEPTANCE-001` | OPEN | Owner accepts or rejects the proposed `ACCEPT_AS_RESEARCH_REFERENCE_AND_TEMPLATE_SYNTHESIS_INPUT` status. |
| `OI-RESEARCH-TEMPLATE-MAPPING-001` | OPEN | Coach and sports-science reviewers map one exact, source-verified template to a supported event/experience scope. |
| `OI-RESEARCH-YOUTH-TRANSFER-001` | OPEN | Youth transfer and consent requirements are approved per template; there is no corpus-wide minor shortcut. |
| `OI-RESEARCH-PRIMARY-EXTRACTION-001` | OPEN | Primary/first-hand 400 m and 400H cycle extraction is completed before those event lines are opened. |
| `OI-RESEARCH-RUNTIME-EVIDENCE-001` | OPEN | Runtime path proves that research provenance cannot bypass source/eligibility/D9 gates. |

This document does not close an issue, canonically promote a specification, or
mark a numeric template accepted. Its job is to make the next work safe and
traceable.

---

## 8. Validation Record

```yaml
validation:
  structural_recount_required:
    public_source_rows: 60
    paper_candidate_rows: 24
  required_command: node specs/test-packages/validate-training-schedule-research-acceptance.mjs
  validator_must_reject:
    - missing_or_nonfinal_decision_marker
    - research_intake_claiming_runtime_authority
    - numeric_activation_without_the_forbidden_boundary
    - changed_public_or_paper_row_count
    - missing_source_class_use_limits
```

[DECISION_COMPLETE]
