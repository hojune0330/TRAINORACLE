# Dependency Security Audit

    audit_id: TRAINORACLE-DEPENDENCY-SECURITY-2026-07-29
    base_main_sha: 456d1bbbc85f547b95f823a3dae78b0dd4fd79f2
    execution_model: gpt-5.6-terra
    reasoning_effort: xhigh
    automatic_dependency_change: false
    tracking_issue: #146

## Result

The full dependency audit reports one high-severity advisory in each Node workspace:
PostCSS version 8.5.16, GHSA-r28c-9q8g-f849. The advisory is reachable only through
Vite or Vitest, which are development dependencies. Each production-only audit with
development dependencies omitted reports zero high-severity advisories.

| Workspace | Full audit high | Production-only high | Path | Runtime conclusion |
| --- | ---: | ---: | --- | --- |
| app | 1 | 0 | Vite 6.4.3 to PostCSS 8.5.16 | Build-only; not shipped in the browser bundle. |
| impl | 1 | 0 | Vitest 4.1.10 to Vite 8.1.3 to PostCSS 8.5.16 | Test-only. |
| runtime-evidence/d9-evaluator | 1 | 0 | Vitest 4.1.10 to Vite 8.1.3 to PostCSS 8.5.16 | Test-only. |

PostCSS is not imported by application, implementation, or D9 runtime source. The
published site is static browser JavaScript and CSS; PostCSS executes only while a local
or CI build processes repository-controlled sources.

The production-only audit result is recorded from a fresh `npm ci` dependency state.
It is not used alone: every lockfile marks the PostCSS path as `dev: true`, and
`npm ls --omit=dev postcss --all` finds no production dependency path in all three
workspaces. This guards against a stale installed dependency tree changing how an audit
command groups development dependencies.

## Advisory Classification

| Advisory | Directness | Fix availability | Remediation class | Decision |
| --- | --- | --- | --- | --- |
| GHSA-r28c-9q8g-f849, PostCSS path traversal in previous source-map auto-loading | Transitive | A patch update is available | DEFERRED_DEV_ONLY | Do not make a lockfile-only churn change in this task. Re-evaluate before accepting untrusted CSS or source-map input in a build environment. |

The audit command itself exits nonzero when a development advisory exists. This is not
treated as a production-risk verdict. The parsed metadata and the separate
production-only result are both required for the decision above.

## Boundaries

- No npm audit fix or force upgrade was run.
- No package manifest or lockfile was changed.
- This finding does not authorize ignoring future production-reachable advisories.
- If PostCSS moves into a runtime dependency or the build processes untrusted input, this
  classification is invalid and a fresh patch/minor remediation PR is required.
- GitHub issue #146 tracks the mandatory re-evaluation triggers above.

[DRAFT_COMPLETE]
