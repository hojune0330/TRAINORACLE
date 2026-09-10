#!/usr/bin/env node
/*
 * 컬렉션 레지스트리(src/domain/decoration-collections.ts)에서
 *  - public/legal/open-source.html
 *  - public/collections/<dir>/assets.json
 * 을 생성한다. 손으로 고친 파일은 다음 실행 때 덮어써진다.
 *
 * 사용:
 *   node scripts/generate-collection-docs.mjs          # 파일 쓰기
 *   node scripts/generate-collection-docs.mjs --check  # 저장소 파일이 최신인지 검사(CI). 다르면 exit 1
 *
 * Node 20에서 TS를 직접 실행할 수 없어 esbuild로 한 번 번들한 뒤 import 한다.
 */
import { build } from "esbuild"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const publicDir = join(appRoot, "public")
const checkOnly = process.argv.includes("--check")

async function loadDocsModule() {
  const outDir = await mkdtemp(join(tmpdir(), "trainoracle-collection-docs-"))
  const outfile = join(outDir, "decoration-collection-docs.mjs")
  await build({
    entryPoints: [join(appRoot, "src/domain/decoration-collection-docs.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node20",
    outfile,
    logLevel: "silent",
  })
  const mod = await import(pathToFileURL(outfile).href)
  return { mod, cleanup: () => rm(outDir, { recursive: true, force: true }) }
}

async function sha256Of(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex")
}

const { mod, cleanup } = await loadDocsModule()
try {
  const { DECORATION_COLLECTIONS } = mod
  const problems = [...mod.validateCollectionRegistry(DECORATION_COLLECTIONS)]

  // 자산 파일 존재·해시 검증: 레지스트리에 적힌 sha256이 실제 배포 파일과 다르면 장부가 거짓이 된다.
  for (const collection of DECORATION_COLLECTIONS) {
    for (const item of collection.items) {
      const filePath = join(publicDir, collection.assetDir, item.fileName)
      let actual
      try {
        actual = await sha256Of(filePath)
      } catch {
        problems.push(`${item.id}: 자산 파일 없음 ${collection.assetDir}/${item.fileName}`)
        continue
      }
      if (item.sha256 !== undefined && item.sha256 !== actual) {
        problems.push(`${item.id}: sha256 불일치 (레지스트리 ${item.sha256.slice(0, 12)}… / 파일 ${actual.slice(0, 12)}…)`)
      }
    }
  }
  if (problems.length > 0) {
    console.error("[collection-docs] 레지스트리 검증 실패:")
    for (const problem of problems) console.error(`  - ${problem}`)
    process.exitCode = 1
  } else {
    const documents = mod.renderCollectionDocuments(DECORATION_COLLECTIONS)
    let stale = 0
    for (const document of documents) {
      const target = join(publicDir, document.path)
      const current = await readFile(target, "utf8").catch(() => null)
      if (current === document.content) {
        console.log(`[collection-docs] 최신: public/${document.path}`)
        continue
      }
      if (checkOnly) {
        stale += 1
        console.error(`[collection-docs] 갱신 필요: public/${document.path} (node scripts/generate-collection-docs.mjs 실행)`)
        continue
      }
      await mkdir(dirname(target), { recursive: true })
      await writeFile(target, document.content, "utf8")
      console.log(`[collection-docs] 작성: public/${document.path}`)
    }
    if (stale > 0) process.exitCode = 1
  }
} finally {
  await cleanup()
}
