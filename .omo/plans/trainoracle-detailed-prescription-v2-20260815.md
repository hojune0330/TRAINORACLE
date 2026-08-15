# TrainOracle detailed prescription v2 implementation

Base: `546eda90e55d4769adb3519c2ec55e7e7424aa48`

## Decisions

- Competition division is requested only when competition use makes it relevant; `NOT_PROVIDED` must not block generation.
- The 7-day choice means "7일만 먼저 받기": it projects the first seven days of a continuing 9.5-day formation and preserves continuity metadata.
- Both candidates honor the selected energy-system intent. Candidate B changes dose/recovery, not intent.
- Until the explicit dual-quality review flow exists, a day has at most one QUALITY session; the other slot is REST/EASY at RPE 1-3.
- Detailed sessions use three layers: compact notation, plain Korean execution, optional details/help.
- All 30 catalog entries stay inert until lifecycle, eligibility, event/experience scope, youth policy, and named human reviews are accepted. Runtime code must fail closed.
- The 100-400 m specialist plan remains deferred.

## Implementation waves

- [ ] Wave 1: domain contract and generation
  - Make optional division genuinely optional.
  - Honor 7/9/10 requests while retaining 9.5-day continuity.
  - Keep chosen focus in both candidates; produce standard vs reduced dose/recovery.
  - Enforce one QUALITY session per day and companion RPE 1-3.
  - Add focused contract tests.

- [ ] Wave 2: intake, comparison, and active-plan UX
  - One clear question per screen, conditional division, explicit plan-length wording.
  - Mobile summary-first candidate comparison.
  - Three-layer session display and inline RPE help.
  - Group AM/PM without nested cards and preserve accessibility/touch targets.
  - Add component and browser contract coverage.

- [ ] Wave 3: closed detailed-prescription integration
  - Reuse `preparePrescriptionRuntime`; do not parse Markdown at runtime.
  - Add an explicit product flag and approval manifest boundary.
  - Prove flag-off and all 30 unapproved entries return no prescription.
  - Keep original notation for display/audit; never invent unresolved dose.

- [ ] Wave 4: verification and delivery
  - Typecheck, unit/contract, impl, D9, build, and browser suites.
  - Manual QA at 375, 768, and 1280 px for intake -> candidates -> activation -> progress.
  - Independent code, safety, UX/accessibility, and gate review at the final SHA.
  - Commit, push, draft PR, and update durable handoff with exact evidence.

## Human activation gate

Public detailed prescriptions remain closed until each template has recorded owner, coach, sports-science, and youth/minor review plus explicit event and experience eligibility. This implementation may expose the review state, but must not manufacture approval or activate a template.
