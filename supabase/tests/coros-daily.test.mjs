import test from "node:test"
import assert from "node:assert/strict"
import { normalizeCorosDaily, readBoundedDailyJson, MAX_DAILY_BODY_BYTES } from "../functions/_shared/coros-daily.mjs"

const payload = (day = {}) => ({ batchDailyList: [{ openId: "synthetic-user", dailyList: [{ happenDay: 20260912, ...day }] }] })

test("missing measurements stay null and provider local times are not converted", () => {
  const [row] = normalizeCorosDaily(payload({ sleepStartTime: "2026-09-11 22:00:00", sleepEndTime: "2026-09-12 07:00:00" }))
  assert.equal(row.restingHeartRate, null)
  assert.equal(row.steps, null)
  assert.equal(row.sleepDurationSeconds, null)
  assert.equal(row.timezone, null)
  assert.equal(row.analysisStatus, "PENDING_SOURCE_REVIEW")
})
test("explicit zero survives but numeric strings and invalid days fail", () => {
  assert.equal(normalizeCorosDaily(payload({ step: 0 }))[0].steps, 0)
  for (const day of [{ step: "12" }, { rhr: -1 }, { happenDay: 20260230 }, { ppgHrv: Infinity }, { sleepStartTime: "2026-09-12 25:00:00" }]) {
    assert.throws(() => normalizeCorosDaily(payload(day)))
  }
})
test("raw and overnight HRV remain distinct and unrelated fields are discarded", () => {
  const [row] = normalizeCorosDaily(payload({ ppgHrv: 50, hrvList: [{ hrv: 25, timestamp: 1592098222 }], memo: "not retained", secret: "not retained" }))
  assert.equal(row.overnightHrv, 50)
  assert.equal(row.hrvSamples[0].hrv, 25)
  assert.equal(row.hrvSamples[0].heartRate, null)
  assert.ok(!JSON.stringify(row).includes("not retained"))
})
test("duplicate provider day in one batch is rejected instead of summed", () => {
  const input = payload()
  input.batchDailyList.push(input.batchDailyList[0])
  assert.throws(() => normalizeCorosDaily(input), /DUPLICATE/)
})
test("different users retain separate identities and list limits are enforced", () => {
  const input = payload()
  input.batchDailyList.push({ openId: "second-user", dailyList: [{ happenDay: 20260912 }] })
  assert.equal(normalizeCorosDaily(input).length, 2)
  assert.throws(() => normalizeCorosDaily(payload({ hrvList: Array(1441).fill({ hrv: 1, timestamp: 1 }) })))
  input.batchDailyList[0].dailyList = Array(4).fill({ happenDay: 20260912 })
  assert.throws(() => normalizeCorosDaily(input), /INVALID_DAILY_LIST/)
})
test("body is bounded independently of content-length", async () => {
  assert.deepEqual(await readBoundedDailyJson(new Request("https://example.test", { method: "POST", body: JSON.stringify(payload()) })), payload())
  await assert.rejects(readBoundedDailyJson(new Request("https://example.test", { method: "POST", body: "x".repeat(MAX_DAILY_BODY_BYTES + 1) })), /TOO_LARGE/)
  await assert.rejects(readBoundedDailyJson(new Request("https://example.test", { method: "POST", body: "{" })))
})
