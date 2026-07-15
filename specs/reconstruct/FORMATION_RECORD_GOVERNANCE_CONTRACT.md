# Formation Record Governance Contract

```yaml
spec_id: FORMATION_RECORD_GOVERNANCE_CONTRACT
version: 0.1
status: QUALIFIED_REVIEW_PENDING
owner: TOTAL_RESPONSIBILITY_HOLDER
runtime_authority: false
account_linked_sensitive_storage: blocked
youth_guardian_production_flow: blocked
```

## 1. Decision Boundary

This is a review packet, not legal advice or a claim of compliance. Jurisdiction,
service audience, controller/processor roles, lawful basis, special-category status,
retention, transfer, and notification duties require a named qualified reviewer.
Undefined policy fails closed.

## 2. Required Governance Envelope

Every account-linked record class requires all fields below before persistence:

```yaml
RecordGovernanceEnvelope:
  recordClass: required
  purposeId: required_separate_versioned_purpose
  dataCategories: required_closed_list
  allowedRolesAndOperations: required_scope_specific_matrix
  minimizationProfile: required
  retentionMode: required_event_or_duration
  retentionEnd: required
  deletionCascadePolicy: required
  exportPolicy: required
  revocationSuppressionPolicy: required
  legalHoldPolicy: required
  keyDomainAndErasurePolicy: required
  auditMinimizationPolicy: required
  breachPlaybookRef: required
  youthPolicyRef: required
  jurisdictionPolicyRefs: required
  processorAndTransferRefs: required
  policyVersion: required
  qualifiedReviewDecisionRef: required
```

Any missing, `UNRESOLVED`, expired, or mismatched field blocks account-linked
persistence and Formation use. `forever`, implicit inheritance, or a generic catch-all
purpose is invalid.

## 3. Record Classes

| Class | Minimum purpose | Raw note allowed | Current persistence authority |
|---|---|---:|---|
| source | reproduce an accepted structured fact | no | blocked pending envelope |
| safety | target-bound generic hold/review | no | blocked pending qualified review |
| plan | coach-reviewed versioned plan | no | blocked pending later orders |
| hold | prevent execution-enabling operation | no | blocked pending later orders |
| adaptation | record proposed/reviewed change | no | blocked pending later orders |
| consent/grant | prove exact purpose and scope | no note signal | blocked pending jurisdiction policy |
| audit | prove generic operation and allow/deny | no detail/reason | blocked pending minimization policy |
| transaction | minimum payment/legal record only | no journal data | separate payment contract required |

Payment-record retention can never justify retaining a training journal, memo, safety
signal, or derived profile.

## 4. Role And Access Rules

- Athlete: own local journal and explicit export; account rights only after identity and
  jurisdiction policy adoption.
- Coach: no blanket athlete-record access. Each operation requires athlete, team, purpose,
  data category, expiry, and grant-version scope.
- Guardian: no blanket `PRIVATE_SELF_ONLY` or coach-equivalent access. Each request needs
  identity, parental responsibility, current authority, child competence/best-interest
  policy where applicable, and harm/escalation review.
- Friend: no account role. A user may show or send their local file independently; in-app
  recipient sharing remains off.
- Support/security: least privilege, time-bound case access, no raw note by default.
- Analytics/model/reward/marketing: private notes denied; every other purpose separately
  reviewed and optional where required.

Undefined roles, cross-tenant/group access, generic guardian roles, expired grants, and
purpose substitution are denied. Parent and coach cannot override an active or unknown
safety hold.

## 5. Purpose Separation

```yaml
rule_class: OWNER_PRODUCT_GUARDRAIL_STRICTER_THAN_MINIMUM_LAW
statutory_status: KOREA_STATUTORY_CANDIDATE_PENDING_REVIEW
```

The following cannot be bundled into one consent or one unavoidable service switch:

- core local journal.
- account sync.
- training analysis.
- coach sharing.
- friend/recipient sharing.
- safety review.
- AI/model processing.
- research.
- rewards/decorations.
- marketing.
- payment.

Refusing an optional purpose must not remove the base local journal or create streak,
reward, visibility, or training penalties.

## 6. Export, Portability, And Sharing

