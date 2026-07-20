# Note Safety Signal And Review State Contract

```yaml
spec_id: NOTE_SAFETY_SIGNAL_AND_REVIEW_STATE_CONTRACT
version: 0.1
status: QUALIFIED_REVIEW_PENDING
owner: TOTAL_RESPONSIBILITY_HOLDER
created_from: [CODEX_WORK_ORDER_011, R-safety-001]
runtime_authority: false
account_linked_persistence_authority: false
```

## 1. Purpose

This contract defines the smallest privacy-safe boundary between local note review and
a future safety hold. It does not diagnose, clear an athlete, notify a coach, or enable
Formation. No implementation is authorized until qualified review and separate runtime
adoption.

## 2. Purpose-To-Consumer Matrix

| Consumer | `PRIVATE_SELF_ONLY` | `ANALYZABLE_TRAINING_NOTE` raw text | Adopted structured safety fields |
|---|---|---|---|
| private local journal | raw text allowed | raw text allowed | display under existing contract |
| local transient evaluator | no invocation | explicit-purpose current entry only | may read allowlisted fields |
| local transient athlete analysis | no invocation | explicit approved purpose only; raw not persisted | local output only |
| persisted/server/downstream analytics and trends | zero-signal | forbidden | separate accepted provenance only |
| model/LLM context | zero-signal | forbidden | default denied |
| Formation/Plan Generator | zero-signal | forbidden | opaque block ref only after adoption |
| coach/guardian surface | zero-signal | forbidden | generic review state only after grant |
| logs/telemetry/audit | zero-signal | forbidden | opaque event ID and state transition only |
| sync/server | zero-signal | raw text forbidden | future accepted envelope only |
| rewards/personalization | zero-signal | zero-signal | forbidden |

`PRIVATE_SELF_ONLY` content, presence, absence, length, frequency, timestamps attributable
to note use, purpose selector events, hashes, embeddings, and derived signals must not
change any non-private output. Explicit owner-selected local export is a user-directed
file operation, not an analytics consumer and not consent to any other processing.

## 3. Existing D9 Dispositions

The existing dispositions remain exactly:

```yaml
d9_dispositions: [D9_CLEARED, D9_ACTIVE, D9_UNKNOWN]
new_disposition_allowed: false
```

This contract does not reinterpret their local transient meaning. It restricts what a
note-origin result may do downstream.

| Local analyzable-note result | Persistable downstream effect | Plan effect |
|---|---|---|
| `D9_ACTIVE` | proposed opaque `BLOCKED` envelope | `BLOCK` operation only |
| `D9_UNKNOWN` | proposed opaque `D9_UNKNOWN` envelope | fail-closed `BLOCK_OR_HUMAN_REVIEW` |
| `D9_CLEARED` | no positive envelope | cannot clear, release, or authorize |
| `D9_CLEARED_WITH_ADVISORY` subtype | no envelope, reason-code persistence, audit, or presence marker | cannot clear, release, or authorize |
| evaluator failure | same as `D9_UNKNOWN` | fail-closed hold/review |

This resolves the note-derived `CLEARED` conflict: a note can raise review attention but
can never prove safety. Release requires a separately accepted structured safety path
and authorized human workflow; silence, deletion, editing, or a later cleared note is
not a release event.

## 4. Proposed Opaque Envelope

```yaml
OpaqueSafetyReviewRef:
  schemaVersion: required_fixed_version
  refId: required_random_nonsemantic_identifier
  tenantScopeBinding: required_opaque_binding
  athleteScopeBinding: required_opaque_binding
  targetType: required_allowlisted_type
  targetBinding: required_content_bound_identifier
  sourceClass: ANALYZABLE_NOTE_TRANSIENT_REVIEW
  safetyGateState: BLOCKED | D9_UNKNOWN
  genericCategory: SAFETY_REVIEW_REQUIRED
  evaluatorContractVersion: required
  evaluationEventRef: required_random_nonsemantic_identifier
  issuedAt: required
  expiresAt: required
  safetyEpoch: required_monotonic
  lifecycle: ACTIVE | SUPERSEDED | REVOKED | EXPIRED
  integrityBinding: required_authenticated_binding
```

`evaluationEventRef` is a CSPRNG registry reference and is never derived from note
content. The trusted registry binds it to the exact target revision and safety epoch.
No raw-note fingerprint, keyed digest, content hash, or cross-record link is allowed.
Exact registry integrity and key custody remain a security-design gate.

## 5. Forbidden Fields And Encodings

