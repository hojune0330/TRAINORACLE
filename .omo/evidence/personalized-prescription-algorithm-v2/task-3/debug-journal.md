# Debug Journal - Coordinated Candidate Identity Forgery

Date: 2026-08-23 Asia/Seoul
Base HEAD: `5ea2eed9fce0f0ddb314358d57c0b2fc538b9daa`

## Hypotheses

1. Pair validation compared only relative BALANCED/CONSERVATIVE structure and trusted retained IDs.
   Confirmed: both coordinated support and QUALITY mutations selected before the fix.
2. The strict parser already rejected 999-duration payloads.
   Refuted: the coordinated 999 payload selected, proving no parser cap explained the defect.
3. Candidate or pair IDs already contained a canonical content digest.
   Refuted: generated pre-fix IDs did not change with complete session content.

## Root Fix

Candidate identity now uses canonical JSON plus deterministic SHA-256 over kind, exact target,
selected template ref, intent, source mode, frame, and complete sessions. Pair identity hashes the
base pair identity plus both ordered candidate IDs. The synchronous SHA implementation is checked
against the existing WebCrypto canonical hash helper in the focused contract.

Generation and detailed prescription binding rederive both IDs. Selection, v3 storage parsing,
pair semantics, and adaptation recompute them independently and fail closed on stale content.

## Outcome

- Coordinated support mutation: `STALE_CANDIDATE_FINGERPRINT`.
- Coordinated QUALITY mutation: `STALE_CANDIDATE_FINGERPRINT`.
- Stored support-session mutation: unloadable, raw bytes preserved.
- Altered adaptation candidate under retained identity: rejected.
- Normal four-event generation/selection and existing adaptation reduction: green.
