# C001 RED Filesystem Truth Baseline

generated_at: 2026-06-26T07:19:00+09:00
surface: CLI auxiliary filesystem/text search
verdict: PASS_RED_BASELINE_CAPTURED

## Exact Invocation

```bash
find . -maxdepth 4 -type f \( -name '*.md' -o -name '*.txt' \) | sort | sed -n '1,240p'
git ls-files '*.md' | sort | sed -n '1,240p'
git ls-files --others --exclude-standard '*.md' | sort | sed -n '1,240p'
for f in RULE_VALIDATION_ENGINE_CONTRACT.md PLAN_SAFETY_GATE_SPEC.md DAILY_LOG_AND_CHECKIN_SPEC.md 11_API_AND_ENGINE_CONTRACTS.md; do
  printf '%s\t' "$f"
  find . -type f -name "$f" | sort | paste -sd '|' -
done
grep -RIn --include='*.md' -E 'RULE_VALIDATION_ENGINE_CONTRACT|PLAN_SAFETY_GATE_SPEC|DAILY_LOG_AND_CHECKIN_SPEC|RECONSTRUCTED_DRAFT_FOR_REVIEW|local files are truth|local_files_are_truth|chapter|phantom' .
```

## Exact Filename Results

| filename | filesystem result |
|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | NOT_FOUND |
| `PLAN_SAFETY_GATE_SPEC.md` | NOT_FOUND |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | NOT_FOUND |
| `11_API_AND_ENGINE_CONTRACTS.md` | FOUND: `./specs/legacy-reference/11_API_AND_ENGINE_CONTRACTS.md` |

## String/Title Sightings That Are Not File Existence

These are textual references only. They must not be promoted into local document existence.

| string | representative sightings |
|---|---|
| `RULE_VALIDATION_ENGINE_CONTRACT.md` | `TRAINORACLE_SPEC_INDEX.md`, `SPEC_WORK_STATUS.md`, `.omo/reports/trainoracle-reconstruction-readiness.md`, `specs/active/RVE_RULE_EVALUATOR_BINDING_SPEC.md` |
| `PLAN_SAFETY_GATE_SPEC.md` | `TRAINORACLE_SPEC_INDEX.md`, `SPEC_WORK_STATUS.md`, `.omo/reports/trainoracle-reconstruction-readiness.md`, `specs/reconstruct/README.md` |
| `DAILY_LOG_AND_CHECKIN_SPEC.md` | `SPEC_LEGACY_ALIGNMENT_AND_DAILY_LOG_PLAN.md`, `.omo/evidence/genspark-spec-readiness-validation-20260626.md` |
| `RECONSTRUCTED_DRAFT_FOR_REVIEW` | multiple planning/readiness docs; not proof that reconstructed files exist |

## RED Finding

The prior failure mode is reproducible: document-like names appear inside plans, readiness reports, H1/title-like lines, and status notes, while exact local files are absent. The safe rule for the next step is:

> A document exists only when exact local filename search returns a filesystem path. A chapter title, table row, status label, or compressed conversation summary is reference text only.

cleanup: no runtime resources spawned; no tmux/browser/server/container/port created.
