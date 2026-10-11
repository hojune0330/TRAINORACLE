#!/usr/bin/env node
/*
 * phase2.ko.json → COPY_DECK.md (human-readable) + checks.
 *   node docs/phase2/copy/build-copy-deck.mjs          # check + write COPY_DECK.md
 *   node docs/phase2/copy/build-copy-deck.mjs --check  # exit 1 on a rule break or a stale deck
 * Checks: valid JSON, length limit per key (variables counted as 4 chars), the app's forbidden phrases
 * (app/src/plain-language-copy.contract.test.ts), and point-copy style (POINT_STANDARD §5).
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const copy = JSON.parse(readFileSync(join(here, "phase2.ko.json"), "utf8"))
const FORBIDDEN = [/오늘의 흐름/u, /기록과 흐름/u, /훈련 흐름/u, /다음 계획에 이어지는 정보/u, /다음 훈련 살펴보기/u, /(?:생리학적|에너지 경로|젖산|사용 연료) 맥락/u, /^자세히$/u]
const STYLE = [[/약 ?\d+원/u, "원 환산에 '약'을 붙이지 않는다"], [/현금처럼/u, "현금처럼 쓰라는 표현 금지"], [/\d+ P\b/u, "숫자와 P 사이 공백 금지"], [/메달[^.]*\d+원/u, "메달에 원 가치를 붙이지 않는다"]]

const problems = []
const rows = []
for (const [group, entries] of Object.entries(copy)) {
  if (group === "_meta") continue
  for (const [key, value] of Object.entries(entries)) {
    const id = `${group}.${key}`
    const measured = value.text.replace(/\{[a-zA-Z]+\}/gu, "0000")
    if (measured.length > value.max) problems.push(`${id}: ${measured.length}자 > 한도 ${value.max}자`)
    if (FORBIDDEN.some(pattern => pattern.test(value.text))) problems.push(`${id}: 금지 표현`)
    for (const [pattern, why] of STYLE) if (pattern.test(value.text)) problems.push(`${id}: ${why}`)
    rows.push({ group, id, ...value })
  }
}

const esc = text => text.replace(/\|/gu, "\\|")
let md = `# 2차 문구 덱

> 자동 생성: \`node docs/phase2/copy/build-copy-deck.mjs\` (원본 \`copy/phase2.ko.json\`). 이 파일을 직접 고치지 말고 JSON을 고친다.

규칙
- 해요체로 쓰고 행동을 먼저 말한다. \`{변수}\`는 개발 담당이 채운다.
- 한도는 360px 한 줄 기준 권장 최대 글자 수다(변수는 4자로 센다).
- P 숫자는 쉼표를 넣어 \`1,250P\`처럼 쓴다. 원 환산은 잔액과 가격 옆에만 \`(125원)\`으로, 내림해서 붙인다(POINT_STANDARD §5).
- 메달 문구에는 원·P 가치를 붙이지 않는다.
- \`pending\` 표시가 있는 문구는 오너·법률 승인 전에는 화면에 넣지 않는다.

키 ${rows.length}개 · 검사 결과: ${problems.length ? `**문제 ${problems.length}개**` : "통과"}
`
let current = ""
for (const row of rows) {
  if (row.group !== current) { current = row.group; md += `\n## ${current}\n\n| 키 | 문구 | 한도 | 비고 |\n|---|---|---|---|\n` }
  md += `| \`${row.id}\` | ${esc(row.text)} | ${row.max} | ${row.pending ? `⚠️ ${esc(row.pending)}` : ""} |\n`
}
const target = join(here, "..", "COPY_DECK.md")
if (problems.length) { console.error(problems.join("\n")); process.exit(1) }
if (process.argv.includes("--check")) {
  const existing = readFileSync(target, "utf8").replace(/\r\n/gu, "\n")
  if (existing !== md) { console.error("COPY_DECK.md is stale. Run: node docs/phase2/copy/build-copy-deck.mjs"); process.exit(1) }
  console.log(`copy deck ok (${rows.length} keys)`)
} else {
  writeFileSync(target, md)
  console.log(`wrote COPY_DECK.md (${rows.length} keys)`)
}
