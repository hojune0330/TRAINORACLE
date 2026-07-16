# Work Order 011 Product-Fact Questionnaire

```yaml
questionnaire_id: TO-WO011-PRODUCT-FACTS-2026-07-16
source_commit: a6857bcdcd9f2989799c505f52773256ce492e14
legal_advice_status: NOT_LEGAL_ADVICE
decision: NOT_ACCEPTED
reviewer: UNASSIGNED
runtime_authority: false
allowed_response_states: [CONFIRMED, UNKNOWN, NOT_APPLICABLE, CONFLICTING_EVIDENCE]
```

This is a factual intake, not a legal questionnaire and not proof of compliance. The
product owner or named operational owner answers each row. `UNKNOWN` is a valid and
required answer when evidence does not exist; it blocks dependent acceptance instead of
being converted into an assumption. Every `CONFIRMED` answer needs a stable evidence
reference or dated accountable-owner attestation.

## A. Launch Countries And Ages

| ID | Product-fact question | Current answer | State | Evidence or next action | Fact owner |
|---|---|---|---|---|---|
| PF-LA-01 | Which countries are included at first public launch? | No launch-country decision is recorded. | UNKNOWN | UNKNOWN - total responsibility holder must name included and excluded countries. | TOTAL_RESPONSIBILITY_HOLDER |
| PF-LA-02 | Is access determined by residence, location, nationality, store, or contract entity? | No conflict rule is recorded. | UNKNOWN | UNKNOWN - product/legal operations must define the jurisdiction-resolution rule. | PRODUCT_OWNER |
| PF-LA-03 | What is the minimum athlete age in each launch country? | No minimum age is recorded. | UNKNOWN | UNKNOWN - owner must provide country-by-country age bands. | PRODUCT_OWNER |
| PF-LA-04 | Will under-14 Korean athletes be offered account features? | Not decided; local journal and future account features must be separated. | UNKNOWN | UNKNOWN - owner must explicitly include or exclude this cohort by feature. | PRODUCT_OWNER |
| PF-LA-05 | Will under-13 US children be offered any online/account feature? | US launch and child-directed scope are not decided. | UNKNOWN | UNKNOWN - owner must state audience, actual-knowledge handling, and feature scope. | PRODUCT_OWNER |
| PF-LA-06 | Will EU/UK children receive an information-society service directly? | EU/UK launch is not decided. | UNKNOWN | UNKNOWN - owner must describe offer, audience, and consent-dependent purposes. | PRODUCT_OWNER |
| PF-LA-07 | What launch date and legal/source freeze date apply? | No release date is approved. | UNKNOWN | UNKNOWN - release owner must set both dates and a re-review lead time. | RELEASE_OWNER |

## B. Controller And Processor Roles

| ID | Product-fact question | Current answer | State | Evidence or next action | Fact owner |
|---|---|---|---|---|---|
| PF-CP-01 | What legal entity operates TRAINORACLE and determines core purposes? | No legal entity is recorded in the reviewed repository. | UNKNOWN | UNKNOWN - business owner must provide legal name, country, address, and contact. | BUSINESS_OWNER |
| PF-CP-02 | Who is the privacy contact or representative per launch jurisdiction? | No appointed contact is recorded. | UNKNOWN | UNKNOWN - business owner and reviewer must identify applicable contacts. | BUSINESS_OWNER |
| PF-CP-03 | Can a coach, club, school, or team determine purposes independently? | Future team relationships are contemplated but no operating model is fixed. | UNKNOWN | UNKNOWN - product owner must describe each contracting and instruction model. | PRODUCT_OWNER |
| PF-CP-04 | Which parties process only documented instructions? | No production processor inventory exists. | UNKNOWN | UNKNOWN - vendor owner must complete the purpose/vendor chain before selection. | VENDOR_OWNER |
| PF-CP-05 | Are any joint-controller relationships intended? | None are accepted; operating facts are missing. | UNKNOWN | UNKNOWN - business owner must describe shared decisions, if any. | BUSINESS_OWNER |

