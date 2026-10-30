import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { runInNewContext } from "node:vm"
import test from "node:test"

let handler
runInNewContext(readFileSync(new URL("../functions/device-integration-status/index.ts", import.meta.url), "utf8"), {
  Deno: { serve: value => { handler = value } }, Response,
})

test("public readiness reports release availability without inferring a personal connection or provider approval", async () => {
  const response = handler(new Request("https://example.test/device-integration-status"))
  assert.equal(response.status, 200)
  assert.equal(response.headers.get("cache-control"), "no-store")
  const body = await response.json()
  assert.equal(body.schemaVersion, 2)
  assert.equal(body.stage, "CONNECTIONS_NOT_ENABLED")
  assert.equal(body.publicUserLinking, false)
  assert.equal(body.dataIngestion, "FAIL_CLOSED")
  assert.equal(body.operational, undefined)
  assert.deepEqual(Object.keys(body.providerDetails), ["GARMIN", "COROS"])
  for (const details of Object.values(body.providerDetails)) {
    assert.deepEqual(details, { apiAvailability: "NOT_ENABLED", accountConnection: "NOT_DISCLOSED",
      applicationStatus: "NOT_REPORTED", requiresUserAuthorization: true })
  }
})

test("status remains read-only and HEAD returns no payload", async () => {
  const head = handler(new Request("https://example.test/status", { method: "HEAD" }))
  assert.equal(head.status, 200)
  assert.equal(await head.text(), "")
  for (const method of ["POST", "PUT", "DELETE"]) {
    const response = handler(new Request("https://example.test/status", { method }))
    assert.equal(response.status, 405)
    assert.equal(response.headers.get("allow"), "GET, HEAD")
  }
})
