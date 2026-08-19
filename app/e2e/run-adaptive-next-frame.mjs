import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createServer } from "node:net"
import http from "node:http"
import path from "node:path"
import process from "node:process"

const appDirectory = process.cwd()
const assetDirectory = path.join(appDirectory, "dist", "assets")
const indexHtml = await readFile(path.join(appDirectory, "dist", "index.html"), "utf8")
const entryMatch = indexHtml.match(/src="\.\/assets\/(index-[A-Za-z0-9_-]+\.js)"/u)
if (entryMatch === null) throw new Error("Could not find the current build entry asset")
const entrySource = await readFile(path.join(assetDirectory, entryMatch[1]), "utf8")
const planAssets = [...entrySource.matchAll(/PlanBeta-[A-Za-z0-9_-]+\.js/gu)]
  .map((match) => match[0])
  .filter((name, index, all) => all.indexOf(name) === index)
if (planAssets.length !== 1) {
  throw new Error(`Expected one PlanBeta asset in the current build entry, found ${planAssets.length}`)
}
const expectedAsset = planAssets[0]
const port = await reservePort()
if (port === 4173) throw new Error("Adaptive E2E may not use shared port 4173")

const vitePath = path.join(appDirectory, "node_modules", "vite", "bin", "vite.js")
const playwrightPath = path.join(appDirectory, "node_modules", "@playwright", "test", "cli.js")
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

try {
  await waitForPreview(port, preview)
  process.stdout.write(`[adaptive-e2e] port=${port} asset=${expectedAsset}\n`)
  const test = spawn(process.execPath, [
    playwrightPath,
    "test",
    "e2e/plan-adaptive-next-frame.spec.ts",
    "--project=desktop-chromium",
    "--workers=1",
  ], {
    cwd: appDirectory,
    env: {
      ...process.env,
      PLAYWRIGHT_EXTERNAL_SERVER: "1",
      PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`,
      PLAYWRIGHT_PORT: String(port),
      PLAYWRIGHT_EXPECTED_PORT: String(port),
      PLAYWRIGHT_EXPECTED_PLAN_BETA_ASSET: expectedAsset,
    },
    stdio: "inherit",
    windowsHide: true,
  })
  const exitCode = await processExit(test)
  if (exitCode !== 0) process.exitCode = exitCode
} finally {
  preview.kill()
  await Promise.race([
    processExit(preview),
    new Promise((resolve) => setTimeout(resolve, 2_000)),
  ])
  if (preview.exitCode === null) preview.kill("SIGKILL")
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

async function waitForPreview(port, preview) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (preview.exitCode !== null) throw new Error(`Preview exited with ${preview.exitCode}`)
    if (await responds(port)) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error(`Preview did not start on isolated port ${port}`)
}

function responds(port) {
  return new Promise((resolve) => {
    const request = http.get({ host: "127.0.0.1", port, path: "/" }, (response) => {
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
  return new Promise((resolve) => child.once("exit", (code) => resolve(code ?? 1)))
}
