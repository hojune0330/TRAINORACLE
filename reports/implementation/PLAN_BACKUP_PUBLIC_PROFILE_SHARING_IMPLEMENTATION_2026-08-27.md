# Plan Backup, Public Profile, and Sharing Implementation — 2026-08-27

## Implemented

- Added a private v3 active-plan backup table and account-isolated client service.
- Added restore only when no valid local active plan exists.
- Added archive propagation and a local archive marker to prevent resurrection after a network failure.
- Prevented a late backup request from reopening an archived plan.
- Added athlete-controlled public profile settings with private default.
- Replaced a free-form biography with one of four allowlisted profile tags.
- Added a strict summary-only plan card and mobile native-share/copy-link flow.
- Added an anonymous public profile page using `?profile=<handle>`.
- Kept coach/support authority separate from friend sharing.
- Added dedicated `PLAN_BACKUP` and `PUBLIC_PROFILE` switches so launch does not open coach proposals, guardian sharing, or coach connections.

## Data Boundary

Public cards contain only event, frame length, quality-session count, completion count, total count, title, and badge label. Detailed prescription payloads, records, journals, pain, mood, sleep, memo text, private notes, D9 reason codes, and safety snapshots are not projected.

## Release Gates

The implementation remains hidden until all of the following are true:

1. migration `0029_plan_backup_public_profiles.sql` is applied;
2. server `PLAN_BACKUP` and `PUBLIC_PROFILE` switches are enabled;
3. GitHub build variables for the same features are enabled;
4. CI and browser scenarios pass on the merged commit;
5. anonymous public read and unpublish behaviour are checked on the deployed site.

The implementation does not enable Kakao, phone authentication, payment, raw memo sync, or coach authority expansion.

## Local Verification

- TypeScript app typecheck: PASS.
- Browser/E2E TypeScript typecheck: PASS after restoring the missing `vite/client` type.
- Focused account, feature-gate, backup, public-projection, archive, and PlanBeta tests: 56/56 PASS.
- Hosted release-environment tests: 11/11 PASS.
- Production build: PASS.
- Full GitHub CI and live Supabase RLS verification: pending until PR and migration application.
