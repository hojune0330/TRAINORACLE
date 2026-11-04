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
const accountGateMigration = read("supabase/migrations/0052_coros_ingestion_account_gate.sql")
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

test("COROS ingestion applies current account admission while remaining service-only", () => {
  assert.match(accountGateMigration, /service_feature_enabled\('ACCOUNT'\) is distinct from true/u)
  assert.match(accountGateMigration, /message = 'ACCOUNT_DISABLED'/u)
  assert.match(accountGateMigration, /join public\.user_private_profiles profile[\s\S]+profile\.user_id = connection\.user_id/u)
  assert.match(accountGateMigration, /join public\.beta_enrollments enrollment[\s\S]+enrollment\.user_id = connection\.user_id/u)
  assert.match(accountGateMigration, /profile\.birth_date <=[\s\S]+time zone 'Asia\/Seoul'[\s\S]+interval '14 years'/u)
  assert.match(accountGateMigration, /profile\.deletion_requested_at is null/u)
  assert.match(accountGateMigration, /profile\.privacy_policy_version = '2026-08-26'/u)
  assert.match(accountGateMigration, /profile\.terms_of_service_version = '2026-08-26'/u)
  assert.match(accountGateMigration, /profile\.legal_consented_at is not null/u)
  assert.match(accountGateMigration, /profile\.legal_consented_at <= clock_timestamp\(\)/u)
  assert.match(accountGateMigration, /not exists \([\s\S]+public\.account_deletion_requests request[\s\S]+request\.user_id = connection\.user_id/u)
  assert.match(accountGateMigration, /with admitted_connection as materialized[\s\S]+insert into public\.external_activity_inbox/u)
  assert.match(accountGateMigration, /set search_path = pg_catalog/u)
  assert.match(accountGateMigration, /grant execute on function public\.ingest_coros_activity_batch\(jsonb\) to service_role/u)
  assert.doesNotMatch(accountGateMigration, /auth\.uid\(\)/u)
  assert.doesNotMatch(accountGateMigration, /public\.account_network_access_allowed\(/u)
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

test("callback retains its held state and public status describes release availability", () => {
  assert.match(callbackFunction, /authorizationAttempt \? 409 : 200/u)
  assert.doesNotMatch(callbackFunction, /accesstoken|client_secret|refresh_token/iu)
  assert.match(statusFunction, /CONNECTIONS_NOT_ENABLED/u)
  assert.match(statusFunction, /publicUserLinking: false/u)
  assert.match(statusFunction, /dataIngestion: "FAIL_CLOSED"/u)
})

test("public pages are truthful, cross-linked, and do not claim live provider access", () => {
  const garminRow = supportPage.match(/<tr><td>Garmin<\/td>[\s\S]*?<\/tr>/u)?.[0] ?? ""
  const corosRow = supportPage.match(/<tr><td>COROS<\/td>[\s\S]*?<\/tr>/u)?.[0] ?? ""
  assert.match(supportPage, /Garmin 개발자 프로그램 승인은 확인했으며, 실제 앱 연결 설정은 준비 중입니다/u)
  assert.match(supportPage, /프로그램 승인과 사용자 운동기록 수신은 별도 단계입니다/u)
  assert.match(garminRow, /개발자 프로그램 승인 확인 · 앱 자격증명·실제 수신 설정 필요/u)
  assert.doesNotMatch(garminRow, /제공자 검토 대기|신청 완료 · 제공자 검토/u)
  assert.match(corosRow, /공식 API 신청 완료 · 제공자 검토 대기/u)
  assert.match(supportPage, /COROS는 자격증명 발급 확인이 남아 있습니다/u)
  assert.match(supportPage, /현재 공개 앱에서는 두 계정의 자동 연결을 제공하지 않습니다/u)
  assert.doesNotMatch(supportPage, /공식 연동 신청은 완료됐고 제공자 검토를 기다리고 있습니다|제공자 검토 대기 중인 공식 자동 연동/u)
  assert.doesNotMatch(supportPage, /신청 준비/u)
  assert.match(supportPage, /legal\/device-integrations\.html/u)
  assert.match(supportPage, /hojune0330@gmail\.com/u)
  assert.match(noticePage, /계정 자동 연결은 아직 공개하지 않음/u)
  assert.match(noticePage, /\.\.\/support\.html/u)
  assert.match(noticePage, /확인 전 활동은 주간·월간 통계, 오라클 분석, 안전 판정, 훈련 계획의 근거로 사용하지 않습니다/u)
  assert.match(noticePage, /현재 Garmin 데이터의 AI 코칭 사용은 제공하지 않습니다/u)
  assert.match(noticePage, /제공자의 서면 허용 범위와 사용자 목적별 동의가 확인되기 전에는 Garmin 데이터나 파생값을 모델 추론에 넣지 않습니다/u)
  assert.match(noticePage, /모델 학습·평가·성능 개선용으로도 사용하지 않습니다/u)
  assert.doesNotMatch(`${supportPage}\n${noticePage}`, /연동 완료|자동 동기화 사용 가능/u)
})
