const fs = require("node:fs")
const path = require("node:path")
const crypto = require("node:crypto")
const Module = require("node:module")
const { createRequire } = Module
const childProcess = require("node:child_process")
const spawned = []
const realSpawn = childProcess.spawn
childProcess.spawn = function (...args) {
  const child = realSpawn.apply(this, args)
  const record = { pid: child.pid, file: args[0], exited: false, exitCode: null, signal: null, child }
  spawned.push(record)
  child.once("exit", (code, signal) => Object.assign(record, { exited: true, exitCode: code, signal }))
  return child
}
const root = path.resolve(__dirname, "../..")
const appRequire = createRequire(path.join(root, "app/package.json"))
const esbuild = appRequire("esbuild")
const sha = value => crypto.createHash("sha256").update(value).digest("hex")
const posix = value => value.split(path.sep).join("/")
const label = process.argv.find(arg => arg.startsWith("--label="))?.slice("--label=".length)
  ?? (process.argv.includes("--snapshot") ? "snapshot" : "initial")
if (!/^[a-z0-9-]+$/.test(label)) throw Error("Invalid report label")
const captured = process.argv.includes("--snapshot")
  ? JSON.parse(fs.readFileSync(path.join(__dirname, "source-initial.json"), "utf8")).sources : {}
const sources = {}
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function cleanup() {
  esbuild.stop()
  for (let i = 0; i < 20 && spawned.some(r => !r.exited); i++) await pause(50)
  for (const record of spawned.filter(r => !r.exited)) record.child.kill()
  for (let i = 0; i < 20 && spawned.some(r => !r.exited); i++) await pause(50)
}

async function build(mutation) {
  const result = await esbuild.build({ entryPoints: [path.join(__dirname, "focused-review.ts")], bundle: true,
    write: false, platform: "node", format: "cjs", target: "node22",
    tsconfig: path.join(root, "app/tsconfig.json"), alias: { "@impl": path.join(root, "impl/src") },
    define: { "import.meta.env": "{}" },
    plugins: [{ name: "capture-local-source", setup(build) {
      build.onLoad({ filter: /\.(ts|tsx|mjs|cjs|js|json)$/ }, args => {
        if (args.path.includes(`${path.sep}node_modules${path.sep}`) || !args.path.startsWith(root + path.sep)) return
        const relative = posix(path.relative(root, args.path))
        const content = captured[relative]?.text ?? sources[relative]?.text ?? fs.readFileSync(args.path, "utf8")
        sources[relative] = { sha256: sha(content), text: content }
        let text = content
        if (mutation === "reject-all-sources" && relative === "app/src/domain/execution-replan-source.ts") {
          text = text.replace(/(export function resolveExecutionReplanSource[^\n]*\{\r?\n)/, "$1  return null\n")
          if (text === content) throw Error("reject-all-sources mutation did not apply")
        }
        if (mutation === "ignore-overlap" && relative === "app/src/domain/execution-replan.ts") {
          text = text.replace("const conflict = input.entries.filter", "const detectedConflict = input.entries.filter")
            .replace("  const review = reviewPlanExecution", "  const conflict = false\n  const review = reviewPlanExecution")
          if (text === content) throw Error("ignore-overlap mutation did not apply")
        }
        const extension = path.extname(args.path).slice(1)
        return { contents: text, loader: extension === "ts" || extension === "tsx" || extension === "json" ? extension : "js",
          resolveDir: path.dirname(args.path) }
      })
    } }] })
  const filename = path.join(__dirname, "memory-only.cjs")
  const loaded = new Module(filename, module)
  loaded.filename = filename
  loaded.paths = Module._nodeModulePaths(path.join(root, "app"))
  loaded._compile(result.outputFiles[0].text, filename)
  return loaded.exports
}

async function main() {
  const startedAt = new Date().toISOString()
  let results, sensitivity
  try {
    results = (await build()).runReview()
    sensitivity = [
      { mutation: "reject-all-sources", results: (await build("reject-all-sources")).runReview(["B01-mixed-multiple-manual-and-execution"]) },
      { mutation: "ignore-overlap", results: (await build("ignore-overlap")).runReview(["B05-overlapping-journals-across-three-versions"]) },
    ]
  } finally { await cleanup() }
  const targets = ["app/src/domain/execution-replan-source.ts", "app/src/domain/execution-replan.ts"]
  const sourceManifest = targets.map(file => ({ file, testedSha256: sources[file]?.sha256,
    endSha256: sha(fs.readFileSync(path.join(root, file))), changedDuringReview: sources[file]?.sha256 !== sha(fs.readFileSync(path.join(root, file))) }))
  const report = { startedAt, finishedAt: new Date().toISOString(), pid: process.pid, node: process.version,
    mode: label, sourceManifest, dependenciesCaptured: Object.keys(sources).length,
    results, sensitivity, cleanup: { esbuildStopped: true,
      ownedChildren: spawned.map(({ child, ...record }) => record), residualChildren: spawned.filter(r => !r.exited).map(r => r.pid),
      systemWideProcessInspection: "not available: CIM access denied; own spawn handles tracked instead" } }
  fs.writeFileSync(path.join(__dirname, `run-${label}.json`), JSON.stringify(report, null, 2) + "\n")
  fs.writeFileSync(path.join(__dirname, `source-${label}.json`), JSON.stringify({ sources }, null, 2) + "\n")
  console.log(JSON.stringify(report, null, 2))
  process.exitCode = results.some(r => r.status === "FAIL") ? 1 : 0
}
main().catch(async error => { await cleanup(); console.error(error); process.exitCode = 2 })
