# Recovery And Record Start UX Contract

```yaml
status: OWNER_DIRECTED_BOUNDED_IMPLEMENTATION_CONTRACT
version: 1
decision_date: 2026-10-07
authority: owner_request_to_improve_fatigue_and_empty_data_and_record_entry
plan_authority: false
safety_authority: false
new_provider_activation: false
```

## Scope

- Oracle shows a short recovery-record entry, not five mandatory fatigue sliders.
- General body state, workout exertion, pain, sleep and wearable measurements remain separate.
- Reuse existing daily-context choices and journal recording. Do not add a required
  question to quick workout recording or create a new universal readiness score.
- Daily context remains the existing device/account-scoped day note, not online
  journal storage or a time-series of morning/evening observations. State this
  boundary next to its save result. Do not invent observation times for old notes.
- Current-day body selection must not imply absence of pain or medical clearance.
- Workout exertion summaries use accepted explicit observations only. Each retains
  its date and AM/PM context; do not average it with general body state.
- Existing five-dimensional experimental records retain original fields, labels,
  evidence and storage. Keep a named entry to the tool. New input starts unanswered;
  all five explicit values are required only inside this optional legacy experiment.
  Its optional simple mean is called an input average, not a physiological score.

## Getting Started

- Empty Oracle/home offers workout file import and structured race record entry.
- File preview, user-confirmed storage, eligible analysis and provider OAuth are
  different stages. Do not claim importing immediately activates analysis or plans.
- Garmin/COROS file instructions and supported CSV/JSON/TCX/GPX are accessible.
  Apple Health and Samsung Health native exports are not advertised as accepted
  archives. Unsupported health archives receive an explicit explanation.
- Automatic provider linking stays behind existing production gates. Never request
  passwords or upload raw health archives to an external model.
- A saved race result offers the existing pace calculator with that exact record.
  This does not apply a pace to a plan or rewrite earlier prescriptions.
- Confirmed import completion offers a facts-preview action even when file analysis
  is held. No successful preview action is shown for failed/pending-only storage.
- Latest imported facts come first in Oracle summary. When there is no eligible
  recent summary, keep the existing analysis explanation behind a named disclosure.
  Existing records remain visible; additional entry actions may collapse after data exists.

## Record Entry

- Default record purpose is explicit at entry: the highest-record CTA preselects PB,
  other existing entrypoints retain their existing recent-result default.
- Event, minutes, seconds, optional achievement date are clear. Provide a native
  date-picker alongside compatible text entry; never default an unknown date to today.
- Reject non-decimal/scientific/hex time input rather than accepting Number coercion.
- Preserve decimal seconds, exact half-marathon distance, actual/goal distinction,
  account confirmation, save failure draft and existing plan-update confirmation.
- No new physiological capability assessment or currentness rule is introduced.

## Verification Boundary

Focused component and contract tests are not real youth, native health integration,
production OAuth or authenticated account round-trip evidence. Report these separately.
