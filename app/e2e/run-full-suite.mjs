import { spawn } from "node:child_process"
import http from "node:http"
import { createServer } from "node:net"
import { randomUUID } from "node:crypto"
import path from "node:path"
import process from "node:process"
import { fileURLToPath } from "node:url"

export const projects = Object.freeze([
  "desktop-chromium",
  "mobile-chromium",
  "touch-narrow",
  "reduced-motion",
])
const lanes = Object.freeze([
  { name: "built-preview", config: "playwright.config.ts" },
  { name: "browser-fixtures", config: "playwright.browser-fixtures.config.ts" },
])
export const laneNames = Object.freeze(lanes.map((lane) => lane.name))

// The fixture server needs only the OS runtime environment, never deployment
// values, credentials, VITE flags or .env files. Playwright retains its normal CI
// environment, including the unchanged generic retries and browser selection.
export function fixtureEnvironment(environment, port) {
  const allowed = /^(PATH|SYSTEMROOT|WINDIR|COMSPEC|TEMP|TMP|HOME|USERPROFILE|APPDATA|LOCALAPPDATA|PROGRAMDATA|PATHEXT|SYSTEMDRIVE)$/iu
  return {
    ...Object.fromEntries(Object.entries(environment).filter(([key]) => allowed.test(key))),
    NODE_ENV: "development",
    PLAYWRIGHT_PORT: String(port),
  }
}

export function runFullSuite(options = {}) {
  return runBrowserSuite(options, projects, lanes, "full-e2e")
}

// CI distributes the fixed project inventory across independent runners. Each
// project shard still owns and completes both lanes. The lane shard entry point
// below selects one member of the same fixed inventory; neither entry point can
// select a test file, grep, timeout or retry override.
export function runProjectSuite(project, options = {}) {
  if (!projects.includes(project)) throw Error("Unknown browser project")
  return runBrowserSuite(options, [project], lanes, "project-e2e")
}

export function runProjectLaneSuite(project, lane, options = {}) {
  if (!projects.includes(project)) throw Error("Unknown browser project")
  const selectedLane = lanes.find((candidate) => candidate.name === lane)
  if (selectedLane === undefined) throw Error("Unknown browser lane")
  return runBrowserSuite(options, [project], [selectedLane], "project-lane-e2e")
}