## C. Field And Inference Inventory

| ID | Product-fact question | Current answer | State | Evidence or next action | Fact owner |
|---|---|---|---|---|---|
| PF-FI-01 | What journal fields exist in the current local application? | Structured race/session/check-in values, provenance, memo purpose, and optional memo text are stored locally. | CONFIRMED | `app/src/domain/journal-schema.ts`; `app/src/domain/journal-store.ts` at source commit. | APP_OWNER |
| PF-FI-02 | Is `PRIVATE_SELF_ONLY` available to analytics, sync, coach, guardian, audit, reward, model, or Formation? | No; it is zero-signal outside private local view and explicit owner backup. | CONFIRMED | `NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md` sections 2 and 9. | PRIVACY_CONTRACT_OWNER |
| PF-FI-03 | Can `ANALYZABLE_TRAINING_NOTE` raw text leave the transient local evaluator? | No accepted path exists. | CONFIRMED | `NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md` section 2. | PRIVACY_CONTRACT_OWNER |
| PF-FI-04 | Which current race self-checks are display-only? | Tension, condition, goal pace, and mood are stored/displayed but excluded from current analytics. | CONFIRMED | `RACE_SELFCHECK_FIELDS_DECISION.md`; journal-store contract tests. | APP_OWNER |
| PF-FI-05 | What safety outputs may be produced from an analyzable note? | Local D9 result; proposed downstream output is only an opaque generic hold/review ref and is not adopted for persistence. | CONFIRMED | `NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md` sections 3-6. | SAFETY_CONTRACT_OWNER |
| PF-FI-06 | Are health, injury, mood, readiness, or biometric inferences planned from combined data? | Formation research discusses load/readiness concepts, but production inference scope is not accepted. | UNKNOWN | UNKNOWN - research and product owners must enumerate every intended inference and input. | FORMATION_OWNER |
| PF-FI-07 | Are wearable, location, voice, image, payment, or unique-ID fields planned? | No accepted production inventory exists. | UNKNOWN | UNKNOWN - roadmap owner must mark each category included or excluded. | PRODUCT_OWNER |
| PF-FI-08 | Are private-note presence, timestamp, hash, length, frequency, selector, or audit reason collected outside its local boundary? | Contract forbids all such signals. | CONFIRMED | `NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md` sections 2 and 5. | PRIVACY_CONTRACT_OWNER |

## D. Purpose, Recipient, Vendor, And Region Matrix

| ID | Product-fact question | Current answer | State | Evidence or next action | Fact owner |
|---|---|---|---|---|---|
| PF-PR-01 | Which account/server features will launch beyond the local journal? | No account-linked production scope is accepted. | UNKNOWN | UNKNOWN - product owner must list each launch feature and required/optional status. | PRODUCT_OWNER |
| PF-PR-02 | Is local journal use separable from sync, analysis, coach sharing, safety, AI, research, rewards, marketing, and payment? | The governance contract requires separate purposes and no penalty for refusing optional purposes. | CONFIRMED | `FORMATION_RECORD_GOVERNANCE_CONTRACT.md` section 5. | PRIVACY_CONTRACT_OWNER |
| PF-PR-03 | Which recipients can receive raw journal fields in-app? | None are currently authorized. | CONFIRMED | `FORMATION_RECORD_GOVERNANCE_CONTRACT.md` sections 4 and 6. | PRIVACY_CONTRACT_OWNER |
| PF-PR-04 | May an athlete create a local file that includes their memos? | Yes, only through explicit confirmed `OWNER_FULL_BACKUP`; default export excludes memos. | CONFIRMED | App full-export tests and `NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT.md` section 9. | APP_OWNER |
| PF-PR-05 | May the athlete independently show or send that local file? | Yes; it is the athlete's explicit external action, not an app recipient grant. | CONFIRMED | `FORMATION_RECORD_GOVERNANCE_CONTRACT.md` section 6. | PRODUCT_OWNER |
| PF-PR-06 | Which hosting/database vendors and regions will receive account data? | No production hosting or database vendor is approved in this packet. | UNKNOWN | UNKNOWN - vendor owner must name entity, service, region, access countries, subprocessors, and fields. | VENDOR_OWNER |
| PF-PR-07 | Which logging, error, email, analytics, AI, wearable, or support vendors will receive data? | No production vendor inventory is approved. | UNKNOWN | UNKNOWN - vendor owner must complete one row per provider, including an explicit none. | VENDOR_OWNER |
| PF-PR-08 | Which payment provider, entity, region, and journal-data separation apply? | Payment is contemplated but no reviewed production contract is recorded. | UNKNOWN | UNKNOWN - commerce owner must provide provider and strict transaction-data boundary. | COMMERCE_OWNER |
| PF-PR-09 | Will coach, guardian, friend, club, school, researcher, advertiser, or model provider receive any data? | In-app access is blocked; future intended recipients are not fully decided. | UNKNOWN | UNKNOWN - product owner must answer per recipient and exact field. | PRODUCT_OWNER |
| PF-PR-10 | Is any server share link or raw-memo sync intended? | Both are currently blocked. | CONFIRMED | `FORMATION_RECORD_GOVERNANCE_CONTRACT.md` section 6. | PRIVACY_CONTRACT_OWNER |

