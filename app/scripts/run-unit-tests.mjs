import { spawn } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { StringDecoder } from "node:string_decoder"

export const HEAVY_FILES = Object.freeze([
  "src/screens/PlanBeta.contract.test.tsx",
  "src/domain/lt-pilot-runtime-v3.contract.test.tsx",
  "src/domain/rpe-adjusted-slot-v3.contract.test.ts",
])
const APP_ROOT = fileURLToPath(new URL("../", import.meta.url))
const VITEST_CLI = fileURLToPath(new URL("../node_modules/vitest/vitest.mjs", import.meta.url))
const EXCLUDES = HEAVY_FILES.flatMap(file => ["--exclude", file])
const SERIAL = ["--maxWorkers=1", "--no-file-parallelism"]

export function parseArgs(argv) {
  let config, inventoryOnly = false
  for (let index = 0; index < argv.length; index++) {
    const arg = argv[index]
    if (arg === "--inventory-only" && !inventoryOnly) { inventoryOnly = true; continue }
    if ((arg === "--config" || arg === "-c") && config === undefined) {
      config = argv[++index]
      if (config !== "vitest.config.ts" && config !== "vitest.config.kst.ts") throw Error("Unsupported unit-test config")
      continue
    }
    throw Error("Unsupported unit-test argument; use installed Vitest directly for focused checks")
  }
  return { configArgs: config ? ["--config", config] : [], inventoryOnly }
}

export function parseInventory(stdout, cwd = APP_ROOT) {
  let rows
  try { rows = JSON.parse(stdout) } catch { throw Error("Vitest file inventory is not valid JSON") }
  if (!Array.isArray(rows) || rows.length === 0) throw Error("Vitest file inventory must be a nonempty array")
  const files = rows.map(row => {
    if (!row || typeof row.file !== "string" || row.file.length === 0
      || (row.projectName !== undefined && row.projectName !== "")) throw Error("Unsupported Vitest file inventory entry")
    const relative = path.relative(cwd, path.resolve(cwd, row.file)).split(path.sep).join("/")
    if (!relative.startsWith("src/") || !/\.test\.(ts|tsx)$/u.test(relative)) throw Error("Vitest inventory file is outside the app test scope")
    return relative
  })
  if (new Set(files).size !== files.length) throw Error("Duplicate file in Vitest inventory")
  return files
}

export function validatePartition(all, normal, heavy) {
  for (const files of [all, normal, heavy]) {
    if (!Array.isArray(files) || !files.length || new Set(files).size !== files.length) throw Error("Empty or duplicate unit-test group")
  }
  const total = new Set(all), main = new Set(normal), isolated = new Set(heavy)
  if (heavy.length !== HEAVY_FILES.length || HEAVY_FILES.some(file => !isolated.has(file) || !total.has(file))) {
    throw Error("Heavy group must contain exactly the three configured files")
  }
  if (normal.some(file => isolated.has(file))) throw Error("Unit-test groups overlap")
  const union = new Set([...normal, ...heavy])
  if (union.size !== total.size || [...union].some(file => !total.has(file))) throw Error("Unit-test partition does not cover the configured inventory")
  return { total: all.length, normal: normal.length, heavy: heavy.length }
}

// Do not use a shell or print environment/credentials. Inventory output is
// captured strictly as JSON; real tests inherit their ordinary output.
export function runChild(args, { capture = false, cwd = APP_ROOT, spawnImpl = spawn, signalSource = process } = {}) {
  return new Promise((resolve, reject) => {
    let child
    try {
      child = spawnImpl(process.execPath, [VITEST_CLI, ...args], {
        cwd, shell: false, windowsHide: true,
        stdio: capture ? ["ignore", "pipe", "inherit"] : "inherit",
      })
    } catch { reject(Error("Unable to start installed Vitest")); return }
    let output = "", bytes = 0, forwardedSignal = null, settled = false
    const decoder = new StringDecoder("utf8")
    const signals = ["SIGINT", "SIGTERM"]
    const forward = signal => { forwardedSignal = signal; child.kill(signal) }
    const handlers = signals.map(signal => () => forward(signal))
    const cleanup = () => signals.forEach((signal, index) => signalSource.removeListener(signal, handlers[index]))
    const fail = error => { if (!settled) { settled = true; cleanup(); reject(error) } }
    signals.forEach((signal, index) => signalSource.on(signal, handlers[index]))
    child.once("error", () => fail(Error("Unable to start installed Vitest")))
    if (capture) child.stdout.on("data", chunk => {
      if (settled) return
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, "utf8")
      bytes += buffer.length
      if (bytes > 1024 * 1024) { fail(Error("Vitest inventory exceeds capture limit")); child.kill("SIGTERM"); return }
      output += decoder.write(buffer)
    })
    child.once("close", (code, signal) => {
      if (settled) return
      settled = true; cleanup()
      resolve({ code, signal: forwardedSignal ?? signal, stdout: output + (capture ? decoder.end() : "") })
    })
  })
}

function failed(result) { return result.signal !== null || result.code !== 0 }

export async function runUnitTests({ argv = [], child = runChild, log = console.log, cwd = APP_ROOT } = {}) {
  const { configArgs, inventoryOnly } = parseArgs(argv)
  const selections = [[], EXCLUDES, [...HEAVY_FILES, ...SERIAL]]
  const inventories = []
  for (const selection of selections) {
    const result = await child(["list", ...configArgs, ...selection, "--filesOnly", "--json"], { capture: true, cwd })
    if (failed(result)) return result
    inventories.push(parseInventory(result.stdout, cwd))
  }
  const counts = validatePartition(...inventories)
  log(`Unit-test partition verified: ${counts.normal} normal + ${counts.heavy} heavy = ${counts.total} configured files`)
  if (inventoryOnly) {
    log("Inventory only: no tests executed")
    return { code: 0, signal: null, counts }
  }
  const normal = await child(["run", ...configArgs, ...EXCLUDES], { cwd })
  if (failed(normal)) return normal
  return child(["run", ...configArgs, ...HEAVY_FILES, ...SERIAL], { cwd })
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = await runUnitTests({ argv: process.argv.slice(2) })
    if (result.signal) {
      // Re-emit termination after removing forwarding handlers; a killed child
      // must never become a successful gate or start another group.
      process.exitCode = 1
      process.kill(process.pid, result.signal)
    } else process.exitCode = Number.isInteger(result.code) ? result.code : 1
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Unit-test scheduling failed")
    process.exitCode = 1
  }
}
