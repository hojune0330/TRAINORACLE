# Oracle V2 Manual Preview Deployment

Date: 2026-10-05
Status: PUBLIC_PREVIEW_DEPLOYED_NOT_FULL_RELEASE

## Published Version

- Preview: https://hojune0330.github.io/TRAINORACLE/previews/oracle-19b069b4/?app=1&oracleV2=1
- Runtime source: `19b069b4fb371c374f7b8d482a9e63a01617f05b`
- Source branch: `codex/multi-event-pace-release-20261002`
- Pages commit: `8c31a2236ff1e470c09c3797e178c149e814fe9a`
- Previous Pages commit: `9f3f493b52fbc2c069a4b1b5a2b17e8d51cad3d5`
- Added path only: `previews/oracle-19b069b4/` (162 files).
- Main site files were not replaced. No force push was used.

## Minimum Verification Performed

- TypeScript: passed after removing the unsupported `exact` option from one Testing Library role query.
- Focused `OracleProfileExperience` contract tests: 15/15 passed. The first sandbox run could not initialize because of filesystem EPERM; it executed no tests. The subsequent permitted run passed.
- Production build: passed. Non-fatal font-resolution and chunk warnings remain.
- Git diff whitespace check: passed.
- Pages build: `built`, reported commit matches the Pages commit above, error message null; completed at `2026-10-05T08:27:23Z`.
- Public preview build manifest: HTTP 200; runtime source matches, `previewOnly: true`, `oracleV2Enabled: true`.
- Public browser: application rendered, and the running-profile screen displayed separate user-profile and Mari-manager sections without entering questionnaire responses.
- Full regression, full browser suite, and new persona runs were intentionally not performed for this requested minimal deployment. No claim of green CI is made.

## Release Boundaries

- This is a separate public screen preview, not the full Oracle V2 launch or replacement of the default website.
- Account storage and friend sharing are disabled in this preview. Questionnaire responses are temporary and are not presented as account-saved data.
- No production database migration or function deployment was performed.
- The normal account-enabled build rejected the unreleased legal-document/storage-privacy configuration. The gate was not bypassed; the isolated preview explicitly disables account access instead.
- Real-account save/reopen, friend comparison, and withdrawal round trips remain unverified.
- Newly rejected anonymous-profile artwork and the shoe/leaf explanation board were not imported. Existing Mari assets are reused; the revised external handoff is a separate next task.
- The source commit in this report is the built runtime commit. This report's subsequent documentation commit is not a different runtime deployment.

## Next Work

1. Review the corrected Mari handoff against the role separation: user profile represents the user; Mari is the manager who explains the Oracle.
2. Integrate current main-branch privacy changes and resolve overlapping migration numbering before any account-enabled backend release.
3. Complete the contracted authenticated account-storage and comparison journeys before full activation. Keep their evidence separate from this public screen preview.

Deployment work ended after publishing and confirming this preview. Production backend work and default-site replacement were not started in this deployment step.
