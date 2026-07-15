# Privacy And Youth Qualified Review Packet

```yaml
packet_id: TO-WO011-QUALIFIED-REVIEW-2026-07-15
status: READY_FOR_NAMED_QUALIFIED_REVIEWER
legal_policy_status: NOT_ACCEPTED
reviewer_name: UNASSIGNED
reviewer_qualification: UNVERIFIED
runtime_authority: false
```

## Reviewer Instructions

For every question, record `ACCEPTED`, `REVISED`, `OUT_OF_SCOPE`, or `UNRESOLVED`, with
jurisdiction, source, rationale, and required product/test change. A signature means the
reviewer accepts only the stated scope and version. Blank or unresolved P1 rows block
Order 011 acceptance.

## Product Facts To Preserve

- Local-first journal is the current base service.
- `PRIVATE_SELF_ONLY` is zero-signal outside the private local view and explicit owner
  full backup.
- `ANALYZABLE_TRAINING_NOTE` may enter the already approved explicit-purpose local
  transient athlete analysis, whose raw text is not persisted. It never enters
  persisted/server/downstream analytics, coach/guardian view, server sync, model
  context, Formation, or audit.
- Default export excludes memos; explicit confirmed full local backup includes them.
- In-app recipient sharing, sensitive server storage, guardian flow, and Formation are off.
- Safety flags are non-diagnostic and cannot clear training or override human care.

## Required Decisions

| ID | P | Qualified-review question | Status |
|---|---:|---|---|
| Q01 | 1 | Controller/processor roles, target countries, residence rule, extraterritorial scope | UNRESOLVED |
| Q02 | 1 | Field/output classification: personal, sensitive, health, biometric, inferred | UNRESOLVED |
| Q03 | 1 | Lawful basis by purpose: journal, sync, analysis, coaching, research, reward, marketing, safety | UNRESOLVED |
| Q04 | 1 | Conditional age rules: Korea guardian consent for under-14 processing that requires consent; EU/UK Article 8 only for an ISS offered directly to a child and relying on consent; COPPA for covered child-directed or actual-knowledge under-13 collection | UNRESOLVED |
| Q05 | 1 | Proportionate age assurance, challenge path, and deletion of verification material | UNRESOLVED |
| Q06 | 1 | Parental responsibility verification and guardian change/dispute | UNRESOLVED |
| Q07 | 1 | Guardian consent evidence, purpose/version/time/method, material-change renewal | UNRESOLVED |
| Q08 | 1 | Athlete understanding/assent/refusal/withdrawal and no reward/journal penalty | UNRESOLVED |
| Q09 | 1 | Separate parent/coach/friend access for private note, training note, safety, plan, export | UNRESOLVED |
| Q10 | 2 | Visible notice whenever parental monitoring is active | UNRESOLVED |
| Q11 | 1 | Competent child, confidentiality, coercion/abuse risk, best-interest escalation | UNRESOLVED |
| Q12 | 1 | Age transition: rights notice, modify/withdraw, guardian-scope review, unlink | UNRESOLVED |
| Q13 | 1 | Deletion map and SLA: raw, derived, cache, backup, audit, key, legal hold | UNRESOLVED |
| Q14 | 1 | Access vs statutory portability vs voluntary backup; third-party and inferred data | UNRESOLVED |
| Q15 | 1 | Revocation propagation to recipients, models, analytics, cache, outbox | UNRESOLVED |
| Q16 | 1 | Formation profiling/ADM/significant effect, human intervention and contest | UNRESOLVED |
| Q17 | 1 | Health/injury/readiness inference, special-category condition, DPIA, prohibited scope | UNRESOLVED |
| Q18 | 1 | Specific retention by class; no indefinite retention; payment records separated | UNRESOLVED |
| Q19 | 1 | Breach applicability, clock, contacts, athlete/guardian notice, processor SLA | UNRESOLVED |
| Q20 | 1 | Vendors, wearables, AI, analytics, regions, international transfer, subprocessors | UNRESOLVED |
| Q21 | 1 | Emergency copy, false-positive correction, non-overridable safety boundaries | UNRESOLVED |
| Q22 | 2 | Child-friendly layered notice and five explanation levels; no dark nudge | UNRESOLVED |

## Korea-Specific Verification

