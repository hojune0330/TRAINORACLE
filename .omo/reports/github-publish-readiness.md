# TrainOracle GitHub Publish Readiness

Generated: 2026-06-24 Asia/Seoul

Scope: preparation only. No commit, push, remote creation, repository creation, or product SPEC movement was performed.

Update: target repository confirmed as `hojune0330/TRAINORACLE`; local branch `codex/trainoracle-spec-handoff` was created from `origin/main` for publish preparation.

## Local Git State

- Repository root: `D:/admin/Documents/트레인 오라클 진도`
- Current branch: `codex/trainoracle-spec-handoff`
- Base branch: `origin/main`
- Remote `origin`: `https://github.com/hojune0330/TRAINORACLE.git`
- Target repository visibility: public
- Connector permissions observed: admin/push available
- Git user name: not configured locally
- Git user email: not configured locally
- GitHub CLI `gh`: not installed or not on `PATH`

## Current Upload Scope

- Tracked candidate currently visible to Git: SPEC index, `specs/` package, `.omo/` curated handoff/evidence/report files, and `.gitignore`.
- Added publish-prep file: `.gitignore`
- Ignored/local-only artifacts: `.codegraph/`, `.omo/ulw-loop/`, `.omo/evidence/*.stdout.txt`, `.omo/evidence/codex-goal-snapshot-*.json`
- `README.md`: updated to link `TRAINORACLE_SPEC_INDEX.md`
- Product SPEC source files were copied from the verified source package into `specs/`.
- Copy verification: SHA256 hashes for the 16 copied source files matched the source package after copy.

## Safety Notes

- Do not upload raw athlete private data, raw symptom clauses, medical notes, guardian private notes, `.env` files, local DB files, or generated local indexing caches.
- Do not copy product SPEC files into the repo until the intended folder structure is confirmed.
- Do not treat GitHub upload as canonical promotion. Draft/reconstructed/candidate status must remain explicit in the documents.
- Do not close D9/RVE/Plan Generator binding issues because of GitHub upload alone.

## Recommended First GitHub Shape

Recommended repository visibility: private.

Recommended first committed scope now prepared:

1. `.gitignore`
2. `.omo/` preparation artifacts
3. `TRAINORACLE_SPEC_INDEX.md`
4. `specs/active/`
5. `specs/test-packages/`
6. `specs/legacy-reference/`
7. `specs/reconstruct/README.md`

Recommended later scope after explicit confirmation:

1. Copy or move verified active SPEC files into a chosen repository structure.
2. Add missing/reconstructed specs under a draft/reconstruct area.
3. Keep legacy references separate from active SPEC files.
4. Add runtime evidence only after actual D9 evaluator execution.

## Required Decisions Before Push

1. Public visibility is already active on the target repository; continue avoiding secrets and raw athlete data.
2. Git identity for local commits still needs to be set before committing.
3. Push may still fail if local Git credentials are not available; connector write access was confirmed separately.

## Blockers

- GitHub CLI `gh` is unavailable, so local push/PR automation cannot run through the normal GitHub publish flow yet.
- Git local user identity is not configured.
- Local `git push` credentials are not yet proven.

## Next Publish Commands After Confirmation

Use these only if local push credentials are available:

```powershell
git config user.name "<name>"
git config user.email "<email>"
git add README.md .gitignore TRAINORACLE_SPEC_INDEX.md specs .omo
git commit -m "Add TrainOracle spec handoff package"
git push -u origin codex/trainoracle-spec-handoff
```

If the full SPEC package is included, stage explicit verified paths instead of using broad `git add -A`.
