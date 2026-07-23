# WO017 Onboarding Motivation Scenarios

```yaml
artifact_type: documentation_only_scenarios
primary_worker: gpt-5.6-terra
reasoning_effort: xhigh
implementation_authorized: false
runtime_authority: false
fable_head_sha: f900793601aa6e1409efb5ee8f756c3924f45549
controlling_issue_url: https://github.com/hojune0330/TRAINORACLE/issues/100
pr_title: [WO017] Bind onboarding UX to current contracts
pr_url: https://github.com/hojune0330/TRAINORACLE/pull/104
```

These are pre-implementation contract scenarios. They neither run a UI nor assert
runtime behavior. Their purpose is to make later implementation acceptance explicit
without granting it.

## SCENARIO-PAIN-MOOD

```yaml
given:
  structured_evening_pain: present
  explicit_evening_mood: present
when: a_local_record_is_saved
then:
  receipt_target: pain_timeline
  mood_confirmation: mood_saved_confirmation
  receipt_precedence: evening_pain > evening_mood > post_session_distance > generic_local_save
not_allowed:
  - mood_record_loss_claim
  - pain_free_claim
  - medical_advice
  - safety_clearance
  - readiness_or_threshold
source:
  fable_proposal: reports/review/WO017_FABLE_UX_FLOW.md:96-116
  current_evidence: app/src/screens/Trends.tsx:20-67
implementation_authorized: false
```

The current Trends file is evidence that local evening facts can be displayed. It does
not prove the proposed receipt exists. Until implementation is separately authorized,
the explicit product state is documentation-only.

## SCENARIO-PLAN-STUB

```yaml
given:
  optional_router_choice: training_plan_interest
when: the_proposed_plan_interest_route_is_shown
then:
  visible_copy: 서비스 준비 중
  allowed_actions: [journal, back, skip]
  router_choice_persistence: false
not_allowed:
  - plan_request
  - candidate
  - waitlist
  - profile_signal
  - generated_plan
  - personalized_output
source:
  fable_proposal: reports/review/WO017_FABLE_UX_FLOW.md:53-55
  current_evidence: impl/src/plan-generator/generator.ts:3-12
implementation_authorized: false
```

The current generator produces only `PLAN_GENERATOR_STUB`; it is not evidence of a
working planning service. This scenario must never be represented as plan availability.

## SCENARIO-INSUFFICIENT-FACTS

```yaml
given:
  structured_evening_pain: absent_or_unverified
  explicit_evening_mood: absent_or_unverified
  valid_post_session_distance: absent_or_unverified
when: no_higher_priority_current_local_fact_exists
then:
  receipt_target: generic_local_save
  message_scope: local_save_confirmation_only
  insufficient_state: explicit
not_allowed:
  - zero_fill_for_missing_facts
  - inferred_recovery
  - inferred_training_load
  - readiness_score
  - safety_or_medical_clearance
source:
  fable_proposal: reports/review/WO017_FABLE_UX_FLOW.md:102-109
  authority_boundary: specs/reconstruct/ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT.md:232-305
implementation_authorized: false
```

Missing, stale, conflicting, or unverified information must remain insufficient. It
may not be converted into a reassuring, diagnostic, or prescriptive message by copy,
visual styling, or a proposed decoration.

## SCENARIO-OPTIONAL-ROUTER

```yaml
given:
  existing_local_entry: false
when: a_first_visit_flow_is_eventually_implemented_after_owner_activation
then:
  router_mode: OPTIONAL_ONE_CONTEXT
  direct_record: true
  skip: true
  back: true
  persistence: transient
not_allowed:
  - mandatory_onboarding
  - retained_visit_reason
  - identity_or_account_inference
source:
  fable_proposal: reports/review/WO017_FABLE_UX_FLOW.md:33-76
  current_evidence: app/src/screens/home/FirstPage.tsx:3-5
implementation_authorized: false
```

The phrase "eventually implemented" is a conditional acceptance target only. No UI
implementation, router state, or persistence behavior is authorized by this scenario.

[DRAFT_COMPLETE]
