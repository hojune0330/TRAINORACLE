# MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md

```yaml
doc_id: trainoracle-spec-019-media-and-transient-capture
spec_id: MEDIA_AND_TRANSIENT_CAPTURE_SPEC
title: TrainOracle Media And Transient Capture Spec
version: "0.1"
round: WORK_ORDER_003_TASK_1
status: DRAFT_FOR_REVIEW
owner: COACH_HOJUNE
source_state:
  local_original_found: false
  new_productization_draft: true
  restored_original: false
  previous_approved_version_restored: false
source_acceptance_decision_state: PENDING_REVIEW
open_issues_total: 7
canonical_blocking_count: 4
executed_tests_total: 0
executed_tests_passed: 0
self_check_is_runtime_evidence: false
canonical_promotion_allowed: false
issue_closure_claimed: false
runtime_evidence_claimed: false
```

---

## 1. Purpose

`MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md` defines how TrainOracle may handle photo attachments, voice memo capture, and photo display references without persisting sensitive raw media content, raw athlete text, raw symptom clauses, raw filenames, or private external LLM prompts.

This document addresses the three `GAP_SPEC_MISSING` rows from `SPEC_SCREEN_TRACEABILITY_MATRIX.md` for:

- `ui_kits/trainoracle-app-v3/LogEntry.jsx` photo attachment row
- `ui_kits/trainoracle-app-v3/LogEntry.jsx` voice memo input
- `ui_kits/trainoracle-app-v3/LogDetail.jsx` and `design-v3/screens/03_LogDetail.html` displayed photos / `PHOTO - track_0708.jpg`

This is a productization draft. It is not runtime evidence, not canonical promotion, not a storage implementation, not a UI implementation, and not issue closure.

---

## 2. Non-Purpose

This document does not:

- modify `app/`, `ui_kits/`, `preview/`, `design-v3/`, `designs/`, `colors_and_type*.css`, or root `index.html`
- create final database schema, bucket policy, object storage vendor selection, or upload endpoint names
- authorize external LLM processing with private athlete data, raw photos, raw audio, raw transcript text, or private prompts
- store raw athlete free text, raw memo text, raw symptom clauses, injury narratives, medical notes, rehab notes, evidence clauses, guardian private notes, raw audio, or raw transcript text in audit records
- treat a photo, audio memo, transcript, or media-derived observation as medical clearance
- clear `D9_ACTIVE`, `D9_UNKNOWN`, Safety Gate blocks, human-review requirements, physio-source conflicts, or template eligibility failures
- define computer-vision diagnosis, medical image analysis, injury classification, or return-to-play clearance
- close `OI-DLC-RAW-NOTE-REDACTION-001`, `OI-AVD-EXPORT-TOOLTIP-PRIVACY-001`, `OI-PORP-EXTERNAL-LLM-POLICY-001`, or any downstream issue

---

## 3. Source Basis

This draft was created only after local target-file search found no existing `specs/reconstruct/MEDIA_AND_TRANSIENT_CAPTURE_SPEC.md`.

| Source | Treatment |
|---|---|
| `SPEC_SCREEN_TRACEABILITY_MATRIX.md` | Identifies the three media/transient `GAP_SPEC_MISSING` target surfaces. |
| `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND3.md` | Accepts Analysis/Visualization, Daily Brief/Inbox, Microcycle/Calendar, and Plan Output Rationale Privacy as working sources only for downstream target patches. |
| `specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md` | Provides daily check-in boundary, `memo_policy`, raw-text storage ban, and transient processing rules. |
| `specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | Requires source refs, confidence/uncertainty, stale/missing/conflicting display states, and no raw text in analysis outputs. |
| `specs/reconstruct/PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | Provides sourceRefs, privacy tiers, redaction states, rationale privacy, and external LLM private-data prohibition. |
| `specs/active/APP_IMPLEMENTATION_BRIDGE.md` | Owns storage, capability, consent, audit, and endpoint bridge decisions after this draft is accepted. |
| `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md` and `specs/reconstruct/PLAN_SAFETY_GATE_SPEC.md` | Define safety signal and pre-generation block/review/allow boundaries that media cannot override. |

---

## 4. Global Invariants

```yaml
media_transient_capture_invariants:
  local_files_are_truth: true
  no_runtime_evidence_claim: true
  no_canonical_promotion_claim: true
  source_acceptance_decision_state: PENDING_REVIEW

  raw_photo_audit_storage_forbidden: true
  raw_audio_audit_storage_forbidden: true
  raw_transcript_persistence_forbidden: true
  raw_filename_audit_storage_forbidden: true
  raw_free_text_storage_forbidden: true
  raw_symptom_clause_storage_forbidden: true
  raw_injury_narrative_storage_forbidden: true
  private_external_llm_with_athlete_data_forbidden: true

  media_can_raise_review_attention: true
  media_can_clear_D9: false
  media_can_clear_SafetyGate: false
  media_can_select_or_modify_plan_options: false

  source_refs_required_for_display: true
  privacy_tier_required_for_display: true
  redaction_state_required_for_display: true
```

