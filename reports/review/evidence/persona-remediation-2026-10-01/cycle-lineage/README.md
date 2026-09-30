# Same-Cycle Evidence Continuity

Status: LOCAL_REVIEWED_IMPLEMENTATION; production not verified.
Base: `bbbd36ade1ce2bcd2c0420607434a0c00ceeebc7` plus the accompanying scoped changes.
All fixtures are synthetic. No personal account, private diary, credentials or
external service was used. These are not another 100 personas or real users.

## Scope

Exact B03 receipt-chain resolution now also supplies cycle summaries, personal
Oracle and saved-session actual records. Original links stay immutable. A separately
computed current occurrence is display-only. Changed target sessions, wrong dates,
forged links, missing chain hops and other cycles do not gain a match.

Different candidate versions of one physical occurrence cannot manufacture repeated
effort evidence. Conflicting journals remain one conflict. Unreadable original
history is distinct from absent journals. The shared method observation retains
valid actual AM/PM differences, labels planned versus actual slots and leaves
same-prescription RPE comparison excluded.

The direct journal reader opens at actual records, not the long cycle explanation.
Missing distance/time/pace and interpretation limits remain available in a native
disclosure; explicit measurements remain visible. General method entry and each
tab's return position are preserved.

## Evidence

| File | Result and boundary |
| --- | --- |
| `before.json` | New original 8 domain cases: 6 named failures, 2 passes before continuity changes. |
| `slot-mismatch-before.json` | 10 domain cases: the 2 added ACTIVE/ARCHIVED actual-slot cases fail before the independent P2 repair. |
| `after-independent-fix-utc.json` | 6 nearest files, 118/118. After P2 repair, before the last display-only missing-field disclosure change. |
| `after-independent-fix-kst.json` | Same 6 files, 118/118 after that display change. Repeated time zones are not extra cases. |
| `final-reader-details.json` | Final affected reader/method/original-journal UI, 3 files 42/42 UTC. Overlaps preceding checks; not added to a total. |
| `mutation-source.json` | Disabling exact source resolution fails 6 named continuity cases. Product files unchanged. |
| `mutation-occurrence.json` | Reverting to candidate-version grouping fails the cross-version repeated-effort case (2 false observations instead of 1 conflict). |
| `mutation-reader.json` | Restoring original-ID-only reader matching fails the archived-record display case. |
| `mutation-method.json` | Reverting the method projection to current-only fails the actual-record continuity case. |
| `browser-result.json` | 9 real-component browser combinations: 320/375px and synthetic 200% text/reduced motion, cycle/detail/changed-detail. No horizontal overflow, page error, external request or local-storage mutation. |

The four mutation runs precede the final AM/PM finding and disclosure-only change.
They are evidence for their exact named boundaries, not a final full-suite run.
Mutation targets must occur exactly once and report application; setup errors do not
count as successful defect detection. Browser screenshots were regenerated after
the final display change. The direct actual-record heading must be in the viewport,
and returning from the method tab must preserve the reader offset.

TypeScript `--noEmit` passes. A direct ESLint attempt could not run because this
checkout has no ESLint configuration or lint script; it is not recorded as a pass.
No dependencies or new lint setup were installed. Full release gates/build/server
deployment were intentionally not run for this read-only evidence/UI slice.

## Independent Review

GPT-6.1 Sol / ultra was used for this separate read-only review:

- [B06 policy review](B06_POLICY_REVIEW.md): exact context recovery is not authority
  to invent a changed-plan sibling or numerical catalog NEXT_FRAME transform.
- [Initial evidence review](EVIDENCE_CONTINUITY_REVIEW.md): one P2, actual AM/PM
  difference was dropped as if the journal did not exist.
- [Narrow follow-up](EVIDENCE_CONTINUITY_FOLLOWUP.md): that code cause resolved; no
  additional actionable defect in the requested static scope.

Reports are copied verbatim. This reviewer did not execute tests or browser checks.
Runtime evidence above belongs to the main worker, not independent execution.
The final missing-field disclosure was refined after the reviewer inspected the
AM/PM repair; its dedicated UI and browser checks are main-worker evidence.

## Reproduce

The preserved `run.mjs`, `entry.tsx` and `browser.cjs` keep their original relative
paths. To replay, copy them into `.scratch/b06-cycle-lineage-20261001/` at repository
root. Use installed Node 24 and existing app dependencies. No `.env` loading is needed.

```powershell
$env:TZ='UTC'
$env:B06_RUN='replay'
Remove-Item Env:B06_MUTATION -ErrorAction SilentlyContinue
node .scratch/b06-cycle-lineage-20261001/run.mjs src/domain/plan-cycle-lineage.contract.test.ts src/domain/plan-cycle-response.contract.test.ts src/domain/plan-method-observations.contract.test.ts src/screens/plan-beta/SessionExplanation.contract.test.tsx src/domain/oracle-personal-result.contract.test.ts src/screens/plan-beta/PlanAdaptationFlow.contract.test.tsx
node .scratch/b06-cycle-lineage-20261001/browser.cjs
```

For a bounded mutation, use `B06_MUTATION=source|occurrence|reader|method` and a new
`B06_RUN` filename. `reader` requires the SessionExplanation test file. A deliberate
named test failure is expected. Do not overwrite preserved results or deploy this
synthetic harness. The browser uses a temporary loopback server and closes it.

## Remaining

- W1 owner decision on automatic detailed MAIN intensity/full-session time remains
  pending; this patch does not raise either limit.
- B06 catalog successor numerical policy and exact current-context work remain.
- Operational DB0041, account server release, final app release and live account
  verification remain separate. No push, merge or production release is claimed.
- Synthetic text enlargement is not actual iOS Dynamic Type verification.

[DRAFT_COMPLETE]
