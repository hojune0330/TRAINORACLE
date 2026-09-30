# B06 Availability And Flow Evidence

This is a parent-run focused follow-up to the independent review, not another
100-persona run or an independent approval of all next-frame adaptation.

## Results

- Focused app checks: 40 unique tests passed. UTC and KST repetitions are not added
  together. `focused-final.json` is the final UTC run; the KST run preceded the
  last wording-only clarification in the empty-evidence heading.
- Two new UI tests failed by name before the availability projection was added.
- In-memory mutation `late-response` produces two named failures: late response
  after going back, and response after the current plan changes.
- In-memory mutation `content-match` fails the unchanged-ID/stale-content test.
  The first mutation launch had a config import error and is not counted as a
  successful mutation test. The preserved JSON reports are the repaired named runs.
- Browser follow-up: 9 combinations, three synthetic states (changed plan,
  missing comparison context, supported legacy sibling pair), at 320/375px and
  synthetic 200% text with reduced motion. No horizontal overflow or page errors;
  cycle evidence remained reachable and measured button targets met 44px with a
  1px subpixel tolerance. These are isolated real components and current CSS,
  not a full-app, real-account, real-iOS, or deployment test.
- Actual catalog next-frame transforms remain unsupported. No catalog dose is
  transformed and no stale sibling pair is relabelled as the current plan.
  Cycle summary still compares links to the current snapshot; resolving archived
  journals for remaining-schedule correction is a separate path.

## Reproduction

Copy `entry.tsx`, `run.cjs`, and `mutation.config.ts` into a new directory exactly
two levels below the repo root, for example `.scratch/b06-rerun/`. Do not execute
them directly in this evidence directory: their source imports are relative to
that scratch layout. Run `node .scratch/b06-rerun/run.cjs` from the repo root.
The browser runner uses an isolated loopback server, fresh synthetic browser
contexts, and closes its browser and server. It reads no `.env` or user records.

From `app/`, run the local Vitest binary with the copied mutation config and
`B06_MUTATION=late-response` or `content-match`. Select the corresponding named
tests. Confirm both exit 1 and the expected named failures, not exit code alone.
No tracked product file is modified by the mutation plugin.

Normal test files are the app's `plan-adaptation-ui.contract.test.ts`,
`PlanAdaptationFlow.contract.test.tsx`, and `ActivePlan.adaptation.contract.test.tsx`.
Typecheck and all three server generated-validator checks passed. This slice
does not change those generated server bundles.

[DRAFT_COMPLETE]
