# Todo 2 Trusted Manifest Gate Review

- Candidate: dirty worktree on `6f0e33829d96a450b7ee45b3576aa641aca3e794`
- Recommendation: **REJECT / needs-fix**
- Scope: read-only inspection and ephemeral in-memory mutation probes; this report is the only created artifact.

## Blocking findings

1. `templateContentFingerprint` is not bound to canonical template content. `isDetailedPrescriptionApprovalApplicable` only compares the manifest string with the caller-provided string. An independent probe changed only `notation` from `5x1000m @5000m RP / r150s` to `1x100m @MAX / no recovery`; applicability remained `true`. This violates the plan's explicit tampered-notation mutation requirement and allows a changed dose to retain a stale fingerprint.
2. The byte-bound historical V2 gate is stale against this candidate. `node --test specs/test-packages/validate-v2-seed-05-activation-packet.test.mjs` fails 2/10 with `runtime approval manifest content changed`: expected approval source hash `bd7f70a4...`, candidate hash `9b4b411a...`. The manifest remains empty and V2 is not directly activated, but the evidence JSON does not disclose the failing historical gate.
3. Under the task's literal acceptance wording, event and experience have scopes only (`eligibleEventGroups`, `eligibleExperienceBands`), not evidence references/fingerprints. Only population applicability has explicit evidence binding.
4. Reviewer qualification and role separation are not trusted. The validator accepts one `reviewerId` for all three required roles and accepts `qualificationRef: "not-a-verified-qualification"` because both identity and qualification are only checked as nonempty strings. This contradicts the referenced V2 packet's requirement for a qualified-reviewer registry and role separation.

## Passing evidence

- Required commands: detailed-prescription 17/17 PASS; pace-target 15/15 PASS; typecheck PASS; `git diff --check` exit 0 (line-ending warnings only).
- Independent in-memory mutations rejected: content fingerprint, version, reviewer qualification, component fingerprint, expiry, revocation, event mismatch.
- Independent reviewer probe returned `sameReviewerAllRolesAccepted:true` and `arbitraryQualificationRefAccepted:true`.
- Manifest count is 0; array is frozen; attempted push throws; forged caller lifecycle/eligibility cannot resolve authority.
- No age/youth/guardian/memo/symptom/narrative field or `Date.now` occurs in the three changed files. `new Date(milliseconds)` only canonicalizes an explicit timestamp.
- Evidence JSON file hashes exactly match all three candidate files. Summary statements match their covered focused-test outcomes.

## Cleanup

- No temporary files or directories were created by the independent probe.
- Vite middleware was closed in `finally`; no server listened on a port.
- No staging, commit, revert, or product/evidence edits were performed.

## Exact repro commands

```bash
npm --prefix app run test:unit -- detailed-prescription
npm --prefix app run test:unit -- pace-target
npm --prefix app run typecheck
git diff --check
node --test specs/test-packages/validate-v2-seed-05-activation-packet.test.mjs
node specs/test-packages/validate-v2-seed-05-activation-packet.mjs
sha256sum app/src/domain/detailed-prescription-approvals.ts app/src/domain/detailed-prescription.ts app/src/domain/detailed-prescription.contract.test.ts
rg -n "templateContentFingerprint|notation|qualificationRef|reviewerId|Date\\.now|youthReview" app/src/domain/detailed-prescription-approvals.ts app/src/domain/detailed-prescription.ts app/src/domain/detailed-prescription.contract.test.ts
```
