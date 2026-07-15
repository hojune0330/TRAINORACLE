#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT"

fail() {
  printf 'FAIL %s\n' "$1" >&2
  exit 1
}

require_text() {
  local file="$1"
  local text="$2"
  grep -Fq -- "$text" "$file" || fail "$file missing: $text"
}

require_count() {
  local label="$1"
  local expected="$2"
  local actual="$3"
  [[ "$actual" == "$expected" ]] || fail "$label expected=$expected actual=$actual"
}

table_ids() {
  local file="$1"
  grep -Eo '^\| [A-Z]+-[0-9]+ ' "$file" | tr -d '| '
}

calendar_ids() {
  grep -E '^(### [A-Z]+-[0-9]+ |- id: [A-Z]+-[0-9]+)' \
    specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md |
    sed -E 's/^### ([A-Z]+-[0-9]+).*/\1/; s/^- id: ([A-Z]+-[0-9]+).*/\1/'
}

check_ids() {
  local label="$1"
  local expected="$2"
  local ids="$3"
  local actual unique
  actual="$(printf '%s\n' "$ids" | sed '/^$/d' | wc -l | tr -d ' ')"
  unique="$(printf '%s\n' "$ids" | sed '/^$/d' | sort -u | wc -l | tr -d ' ')"
  require_count "$label fixture count" "$expected" "$actual"
  require_count "$label unique fixture count" "$expected" "$unique"
  printf 'PASS %s fixtures=%s unique=%s\n' "$label" "$actual" "$unique"
}

required_files=(
  FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md
  FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md
  FORMATION_SHADOW_PROTOCOL_ACCEPTANCE_DECISION.md
  FORMATION_PRODUCT_PROJECTION_ACCEPTANCE_DECISION.md
  FORMATION_RUNTIME_READINESS_DECISION.md
  specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md
  specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md
  specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md
  specs/test-packages/FORMATION_PROJECTION_ACCESSIBILITY_TEST_PACKAGE.md
  specs/test-packages/FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md
)
for file in "${required_files[@]}"; do
  [[ -s "$file" ]] || fail "required file absent or empty: $file"
done

check_ids WO012 30 "$(table_ids specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md)"
check_ids WO013 36 "$(calendar_ids)"
check_ids WO014 37 "$(table_ids specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md)"
check_ids WO015 40 "$(table_ids specs/test-packages/FORMATION_PROJECTION_ACCESSIBILITY_TEST_PACKAGE.md)"
check_ids WO016 24 "$(table_ids specs/test-packages/FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md)"

require_count 'WO012 declared fixture_count' 30 "$(sed -nE 's/^fixture_count: ([0-9]+)$/\1/p' specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md)"
require_count 'WO013 declared fixture_count' 36 "$(sed -nE 's/^fixture_count: ([0-9]+)$/\1/p' specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md)"
require_count 'WO014 declared fixture_count' 37 "$(sed -nE 's/^fixture_count: ([0-9]+)$/\1/p' specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md)"
require_count 'WO015 declared fixture_count' 40 "$(sed -nE 's/^fixture_count: ([0-9]+)$/\1/p' specs/test-packages/FORMATION_PROJECTION_ACCESSIBILITY_TEST_PACKAGE.md)"
require_count 'WO016 declared test_count' 24 "$(sed -nE 's/^test_count: ([0-9]+)$/\1/p' specs/test-packages/FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md)"

runtime_ids="$(table_ids specs/test-packages/FORMATION_RUNTIME_INTEGRATION_TEST_PACKAGE.md)"
require_count 'WO016 GV count' 12 "$(printf '%s\n' "$runtime_ids" | grep -Ec '^GV-')"
require_count 'WO016 RT count' 12 "$(printf '%s\n' "$runtime_ids" | grep -Ec '^RT-')"

hash_one='{"domainTag":"TRAINORACLE_CALENDAR_PROJECTION_V1","projectionDocument":{"plannedSessionId":"session-1"},"projectionSchemaVersion":"1"}'
hash_two='{"domainTag":"TRAINORACLE_OTHER_DOMAIN_V1","projectionDocument":{"plannedSessionId":"session-1"},"projectionSchemaVersion":"1"}'
actual_one="$(printf '%s' "$hash_one" | sha256sum | cut -d' ' -f1)"
actual_two="$(printf '%s' "$hash_two" | sha256sum | cut -d' ' -f1)"
require_count HASH-01 d09425ec584a295dcc9d47a7aeab44fb5eb7d5230633fec0b05abf89c03b3834 "$actual_one"
require_count HASH-02 3714a2c85c3a80a4420df8a4bcee979d669b47cfc835f71d3da3efddbaff0dac "$actual_two"
printf 'PASS canonical SHA-256 golden values\n'

