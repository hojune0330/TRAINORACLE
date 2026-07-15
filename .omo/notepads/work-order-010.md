# CODEX_WORK_ORDER_010 Execution Notepad

## Objective

Produce and independently verify the research foundation without granting runtime,
prescriptive, medical, or safety authority.

## RED Contract

- `WO010-R01`: required four research outputs and acceptance decision do not yet exist.
- `WO010-R02`: no source matrix currently binds claim, population, evidence type,
  counterevidence, limitation, applicability, and confidence.
- `WO010-R03`: no deterministic malformed/missing/stale/composite fixture package exists.

Captured before output creation: exit code 1, six expected failures (five required
decision/research files absent plus calculation fixture package absent).

## Manual QA Scenarios

- `WO010-QA01` CLI/data: extract every external claim and verify a direct source URL;
  PASS when uncited factual claims equal zero.
- `WO010-QA02` CLI/data: run policy scans for diagnosis, injury-risk, safety,
  prescription, or automatic plan authority; PASS when every occurrence is a clear
  prohibition/non-claim.
- `WO010-QA03` CLI/data: inspect preset decisions; PASS when each current value is
  `maintain`, `adjust_proposal`, or `unknown` with population/applicability notes.
- `WO010-QA04` CLI/data: inspect calculation fixtures; PASS when empty, malformed,
  stale, mixed-unit, low-sample, composite, and conflicting-source cases fail closed.

## Active Research Lanes

- Sports science and counterevidence.
- Load/component/statistical rules.
- Race descriptive analysis.
- Quick-log preset evidence.

## Completion

- RED: six required outputs absent, exit 1.
- GREEN: five research/fixture outputs present; 34 fixtures and bounded-claim scans pass.
- Executed QA: numeric fixtures pass with exact expected results.
- Independent review: four perspectives failed first review, fixes applied, all PASS.
- Owner decision: `ACCEPT_RESEARCH_BOUNDARY_ONLY`; runtime and shared output remain off.