async function runBrowserSuite({
  argv = [],
  appDirectory = process.cwd(), environment = process.env,
  spawnChild = spawn, selectPort = reservePort, waitForServer = waitForPreview,
  stopServer = stopPreview, signals = process,
  stdout = process.stdout, stderr = process.stderr,
} = {}, requiredProjects, requiredLanes, runLabel) {
  if (argv.length !== 0) throw Error("The full browser gate does not accept narrowing arguments; run installed Playwright directly for focused checks")
  const vitePath = path.join(appDirectory, "node_modules", "vite", "bin", "vite.js")
  const playwrightPath = path.join(appDirectory, "node_modules", "@playwright", "test", "cli.js")
  // Playwright cleans its output directory before each invocation. Keep each
  // project in a new run's own directory, never the existing evidence root.
  const outputRoot = path.resolve(appDirectory, "test-results", "full-browser", randomUUID())
  let activeProject = null, activeServer = null, interruptedSignal = null
  let failure = null, completedProjects = 0, completedLanes = 0, cleanedServers = 0
  const signalHandlers = new Map(["SIGINT", "SIGTERM"].map((signal) => {
    const handler = () => {
      interruptedSignal ??= signal
      activeProject?.kill()
      activeServer?.kill()
    }
    signals.once(signal, handler)
    return [signal, handler]
  }))
  try {
    for (const lane of requiredLanes) {
      if (interruptedSignal !== null) throw Error("Interrupted before lane start")
      const port = await selectPort()
      const baseUrl = `http://127.0.0.1:${port}`
      const isFixture = lane.name === "browser-fixtures"
      const serverArgs = isFixture
        ? [path.join(appDirectory, "e2e", "browser-fixtures.setup.mjs")]
        : [vitePath, "preview", "--host", "127.0.0.1", "--port", String(port), "--strictPort"]
      activeServer = spawnChild(process.execPath, serverArgs, {
        cwd: appDirectory,
        env: isFixture ? fixtureEnvironment(environment, port) : environment,
        stdio: ["ignore", "pipe", "pipe"], shell: false, windowsHide: true,
      })
      activeServer.stdout.pipe(stdout)
      activeServer.stderr.pipe(stderr)
      // Observe spawn errors immediately, before the readiness loop's first await.
      let serverError = null
      activeServer.once("error", (error) => { serverError = error })
      try {
        await waitForServer(port, activeServer)
        if (serverError !== null) throw serverError
        stdout.write(`[${runLabel}] lane=${lane.name} server=READY port=${port} projects=${requiredProjects.length}\n`)
        for (const project of requiredProjects) {
          if (interruptedSignal !== null) throw Error("Interrupted before project start")
          stdout.write(`[${runLabel}] lane=${lane.name} project=${project} result=STARTED\n`)
          activeProject = spawnChild(process.execPath, [
            playwrightPath, "test", `--config=${lane.config}`, `--project=${project}`,
            "--no-deps", "--workers=1",
            // Stop a broken CI run after three final failures, with nonzero
            // status. This never narrows a passing run or changes retries.
            ...(environment.CI ? ["--max-failures=3"] : []),
            `--output=${path.join(outputRoot, lane.name, project)}`,
          ], {
            cwd: appDirectory,
            env: { ...environment, PLAYWRIGHT_EXTERNAL_SERVER: "1", PLAYWRIGHT_BASE_URL: baseUrl, PLAYWRIGHT_PORT: String(port) },
            stdio: "inherit", shell: false, windowsHide: true,
          })
          const exitCode = await processExit(activeProject)
          activeProject = null
          if (exitCode !== 0) throw Error(`${lane.name}/${project} exited with ${exitCode}`)
          if (serverError !== null) throw serverError
          if (activeServer.exitCode !== null || activeServer.signalCode !== null) throw Error(`${lane.name} server exited during ${project}`)
          if (interruptedSignal !== null) throw Error("Interrupted during project")
          completedProjects += 1
          stdout.write(`[${runLabel}] lane=${lane.name} project=${project} result=PASS exit=0\n`)
        }
        completedLanes += 1
      } finally {
        if (activeProject !== null) { await stopServer(activeProject); activeProject = null }
        await stopServer(activeServer)
        activeServer = null
        cleanedServers += 1
      }
    }
    // A removed, skipped or partially completed required lane is never a pass.
    const expectedProjects = requiredProjects.length * requiredLanes.length
    if (completedLanes !== requiredLanes.length || cleanedServers !== requiredLanes.length || completedProjects !== expectedProjects) {
      throw Error("Every required browser lane and project must complete and clean up")
    }
  } catch (error) {
    failure = error
  } finally {
    for (const child of [activeProject, activeServer]) {
      if (child !== null) { try { await stopServer(child) } catch (error) { failure ??= error } }
    }
    for (const [signal, handler] of signalHandlers) signals.removeListener(signal, handler)
  }
  const code = failure === null && interruptedSignal === null ? 0
    : interruptedSignal === "SIGINT" ? 130 : interruptedSignal === "SIGTERM" ? 143 : 1
  const expectedProjects = requiredProjects.length * requiredLanes.length
  if (code === 0) {
    stdout.write(`[${runLabel}] SUCCESS lanes=${completedLanes}/${requiredLanes.length} projects=${completedProjects}/${expectedProjects} serverCleanup=PASS\n`)
  } else {
    const reason = interruptedSignal === null ? failure instanceof Error ? failure.message : String(failure) : `Interrupted by ${interruptedSignal}`
    stderr.write(`[${runLabel}] FAILURE lanes=${completedLanes}/${requiredLanes.length} projects=${completedProjects}/${expectedProjects} serverCleanup=${cleanedServers}/${requiredLanes.length} reason=${reason}\n`)
  }
  return { code, completedProjects, completedLanes, cleanedServers }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw Error("The full browser gate does not accept narrowing arguments")
    // This Node test is not a Playwright case; make it a mandatory gate here.
    const selfTests = spawn(process.execPath, ["--test", path.join(process.cwd(), "e2e", "run-full-suite.test.mjs"),
      path.join(process.cwd(), "scripts", "ci-gates.test.mjs")], {
      stdio: "inherit", shell: false, windowsHide: true,
    })
    const selfTestCode = await processExit(selfTests)
    process.exitCode = selfTestCode === 0 ? (await runFullSuite()).code : selfTestCode
  }
  catch (error) { console.error(error instanceof Error ? error.message : "Browser gate failed"); process.exitCode = 1 }
}

async function reservePort() {
  const reservation = createServer()
  await new Promise((resolve, reject) => {
    reservation.once("error", reject)
    reservation.listen(0, "127.0.0.1", resolve)
  })
  const address = reservation.address()
  if (address === null || typeof address === "string") {
    reservation.close()
    throw new Error("Could not reserve an isolated preview port")
  }
  const selectedPort = address.port
  await new Promise((resolve, reject) => reservation.close((error) => (
    error === undefined ? resolve() : reject(error)
  )))
  return selectedPort
}

async function waitForPreview(selectedPort, child) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null || child.signalCode !== null) throw new Error(`Browser server exited with ${child.exitCode ?? child.signalCode}`)
    if (await responds(selectedPort)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Preview did not start on isolated port ${selectedPort}`)
}

function responds(selectedPort) {
  return new Promise((resolve) => {
    const request = http.get({ host: "127.0.0.1", port: selectedPort, path: "/" }, (response) => {
      response.resume()
      resolve(response.statusCode === 200)
    })
    request.once("error", () => resolve(false))
    request.setTimeout(500, () => {
      request.destroy()
      resolve(false)
    })
  })
}

function processExit(child) {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode)
  if (child.signalCode !== null) return Promise.resolve(1)
  return new Promise((resolve, reject) => {
    child.once("error", reject)
    child.once("exit", (code) => resolve(code ?? 1))
  })
}

async function stopPreview(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  child.kill()
  if (await exitsWithin(child, 2_000)) return
  child.kill("SIGKILL")
  if (!await exitsWithin(child, 2_000)) throw new Error("Preview did not terminate")
}

function exitsWithin(child, timeoutMs) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve(true)
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      child.removeListener("exit", onExit)
      resolve(false)
    }, timeoutMs)
    const onExit = () => {
      clearTimeout(timeout)
      resolve(true)
    }
    child.once("exit", onExit)
  })
}