## E. Retention, Deletion, Backup, And Key Erasure

| ID | Product-fact question | Current answer | State | Evidence or next action | Fact owner |
|---|---|---|---|---|---|
| PF-RD-01 | What is the retention end for every future account-linked record class? | All numeric periods remain unresolved. | UNKNOWN | UNKNOWN - record owner must propose purpose-specific event or duration for each class. | DATA_GOVERNANCE_OWNER |
| PF-RD-02 | How are source, derived, index, cache, outbox, replica, and recipient copies deleted? | A cascade is required but no production topology or SLA exists. | UNKNOWN | UNKNOWN - system owner must provide store-by-store deletion map and proof method. | SYSTEM_OWNER |
| PF-RD-03 | What backup schedule, location, encryption, expiry, and restore process apply? | No server backup design is approved. | UNKNOWN | UNKNOWN - operations owner must provide topology, periods, keys, and restore controls. | OPERATIONS_OWNER |
| PF-RD-04 | How is deletion suppression reapplied after a backup restore? | Required by contract; implementation and evidence do not exist. | UNKNOWN | UNKNOWN - operations owner must define tombstone/suppression behavior and test. | OPERATIONS_OWNER |
| PF-RD-05 | What key domains, rotation, destruction event, and erasure proof apply? | Key-erasure policy is not designed or accepted. | UNKNOWN | UNKNOWN - security owner must define per-class key custody and executable proof. | SECURITY_OWNER |
| PF-RD-06 | What is retained after withdrawal and under which separate authority? | New optional consent-reliant processing must stop; exact retention remains jurisdiction-specific. | UNKNOWN | UNKNOWN - reviewer needs the purpose and record inventory before deciding. | DATA_GOVERNANCE_OWNER |
| PF-RD-07 | Are payment/legal records kept separately from journal, memo, safety, and profile data? | Separation is contractually required; production implementation is absent. | UNKNOWN | UNKNOWN - commerce/system owners must provide schema and access evidence. | COMMERCE_OWNER |

## F. Legal Hold, Breach, And International Transfer

