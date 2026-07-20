import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "../..")
const read = (relativePath) => readFile(path.join(root, relativePath), "utf8")

function assertIncludesExactlyOnce(body, value) {
  assert.equal(body.split(value).length - 1, 1, `expected exactly one ${value}`)
}

test("owner direction is recorded without formal or runtime authority", async () => {
  const binding = await read("reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md")

  for (const value of [
    "status: OWNER_DIRECTION_RECORDED_PENDING_NAMED_REVIEW",
    "source_ref: reports/review/OWNER_DECISION_INTAKE_2026-07-18.md",
    "formal_owner_decision: NOT_REVIEWED",
    "scientific_acceptance: false",
    "privacy_acceptance: false",
    "runtime_authority: false",
    "canonical_spec_patch_authorized: false",
  ]) assertIncludesExactlyOnce(binding, value)
  assert.doesNotMatch(binding, /runtime_authority\s*:\s*true/iu)
  assert.doesNotMatch(binding, /canonical_spec_patch_authorized\s*:\s*true/iu)
})

test("load and minimum-evidence packets bind the approved product direction", async () => {
  const [load, minimum] = await Promise.all([
    read("reports/review/FORMATION_LOAD_COMPONENT_DECISION_PACKET_V2.md"),
    read("reports/review/FORMATION_MINIMUM_EVIDENCE_DECISION_PACKET_V2.md"),
  ])

  assert.match(load, /owner_product_direction: APPROVE_RECORDED_PENDING_NAMED_REVIEW/u)
  assert.match(minimum, /owner_product_direction: APPROVE_RECORDED_PENDING_NAMED_REVIEW/u)
  assert.match(load, /sport_science_decision: NOT_REVIEWED/u)
  assert.match(minimum, /statistics_decision: NOT_REVIEWED/u)
})

test("competition direction separates bout records from MAIN placement", async () => {
  const competition = await read("reports/review/FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md")

  assert.match(competition, /ca_02_owner_direction: APPROVE_RECORDED_PENDING_NAMED_REVIEW/u)
  assert.match(competition, /ca_03_owner_direction: REVISE_RECORDED_PENDING_NAMED_REVIEW/u)
  assert.match(competition, /completed_bout_records: SEPARATE/u)
  assert.match(competition, /same_competition_day_main_placement: ZERO_OR_ONE/u)
  assert.match(competition, /calendar_anchor_exposure: 0/u)
  assert.match(competition, /canonical_counting_changed: false/u)
})

test("first sharing delivery and internal shadow stay bounded", async () => {
  const binding = await read("reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md")

  assert.match(binding, /sharing_first_delivery: SELECTIVE_EXPORT_AND_OS_SHARE/u)
  assert.match(binding, /memo_inclusion_default: false/u)
  assert.match(binding, /in_app_recipient_accounts: DEFERRED/u)
  assert.match(binding, /internal_shadow_qa: ALLOWED_NON_PRESCRIPTIVE/u)
  assert.match(binding, /athlete_pilot: BLOCKED_PENDING_NAMED_REVIEW/u)
  assert.match(binding, /minor_participant_operation: BLOCKED_PENDING_SAFEGUARDING/u)
})

test("daily-log memo transport follows the explicit owner file operation", async () => {
  const dailyLog = await read("specs/reconstruct/DAILY_LOG_AND_CHECKIN_SPEC.md")

  for (const value of [
    "first_delivery: SELECTIVE_EXPORT_AND_OS_SHARE",
    "operation_class: USER_DIRECTED_FILE_OPERATION",
    "memo_inclusion_default: false",
    "exact_field_preview_required: true",
    "explicit_memo_inclusion_confirmation_required: true",
    "owner_full_local_backup_allowed: true",
    "automatic_network_upload_allowed: false",
    "preselected_recipient_allowed: false",
    "analysis_consent_from_export_or_share: prohibited",
    "standing_coach_guardian_or_friend_access_from_export_or_share: prohibited",
    "Formation_plan_safety_reward_or_telemetry_effect: prohibited",
  ]) assertIncludesExactlyOnce(dailyLog, value)

  assert.equal(
    dailyLog.split("explicit_user_selected_file_inclusion: allowed_under_file_transport_contract").length - 1,
    2,
  )
  assert.doesNotMatch(dailyLog, /^\s+(?:raw_text_)?export_allowed: false\s*$/mu)
})

test("latest baseline and handoff point to the owner-direction binding", async () => {
  const [baseline, handoff] = await Promise.all([
    read("reports/review/FORMATION_LATEST_OWNER_DECISION_BASELINE.md"),
    read("reports/review/FORMATION_LATEST_DECISION_RECONCILIATION_HANDOFF.md"),
  ])
  const bindingPath = "reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md"

  assert.match(baseline, new RegExp(bindingPath.replaceAll("/", "\\/"), "u"))
  assert.match(handoff, new RegExp(bindingPath.replaceAll("/", "\\/"), "u"))
})

test("competition, pilot, projection, and sharing plans reference the binding", async () => {
  const paths = [
    "reports/review/FORMATION_COMPETITION_ANCHOR_DECISION_PACKET_V1.md",
    "reports/target-patch-plans/05-pilot-protocol.md",
    "reports/target-patch-plans/09-product-projection.md",
    "reports/target-patch-plans/10-record-governance.md",
  ]
  const bindingPath = "reports/review/FORMATION_OWNER_DIRECTION_BINDING_2026-07-18.md"

  for (const body of await Promise.all(paths.map(read))) assert.match(body, new RegExp(bindingPath.replaceAll("/", "\\/"), "u"))
})