- Raw note text, excerpt, quote, token, n-gram, summary, translation, or attachment.
- Plain or unsalted raw-text hash.
- Embedding, sentiment, symptom, diagnosis, body part, injury, medication, or severity.
- Human-readable note-derived reason.
- Note length, word count, language, frequency, presence, selector telemetry, or edit
  distance.
- Identifiers or timestamp precision not required for the target-bound operation.
- Reversible, enumerable, or small-vocabulary reason categories beyond the single
  generic category.

## 6. Validation And Fail-Closed Behavior

| Condition | Result |
|---|---|
| absent ref where target requires safety evaluation | target held; generic unavailable state |
| stale or expired ref | reject; target held |
| wrong tenant, athlete, target, plan version, or content binding | reject; security event without note detail |
| wrong schema/evaluator version | reject; target held |
| invalid integrity binding | reject; target held and incident path |
| evaluator failure or timeout | `D9_UNKNOWN`; save local entry, do not authorize plan |
| consent/purpose revoked | revoke active envelope; target held pending accepted review |
| source entry edited or deleted | supersede envelope; never auto-release target |
| replay or safety epoch rollback | reject |
| undefined state or category | reject |

Verifier output, safety result, and product projection are separate:

```yaml
invalid_envelope:
  verifierResult: REJECTED_ENVELOPE
  safetyResult: D9_UNKNOWN
  operation: BLOCK_OR_HUMAN_REVIEW
  productProjection: GENERIC_BLOCKED_OR_PAUSED_ONLY
mapping:
  D9_ACTIVE: BLOCKED
  D9_UNKNOWN: D9_UNKNOWN
```

An invalid envelope never falls back to `CLEARED`, a previous plan state, a default
reason, or a coach override.

## 7. Access And Projection

- Athlete UI may show: `확인이 필요한 기록이 있어요.`
- Coach/guardian UI is forbidden until Order 011 access policy and the exact grant are
  accepted. When allowed, it receives only the generic review state and permitted action.
- Product copy must say the flag is non-diagnostic and not emergency monitoring.
- Emergency copy must direct the user to local emergency or qualified medical support;
  the app does not continuously monitor or dispatch help.
- Neither parent nor coach can view note content through this ref, infer a reason, or
  override an active/unknown hold through a generic plan action.

## 8. Correction And Appeal

The athlete can report an incorrect state without revealing the note. Correction creates
an append-only case ID, preserves the disputed envelope, and routes to an authorized
human role after governance adoption. The reviewer can confirm a generic hold, request
an allowed structured check, or close the case under a separately accepted release path.
The reviewer cannot edit the athlete's note, generate a diagnosis, or manufacture a
`D9_CLEARED` release.

## 9. Export And Sharing

Current adopted behavior is preserved:

- Default export excludes raw memos.
- The athlete may explicitly choose a local `OWNER_FULL_BACKUP` containing their memos
  after a clear confirmation.
- The local file creates no network request.
- Export choice does not change analytics, coach, guardian, Formation, or sync rights.
- Sending that file to a coach, friend, or another person is an explicit user action;
  the service must not silently upload, preselect a recipient, or claim continued access
  control after the file leaves the device.

`DAILY_LOG_AND_CHECKIN_SPEC.md` now aligns the local file-transport boundary with this
contract. That specification alignment does not itself approve privacy governance,
server sharing, recipient accounts, or runtime promotion.

## 10. Open Issues

| ID | Blocking | Status | Required resolution |
|---|---:|---|---|
| `OI-NSR-QUALIFIED-PRIVACY-001` | YES | OPEN | Named qualified privacy reviewer signs the processing and access boundary. |
| `OI-NSR-CRYPTO-BINDING-001` | YES | OPEN | Security owner defines keyed binding, key rotation, and erasure. |
| `OI-NSR-RELEASE-PATH-001` | YES | OPEN | Safety owner accepts structured human release path. |
| `OI-NSR-EXPORT-DRIFT-001` | NO | RESOLVED_SPEC_ONLY | Daily Log permits only explicit user-selected local file inclusion under preview and confirmation; implementation and qualified review remain separate gates. |
| `OI-NSR-RUNTIME-EVIDENCE-001` | YES | OPEN | RED/GREEN implementation and information-flow evidence. |

## 11. Non-Claims

This draft does not establish legal compliance, medical validity, diagnostic accuracy,
continuous monitoring, coach/guardian access, server persistence, or Formation runtime.

[DRAFT_COMPLETE]
