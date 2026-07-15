#!/usr/bin/env bash
set -euo pipefail

repo_root="$(git rev-parse --show-toplevel)"
protocol="$repo_root/specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md"
workflow="$repo_root/specs/reconstruct/HUMAN_REVIEW_AND_SHARING_WORKFLOW.md"
scenarios="$repo_root/specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md"
decision="$repo_root/FORMATION_SHADOW_PROTOCOL_ACCEPTANCE_DECISION.md"

fail() {
  printf 'FAIL: %s\n' "$1" >&2
  exit 1
}

for file in "$protocol" "$workflow" "$scenarios" "$decision"; do
  test -f "$file" || fail "missing ${file#$repo_root/}"
done

require_literal() {
  local file="$1"
  local literal="$2"
  grep -qF -- "$literal" "$file" || fail "missing '$literal' in ${file#$repo_root/}"
}

require_literal "$protocol" 'runtime_authority: false'
require_literal "$protocol" 'participant_enrollment: false'
require_literal "$protocol" 'hidden_shadow: forbidden'
require_literal "$protocol" '## Baseline'
require_literal "$protocol" '## Monitoring Cadence'
require_literal "$protocol" '## Uncertainty'
require_literal "$protocol" '## Usefulness And Feasibility'
require_literal "$protocol" '## Post-Pilot Disposition'
require_literal "$protocol" 'comprehension check `4/4`'
require_literal "$protocol" 'A safety-related pause also requires the'
require_literal "$workflow" 'in_app_delivery: false'
require_literal "$workflow" '## Sampling And Independence'
require_literal "$workflow" 'Reviewer C'
require_literal "$decision" 'protocol_accepted: false'
require_literal "$decision" 'runtime_authority: false'
require_literal "$decision" 'participant_enrollment: false'
require_literal "$decision" 'shadow_generation: false'
require_literal "$decision" 'in_app_delivery: false'
require_literal "$decision" 'real_plan_mutation: false'
require_literal "$decision" '[BLOCKED_ENTRY_GATE]'

if grep -Eq 'runtime_authority: true|participant_enrollment: true|protocol_accepted: true|in_app_delivery: true|hidden_shadow: allowed' \
  "$protocol" "$workflow" "$scenarios" "$decision"; then
  fail 'an enabled runtime, participant, protocol, delivery, or hidden-shadow state exists'
fi

declared_count="$(sed -n 's/^fixture_count: \([0-9][0-9]*\)$/\1/p' "$scenarios")"
actual_count="$(grep -Ec '^\| (SP|SH|HR)-[0-9]{2} \|' "$scenarios")"
unique_count="$(grep -E '^\| (SP|SH|HR)-[0-9]{2} \|' "$scenarios" | cut -d'|' -f2 | tr -d ' ' | sort -u | wc -l | tr -d ' ')"

test -n "$declared_count" || fail 'fixture_count is missing'
test "$declared_count" = "$actual_count" || fail "fixture_count=$declared_count but rows=$actual_count"
test "$actual_count" = "$unique_count" || fail "fixture IDs are not unique ($unique_count/$actual_count)"

for fixture_id in SP-01 SP-02 SP-03 SP-04 SP-05 SP-06 SP-07 SP-08 SP-09 SP-10 \
  SP-11 SP-12 SP-13 SP-14 SP-15 SP-16 SP-17 SP-18 \
  SH-01 SH-02 SH-03 SH-04 SH-05 SH-06 SH-07 SH-08 SH-09 SH-10 \
  HR-01 HR-02 HR-03 HR-04 HR-05 HR-06 HR-07 HR-08 HR-09; do
  grep -q "^| $fixture_id |" "$scenarios" || fail "missing fixture $fixture_id"
done

printf 'PASS files=4 fixtures=%s unique=%s groups=SP:%s,SH:%s,HR:%s\n' \
  "$actual_count" \
  "$unique_count" \
  "$(grep -Ec '^\| SP-[0-9]{2} \|' "$scenarios")" \
  "$(grep -Ec '^\| SH-[0-9]{2} \|' "$scenarios")" \
  "$(grep -Ec '^\| HR-[0-9]{2} \|' "$scenarios")"
printf 'PASS blocked_authority runtime=false participant=false protocol=false delivery=false hidden=forbidden\n'
printf 'PASS required_contracts baseline cadence uncertainty feasibility disposition sampling adjudicator resume\n'
