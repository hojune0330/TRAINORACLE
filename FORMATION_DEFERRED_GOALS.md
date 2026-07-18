# Formation Deferred Goals

```yaml
status: DEFERRED_GOAL_REGISTER
current_runtime: NONE
latest_owner_baseline: reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md
product_identity: 9_5_DAY_FORMATION_FIXED_NOT_DEFERRED
default_selection_direction: DEFAULT_AUTOMATED_PRESCRIPTION_FIXED_NOT_DEFERRED
activation_status: DEFERRED_PENDING_NAMED_GATES
remaining_deferred_scope: ACTIVATION_SAFETY_PRIVACY_HUMAN_REVIEW_IMPLEMENTATION_DEPLOYMENT
rule: "A deferred item is not silently implemented while its required review is missing."
```

The product identity and default-selection direction are no longer deferred: eligible input is
intended to yield exactly one deterministic primary 9.5-day plan, while no eligible candidate yields
`NO_AUTOMATED_PLAN -> KEEP_CURRENT_COACH_AUTHORED_PLAN`. This direction does not activate runtime.
Safety, privacy, named human review, implementation, and deployment remain deferred as listed below.

| Goal | Deferred state | Why it is not built now | Reactivation condition | Current prohibition |
|---|---|---|---|---|
| Sports-science evidence and counterevidence review | `RESEARCH_BOUNDARY_ACCEPTED_RUNTIME_DEFERRED` | Order 010 added primary-source and counterevidence review, but the 9.5-day architecture remains an unvalidated coach hypothesis. | Strict acceptance metadata plus accepted downstream rules and runtime evidence. | No scientific effectiveness or safety claim. |
| Load, component, and statistical rules | `DESCRIPTIVE_CONTRACT_ACCEPTED_RUNTIME_DEFERRED` | Order 010 accepted descriptive units, missingness, deduplication, and comparison boundaries only. | Executable RED/GREEN implementation tests and strict downstream acceptance. | No readiness, fatigue, injury-risk, percentile, or threshold calculation. |
| Coach rules for frame, MAIN, race, taper, and exceptions | `WALKTHROUGH_PREPARED_OWNER_RESPONSE_BLOCKED` | The versioned registry, 30 synthetic fixtures, and owner walkthrough are ready; Order 011 and the coach response remain unaccepted. The default-selection product direction is fixed, but these executable rules are not. | Coach completes every response and approves the registry after Order 011. | No active runtime prescription, plan execution, or exception decision. |
| Athlete-visible shadow protocol | `MATERIALS_PREPARED_PARTICIPANT_GATE_BLOCKED` | Baseline, monitoring, 37 synthetic scenarios, participant guide, and independent-review forms exist; all forms say `NOT_VALID_FOR_ENROLLMENT`. | Accepted upstream orders plus informed named athlete and independent reviewer approval. | No hidden or executing shadow run. |
| Privacy, youth, retention, deletion, and governance | `QUALIFIED_HANDOFF_PREPARED_REVIEW_BLOCKED` | The 49-row product-fact questionnaire and review handoff are ready, but unresolved product facts and a qualified reviewer remain absent. | Product facts completed, qualified reviewer enrolled, and governance envelope approved. | No Formation persistence or in-app data sharing. |
| Product projection and explanations | `STATIC_PROTOTYPE_RENDERED_HUMAN_REVIEW_BLOCKED` | The isolated synthetic prototype and automated multi-viewport evidence exist; named athlete, coach, accessibility, and privacy reviews do not. | Dedicated human design/accessibility/privacy review with athlete and coach feedback. | No Formation screen that appears to be coach authority. |
| Calendar/version binding and backend fixtures | `TARGET_MAP_PREPARED_DEPENDENCIES_BLOCKED` | The 36 fixtures now map to 2 current targets, 5 future seams, and 29 not-yet-existing targets; upstream orders and architecture remain unaccepted. | Accepted source bundle, upstream orders, owner-approved target plan, and executable runtime fixtures. | No plan persistence, syncing, or implementation shortcut. |
| Race descriptive analysis | `RESEARCH_BOUNDARY_ACCEPTED_RUNTIME_DEFERRED` | Order 010 defined descriptive scope, low-sample behavior, and interpretation limits without prediction or prescription authority. | Strict acceptance metadata and executable implementation evidence. | No causal or plan-changing race analysis. |
| Recipient-specific optional memo sharing | `OWNER_CHOICE_PRESERVED_PRODUCT_AND_PRIVACY_REVIEW_DEFERRED` | The owner approved user-chosen sharing with a coach, friend, or other recipient, but exact recipient scope, confirmation, revocation, youth rules, transport, and retention are not accepted. Local `OWNER_FULL_BACKUP` plus user-directed manual sending remains distinct and available; in-app sharing is not built. | Qualified privacy review, explicit recipient/scope preview, revocation/deletion behavior, youth safeguards, and owner-approved UI contract. | No default, inferred, automatic, guardian-wide, coach-wide, or shadow-flow raw-note sharing. |

## Reactivation Rule

When one goal is ready for review, create a bounded decision packet for that goal only. It must name the owner, source evidence, tests, data boundary, and the behavior that remains prohibited. Passing one row never activates another row automatically.
