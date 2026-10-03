import { build } from "esbuild"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { readFile, writeFile } from "node:fs/promises"
const root = fileURLToPath(new URL("../../", import.meta.url))
{
  const bundle = await build({ entryPoints: [resolve(root, "reports/research/all-workout-runtime-catalog.ts")],
    absWorkingDir: root, tsconfig: resolve(root, "app/tsconfig.json"), platform: "node", format: "esm",
    target: "node24", bundle: true, write: false, logLevel: "error" })
  const { buildAllWorkoutRuntimeCatalog } = await import(`data:text/javascript;base64,${Buffer.from(bundle.outputFiles[0].contents).toString("base64")}`)
  const catalog = buildAllWorkoutRuntimeCatalog()
  const output = `${JSON.stringify(catalog, null, 2)}\n`
  const target = resolve(root, "impl/src/prescription/all-workout-catalog.json")
  if (process.argv.includes("--check")) {
    if (await readFile(target, "utf8") !== output) throw Error("ALL_WORKOUT_CATALOG_STALE")
  } else await writeFile(target, output)
  console.log(JSON.stringify({ count: catalog.rows.length, families: [...new Set(catalog.rows.map(c => c.family))] }))
}
