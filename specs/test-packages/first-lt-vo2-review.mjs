import { readFileSync, writeFileSync, existsSync } from "node:fs"
import { createHash } from "node:crypto"
import { execFileSync } from "node:child_process"
import { dirname, resolve, relative } from "node:path"
import { fileURLToPath } from "node:url"
import ts from "../../app/node_modules/typescript/lib/typescript.js"
import { createServer } from "../../app/node_modules/vite/dist/node/index.js"

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..")
export const output = resolve(root, "reports/review/FIRST_LT_VO2_FULL_PLAN_REVIEW_PACKET_2026-09-08.json")
export const sha = bytes => `sha256:${createHash("sha256").update(bytes).digest("hex")}`
export const sourceHash = bytes => sha(bytes.toString("utf8").replaceAll("\r\n", "\n"))

// Only CRLF becomes LF. No trimming, JSON reserialization or whitespace folding.
export function sourceBindings() {
  const pending = ["reports/review/first-lt-vo2-full-plan-review.ts",
    "specs/test-packages/first-lt-vo2-review.mjs",
    "reports/review/TRAINING_ADOPTION_READY_PACKET_2026-09-08.md",
    "reports/review/METHOD_OWNER_REVIEW_BUNDLE_V3.json",
    "reports/review/OWNER_TRAINING_ADOPTION_REVIEW_ROUTE_2026-09-07.md",
    "specs/reconstruct/SESSION_METHOD_SELECTION_AND_ADJUSTMENT_CONTRACT.md",
    "app/src/domain/rpe-adjusted-slot-v3.ts", "app/src/domain/adjusted-plan-multi-review-v3.ts",
    "PRODUCT_NORTH_STAR.md", "AGENTS.md", "app/package.json", "app/package-lock.json"]
  const visited = new Set()
  while (pending.length) {
    const path = pending.pop()
    if (visited.has(path)) continue
    visited.add(path)
    const text = readFileSync(resolve(root, path), "utf8")
    if (!/\.(?:ts|tsx|mjs)$/.test(path)) continue
    for (const { fileName } of ts.preProcessFile(text, true, true).importedFiles) {
      if (fileName.includes("node_modules") || (!fileName.startsWith(".") && !fileName.startsWith("@impl/"))) continue
      const base = fileName.startsWith("@impl/") ? resolve(root, "impl/src", fileName.slice(6)) : resolve(root, dirname(path), fileName)
      const absolute = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, resolve(base, "index.ts")].find(p => existsSync(p) && /\.(?:ts|tsx|mjs|json)$/.test(p))
      if (!absolute) throw Error(`UNRESOLVED_LOCAL_SOURCE:${path}:${fileName}`)
      const next = relative(root, absolute).replaceAll("\\", "/")
      if (next.startsWith("../")) throw Error("SOURCE_OUTSIDE_REPOSITORY")
      pending.push(next)
    }
  }
  return [...visited].sort().map(path => ({ path, sha256: sourceHash(readFileSync(resolve(root, path))) }))
}

export async function loadReview({ refreshHead = false } = {}) {
  const server = await createServer({ root: resolve(root, "app"), configFile: false,
    resolve: { alias: { "@impl": resolve(root, "impl/src") } },
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true, hmr: false, watch: null }, appType: "custom" })
  try {
    const module = await server.ssrLoadModule(resolve(root, "reports/review/first-lt-vo2-full-plan-review.ts"))
    const gitOptions = { cwd: root, encoding: "utf8", windowsHide: true }
    const currentHead = execFileSync("git", ["rev-parse", "HEAD"], gitOptions).trim()
    const head = !refreshHead && existsSync(output) ? JSON.parse(readFileSync(output, "utf8")).sourceHead : currentHead
    // A later commit may contain this artifact. It cannot contain its own HEAD hash.
    if (!/^[a-f0-9]{40}$/.test(head)) throw Error("INVALID_SOURCE_BASELINE")
    try { execFileSync("git", ["merge-base", "--is-ancestor", head, currentHead], gitOptions) }
    catch { throw Error("SOURCE_BASELINE_NOT_ANCESTOR_OR_HISTORY_UNAVAILABLE_FETCH_HISTORY_FOR_CHECK") }
    const packet = module.buildFirstLvReview(head, sourceBindings())
    const savedBundle = JSON.parse(readFileSync(resolve(root, "reports/review/METHOD_OWNER_REVIEW_BUNDLE_V3.json"), "utf8"))
    if (packet.bundleIdentity.contentFingerprint !== savedBundle.contentFingerprint) throw Error("CURRENT_BUNDLE_REGENERATION_DRIFT")
    return { module, packet }
  } finally { await server.close() }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const mode = process.argv[2]
  if (!["--write", "--check"].includes(mode)) throw Error("Use --write or --check")
  const { module, packet } = await loadReview({ refreshHead: mode === "--write" })
  if (mode === "--write") writeFileSync(output, `${JSON.stringify(packet, null, 2)}\n`, "utf8")
  const saved = JSON.parse(readFileSync(output, "utf8"))
  console.log(JSON.stringify({ ...module.validateFirstLvReview(saved, packet),
    fileSha256: sha(readFileSync(output)), reviewContentHash: saved.reviewContentHash,
    currentContextReviewHash: saved.currentContextReviewHash, sourceFiles: saved.sourceFiles.length }, null, 2))
}
