import test from "node:test"
import assert from "node:assert/strict"
import { createCorosDailyHandler } from "../functions/_shared/coros-daily-handler.mjs"

const request = (query = "signature=test&nonce=test&timestamp=1") => new Request(`https://example.test/?${query}`, {
  method: "POST", headers: { "content-type": "application/json" },
  body: JSON.stringify({ batchDailyList: [{ openId: "synthetic", dailyList: [{ happenDay: 20260912, step: 4 }] }] }),
})

test("unconfigured handler never accepts a provider request", async () => {
  assert.equal((await createCorosDailyHandler()(request())).status, 503)
})
test("invalid and duplicate signature envelope cannot reach verification or storage", async () => {
  let calls = 0
  const handler = createCorosDailyHandler({ verifyRequest: () => { calls++; return true }, ingestAuthorizedBatch: () => { calls++ } })
  for (const query of ["", "signature=a&nonce=b", "signature=a&signature=b&nonce=c&timestamp=1"]) {
    assert.equal((await handler(request(query))).status, 401)
  }
  assert.equal(calls, 0)
})
test("failed verification cannot reach normalization storage", async () => {
  let writes = 0
  const handler = createCorosDailyHandler({ verifyRequest: async () => false, ingestAuthorizedBatch: () => { writes++ } })
  assert.equal((await handler(request())).status, 401)
  assert.equal(writes, 0)
})
test("acknowledgment requires complete commit receipt", async () => {
  for (const receipt of [null, { committed: false, processed: 1 }, { committed: true, processed: 0 }]) {
    const handler = createCorosDailyHandler({ verifyRequest: () => true, ingestAuthorizedBatch: () => receipt })
    const response = await handler(request())
    assert.equal(response.status, 503)
    assert.notEqual((await response.json()).result, "0000")
  }
  const handler = createCorosDailyHandler({ verifyRequest: () => true, ingestAuthorizedBatch: rows => ({ committed: true, processed: rows.length }) })
  assert.deepEqual(await (await handler(request())).json(), { result: "0000", message: "ok" })
})
test("internal exceptions do not disclose payload or secrets", async () => {
  const handler = createCorosDailyHandler({ verifyRequest: () => true, ingestAuthorizedBatch: () => { throw new Error("private provider material") } })
  const response = await handler(request())
  assert.equal(response.status, 503)
  assert.ok(!(await response.text()).includes("private provider material"))
})
