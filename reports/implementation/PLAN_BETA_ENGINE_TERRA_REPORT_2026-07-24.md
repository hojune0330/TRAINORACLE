# Plan Beta Engine Report

Date: 2026-07-24

## Delivered Scope

- Replaced the plan-generator stub with a deterministic beta engine that parses
  untrusted generation input into strict domain values and returns typed results.
- Preserved the existing D9 -> RVE -> Safety Gate boundary. Only a current
  `SafetyGatePassed` decision can create candidates. `ACTIVE` and `UNKNOWN`
  return empty candidate arrays with structured safety codes and no sessions or
  progression output.
- Generates exactly two deterministic candidate kinds in fixed order:
  `BALANCED`, then `CONSERVATIVE`. Sparse-data prescriptions use duration and
  RPE ranges only; no pace, medical clearance, or scientific personalization is
  emitted.
- Supports beta event groups `MIDDLE_DISTANCE`, `FIVE_K`, `TEN_K`, and
  `GENERAL_ENDURANCE`. Every candidate is marked `BETA`, `DURATION_RPE_ONLY`,
  and `NOT_UNIVERSAL`; this does not claim that the reconstructed 1500 m
  Formation method applies universally.
- Supports 7, 9, and 10 day frames. Seven-day candidates carry
  `SEVEN_DAY_CONTINUITY` metadata. Optional aggregate continuity input retains
  only a prior candidate kind plus ordered progress-state counts and emits
  `PREVIOUS_FRAME_CONTEXT_RETAINED`; it does not modify sessions or infer
  progression.
- Added selection support for `SELF` and `COACH_REQUIRED`, immutable selected
  beta snapshots, and structured progress states `COMPLETED`, `RESTED`,
  `SKIPPED`, and `PAIN_CHECKIN`. No points or rewards are represented.
- Public engine exports include `generatePlanCandidates`, `selectPlanCandidate`,
  and `recordPlanProgress`. The latter two are available from both the package
  index and `plan-generator/generator.ts` for parent-app compatibility.

## Privacy And Safety Boundary

- Plan inputs and outputs do not include raw memo, symptom, injury, medical,
  guardian-note, or pace fields.
- Audits are `STRUCTURED_CODES_ONLY`.
- Malformed, out-of-range, unordered continuity, and safety-blocked input paths
  return typed results rather than throwing.

## Verification

The Windows PowerShell execution policy blocks `npm.ps1`, so the lockfile-pinned
commands were invoked through the equivalent `npm.cmd` executable in `impl/`.

| Command | Observed result |
|---|---|
| `npm.cmd ci` | 46 packages added; 0 vulnerabilities reported. |
| `npm.cmd test` | Exit 0. Vitest: 4 test files passed, 36 tests passed. |
| `npm.cmd run typecheck` | Exit 0. `tsc --noEmit` produced no diagnostics. |

The largest changed production module is `candidates.ts` at 226 nonblank,
non-comment lines; all changed source modules remain at or below the 250-line
ceiling.

No commit or push was performed.
