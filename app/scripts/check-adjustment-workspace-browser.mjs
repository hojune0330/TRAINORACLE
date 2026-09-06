import assert from "node:assert/strict"
import { fileURLToPath } from "node:url"
import { build } from "esbuild"
import { chromium } from "@playwright/test"

// TEST-only page, intercepted locally. No app account, external server or health data.
const appRoot = fileURLToPath(new URL("../", import.meta.url))
const compiled = await build({
  stdin: { contents: `
    export { openAdjustmentSessionWorkspace, ADJUSTMENT_WORKSPACE_SESSION_KEY } from './src/domain/adjustment-workspace-session';
    export { createAdjustmentCommitController } from './src/domain/prescription-adjustment-commit';
    export { adjustmentCommitFixture } from './src/domain/prescription-adjustment-commit.test-fixtures';
  `, resolveDir: appRoot, loader: "ts" },
  absWorkingDir: appRoot, tsconfig: `${appRoot}tsconfig.json`, bundle: true, write: false,
  format: "iife", globalName: "__TO_WORKSPACE_TEST__", platform: "browser",
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
  logLevel: "silent",
})
const browser = await chromium.launch({ headless: true })
try {
  const context = await browser.newContext()
  const url = "http://127.0.0.1:4187/__adjustment-workspace-test/"
  await context.route("**/*", route => {
    const requested = route.request().url()
    if (requested === url) return route.fulfill({ contentType: "text/html", body: '<!doctype html><title>Workspace test</title><script src="./bundle.js"></script>' })
    if (requested === `${url}bundle.js`) return route.fulfill({ contentType: "text/javascript", body: compiled.outputFiles[0].text })
    return route.abort()
  })
  const page = await context.newPage()
  await page.goto(url)
  const initial = await page.evaluate(async () => {
    const api = window.__TO_WORKSPACE_TEST__
    const fixture = api.adjustmentCommitFixture()
    const opened = await api.openAdjustmentSessionWorkspace({ base: fixture.base,
      readEnvironment: fixture.adapter.readEnvironment, now: fixture.adapter.now })
    if (opened.kind !== "opened") throw Error(opened.code)
    const result = await api.createAdjustmentCommitController(opened.adapter).commit(fixture.input)
    return { result: result.kind, persisted: sessionStorage.getItem(api.ADJUSTMENT_WORKSPACE_SESSION_KEY) !== null,
      localWrites: localStorage.length, nativeLocks: typeof navigator.locks?.request === "function" }
  })
  assert.deepEqual(initial, { result: "committed", persisted: true, localWrites: 0, nativeLocks: true })
  await page.reload()
  const reloaded = await page.evaluate(async () => {
    const api = window.__TO_WORKSPACE_TEST__
    const f = api.adjustmentCommitFixture()
    const opened = await api.openAdjustmentSessionWorkspace({ base: f.base, readEnvironment: f.adapter.readEnvironment, now: f.adapter.now })
    if (opened.kind !== "opened") throw Error(opened.code)
    const before = sessionStorage.getItem(api.ADJUSTMENT_WORKSPACE_SESSION_KEY)
    const replay = await api.createAdjustmentCommitController(opened.adapter).commit(f.input)
    return { replay: replay.kind, unchanged: sessionStorage.getItem(api.ADJUSTMENT_WORKSPACE_SESSION_KEY) === before,
      samePrescription: JSON.stringify(opened.adapter.readState().prescription) === JSON.stringify(f.applied.prescription) }
  })
  assert.deepEqual(reloaded, { replay: "replayed", unchanged: true, samePrescription: true })
  const other = await context.newPage()
  await other.goto(url)
  assert.equal(await other.evaluate(() => sessionStorage.length), 0)
  const lockResult = await page.evaluate(async () => {
    const api = window.__TO_WORKSPACE_TEST__
    const f = api.adjustmentCommitFixture()
    return navigator.locks.request("trainoracle.plan-beta.mutation.v1", async () => {
      const result = await api.openAdjustmentSessionWorkspace({ base: f.base, readEnvironment: f.adapter.readEnvironment, now: f.adapter.now })
      return { kind: result.kind, code: result.code }
    })
  })
  assert.deepEqual(lockResult, { kind: "unavailable", code: "MUTATION_LOCK_UNAVAILABLE" })
  const discarded = await page.evaluate(async () => {
    const api = window.__TO_WORKSPACE_TEST__
    const f = api.adjustmentCommitFixture()
    const opened = await api.openAdjustmentSessionWorkspace({ base: f.base, readEnvironment: f.adapter.readEnvironment, now: f.adapter.now })
    if (opened.kind !== "opened") throw Error(opened.code)
    const result = await opened.discard()
    return { result, remaining: sessionStorage.length }
  })
  assert.deepEqual(discarded, { result: true, remaining: 0 })
  console.log(JSON.stringify({ status: "PASS", browser: "chromium", checks: [
    "native-lock-and-session-write", "reload-exact-replay", "separate-tab-isolation", "held-lock-rejection", "explicit-discard",
  ], network: "intercepted-local-test-page-only", realAthleteData: false }))
  await context.close()
} finally { await browser.close() }
