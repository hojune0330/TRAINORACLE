import { createServer } from "vite"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { readFile, writeFile } from "node:fs/promises"
const root = fileURLToPath(new URL("../../", import.meta.url))
const server = await createServer({ configFile: false, root, cacheDir: resolve(root, "app/node_modules/.vite-all-workout"),
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" })
try {
  const { buildAllWorkoutRuntimeCatalog } = await server.ssrLoadModule("/reports/research/all-workout-runtime-catalog.ts")
  const catalog = buildAllWorkoutRuntimeCatalog()
  const output = `${JSON.stringify(catalog, null, 2)}\n`
  const target = resolve(root, "impl/src/prescription/all-workout-catalog.json")
  if (process.argv.includes("--check")) {
    if (await readFile(target, "utf8") !== output) throw Error("ALL_WORKOUT_CATALOG_STALE")
  } else await writeFile(target, output)
  console.log(JSON.stringify({ count: catalog.rows.length, families: [...new Set(catalog.rows.map(c => c.family))] }))
} finally { await server.close() }
