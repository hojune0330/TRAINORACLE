import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import test from "node:test"
import {
  MAX_COROS_BATCH_SIZE,
  normalizeCorosPush,
  secureSecretMatch,
  withPayloadDigests,
} from "../../supabase/functions/_shared/coros.mjs"

const repositoryRoot = resolve(process.cwd(), "..")
const read = (path) => readFileSync(resolve(repositoryRoot, path), "utf8")

const spec = read("specs/reconstruct/EXTERNAL_RECORD_INTEGRATION_SPEC.md")
const migration = read("supabase/migrations/0030_device_integration_readiness.sql")
const config = read("supabase/config.toml")
const pushFunction = read("supabase/functions/coros-workout-push/index.ts")
const callbackFunction = read("supabase/functions/coros-oauth-callback/index.ts")
const statusFunction = read("supabase/functions/device-integration-status/index.ts")
const supportPage = read("app/public/support.html")
const noticePage = read("app/public/legal/device-integrations.html")

function validActivity(overrides = {}) {
  return {
    openId: "coros-user-001",
    labelId: "activity-001",
    mode: 8,
    subMode: 1,
    deviceName: "COROS TEST DEVICE",
    distance: 5000,
    duration: 1200,
    startTime: 1787972400,
    fitUrl: "https://example.invalid/private.fit",
    notes: "raw athlete note must not survive",
    trackPoints: [{ latitude: 0, longitude: 0 }],
    ...overrides,
  }
}

test("external integration draft recounts issues and keeps the final marker strict", () => {
  const issueRows = spec.split(/\r?\n/u).filter((line) => line.startsWith("| OI-ERI-"))
  const blockers = issueRows.filter((line) => line.includes("| YES |"))
  assert.equal(issueRows.length, 12)
  assert.equal(blockers.length, 10)
  assert.match(spec, /open_issues_total: 12/u)
  assert.match(spec, /canonical_blocking_count: 10/u)
  assert.equal((spec.match(/\[DRAFT_COMPLETE\]/gu) ?? []).length, 1)
  assert.equal(spec.trimEnd().endsWith("[DRAFT_COMPLETE]"), true)
})

test("COROS normalization keeps only bounded structured facts", () => {
  const [normalized] = normalizeCorosPush({ sportDataList: [validActivity()] })
  assert.deepEqual(Object.keys(normalized).sort(), [
    "activityStart",
    "deviceName",
    "distanceMeters",
    "durationSeconds",
    "providerRecordId",
    "providerUserId",
    "sportCode",
  ])
  assert.equal(JSON.stringify(normalized).includes("raw athlete note"), false)
  assert.equal(JSON.stringify(normalized).includes("private.fit"), false)
  assert.equal(JSON.stringify(normalized).includes("latitude"), false)
})

test("COROS normalization rejects missing identity and oversized batches", () => {
  assert.throws(
    () => normalizeCorosPush({ sportDataList: [validActivity({ labelId: "" })] }),
    /MISSING_COROS_ACTIVITY_IDENTITY/u,
  )
  assert.throws(
    () => normalizeCorosPush({
      sportDataList: Array.from({ length: MAX_COROS_BATCH_SIZE + 1 }, (_, index) =>
        validActivity({ labelId: `activity-${index}` })),
    }),
    /INVALID_COROS_BATCH/u,
  )
})

test("COROS secrets are compared by digest and short configured secrets fail closed", async () => {
  const secret = "correct-secret-at-least-16-characters"
  assert.equal(await secureSecretMatch(secret, secret), true)
  assert.equal(await secureSecretMatch(`${secret}x`, secret), false)
  assert.equal(await secureSecretMatch("short", "short"), false)
  assert.equal(await secureSecretMatch(null, secret), false)
})