projection_fact='{"components":[{"durationMin":40,"id":"C-RUN","order":1,"type":"RUNNING"},{"durationMin":15,"id":"C-PLYO","order":2,"type":"PLYOMETRIC"},{"durationMin":25,"id":"C-STRENGTH","order":3,"type":"STRENGTH"}],"horizon":"completed_session_2026_07_16","parentSessionId":"S-001","wholeSessionRpe":7}'
projection_result='{"action":"VIEW_ONLY","authority":"DESCRIPTIVE_ANALYSIS","readinessOrRecovery":"UNKNOWN","uncertainty":"recovery_not_inferred"}'
real_plan='{"planVersionId":"plan-v3","plannedSessionId":"S-001","status":"UNCHANGED"}'
require_count 'WO015 fact hash' 09851c68a7935f81919db853bc280887001640d405e6f72cffc9a20142ec0f4c "$(printf '%s' "$projection_fact" | sha256sum | cut -d' ' -f1)"
require_count 'WO015 result hash' b788dd917b9dc33fd2d32644d66994563d84b42acc2a7a1bf3735eb3b478aa25 "$(printf '%s' "$projection_result" | sha256sum | cut -d' ' -f1)"
require_count 'WO015 real-plan hash' 7d414eef0b7febf3344e29c6994e269194191b4496d8e42b9e9d954e065df90b "$(printf '%s' "$real_plan" | sha256sum | cut -d' ' -f1)"
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md "canonicalFactPreimageUtf8: '$projection_fact'"
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'canonicalFactHash: 09851c68a7935f81919db853bc280887001640d405e6f72cffc9a20142ec0f4c'
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md "canonicalResultPreimageUtf8: '$projection_result'"
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'canonicalResultHash: b788dd917b9dc33fd2d32644d66994563d84b42acc2a7a1bf3735eb3b478aa25'
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md "realPlanPreimageUtf8: '$real_plan'"
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'realPlanHash: 7d414eef0b7febf3344e29c6994e269194191b4496d8e42b9e9d954e065df90b'
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'sourceWatermark:'
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'streamId: DLC-v1'
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'eventSequence: 1'
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'aggregateRevision: 1'
require_text specs/reconstruct/FORMATION_PRODUCT_PROJECTION_AND_EXPLANATION_CONTRACT.md 'observedAt: "2026-07-16T00:00:00Z"'
require_text specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md 'arrays: preserve_input_order'
require_text specs/reconstruct/CALENDAR_VERSION_AND_SYNC_CONTRACT.md 'objectPropertyNames: RFC_8785_UTF16_code_unit_lexicographic_order'
require_text specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md 'fixture-tzdb-2026a'
require_text specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md 'atUtc: "2026-03-08T07:00:00Z", offsetBeforeSeconds: -18000, offsetAfterSeconds: -14400, localEffect: GAP_02_00_TO_02_59_59'
require_text specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md 'atUtc: "2026-11-01T06:00:00Z", offsetBeforeSeconds: -14400, offsetAfterSeconds: -18000, localEffect: FOLD_01_00_TO_01_59_59'
require_text specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md 'outsideSnapshotRange: REJECT_UNSUPPORTED_FIXTURE_TIME'
require_text specs/reconstruct/ATHLETE_VISIBLE_SHADOW_PILOT_PROTOCOL.md 'FINAL_REVIEW -> COMPLETED_PENDING_DISPOSITION'
printf 'PASS cross-order projection, canonicalization, timezone, and lifecycle bindings\n'