---

## 5. Media Source Reference Model

Media surfaces must use a stable reference object instead of raw filenames, raw paths, raw object keys, or private text.

```yaml
MediaSourceRef:
  sourceRef:
    type: string
    pattern: "^media://(local|vault|server)/[a-z0-9][a-z0-9_-]{7,63}$"
    examples:
      - media://local/checkin-photo-a1f0c9d2
      - media://vault/voice-memo-74ab212e
  ownerScope:
    enum:
      - athlete_private
      - coach_visible_with_consent
      - audit_metadata_only
  mediaKind:
    enum:
      - photo
      - voice_audio
      - derived_thumbnail
      - derived_structured_signal
  captureSurface:
    enum:
      - daily_log_photo_attachment
      - daily_log_voice_memo
      - log_detail_photo_display
  sourceState:
    enum:
      - available
      - local_only
      - redacted
      - deleted
      - missing
      - stale
      - consent_withheld
  privacyTier:
    enum:
      - private_raw_media
      - derived_non_sensitive_summary
      - audit_metadata_only
  redactionState:
    enum:
      - raw_not_persisted
      - exif_removed
      - filename_suppressed
      - transcript_discarded
      - derived_fields_only
      - pending_deletion
      - deleted
  displayLabel:
    type: string
    rule: "sanitized non-sensitive label only; never raw filename"
  createdAt:
    type: ISO-8601 timestamp
  retentionPolicyId:
    type: string
  consentSnapshotId:
    type: string
  nonSensitiveReasonCodes:
    type: array
    items: string
```

`sourceRef` may be stored in analysis, rationale, daily brief, inbox, or audit records. Raw file bytes, raw audio, raw transcript text, raw filenames, EXIF payloads, and local filesystem paths must not be stored in audit records.

---

## 6. Photo Attachment Contract

Photo attachments may be offered for user convenience and coach review, but the storage boundary must be explicit before implementation.

```yaml
photo_attachment_policy:
  allowed_capture_surface:
    - daily_log_photo_attachment
  default_storage_location:
    unresolved: true
    allowed_options:
      - local_device_only
      - server_storage_with_explicit_consent
      - deleted_after_review_window
  server_storage_default_allowed: false
  requires_explicit_media_consent_before_server_upload: true
  requires_delete_workflow: true
  requires_retention_policy: true

  exif_policy:
    exif_must_be_removed_before_server_upload: true
    gps_location_must_be_removed: true
    device_identifier_must_be_removed: true
    capture_timestamp_precision_may_be_reduced: true

  audit_policy:
    may_store:
      - sourceRef
      - mediaKind
      - sourceState
      - privacyTier
      - redactionState
      - retentionPolicyId
      - consentSnapshotId
      - nonSensitiveReasonCodes
    must_not_store:
      - raw_file_bytes
      - raw_filename
      - local_filesystem_path
      - object_storage_key_if_user_identifying
      - exif_payload
      - gps_location
      - injury_photo_description_free_text
```

Photos can raise review attention through structured, non-sensitive reason codes such as `MEDIA_ATTACHED_FOR_REVIEW` or `ATHLETE_REQUESTED_COACH_LOOK`. Photos cannot clear existing D9 or Safety Gate risk.

---

## 7. Voice Memo Contract

Voice memo capture is a transient input surface. Raw audio and transcript text are sensitive media/free-text equivalents.

```yaml
voice_memo_policy:
  user_facing_voice_input_allowed: true
  raw_audio_persistence_default_allowed: false
  raw_transcript_persistence_allowed: false
  server_upload_default_allowed: false
  external_transcription_default_allowed: false
  private_external_llm_processing_allowed: false

  allowed_processing:
    - transient_local_capture
    - transient_local_transcription_if_available
    - structured_field_extraction
    - non_sensitive_reason_code_generation
    - immediate_raw_audio_deletion_after_processing
    - immediate_transcript_deletion_after_processing

  persistable_outputs:
    - structured_daily_checkin_fields
    - sourceRef
    - confidence
    - uncertaintyState
    - nonSensitiveReasonCodes
    - redactionState

  forbidden_persistent_outputs:
    - raw_audio_bytes
    - raw_transcript_text
    - raw_athlete_statement
    - symptom_clause
    - evidence_clause
    - injury_narrative
    - medical_note
    - private_prompt
    - external_llm_response_with_private_data
```