The reviewer must validate, not merely copy:

- PIPA Articles 15-18, 20, 20-2, 21, 22, 22-2, 23, 24, 24-2, 26, 28-8, 29-31,
  and 34-38; Enforcement Decree Articles 17-2, 29-7 through 29-10, 30, 39-44; and the current technical-safeguards
  notice. The reviewer records which provisions actually apply.
- Whether each training, sleep, heart-rate, pain, condition, mood, and note field is
  sensitive health information in the proposed processing context.
- Under-14 guardian verification and easy notice.
- Rights workflow and applicable ten-day response handling.
- Recipient-specific third-party provision for in-app sharing.
- Record-class retention and deletion; payment records kept separately.
- Provider/region/subprocessor international-transfer inventory.
- Separate data-subject notice and PIPC/KISA report paths, triggers, exceptions, and
  applicable 72-hour handling; neither path is inferred from the other's threshold.
- Re-review before the 2026-09-11 PIPA amendment takes effect.
- At that release gate, verify the final promulgated enforcement decree/notices, the
  2026-07-01 safeguards standard, and a launch-date legal snapshot. If a final instrument
  is unavailable or changes are not incorporated, Orders 011 and 016 remain blocked.
- Determine whether Korea e-commerce retention applies and validate the candidate
  periods: advertising 6 months; contract/withdrawal 5 years; payment/supply 5 years;
  complaint/dispute 3 years. Never extend those periods to the training journal.

Official starting points:
[PIPA](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=270351),
[PIPC youth guide](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=&nttId=10896),
[PIPC international transfer](https://m.pipc.go.kr/np/default/page.do?mCode=D060040000),
[PIPC breach reporting](https://www.pipc.go.kr/np/default/page.do?mCode=D030040000),
[2026 safeguards standard](https://www.law.go.kr/LSW/admRulSideInfoP.do?admRulSeq=2100000281400&chrClsCd=010201&dashNo=&docCls=jo&joBrNo=00&joNo=0006&urlMode=admRulScJoRltInfoR),
[Korea e-commerce decree Article 6](https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0006&lsiSeq=269055&urlMode=lsScJoRltInfoR),
[future amendment](https://law.go.kr/LSW/lsInfoP.do?lsiSeq=283839&viewCls=lsRvsDocInfoR).

## Cross-Jurisdiction Conflicts To Decide

- COPPA parental access and UK competent-child confidentiality cannot become one blanket
  guardian rule.
- Parental consent is not always required or sufficient; Article 8 applies only in its
  defined consent/ISS setting.
- Age transition does not universally mean automatic re-consent, but the athlete must
  receive control of applicable rights and guardian access must be reviewed.
- A non-executing Formation output can still be profiling.
- Fitness/health inference and multi-source fitness apps may trigger additional health or
  breach regimes.

Official sources:
[GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/),
[EDPB consent](https://www.edpb.europa.eu/system/files/documents/files/file1/edpb_guidelines_202005_consent_en.pdf),
[EDPB ADM/profiling](https://www.edpb.europa.eu/documents/guideline/automated-decision-making-and-profiling_en),
[EDPB portability](https://www.edpb.europa.eu/documents/guideline/right-to-data-portability_en),
[ICO Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/),
[ICO child access](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/right-of-access/how-do-we-recognise-a-subject-access-request-sar/),
[ICO inferred health](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/),
[ICO DUAA 2025 changes](https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-duaa-summary-of-the-changes/data-protection/),
[FTC COPPA](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions),
[FTC 2025 final amendments](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments),
[FTC 2026 age verification policy](https://www.ftc.gov/news-events/news/press-releases/2026/02/ftc-issues-coppa-policy-statement-incentivize-use-age-verification-technologies-protect-children).

## Required Reviewer Record

```yaml
reviewer:
  legal_name: REQUIRED
  organization_or_independent_status: REQUIRED
  qualification_and_jurisdictions: REQUIRED
  conflicts_of_interest: REQUIRED
  reviewed_document_versions: REQUIRED
  decision_date: REQUIRED
  signature_or_verifiable_approval_ref: REQUIRED
  unresolved_p1_count: REQUIRED
  overall_decision: ACCEPTED | REVISED | REJECTED
```

[QUALIFIED_REVIEW_NOT_YET_PERFORMED]
