import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { PassThrough, Writable } from "node:stream"
import { test } from "node:test"
import path from "node:path"
import { fixtureEnvironment, projects, runFullSuite } from "./run-full-suite.mjs"

function fixture(options = {}) {
  const calls = [], stopped = [], signals = new EventEmitter(), messages = []
  let port = 39100, projectIndex = 0, serverIndex = 0, activeServer
  const output = new Writable({ write(chunk, _encoding, callback) { messages.push(String(chunk)); callback() } })
  const spawnChild = (_node, args, settings) => {
    calls.push({ args, settings })
    const child = new EventEmitter()
    child.exitCode = null; child.signalCode = null
    child.stdout = new PassThrough(); child.stderr = new PassThrough()
    child.kill = () => { child.signalCode = "SIGTERM"; child.emit("exit", null, "SIGTERM"); return true }
    if (args.includes("test")) {
      projectIndex += 1
      const index = projectIndex
      queueMicrotask(() => {
        if (options.interruptAt === index) signals.emit("SIGTERM")
        if (options.serverExitAt === index) activeServer.exitCode = 9
        if (options.spawnErrorAt === index) { child.emit("error", Error("Playwright could not start")); return }
        child.exitCode = options.failAt === index ? 7 : 0
        child.emit("exit", child.exitCode, null)
      })
    } else {
      serverIndex += 1
      child.laneIndex = serverIndex
      activeServer = child
      if (options.missingFixture && serverIndex === 2) throw Error("Fixture server is missing")
    }
    return child
  }
  return {
    calls, stopped, signals, messages,
    appDirectory: "/synthetic/app", environment: { CI: "true", PATH: "/synthetic/bin", VITE_SECRET: "not-forwarded", SECRET: "not-forwarded" },
    stdout: output, stderr: output, spawnChild,
    selectPort: async () => ++port,
    waitForServer: async (_port, child) => { if (options.startFailureAt === child.laneIndex) throw Error("Server did not start") },
    stopServer: async child => {
      stopped.push(child)
      if (options.cleanupFailureAt !== undefined && options.cleanupFailureAt === child.laneIndex) throw Error("Server did not terminate")
      child.kill()
    },
  }
}
const children = value => value.calls.filter(call => call.args.includes("test"))
const succeeded = value => value.messages.some(message => message.includes("[full-e2e] SUCCESS"))

test("success requires both lanes, all four projects and both owned servers cleaned", async () => {
  const value = fixture(), result = await runFullSuite(value)
  assert.deepEqual(result, { code: 0, completedProjects: 8, completedLanes: 2, cleanedServers: 2 })
  assert.equal(succeeded(value), true)
  assert.equal(value.stopped.length, 2)
  assert.deepEqual(children(value).map(call => call.args.find(arg => arg.startsWith("--project="))), [...projects, ...projects].map(project => `--project=${project}`))
  assert.deepEqual(children(value).map(call => call.args.find(arg => arg.startsWith("--config="))), [
    ...projects.map(() => "--config=playwright.config.ts"),
    ...projects.map(() => "--config=playwright.browser-fixtures.config.ts"),
  ])
  assert.equal(new Set(children(value).map(call => call.settings.env.PLAYWRIGHT_BASE_URL)).size, 2)
  assert(value.calls.every(call => call.settings.windowsHide === true && call.settings.shell === false))
  assert(children(value).every(call => call.args.includes("--workers=1") && call.args.includes("--no-deps") && !call.args.some(arg => /timeout|retries|grep|pass-with-no-tests/u.test(arg))))
  assert(children(value).every(call => call.settings.env.CI === "true" && call.settings.env.PLAYWRIGHT_EXTERNAL_SERVER === "1"))
  assert.equal(value.signals.listenerCount("SIGTERM"), 0)
  assert.equal(value.signals.listenerCount("SIGINT"), 0)
})

test("fixture server receives only runtime environment and isolated loopback port", () => {
  assert.deepEqual(fixtureEnvironment({ PATH: "runtime", SystemRoot: "os", CI: "true", VITE_ACCOUNT: "never", SECRET: "never", NODE_OPTIONS: "never" }, 39102), {
    PATH: "runtime", SystemRoot: "os", NODE_ENV: "development", PLAYWRIGHT_PORT: "39102",
  })
})