```yaml
voice_transcript_d9_precheck_patch:
  patched_from: SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md (N1/T1)
  binding_source: specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md Section 9 and Section 11
  rule:
    - transcript_text_must_be_treated_as_raw_free_text_before_structured_extraction
    - D9_colloquial_layer_evaluation_runs_before_structured_field_extraction
    - D9_colloquial_layer_evaluation_runs_before_non_sensitive_reason_code_generation
  pipeline_outputs_allowed_after_precheck:
    - D9_disposition
    - non_sensitive_reason_codes
    - structured_daily_checkin_fields
    - sourceRef
    - confidence
    - uncertaintyState
    - redactionState
  discard_policy:
    raw_transcript_text_discarded_immediately_after_processing: true
    evidence_clause_discarded_immediately_after_processing: true
    raw_athlete_words_must_not_enter_audit: true
  fail_safe:
    transcription_failed: insufficient_source
    D9_evaluation_unavailable_or_invalid: D9_UNKNOWN
    D9_UNKNOWN_blocks_or_requires_human_review: true
```

If transcription fails, the product must show `uncertaintyState: insufficient_source` or equivalent. It must not silently infer a safe status.

If the transcript exists but the D9 colloquial-layer evaluation cannot run, the voice-memo pathway must fail safe to `D9_UNKNOWN` before any downstream structured extraction or reason-code generation is treated as usable. Only the evaluator disposition and non-sensitive derived outputs may continue; transcript text and evidence clauses must be discarded.

---

## 8. Photo Display Contract

Log Detail may display that a photo exists, but the display must not leak raw filenames or sensitive source details.

```yaml
photo_display_policy:
  display_surface:
    - log_detail_photo_display
    - static_review_summary
  raw_filename_display_default_allowed: false
  sanitized_label_required: true
  allowed_labels:
    - "PHOTO"
    - "PHOTO 1"
    - "coach-visible photo"
    - "local-only photo"
  discouraged_example:
    - "PHOTO - track_0708.jpg"

  required_display_metadata:
    - sourceRef
    - mediaKind
    - sourceState
    - privacyTier
    - redactionState
    - consentSnapshotId

  missing_or_redacted_state_visible: true
```

The current screen text `PHOTO - track_0708.jpg` is treated as a design reference requiring future sanitization. This draft does not modify the design file.

---

## 9. External LLM And Private Media Boundary

```yaml
external_llm_boundary:
  raw_photo_to_external_llm_allowed: false
  raw_audio_to_external_llm_allowed: false
  raw_transcript_to_external_llm_allowed: false
  private_prompt_with_media_context_allowed: false
  future_enablement_requires:
    - explicit security_review
    - explicit privacy_review
    - media_consent_scope
    - redaction_policy
    - audit_policy_without_raw_media_or_private_text
    - opt_out_and_deletion_workflow
```

No media or voice memo pathway may introduce a private external LLM dependency by implication. Any future LLM summarization must consume only approved, non-sensitive structured fields and reason codes unless a separate accepted security/privacy contract says otherwise.

---

## 10. Downstream Consumer Rules

```yaml
downstream_consumption:
  DailyLog:
    may_create_media_source_ref: true
    may_store_raw_media: unresolved_until_AppBridge_patch
    may_store_raw_transcript: false
  AnalysisVisualization:
    may_display_media_presence: true
    may_display_source_state: true
    may_display_raw_filename: false
    may_use_media_to_clear_safety: false
  PlanOutputRationale:
    may_reference_media_sourceRef: true
    may_use_non_sensitive_reason_codes: true
    may_quote_raw_transcript: false
    may_quote_symptom_clause: false
  DailyBriefInbox:
    may_surface_attention_item: true
    may_include_sourceRef: true
    may_include_raw_media_or_transcript: false
  RVE_SafetyGate:
    may_consume_structured_reason_codes: true
    may_raise_review_or_unknown: true
    may_clear_D9_or_SafetyGate_from_media: false
```

---

## 11. Draft Type Shapes

These shapes are contract sketches only. They do not select a database, storage vendor, route name, or UI component.

