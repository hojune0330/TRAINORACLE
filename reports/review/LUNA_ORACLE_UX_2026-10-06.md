# LUNA Oracle UX Review - 2026-10-06

## Summary

Independent synthetic cognitive walkthrough of first-use Home and Oracle paths. The 16 personas below are fictional review lenses, not recruited users or observed user behavior. They cover 69 explicit actions. No real account, private journal, production data, or production write was used. Static conclusions are labeled separately from browser and test execution.

## Priority Findings

1. **P2, mitigated in the current Profile change: optional context competed with the first three-question action.** The extra-context action and three manager actions were prominent alongside the initial flow. The existing `InfoDisclosure` now places optional context below the result and groups Mari's explanation and three reading routes in one disclosure. The three-question CTA and scored values remain direct; pending status and unfinished-context continuation remain direct too. See `app/src/screens/OracleProfileExperience.tsx:154`, `:168`, `:171`, `:181`, `:190`; layout in `app/src/screens/oracle-profile-v2.css:26` and `:30`. No feature route was removed.

2. **P2, Home ordering is addressed in the current integration tree.** On WELCOME, the first-record action renders before the Oracle example disclosure. This preserves one obvious primary action while keeping the example reachable. Static source: `app/src/screens/home/TrainingHome.tsx:62`, `:67`, `:98`. Keep this ordering and the existing disclosure; no further Home edit was made in this review.

3. **Trends density remains owner-tracked, not independently browser-verified here.** The main reviewer reported two button rows, six empty-result options, an empty coaching area, and an empty return state. Current source puts empty-state explanations and topic choices in disclosures (`app/src/screens/Trends.tsx:187`, `:198`, `:200`), but source inspection cannot establish their rendered first-screen density or back behavior. The main owner reports 35 focused tests passing; their isolated browser journeys were interrupted by the cold-entry failure below. Keep that result owner-attributed until those browser journeys resume.

## Synthetic Walkthroughs

Each line is a static, first-use scenario. The action numbers are counted individually; they do not represent completed browser actions or user outcomes.

| # | Fictional persona | 4-5 action path |
|---|---|---|
| 1 | Min, guest with no records | 1) Land on Home. 2) Locate today's record action. 3) Open Oracle. 4) Leave all questions unanswered and inspect the neutral state. |
| 2 | Jae, unsure whether to begin | 1) Open Oracle. 2) Start the three-question flow. 3) Answer question 1. 4) Answer question 2. 5) Go back one question. |
| 3 | Sora, wants a quick preference result | 1) Open Profile. 2) Start the retained three-question flow. 3) Answer question 1. 4) Answer question 2. 5) Answer question 3 and inspect the result. |
| 4 | Yuna, wants to add meet context first | 1) Open the result view. 2) Expand “훈련·대회 맥락 추가”. 3) Read that context does not add preference score. 4) Open the context editor. |
| 5 | Dae, returning to unfinished context | 1) Arrive with context editing pending. 2) Use the direct “작성하던 추가 맥락 이어가기” action. 3) Return without finishing. 4) Check that the pending warning/continuation remains direct. |
| 6 | Ara, curious about the manager | 1) Open Profile. 2) Expand “마리 안내와 다른 풀이”. 3) Open the training reading. 4) Close it back to Profile. |
| 7 | Jun, expects a saved race record | 1) Open Profile with no records. 2) Expand Mari's disclosure. 3) Open record reading B02. 4) Inspect the missing-record state without assuming personal facts. |
| 8 | Nari, looking for plan-vs-actual | 1) Open Profile. 2) Expand Mari's disclosure. 3) Open comparison C07. 4) Inspect the no-plan-data state. |
| 9 | Hye, wants to revise a result | 1) Open a completed result. 2) Read the visible score. 3) Choose another preference axis. 4) Return to the result without implying training changed. |
| 10 | Sol, guest concerned about persistence | 1) Open guest Profile. 2) Start the question flow. 3) Complete the three answers. 4) Read the transient guest message. 5) Reload and check whether the in-memory guest response remains. |
| 11 | Bo, using a 320px-wide phone | 1) Land on Home at narrow width. 2) Find the primary record action. 3) Expand/collapse the Oracle example. 4) Open Oracle without losing the primary path. |
| 12 | Eun, switching between profile and tools | 1) Open a training tool from Home/Trends. 2) Use its calculator or reading action. 3) Switch to Oracle Profile. 4) Open the reading-library tab. |
| 13 | Tae, using browser Back unpredictably | 1) Open Profile. 2) Start the questions. 3) Answer question 1. 4) Press browser Back. 5) Re-enter Profile and inspect the resulting state. |
| 14 | Mira, browsing nested readings | 1) Open the Oracle library. 2) Open a topic. 3) Move to an adjacent reading. 4) Press browser Back. 5) Return to the library and switch to Saved. |
| 15 | Kyu, encountering account save pending | 1) Open Profile in account PENDING state. 2) Read the direct status. 3) Use “다시 확인”. 4) Confirm the warning/action is not hidden in a disclosure. |
| 16 | Rin, with no score-bearing answers | 1) Open an empty Profile. 2) Confirm no zero score is invented. 3) Expand the manager disclosure. 4) Open and close a general reading. |

## Execution Evidence

**Synthetic/static review:** 16 fictional paths, 69 numbered actions. These are not test results. Home/Profile ordering, disclosures, status placement, and route affordances were checked in source and contract-test intent only.

**Main-agent-reported browser execution:** one isolated cold-entry browser journey stopped with `ReferenceError: Cannot access 'accountBlocked' before initialization` at timestamp `t=1791272716831` (reported screen line 185). I moved `managerDescription` below the `accountBlocked` declaration in `OracleProfileExperience.tsx:108-109`. The main agent said browser verification would resume after this fix; no post-fix browser result had been reported when this independent review ended. This was not a human-user test.

**Main-agent-reported integrated tests:** the main reviewer reported 35 focused tests passing for the Home/Trends/JournalArchive/recommendation fold changes before the Profile initialization error was surfaced. This is not my test execution and does not establish the post-fix Profile state. Subsequent integrated results are recorded separately in `PROGRESSIVE_CHOICE_UX_2026-10-06.md`.

**Checks executed here:** `OracleProfileExperience.tsx` esbuild TSX transform passed; `git diff --check` passed for the three assigned Profile files. My initial focused batch targeted 6 suites and collected 0 tests because Vite failed resolving `src/test/setup.ts` with Windows `EPERM`. After the Profile fix, 4 single-Profile runner attempts also collected 0 tests; the harness stopped during setup/module resolution or temp-file rename with `EPERM`. No assertions ran and no full suite was started. Browser journeys executed by me: 0.

## Changed Files In This Review

- `app/src/screens/OracleProfileExperience.tsx` - progressive disclosure, concise transient guest status, and `accountBlocked` initialization order.
- `app/src/screens/oracle-profile-v2.css` - disclosure layout while retaining touch-sized actions.
- `app/src/screens/OracleProfileExperience.contract.test.tsx` - checks for disclosure reachability, direct unfinished-context continuation, honest guest messaging, visible pending/loading status, and manager routes.
- `reports/review/LUNA_ORACLE_UX_2026-10-06.md` - this review and evidence ledger.

No Home, Trends, JournalArchive, recommendation, production, or account data was changed by this review.
