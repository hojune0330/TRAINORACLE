import { createServer } from "vite"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { readFile, writeFile } from "node:fs/promises"
const root = fileURLToPath(new URL("../../", import.meta.url))
const server = await createServer({ configFile: false, root, cacheDir: resolve(root, "app/node_modules/.vite-catalog-audit"),
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" })
try {
  const { auditPrescriptionCatalog } = await server.ssrLoadModule("/reports/research/prescription-catalog-audit.ts")
  const report = auditPrescriptionCatalog()
  const output = `${JSON.stringify(report, null, 2)}\n`
  const target = resolve(root, "reports/review/PRESCRIPTION_CATALOG_AUDIT_2026-09-30.json")
  if (process.argv.includes("--check")) {
    if (await readFile(target, "utf8") !== output) throw Error("CATALOG_AUDIT_STALE")
  } else await writeFile(target, output)
  console.log(output)
} finally { await server.close() }