```ts
type MediaKind =
  | "photo"
  | "voice_audio"
  | "derived_thumbnail"
  | "derived_structured_signal";

type MediaSourceState =
  | "available"
  | "local_only"
  | "redacted"
  | "deleted"
  | "missing"
  | "stale"
  | "consent_withheld";

type MediaPrivacyTier =
  | "private_raw_media"
  | "derived_non_sensitive_summary"
  | "audit_metadata_only";

type MediaRedactionState =
  | "raw_not_persisted"
  | "exif_removed"
  | "filename_suppressed"
  | "transcript_discarded"
  | "derived_fields_only"
  | "pending_deletion"
  | "deleted";

interface MediaSourceRef {
  sourceRef: `media://${"local" | "vault" | "server"}/${string}`;
  ownerScope: "athlete_private" | "coach_visible_with_consent" | "audit_metadata_only";
  mediaKind: MediaKind;
  captureSurface:
    | "daily_log_photo_attachment"
    | "daily_log_voice_memo"
    | "log_detail_photo_display";
  sourceState: MediaSourceState;
  privacyTier: MediaPrivacyTier;
  redactionState: MediaRedactionState;
  displayLabel: string;
  createdAt: string;
  retentionPolicyId: string;
  consentSnapshotId: string;
  nonSensitiveReasonCodes: string[];
}
```

---

## 12. Required Target Patches Before Implementation

This draft can be used as a downstream patch source only after owner review accepts it as a working source.

Required later target patches:

| Target | Required patch | Issue closure allowed now |
|---|---|---|
| `APP_IMPLEMENTATION_BRIDGE.md` | storage location, consent, delete workflow, audit metadata, endpoint/capability boundary | NO |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | media attachment and voice memo sub-record reference to this spec | NO |
| `ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md` | media source display/privacy binding for Log Detail and exports | NO |
| `PLAN_OUTPUT_RATIONALE_PRIVACY_SPEC.md` | media sourceRef privacy boundary for rationale and footnotes | NO |
| `DAILY_BRIEF_AND_INBOX_SIGNAL_SPEC.md` | attention item sourceRef and no raw media/transcript payload rule | NO |

Any target patch must open the target file, recount that target's open issue table, and use relative deltas unless the target table is recounted in the same patch.

---

## 13. Open Issues

These are this draft's own issues. They do not change issue counts in other SPEC files.

| Issue ID | Priority | Canonical blocking | Status | Problem | Required next evidence |
|---|---|---|---|---|---|
| `OI-MTC-APP-BRIDGE-STORAGE-BINDING-001` | P1 | YES | OPEN | App Bridge does not yet own media storage location, consent, retention, deletion, capability, or audit metadata. | Patch App Bridge after this draft is accepted, then recount target issues. |
| `OI-MTC-MEDIA-LIFECYCLE-001` | P1 | YES | OPEN | Photo EXIF stripping, raw filename suppression, sourceRef generation, and retention lifecycle are draft-only. | Add accepted storage lifecycle and implementation tests before any closure. |
| `OI-MTC-VOICE-TRANSIENT-REDACTION-001` | P1 | YES | OPEN | Voice memo capture, local transcription, raw audio deletion, transcript discard, and transcript-before-structure D9 precheck are not implementation-bound. | Patched from `SPEC_SOURCE_ACCEPTANCE_DECISION_ROUND4.md` N1/T1; prove raw audio/transcript cannot persist and D9 evaluation failure maps to `D9_UNKNOWN`. |
| `OI-MTC-RUNTIME-EVIDENCE-001` | P1 | YES | OPEN | No runtime or CI evidence proves media redaction, sourceRef preservation, or deletion behavior. | Add actual terminal or CI logs after implementation exists. |
| `OI-MTC-UI-SURFACE-BINDING-001` | P2 | NO | OPEN | Log Entry and Log Detail screens are design references only and still display media affordances without accepted implementation binding. | Patch UI/screen contracts or implementation after this draft is reviewed. |
| `OI-MTC-EXTERNAL-LLM-POLICY-001` | P2 | NO | OPEN | Future media summarization or transcription through external LLM services is not accepted for private athlete data. | Keep disabled until explicit privacy/security review exists. |
| `OI-MTC-MULTI-AUDIENCE-CONSENT-001` | P2 | NO | OPEN | Athlete-only, coach-visible, guardian-visible, and audit-only media display scopes are not finalized. | Confirm audience-specific consent and copy policy before UI implementation. |

---

## 14. Self-Check

| Check | Result |
|---|---|
| First line is filename H1 | PASS |
| Final marker is final line | PASS |
| Metadata declares `DRAFT_FOR_REVIEW` | PASS |
| Source decision remains `PENDING_REVIEW` | PASS |
| `executed_tests_total` is 0 | PASS |
| Does not claim runtime evidence | PASS |
| Does not claim canonical promotion | PASS |
| Does not close downstream issues | PASS |
| Open issue count is 7 | PASS |
| Canonical blocking count is 4 | PASS |
| Forbids raw media/transcript/private text audit storage | PASS |
| Forbids private external LLM media processing | PASS |
| Media can raise review but cannot clear D9 or Safety Gate | PASS |

[DRAFT_COMPLETE]
