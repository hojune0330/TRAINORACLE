# V2-SEED-05 Owner Adoption Decision - 2026-08-17

```yaml
decision_id: TO-V2-SEED-05-OWNER-ADOPTION-2026-08-17
decision_status: APPROVED_FOR_ACTIVE_ELIGIBLE_MANIFEST_ENTRY
authority_role: PRODUCT_OWNER_COACH
authority_id: COACH_HOJUNE
template_id: V2-SEED-05
template_version: "1.0.0"
event_scope: [FIVE_K]
experience_scope: [EXPERIENCED]
population_scope: YOUTH_AND_ADULT
independent_human_review_claimed: false
historical_packet_superseded_only_for_current_activation_state: true
historical_packet_rewritten: false
```

## Decision

The product owner and coach adopts exactly `V2-SEED-05@1.0.0`. This is one
owner authority decision. It does not claim four independent reviewers, an
independent sports-science review, or an independent population review.
Sports-science and population applicability are separately identified,
machine-readable evidence bundles whose canonical bytes are SHA-256 bound in
the trusted manifest.

The 2026-08-16 activation review packet remains immutable evidence of the
earlier `FORBIDDEN` state. This decision supersedes only that packet's current
activation conclusion. It does not rewrite its facts or close unrelated
storage, generator, UI, D9-runtime-evidence, or release issues.

## Source And Adaptation

Direct source reference: `SRC-VDOT-PACES`, <https://vdoto2.com/calculator/>.
The source supports interval-training context and jogging recovery guidance.
It does not prescribe TrainOracle's exact five repetitions, exact 150-second
recovery, warm-up, cooldown, or a youth-specific dose.

The adopted main set is therefore labeled `TRAINORACLE_ADAPTATION`, not a
universal source protocol:

- one set of five 1000 m repetitions at current 5000 m race pace;
- four between-repetition recoveries, each 150 seconds in `JOG` mode;
- `qualityDistanceM=5000` and `recoveryTotalSeconds=600`;
- no cross-event conversion and no goal record as current capability.

## Scope

Eligibility is limited to `FIVE_K`, `EXPERIENCED`, and an explicitly selected
`CURRENT` same-event 5000 m anchor with complete provenance. Youth and adults
use the same criteria and the same dose. Age or school division alone neither
rejects training nor changes repetitions, distance, recovery, pace, or RPE.

Guardian consent and all privacy, account, sensitive/server processing,
synchronization, and sharing authorization remain separate fail-closed
processing controls. This training decision is not a legal conclusion and
does not weaken those controls.

## Operational Components

The source does not prescribe these components. They are versioned
`OWNER_OPERATIONAL_ADAPTATION` decisions:

- `WU-V2-5K-01@1.0.0`: 15 minutes easy at RPE 2-3, then four 20-second
  progressive strides with 40 seconds easy walk/jog between strides.
- `CD-V2-5K-01@1.0.0`: 10 minutes easy at RPE 1-2.
- `RPE-ONLY-CONTROLLED-01@1.0.0`: no numeric reduced-repetition variant;
  atomically delegate to the existing RPE candidate.
- `STOP-V2-5K-01@1.0.0`: precautionary operational rules, not diagnosis:
  `STOP_NEW_OR_WORSENING_PAIN`, `STOP_DIZZINESS_OR_FAINTNESS`,
  `STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING`, and
  `STOP_LOSS_OF_CONTROLLED_FORM`.

## Cryptographic Bindings

```yaml
template_content_fingerprint: sha256:ad4a8c436a5a6e7a9c81342d79b359d84b1b8ea1034f9589141429eea8d0e42a
owner_authority_evidence_fingerprint: sha256:f96b4538082478fc85dd70d7838563039a9e08c4b106b25ea06aaec8e643084a
sports_science_evidence_fingerprint: sha256:43f39eea01053d1cf11afbdac90adc0c6331cd4b36355c16b660b6970d62cbed
population_applicability_evidence_fingerprint: sha256:dddff17cc298cd32ce7cbd6c2ccff6e38034b7e0ff5dd114e40b3893d55b4517
component_fingerprints:
  WU-V2-5K-01@1.0.0: sha256:d8da21478d2a44841122874ccf35c24aad1777ebaaeb018deda3e98a8f9cf6f1
  CD-V2-5K-01@1.0.0: sha256:8d1470171a5edb17a43aa1c21ca34bbfb77456347a68293d2ffe0a5bc52968ab
  RPE-ONLY-CONTROLLED-01@1.0.0: sha256:cd09b06359fcdfb422b421c31dd45a97beeccbdbecaabd1eb7274cdd67ecf3c5
  STOP-V2-5K-01@1.0.0: sha256:737ce6df7f7049530b72f3f52f20a2cbbd32bb83ccf6bfd93c29e25864b4bc29
```

The JSON manifest is the machine authority. The catalog and this report are
human-reviewable records; neither may independently grant runtime authority.

[DRAFT_COMPLETE]