| ID | Product-fact question | Current answer | State | Evidence or next action | Fact owner |
|---|---|---|---|---|---|
| PF-BT-01 | What legal-hold authority, scope, vault, access, expiry, and release process exists? | No legal-hold policy is accepted. | UNKNOWN | UNKNOWN - legal/operations owners must define or explicitly prohibit launch use. | OPERATIONS_OWNER |
| PF-BT-02 | What incident detection, isolation, kill switch, rotation, and recovery capabilities exist? | No production incident architecture is documented for account-linked data. | UNKNOWN | UNKNOWN - security owner must provide system-specific playbook and evidence. | SECURITY_OWNER |
| PF-BT-03 | Who makes notification decisions and contacts authorities, athletes, and guardians? | No named incident roles or contacts are recorded. | UNKNOWN | UNKNOWN - business/security owners must name primary and backup contacts. | BUSINESS_OWNER |
| PF-BT-04 | Which breach clocks and thresholds apply in each launch jurisdiction? | No launch jurisdictions are fixed; global defaults are forbidden. | UNKNOWN | UNKNOWN - qualified reviewer decides after PF-LA-01 and processing inventory. | QUALIFIED_REVIEWER |
| PF-BT-05 | Which international transfers, remote-access countries, and subprocessors exist? | No production transfer inventory exists. | UNKNOWN | UNKNOWN - vendor owner must provide data-flow and access-country register. | VENDOR_OWNER |
| PF-BT-06 | What transfer mechanism, supplementary measures, and re-review triggers apply? | Cannot be decided before vendors, regions, and jurisdictions are known. | UNKNOWN | UNKNOWN - qualified reviewer and security owner assess each transfer. | QUALIFIED_REVIEWER |
| PF-BT-07 | Does breach forensics preserve only minimized data without restoring product use? | The contract requires minimization; no production playbook exists. | UNKNOWN | UNKNOWN - security owner must define evidence scope, access, expiry, and deletion. | SECURITY_OWNER |

## G. Source And Version Register

| ID | Product-fact question | Current answer | State | Evidence or next action | Fact owner |
|---|---|---|---|---|---|
| PF-SV-01 | What repository snapshot is this intake based on? | Commit `a6857bcdcd9f2989799c505f52773256ce492e14`. | CONFIRMED | Git commit identifier recorded in packet header. | REPOSITORY_OWNER |
| PF-SV-02 | Which legal instruments and guidance start the qualified review? | The existing packet lists Korea PIPA/decree/guidance, GDPR/EDPB, ICO, COPPA/FTC, and NIST starting points. | CONFIRMED | `PRIVACY_YOUTH_QUALIFIED_REVIEW_PACKET.md`; `FORMATION_RECORD_GOVERNANCE_CONTRACT.md`. | QUALIFIED_REVIEWER |
| PF-SV-03 | Has currency, effective date, applicability, and official version of every source been verified for launch? | No launch-date verification has been performed. | UNKNOWN | UNKNOWN - qualified reviewer must record official URL, version/effective date, retrieval date, and applicability. | QUALIFIED_REVIEWER |
| PF-SV-04 | What product/spec changes trigger re-review? | Country, age, entity, purpose, field/inference, recipient/vendor/region, retention, sharing, safety, model, breach, or law change must trigger review. | CONFIRMED | This handoff's reviewer sequence and existing qualified-review packet. | PRIVACY_CONTRACT_OWNER |
| PF-SV-05 | Are current app dependencies proof that no provider processes data? | No; dependency manifests alone do not prove deployed network or operational behavior. | CONFIRMED | Repository inspection boundary; runtime/deployment evidence is separately required. | SECURITY_OWNER |

## H. Owner Attestation

The accountable product owner completes this only after every row has an evidence-backed
response. The attestation confirms factual completeness, not legal compliance.

```yaml
attestor_legal_name: REQUIRED
attestor_role: REQUIRED
organization: REQUIRED
source_commit: a6857bcdcd9f2989799c505f52773256ce492e14
evidence_bundle_ref: REQUIRED
unknown_row_count: REQUIRED
conflicting_evidence_row_count: REQUIRED
attestation_date: REQUIRED
signature_or_verifiable_approval_ref: REQUIRED
statement: I_CONFIRM_THE_PRODUCT_FACTS_ARE_COMPLETE_TO_THE_BEST_OF_MY_ACCOUNTABLE_KNOWLEDGE
```

Until the attestation and qualified review are complete:

```yaml
product_fact_intake: INCOMPLETE_WITH_EXPLICIT_UNKNOWNS
qualified_review: NOT_PERFORMED
decision: NOT_ACCEPTED
reviewer: UNASSIGNED
runtime_authority: false
```

[PRODUCT_FACTS_REQUIRE_OWNER_COMPLETION]