| Flow | Current decision |
|---|---|
| default local export | allowed; memos excluded |
| explicit owner full local backup | allowed after clear warning and confirmation |
| athlete independently sends/shows created file | outside app recipient flow; service does not track it |
| in-app coach/friend/guardian recipient share | blocked pending recipient-specific contract |
| server share link or raw-memo sync | blocked |

In-app sharing needs recipient identity, purpose, exact fields, memo inclusion off by
default, expiry, revocation, download/re-share behavior, audit, youth handling, and
deletion propagation. Export does not imply analytics consent or change memo purpose.

## 7. Youth State Model

The refusal, no-penalty, layered-notice, and access-minimization rules below are owner
product guardrails that may be stricter than minimum law. They are not claims that an
athlete's refusal universally invalidates guardian consent or every other lawful basis.

```yaml
youth_governance_states:
  - JURISDICTION_UNKNOWN
  - AGE_POLICY_UNRESOLVED
  - GUARDIAN_VERIFICATION_REQUIRED
  - ATHLETE_NOTICE_AND_CHOICE_REQUIRED
  - PURPOSE_GRANT_ACTIVE
  - REFUSED_OR_WITHDRAWN
  - AGE_TRANSITION_REVIEW
  - GUARDIAN_ROLE_DISPUTED
  - ACCOUNT_UNLINKED
```

These are governance states, not D9 dispositions. `JURISDICTION_UNKNOWN`, unresolved
age policy, missing guardian verification where required, athlete refusal/withdrawal,
and guardian dispute block sensitive account processing.

Guardian consent and athlete understanding/assent are separate versioned records.
Under the owner guardrail, guardian agreement does not override athlete refusal for
optional processing. Product notices must be layered and easy for a middle-school
student to understand. Korea's under-14 easy-notice rule is a statutory review candidate;
the five-level explanation for all youth is the broader owner design standard.

Athlete assent is an additional product safeguard. It is not asserted as a universal
legal consent and does not replace an applicable guardian consent or other lawful basis.

At an age-transition milestone, notify the athlete of their own rights; allow confirm,
modify, or withdraw; and separately review guardian access. Do not automatically unlock
all data or assume automatic legal re-consent is universally required. Under the EDPB
consent guidance, reaching the applicable digital-consent age gives the child direct
control to confirm, modify, or withdraw and requires notice of that control; an existing
parental consent is not automatically invalid merely because the child takes no action.

## 8. Rights, Correction, And Appeal

The future product must distinguish:

- view/access.
- correction.
- deletion.
- processing stop/withdrawal.
- voluntary backup export.
- statutory portability.
- challenge to automated or human-reviewed output.

Requests require identity/authority verification without excessive collection. The
workflow must cover source, derived records, indexes, caches, outbox, replicas, restored
backups, grants, and downstream recipients. Exact response times remain jurisdictional
policy; the Korea packet asks the qualified reviewer to validate the applicable ten-day
rights workflow.

False-positive safety review offers a non-diagnostic correction path. The app cannot
silently change a plan while an appeal is pending.

## 9. Retention, Deletion, And Key Erasure

- Each class needs a specific-purpose duration or event-bound end.
- Indefinite retention and `keep while useful` are invalid.
- Withdrawal immediately suppresses new consent-reliant optional processing for that
  purpose. Deletion, mandatory retention, another lawful basis, and core-service effects
  are jurisdiction-specific and are not inferred from withdrawal.
- Deletion covers primary and derived data, index, cache, outbox, replicas, backup expiry,
  and restore suppression.
- Audit keeps only the minimum generic deletion event, not raw content or reason.
- A legal hold requires separate authority, restricted vault, and access policy; it does
  not restore product use. Without accepted policy, production remains blocked.