test("normalized activity receives a deterministic digest without adding raw fields", async () => {
  const normalized = normalizeCorosPush({ sportDataList: [validActivity()] })
  const first = await withPayloadDigests(normalized)
  const second = await withPayloadDigests(normalized)
  assert.equal(first[0].payloadDigest, second[0].payloadDigest)
  assert.match(first[0].payloadDigest, /^[a-f0-9]{64}$/u)
  assert.equal(JSON.stringify(first).includes("notes"), false)
})

test("database readiness is default-off, service-only, and stores no provider tokens", () => {
  assert.match(migration, /'DEVICE_INTEGRATION', false, 'APPLICATION_READINESS_FAIL_CLOSED'/u)
  assert.match(migration, /external_provider_connections enable row level security/u)
  assert.match(migration, /external_activity_inbox enable row level security/u)
  assert.match(migration, /revoke all on table public\.external_provider_connections from public, anon, authenticated/u)
  assert.match(migration, /revoke all on table public\.external_activity_inbox from public, anon, authenticated/u)
  assert.match(migration, /grant execute on function public\.ingest_coros_activity_batch\(jsonb\) to service_role/u)
  assert.doesNotMatch(migration, /access_token|refresh_token|fit_url|raw_payload|free_text/iu)
})

test("ingestion SQL requires an active linked COROS user and stays pending confirmation", () => {
  assert.match(migration, /provider = 'COROS'/u)
  assert.match(migration, /connection_status = 'ACTIVE'/u)
  assert.match(migration, /DEVICE_INTEGRATION_DISABLED/u)
  assert.match(migration, /PENDING_USER_CONFIRMATION/u)
  assert.match(migration, /on conflict \(connection_id, provider_record_id\) do nothing/u)
})

test("public endpoints are configured without JWT but push authentication remains mandatory", () => {
  for (const name of ["device-integration-status", "coros-oauth-callback", "coros-workout-push"]) {
    assert.match(config, new RegExp(`\\[functions\\.${name}\\]\\s+verify_jwt = false`, "u"))
  }
  assert.match(pushFunction, /COROS_PUSH_CLIENT/u)
  assert.match(pushFunction, /COROS_PUSH_SECRET/u)
  assert.match(pushFunction, /secureSecretMatch/u)
  assert.match(pushFunction, /ingest_coros_activity_batch/u)
  assert.doesNotMatch(pushFunction, /console\.(log|info|debug|warn|error)/u)
})

test("callback and status endpoints make the application-pending state explicit", () => {
  assert.match(callbackFunction, /authorizationAttempt \? 409 : 200/u)
  assert.doesNotMatch(callbackFunction, /accesstoken|client_secret|refresh_token/iu)
  assert.match(statusFunction, /APPLICATION_PENDING/u)
  assert.match(statusFunction, /publicUserLinking: false/u)
  assert.match(statusFunction, /dataIngestion: "FAIL_CLOSED"/u)
})

test("public pages are truthful, cross-linked, and do not claim live provider access", () => {
  assert.match(supportPage, /공식 연동 신청은 완료됐고 제공자 검토를 기다리고 있습니다/u)
  assert.match(supportPage, /Garmin·COROS가 결정합니다/u)
  assert.match(supportPage, /공식 개발자 프로그램 신청 완료 · 제공자 검토 대기/u)
  assert.match(supportPage, /공식 API 신청 완료 · 제공자 검토 대기/u)
  assert.doesNotMatch(supportPage, /신청 준비/u)
  assert.match(supportPage, /legal\/device-integrations\.html/u)
  assert.match(supportPage, /hojune0330@gmail\.com/u)
  assert.match(noticePage, /실제 연결 기능은 아직 제공하지 않음/u)
  assert.match(noticePage, /확인 전 활동은 주간·월간 통계, 오라클 분석, 안전 판정, 훈련 계획의 근거로 사용하지 않습니다/u)
  assert.doesNotMatch(`${supportPage}\n${noticePage}`, /연동 완료|자동 동기화 사용 가능/u)
})
