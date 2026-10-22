import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import { PassThrough, Writable } from "node:stream"
import { test } from "node:test"
import path from "node:path"
import { fixtureEnvironment, laneNames, projects, runFullSuite, runProjectLaneSuite, runProjectSuite } from "./run-full-suite.mjs"
import { parseProjectLane } from "./run-project-lane-suite.mjs"
import { parseProject } from "./run-project-suite.mjs"

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

test('CI bounds repeated failures without narrowing a successful run', async () => {
  const ci = fixture()
  await runFullSuite(ci)
  assert(children(ci).every(call => call.args.includes('--max-failures=3')))
  const local = fixture(); delete local.environment.CI
  await runFullSuite(local)
  assert(children(local).every(call => !call.args.some(arg => arg.startsWith('--max-failures'))))
  const failed = fixture({ failAt: 1 })
  const result = await runFullSuite(failed)
  assert.notEqual(result.code, 0)
  assert.equal(succeeded(failed), false)
  assert.equal(result.completedProjects, 0)
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

test("each configured project shard requires both lanes without reporting a full gate", async () => {
  const coverage = []
  for (const project of projects) {
    const value = fixture(), result = await runProjectSuite(project, value)
    assert.deepEqual(result, { code: 0, completedProjects: 2, completedLanes: 2, cleanedServers: 2 })
    const calls = children(value)
    assert.equal(calls.length, 2)
    assert(calls.every(call => call.args.includes(`--project=${project}`) && call.args.includes("--workers=1")))
    assert.deepEqual(calls.map(call => call.args.find(arg => arg.startsWith("--config="))), [
      "--config=playwright.config.ts", "--config=playwright.browser-fixtures.config.ts",
    ])
    assert.equal(new Set(calls.map(call => call.settings.env.PLAYWRIGHT_BASE_URL)).size, 2)
    assert.equal(value.stopped.length, 2)
    assert.equal(succeeded(value), false)
    assert(value.messages.some(message => message.includes("[project-e2e] SUCCESS lanes=2/2 projects=2/2")))
    coverage.push(...calls.map(call => `${project}:${call.args.find(arg => arg.startsWith("--config="))}`))
  }
  assert.equal(new Set(coverage).size, 8)
})

test("the fixed project and lane inventory produces exactly eight isolated lane shards", async () => {
  assert.deepEqual(laneNames, ["built-preview", "browser-fixtures"])
  assert.equal(Object.isFrozen(laneNames), true)
  const configs = {
    "built-preview": "playwright.config.ts",
    "browser-fixtures": "playwright.browser-fixtures.config.ts",
  }
  const coverage = []
  for (const project of projects) {
    for (const lane of laneNames) {
      const value = fixture(), result = await runProjectLaneSuite(project, lane, value)
      assert.deepEqual(result, { code: 0, completedProjects: 1, completedLanes: 1, cleanedServers: 1 })
      const calls = children(value)
      assert.equal(calls.length, 1)
      assert(calls[0].args.includes(`--project=${project}`))
      assert(calls[0].args.includes(`--config=${configs[lane]}`))
      assert(calls[0].args.includes("--workers=1"))
      assert.equal(value.stopped.length, 1)
      assert(value.messages.some(message => message.includes("[project-lane-e2e] SUCCESS lanes=1/1 projects=1/1")))
      assert.equal(value.messages.some(message => message.includes("[full-e2e] SUCCESS") || message.includes("[project-e2e] SUCCESS")), false)
      coverage.push(`${project}:${lane}`)
    }
  }
  assert.equal(new Set(coverage).size, projects.length * laneNames.length)
  assert.equal(coverage.length, 8)
})

test("project entry refuses unknown, missing, extra and narrowing arguments", async () => {
  for (const argv of [[], ["unknown"], [projects[0], "--grep=one"], [projects[0], "--pass-with-no-tests"]]) {
    assert.throws(() => parseProject(argv), /exactly one configured/u)
  }
  for (const project of projects) assert.equal(parseProject([project]), project)
  const value = fixture()
  assert.throws(() => runProjectSuite("unknown", value), /Unknown browser project/u)
  await assert.rejects(runProjectSuite(projects[0], { ...value, argv: ["--grep=one"] }), /does not accept narrowing/u)
  assert.equal(value.calls.length, 0)
})

test("project lane entry accepts only the fixed pair and rejects every narrowing argument", async () => {
  for (const project of projects) {
    for (const lane of laneNames) assert.deepEqual(parseProjectLane([project, lane]), { project, lane })
  }
  for (const argv of [[], [projects[0]], ["unknown", laneNames[0]], [projects[0], "unknown"],
    [projects[0], laneNames[0], "--grep=one"], [projects[0], laneNames[0], "one.spec.ts"],
    [projects[0], laneNames[0], "--timeout=999999"], [projects[0], laneNames[0], "--retries=9"]]) {
    assert.throws(() => parseProjectLane(argv), /exactly one configured project and one configured lane/u)
  }
  assert.throws(() => runProjectLaneSuite("unknown", laneNames[0]), /Unknown browser project/u)
  assert.throws(() => runProjectLaneSuite(projects[0], "unknown"), /Unknown browser lane/u)
  const value = fixture()
  await assert.rejects(runProjectLaneSuite(projects[0], laneNames[0], { ...value, argv: ["--grep=one"] }), /does not accept narrowing/u)
  assert.equal(value.calls.length, 0)
})

test("a single lane failure is nonzero and cleans its owned server", async () => {
  for (const lane of laneNames) {
    const failed = fixture({ failAt: 1 }), failedResult = await runProjectLaneSuite(projects[0], lane, failed)
    assert.deepEqual(failedResult, { code: 1, completedProjects: 0, completedLanes: 0, cleanedServers: 1 })
    assert.equal(children(failed).length, 1)
    assert.equal(failed.stopped.length, 1)
    assert.equal(failed.messages.some(message => message.includes("[project-lane-e2e] SUCCESS")), false)

    const startup = fixture({ startFailureAt: 1 }), startupResult = await runProjectLaneSuite(projects[0], lane, startup)
    assert.deepEqual(startupResult, { code: 1, completedProjects: 0, completedLanes: 0, cleanedServers: 1 })
    assert.equal(children(startup).length, 0)
    assert.equal(startup.stopped.length, 1)
  }
})

test("project shard refuses either lane failure, missing fixture and interrupted success", async () => {
  for (const options of [{ failAt: 1 }, { failAt: 2 }, { missingFixture: true }, { interruptAt: 2 },
    { cleanupFailureAt: 2 }, { serverExitAt: 2 }, { spawnErrorAt: 2 }]) {
    const value = fixture(options), result = await runProjectSuite(projects[0], value)
    assert.notEqual(result.code, 0)
    assert.equal(value.messages.some(message => message.includes("[project-e2e] SUCCESS")), false)
    assert.equal(value.signals.listenerCount("SIGTERM"), 0)
  }
})
