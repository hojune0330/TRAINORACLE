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

export async function runFullSuite({
  argv = [],
  appDirectory = process.cwd(), environment = process.env,
  spawnChild = spawn, selectPort = reservePort, waitForServer = waitForPreview,
  stopServer = stopPreview, signals = process,
  stdout = process.stdout, stderr = process.stderr,
} = {}) {
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
    for (const lane of lanes) {
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
        stdout.write(`[full-e2e] lane=${lane.name} server=READY port=${port} projects=${projects.length}\n`)
        for (const project of projects) {
          if (interruptedSignal !== null) throw Error("Interrupted before project start")
          stdout.write(`[full-e2e] lane=${lane.name} project=${project} result=STARTED\n`)
          activeProject = spawnChild(process.execPath, [
            playwrightPath, "test", `--config=${lane.config}`, `--project=${project}`,
            "--no-deps", "--workers=1",
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
          stdout.write(`[full-e2e] lane=${lane.name} project=${project} result=PASS exit=0\n`)
        }
        completedLanes += 1
      } finally {
        if (activeProject !== null) { await stopServer(activeProject); activeProject = null }
        await stopServer(activeServer)
        activeServer = null
        cleanedServers += 1
      }
    }
    // A removed, skipped or partially completed lane is never a full-suite pass.
    if (completedLanes !== 2 || cleanedServers !== 2 || completedProjects !== projects.length * 2) {
      throw Error("Both browser lanes and all four projects must complete and clean up")
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
  if (code === 0) {
    stdout.write(`[full-e2e] SUCCESS lanes=${completedLanes}/2 projects=${completedProjects}/8 serverCleanup=PASS\n`)
  } else {
    const reason = interruptedSignal === null ? failure instanceof Error ? failure.message : String(failure) : `Interrupted by ${interruptedSignal}`
    stderr.write(`[full-e2e] FAILURE lanes=${completedLanes}/2 projects=${completedProjects}/8 serverCleanup=${cleanedServers}/2 reason=${reason}\n`)
  }
  return { code, completedProjects, completedLanes, cleanedServers }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 2) throw Error("The full browser gate does not accept narrowing arguments")
    // This Node test is not a Playwright case; make it a mandatory gate here.
    const selfTests = spawn(process.execPath, ["--test", path.join(process.cwd(), "e2e", "run-full-suite.test.mjs")], {
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