- Cryptographic erasure requires a reviewed key domain, destruction evidence, and proof
  that plaintext derivatives cannot be restored. See
  [NIST SP 800-88 Rev. 2](https://csrc.nist.gov/pubs/sp/800/88/r2/final).

All numeric periods are `UNRESOLVED_PENDING_QUALIFIED_REVIEW`; no convenient default is
accepted.

## 10. Processors, International Transfer, And Security

No Netlify, database, logging, email, analytics, AI, wearable, error-tracking, or payment
provider may receive sensitive/youth data until its entity, role, region, access country,
subprocessors, fields, purpose, retention, deletion, incident SLA, and transfer basis are
recorded and reviewed.

Minimum security review covers least privilege, MFA, transport/storage encryption,
secret rotation, environment isolation, access logging, backup/restore, deletion,
incident response, and tenant separation. This draft does not claim that browser
`localStorage` is encrypted or secure storage.

## 11. Breach Response

The future playbook must define detection, kill switch, isolation, credential/key
rotation, scope assessment, minimized forensic preservation, processor escalation,
jurisdictional notification decision, athlete/guardian-safe notice, recovery, and
retest. Deadlines are not globally uniform. For Korea, the reviewer must separately
validate: (1) data-subject notice, generally within 72 hours after learning of a breach
under the applicable rule and exceptions; and (2) PIPC/KISA reporting, generally within
72 hours only when a statutory trigger such as scale, sensitive/unique ID data, or
external unlawful access applies. One threshold must never suppress the other path.
FTC HBNR and other jurisdictions need separate applicability decisions.

## 12. Official Source Boundary

- [Korea Personal Information Protection Act](https://www.law.go.kr/LSW/lsInfoP.do?lsiSeq=270351)
  and [under-14 clause](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?ancYnChk=&chrClsCd=010202&lsJoLnkSeq=1029334873).
- [Korea enforcement decree](https://law.go.kr/lsInfoP.do?lsId=011468) and
  [2026 safeguards standard](https://www.law.go.kr/LSW/admRulSideInfoP.do?admRulSeq=2100000281400&chrClsCd=010201&dashNo=&docCls=jo&joBrNo=00&joNo=0006&urlMode=admRulScJoRltInfoR).
- [Korea breach reporting program](https://www.pipc.go.kr/np/default/page.do?mCode=D030040000).
- [Korea PIPC children/youth guide](https://www.pipc.go.kr/np/cop/bbs/selectBoardArticle.do?bbsId=BS217&mCode=&nttId=10896).
- [EU GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/).
- [EDPB consent guidance](https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-052020-consent-under-regulation-2016679_en).
- [EDPB automated decision-making/profiling guidance](https://www.edpb.europa.eu/documents/guideline/automated-decision-making-and-profiling_en).
- [EDPB portability guidance](https://www.edpb.europa.eu/documents/guideline/right-to-data-portability_en).
- [UK ICO Children's Code](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/code-standards/).
- [UK ICO inferred health/special-category guidance](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/lawful-basis/special-category-data/what-is-special-category-data/).
- [UK ICO DUAA 2025 summary](https://ico.org.uk/about-the-ico/what-we-do/legislation-we-cover/data-use-and-access-act-2025/the-data-use-and-access-act-2025-duaa-summary-of-the-changes/data-protection/).
- [FTC COPPA compliance plan](https://www.ftc.gov/business-guidance/resources/childrens-online-privacy-protection-rule-six-step-compliance-plan-your-business).
- [FTC 2025 COPPA final amendments](https://www.ftc.gov/legal-library/browse/federal-register-notices/16-cfr-part-312-coppa-final-rule-amendments).
- [FTC 2026 age-verification policy statement](https://www.ftc.gov/news-events/news/press-releases/2026/02/ftc-issues-coppa-policy-statement-incentivize-use-age-verification-technologies-protect-children).
- [FTC Health Breach Notification Rule guide](https://www.ftc.gov/business-guidance/resources/complying-ftcs-health-breach-notification-rule-0).

These sources define review questions, not a single global policy.

## 13. Open Issues

| ID | Blocking | Status |
|---|---:|---|
| `OI-FRG-JURISDICTION-001` | YES | OPEN |
| `OI-FRG-QUALIFIED-REVIEW-001` | YES | OPEN |
| `OI-FRG-RETENTION-001` | YES | OPEN |
| `OI-FRG-GUARDIAN-001` | YES | OPEN |
| `OI-FRG-RECIPIENT-SHARE-001` | YES | OPEN |
| `OI-FRG-PROCESSOR-TRANSFER-001` | YES | OPEN |
| `OI-FRG-BREACH-001` | YES | OPEN |
| `OI-FRG-RUNTIME-EVIDENCE-001` | YES | OPEN |

## 14. Non-Claims

No clause establishes global legal compliance, qualified privacy approval, account-linked
storage, youth production flow, coach/guardian access, or Formation runtime.

[DRAFT_COMPLETE]
