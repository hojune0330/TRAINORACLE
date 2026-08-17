# Todo 2 Re-verification Gate Review

- Candidate: dirty worktree on `6f0e33829d96a450b7ee45b3576aa641aca3e794`
- Recommendation: **REJECT / needs-fix**
- Scope: independent inspection and in-memory mutation probes. This report is the only verifier-created file.

## Blocking Findings

1. **Fabricated reviewer qualification still grants applicability.** `isReviewerForRole` validates only nonempty authority/decision/evidence strings and fingerprint syntax. With four distinct reviewer IDs and correct role keys, replacing every qualification authority, decision and evidence reference with fabricated strings plus a syntactically valid `sha256:` value leaves `isDetailedPrescriptionApprovalApplicable(...) === true`. No immutable qualification-authority lookup proves that the reviewer is qualified. This leaves previous blocker 2 unresolved and makes the evidence statement about arbitrary qualification too narrow.
2. **Historical V2 semantic gate is bypassable by an equivalent nonliteral ID.** A literal ACTIVE/ELIGIBLE `templateId: "V2-SEED-05"` is rejected, but `templateId: ("V2-" + "SEED-05")` is accepted with `manifestAuthority: "NO_V2_SEED_05"`. The validator scans source with a literal-value regex instead of parsing/evaluating the compiled manifest contract, so previous blocker 4 is not adversarially closed.

## Confirmed Fixes

- Notation-only mutation rejects; the Node contract computes SHA-256 over canonical NFC JSON and checks every compiled manifest entry.
- Duplicate reviewer ID, wrong role, missing qualification authority/decision/evidence/fingerprint, and missing reviewer evidence reject.
- Missing or mismatched event and experience evidence bindings reject.
- Manifest is empty; no V2, age, youth, guardian, memo, symptom, narrative, or hidden wall-clock input is present.
- Packet and catalog remain unchanged and hash-pinned. All six requested commands pass.
- Evidence JSON hashes match all six listed candidate files; summary and latest ledger entry describe the reported green runs accurately, except that they omit the two bypasses above.

## Required Command Results

```text
npm --prefix app run test:unit -- detailed-prescription  -> 26/26 PASS
npm --prefix app run test:unit -- pace-target            -> 15/15 PASS
npm --prefix app run typecheck                           -> PASS
node --test specs/test-packages/validate-v2-seed-05-activation-packet.test.mjs -> 11/11 PASS
node specs/test-packages/validate-v2-seed-05-activation-packet.mjs             -> PASS / FORBIDDEN / EMPTY
git diff --check                                         -> exit 0
```

## Cleanup

- No temporary file or directory was created.
- Vite middleware probes were closed in `finally`; no workspace Node/Vite process remains.
- Nothing was staged, committed, reverted, or modified outside this report artifact.
