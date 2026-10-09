#!/usr/bin/env node
/*
 * Builds public/legal/third-party-notices.html: every production package shipped in the app bundle
 * (walked from package-lock.json, dev dependencies excluded), with its version, license and the full
 * LICENSE / NOTICE text from node_modules, plus the bundled font.
 *
 *   node scripts/generate-third-party-notices.mjs          # write the file
 *   node scripts/generate-third-party-notices.mjs --check  # exit 1 if the committed file is stale
 *
 * Unit test src/legal/third-party-notices.contract.test.ts runs the same check, so `npm test` fails
 * when a dependency is added, removed or upgraded without regenerating the notice.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const output = join(appRoot, "public/legal/third-party-notices.html")
const normalize = text => text.replace(/\r\n/gu, "\n")
const escape = text => text.replace(/[&<>"]/gu, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[ch])

export function productionPackages(lock = JSON.parse(readFileSync(join(appRoot, "package-lock.json"), "utf8"))) {
  const root = lock.packages[""]
  const seen = new Map()
  const visit = (name, from = "") => {
    // npm v3 lockfiles resolve nested copies first, then the hoisted one.
    const candidates = [from && `${from}/node_modules/${name}`, `node_modules/${name}`].filter(Boolean)
    const path = candidates.find(item => lock.packages[item])
    if (!path || seen.has(path)) return
    const entry = lock.packages[path]
    if (entry.dev) return
    seen.set(path, { name, path, version: entry.version, license: entry.license ?? "UNKNOWN" })
    for (const dep of Object.keys({ ...entry.dependencies, ...entry.optionalDependencies })) visit(dep, path)
  }
  for (const dep of Object.keys(root.dependencies ?? {})) visit(dep)
  return [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "en") || a.version.localeCompare(b.version, "en"))
}

function licenseTexts(path) {
  const dir = join(appRoot, path)
  if (!existsSync(dir)) return []
  return readdirSync(dir).filter(file => /^(licen[cs]e|copying|notice)(\.(md|txt))?$/iu.test(file)).sort()
    .map(file => ({ file, text: normalize(readFileSync(join(dir, file), "utf8")).trim() }))
}

export function renderNotices(packages = productionPackages()) {
  const rows = packages.map(item => `<tr><td><a href="#${escape(item.name)}">${escape(item.name)}</a></td><td>${escape(item.version)}</td><td>${escape(item.license)}</td></tr>`).join("\n")
  const sections = packages.map(item => {
    const texts = licenseTexts(item.path)
    const body = texts.length
      ? texts.map(entry => `<h3>${escape(entry.file)}</h3>\n<pre>${escape(entry.text)}</pre>`).join("\n")
      : `<p>패키지에 라이선스 파일이 없어 package.json의 라이선스 표기(${escape(item.license)})를 따릅니다.</p>`
    return `<section id="${escape(item.name)}">\n<h2>${escape(item.name)} ${escape(item.version)}</h2>\n<p>라이선스: ${escape(item.license)}</p>\n${body}\n</section>`
  }).join("\n")
  const font = normalize(readFileSync(join(appRoot, "public/fonts/Pretendard-LICENSE.txt"), "utf8")).trim()
  return `<!doctype html>
<!-- 자동 생성 파일: app/scripts/generate-third-party-notices.mjs 가 package-lock.json 에서 만든다. 손으로 고치지 말 것. -->
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>오픈소스 소프트웨어 고지 | TrainOracle</title>
  <link rel="stylesheet" href="./legal.css" />
  <style>pre{white-space:pre-wrap;word-break:break-word;font-size:12px;line-height:1.5}table{border-collapse:collapse;width:100%}td,th{text-align:left;padding:4px 8px;border-bottom:1px solid currentColor}</style>
</head>
<body>
  <header class="legal-header"><div class="legal-header__inner">
    <a class="legal-brand" href="../">TRAINORACLE</a>
    <nav class="legal-nav" aria-label="서비스 문서">
      <a href="./privacy.html">개인정보처리방침</a>
      <a href="./terms.html">이용약관</a>
      <a href="./open-source.html">자산 출처</a>
      <a href="./third-party-notices.html" aria-current="page">오픈소스 소프트웨어</a>
    </nav>
  </div></header>
  <main class="legal-document">
    <h1>오픈소스 소프트웨어 고지</h1>
    <p class="legal-summary">TrainOracle 앱에 포함되어 배포되는 오픈소스 소프트웨어 ${packages.length}개와 글꼴의 저작권·라이선스 전문입니다. 개발에만 쓰는 도구는 앱에 포함되지 않아 제외했습니다. 스티커 등 그림 자산은 <a href="./open-source.html">자산 출처</a>에 있습니다.</p>
    <table><thead><tr><th>패키지</th><th>버전</th><th>라이선스</th></tr></thead><tbody>
${rows}
<tr><td><a href="#pretendard">Pretendard (글꼴)</a></td><td>—</td><td>OFL-1.1</td></tr>
</tbody></table>
${sections}
<section id="pretendard">
<h2>Pretendard (글꼴)</h2>
<p>라이선스: SIL Open Font License 1.1</p>
<pre>${escape(font)}</pre>
</section>
  </main>
</body>
</html>
`
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const html = renderNotices()
  if (process.argv.includes("--check")) {
    if (!existsSync(output) || normalize(readFileSync(output, "utf8")) !== html) {
      console.error("public/legal/third-party-notices.html is stale. Run: node scripts/generate-third-party-notices.mjs")
      process.exit(1)
    }
    console.log("third-party notices up to date")
  } else {
    writeFileSync(output, html)
    console.log(`wrote ${output} (${productionPackages().length} packages)`)
  }
}