test("each invocation preserves prior evidence with unique per-run lane/project output", async () => {
  const first = fixture(), second = fixture()
  await runFullSuite(first); await runFullSuite(second)
  const outputs = value => children(value).map(call => call.args.find(arg => arg.startsWith("--output="))?.slice("--output=".length))
  const all = [...outputs(first), ...outputs(second)]
  assert.equal(new Set(all).size, 16)
  const evidenceRoot = path.resolve(first.appDirectory, "test-results")
  for (const output of all) {
    assert.equal(typeof output, "string")
    const relative = path.relative(evidenceRoot, output)
    assert.equal(path.isAbsolute(relative), false)
    assert.equal(relative.startsWith(".."), false)
    assert.equal(relative.split(path.sep)[0], "full-browser")
    assert.equal(relative.split(path.sep).length, 4)
  }
  assert.deepEqual(outputs(first).map(output => path.basename(output)), [...projects, ...projects])
})

test("rejects narrowing runner arguments before spawning any lane", async () => {
  for (const argv of [["--project=desktop-chromium"], ["--grep=one"], ["--pass-with-no-tests"], ["--timeout=999999"]]) {
    const value = fixture()
    await assert.rejects(runFullSuite({ ...value, argv }), /does not accept narrowing/u)
    assert.equal(value.calls.length, 0)
  }
})

test("built lane failure is nonzero, closes its server and never claims missing fixture lane passed", async () => {
  const value = fixture({ failAt: 2 }), result = await runFullSuite(value)
  assert.equal(result.code, 1); assert.equal(result.completedProjects, 1); assert.equal(result.completedLanes, 0)
  assert.equal(children(value).length, 2); assert.equal(value.stopped.length, 1); assert.equal(succeeded(value), false)
})

test("fixture lane failure is nonzero even after all built-preview projects passed", async () => {
  const value = fixture({ failAt: 5 }), result = await runFullSuite(value)
  assert.equal(result.code, 1); assert.equal(result.completedProjects, 4); assert.equal(result.completedLanes, 1)
  assert.equal(children(value).length, 5); assert.equal(value.stopped.length, 2); assert.equal(succeeded(value), false)
})

test("missing fixture server cannot produce full success after the built lane", async () => {
  const value = fixture({ missingFixture: true }), result = await runFullSuite(value)
  assert.equal(result.code, 1); assert.equal(result.completedProjects, 4); assert.equal(result.cleanedServers, 1)
  assert.equal(children(value).length, 4); assert.equal(succeeded(value), false)
})

for (const laneIndex of [1, 2]) {
  test(`lane ${laneIndex} startup failure closes the owned process and stops the gate`, async () => {
    const value = fixture({ startFailureAt: laneIndex }), result = await runFullSuite(value)
    assert.equal(result.code, 1); assert.equal(result.cleanedServers, laneIndex)
    assert.equal(children(value).length, (laneIndex - 1) * 4); assert.equal(succeeded(value), false)
    assert.equal(value.signals.listenerCount("SIGINT"), 0)
  })
  test(`lane ${laneIndex} cleanup failure cannot return success`, async () => {
    const value = fixture({ cleanupFailureAt: laneIndex }), result = await runFullSuite(value)
    assert.equal(result.code, 1); assert.equal(result.cleanedServers, laneIndex - 1)
    assert.equal(children(value).length, laneIndex * 4); assert.equal(succeeded(value), false)
  })
}

test("server exit during a successful test child still fails the gate", async () => {
  const value = fixture({ serverExitAt: 5 }), result = await runFullSuite(value)
  assert.equal(result.code, 1); assert.equal(result.completedProjects, 4); assert.equal(succeeded(value), false)
  assert.equal(value.stopped.length, 2)
})

test("interruption cannot turn a zero child exit into success or start another project", async () => {
  const value = fixture({ interruptAt: 5 }), result = await runFullSuite(value)
  assert.equal(result.code, 143); assert.equal(result.completedProjects, 4); assert.equal(succeeded(value), false)
  assert.equal(children(value).length, 5); assert.equal(value.signals.listenerCount("SIGTERM"), 0)
})

test("Playwright spawn error fails and cleans up the project and server", async () => {
  const value = fixture({ spawnErrorAt: 5 }), result = await runFullSuite(value)
  assert.equal(result.code, 1); assert.equal(result.completedProjects, 4); assert.equal(succeeded(value), false)
  assert.equal(value.stopped.length, 3)
})
