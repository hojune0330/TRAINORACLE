import { spawn } from "node:child_process"
import http from "node:http"
import { createServer } from "node:net"
import path from "node:path"
import process from "node:process"

const projects = [
  "desktop-chromium",
  "mobile-chromium",
  "touch-narrow",
  "reduced-motion",
]
const appDirectory = process.cwd()
const vitePath = path.join(appDirectory, "node_modules", "vite", "bin", "vite.js")
const playwrightPath = path.join(appDirectory, "node_modules", "@playwright", "test", "cli.js")
const port = await reservePort()
const baseUrl = `http://127.0.0.1:${port}`
let activeProject = null
let interruptedSignal = null

const preview = spawn(process.execPath, [
  vitePath,
  "preview",
  "--host",
  "127.0.0.1",
  "--port",
  String(port),
], {
  cwd: appDirectory,
  stdio: ["ignore", "pipe", "pipe"],
  windowsHide: true,
})
preview.stdout.pipe(process.stdout)
preview.stderr.pipe(process.stderr)

const signalHandlers = new Map(["SIGINT", "SIGTERM"].map((signal) => {
  const handler = () => {
    interruptedSignal ??= signal
    activeProject?.kill()
    preview.kill()
  }
  process.once(signal, handler)
  return [signal, handler]
}))

let failure = null
let completedProjects = 0
let serverCleanupPassed = false

try {
  await waitForPreview(port, preview)
  process.stdout.write(`[full-e2e] server=READY port=${port} projects=${projects.length}\n`)

  for (const project of projects) {
    process.stdout.write(`[full-e2e] project=${project} result=STARTED\n`)
    activeProject = spawn(process.execPath, [
      playwrightPath,
      "test",
      `--project=${project}`,
      "--no-deps",
      "--workers=1",
    ], {
      cwd: appDirectory,
      env: {
        ...process.env,
        PLAYWRIGHT_EXTERNAL_SERVER: "1",
        PLAYWRIGHT_BASE_URL: baseUrl,
        PLAYWRIGHT_PORT: String(port),
      },
      stdio: "inherit",
      windowsHide: true,
    })
    const exitCode = await processExit(activeProject)
    activeProject = null
    if (exitCode !== 0) throw new Error(`Project ${project} exited with ${exitCode}`)
    if (preview.exitCode !== null || preview.signalCode !== null) {
      throw new Error(`Preview exited during project ${project}`)
    }
    completedProjects += 1
    process.stdout.write(`[full-e2e] project=${project} result=PASS exit=0\n`)
  }
} catch (error) {
  failure = error
} finally {
  activeProject?.kill()
  try {
    await stopPreview(preview)
    serverCleanupPassed = true
  } catch (error) {
    failure ??= error
  }
  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler)
}

if (failure === null && interruptedSignal === null) {
  process.stdout.write(`[full-e2e] SUCCESS projects=${completedProjects}/${projects.length} serverCleanup=PASS\n`)
} else {
  const reason = interruptedSignal === null
    ? failure instanceof Error ? failure.message : String(failure)
    : `Interrupted by ${interruptedSignal}`
  process.stderr.write(`[full-e2e] FAILURE projects=${completedProjects}/${projects.length} serverCleanup=${serverCleanupPassed ? "PASS" : "FAIL"} reason=${reason}\n`)
  process.exitCode = interruptedSignal === "SIGINT" ? 130 : interruptedSignal === "SIGTERM" ? 143 : 1
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
    if (child.exitCode !== null) throw new Error(`Preview exited with ${child.exitCode}`)
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