require_text FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md 'ruleset_accepted: false'
require_text FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md 'architecture_accepted: false'
require_text FORMATION_SHADOW_PROTOCOL_ACCEPTANCE_DECISION.md 'protocol_accepted: false'
require_text FORMATION_PRODUCT_PROJECTION_ACCEPTANCE_DECISION.md 'projection_accepted: false'
require_text FORMATION_RUNTIME_READINESS_DECISION.md 'accepted_dependencies: []'
require_text FORMATION_RUNTIME_READINESS_DECISION.md 'canonical_p1_blockers_open: 10'
require_text FORMATION_RUNTIME_READINESS_DECISION.md 'approved_target_patch_plans: 0'
require_text FORMATION_RUNTIME_READINESS_DECISION.md 'runtime_authority: false'
require_text FORMATION_COACH_RULESET_ACCEPTANCE_DECISION.md 'decision: PACKET_PREPARED_COACH_AND_011_APPROVAL_BLOCKED'
require_text FORMATION_CALENDAR_SYNC_ACCEPTANCE_DECISION.md 'decision: PACKET_PREPARED_DEPENDENCIES_BLOCKED'
require_text FORMATION_SHADOW_PROTOCOL_ACCEPTANCE_DECISION.md 'decision: SYNTHETIC_PACKET_COMPLETE_PARTICIPANT_GATE_BLOCKED'
require_text FORMATION_PRODUCT_PROJECTION_ACCEPTANCE_DECISION.md 'decision: DRAFT_PACKET_RENDER_AND_FEEDBACK_BLOCKED'
require_text FORMATION_RUNTIME_READINESS_DECISION.md 'decision: ENTRY_GATE_FAILED_RUNTIME_NOT_STARTED'
require_text .omo/plans/trainoracle-remaining-work-orders.md '`PACKET_PREPARED_COACH_AND_011_APPROVAL_BLOCKED`'
require_text .omo/plans/trainoracle-remaining-work-orders.md '`PACKET_PREPARED_DEPENDENCIES_BLOCKED`'
require_text .omo/plans/trainoracle-remaining-work-orders.md '`SYNTHETIC_PACKET_COMPLETE_PARTICIPANT_GATE_BLOCKED`'
require_text .omo/plans/trainoracle-remaining-work-orders.md '`DRAFT_PACKET_RENDER_AND_FEEDBACK_BLOCKED`'
require_text .omo/plans/trainoracle-remaining-work-orders.md 'execution_state: PACKET_PREPARED_COACH_AND_011_APPROVAL_BLOCKED'
require_text .omo/plans/trainoracle-remaining-work-orders.md 'execution_state: PACKET_PREPARED_DEPENDENCIES_BLOCKED'
require_text .omo/plans/trainoracle-remaining-work-orders.md 'execution_state: SYNTHETIC_PACKET_COMPLETE_PARTICIPANT_GATE_BLOCKED'
require_text .omo/plans/trainoracle-remaining-work-orders.md 'execution_state: DRAFT_PACKET_RENDER_AND_FEEDBACK_BLOCKED'
require_text .omo/notepads/work-orders-012-016.md '`PACKET_READY_BLOCKED` | `DECISION_PACKET_COMPLETE_BLOCKED_ON_QUALIFIED_REVIEW`, `PACKET_PREPARED_COACH_AND_011_APPROVAL_BLOCKED`, `PACKET_PREPARED_DEPENDENCIES_BLOCKED`, `SYNTHETIC_PACKET_COMPLETE_PARTICIPANT_GATE_BLOCKED`'
require_text .omo/notepads/work-orders-012-016.md '`DRAFT_BLOCKED` | `DRAFT_PACKET_RENDER_AND_FEEDBACK_BLOCKED`'
require_text .omo/notepads/work-orders-012-016.md '`GATE_FAILED_RUNTIME_DORMANT` | `ENTRY_GATE_FAILED_RUNTIME_NOT_STARTED`'
require_text .omo/plans/trainoracle-remaining-work-orders.md 'execution_state: ENTRY_GATE_FAILED_RUNTIME_NOT_STARTED'

for order in 010 011 012 013 014 015; do
  require_text FORMATION_RUNTIME_READINESS_DECISION.md "CODEX_WORK_ORDER_$order"
done

p1_count="$(grep -Ec '^- `OI-FA-[A-Z0-9-]+`$' FORMATION_RUNTIME_READINESS_DECISION.md)"
require_count 'WO016 canonical P1 inventory' 10 "$p1_count"

if grep -R -n -E '^runtime_authority:[[:space:]]*true$' \
  FORMATION_*_DECISION.md specs/reconstruct specs/test-packages runtime-evidence 2>/dev/null; then
  fail 'runtime authority was enabled'
fi

forbidden='^(app|impl|backend|server|db|database|migrations?|schema|\.github)/'
changed_paths="$(git status --porcelain=v1 | sed -E 's/^...//')"
if printf '%s\n' "$changed_paths" | grep -E "$forbidden"; then
  fail 'implementation or deployment path changed before WO016 gate'
fi

printf 'PASS gate state strict_acceptance=0/6 p1_open=10/10 target_patch_plans=0 runtime=false\n'
printf 'PASS changed paths contain readiness documents/evidence only\n'
node specs/test-packages/test-wo016-gate-verifier.mjs
printf 'PASS readiness validation only; no static scenario is claimed as runtime execution\n'
