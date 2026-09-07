import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { buildPendingOwnerReviewBundleV3 } from "../../../reports/research/method-owner-review-bundle-v3"

const cards = readFileSync("../reports/review/METHOD_CONFIGURATION_REVIEW_CARDS_V3.md", "utf8").replaceAll("\r\n", "\n")
const card = (id: string) => cards.split(`## ${id}\n`)[1]!.split("\n## ")[0]!

it("preserves every configuration in the compact index with complete duration and correct recovery activity", () => {
  const index = cards.split("## 빠르게 비교하는 전체 37개\n")[1]!.split("\n## P-")[0]!
  const rows = index.split("\n").filter(line => line.startsWith("| ["))
  const bundle = buildPendingOwnerReviewBundleV3()
  expect(rows).toHaveLength(bundle.items.length)
  for (const item of bundle.items) expect(rows.filter(row => row.includes(`(#${item.id.toLowerCase()})`))).toHaveLength(1)
  const row = (id: string) => rows.find(row => row.includes(`(#${id.toLowerCase()})`))!
  expect(row("P-INTRO-LT-C")).toContain("| 37분 20초 | 입문 |")
  expect(row("P-LT-C")).toContain("| 49분 20초 | 경험 있음, 경험 많음 |")
  expect(row("P-RHYTHM-400")).toContain("(마지막 포함)")
  expect(row("P-RHYTHM-400")).toContain("| 미산출 |")
  expect(row("P-REC-W")).toContain("15분 걷기")
  expect(row("P-OFF")).toContain("운동 시간 해당 없음")
})

it("renders all current pending decisions and the exact bundle identity", () => {
  const bundle = buildPendingOwnerReviewBundleV3()
  expect(cards).toContain(bundle.contentFingerprint)
  for (const item of bundle.items) {
    const section = card(item.id)
    expect(section).toContain(`경험 ${item.scope.experience.join(", ")}`)
    for (const pending of item.explanation.pending) expect(section).toContain(`- ${pending}\n`)
  }
})

it("compares duration only within the declared experience scope", () => {
  const intro = card("P-INTRO-LT-C"), trained = card("P-LT-C")
  expect(intro).toContain("| 처음 시작 |")
  expect(intro).not.toContain("| 훈련 경험 있음 |")
  expect(intro).not.toContain("| 훈련 경험 많음 |")
  expect(trained).not.toContain("| 처음 시작 |")
  expect(trained).toContain("| 훈련 경험 있음 |")
})

it("distinguishes unknown recovery totals from known-unit subtotals", () => {
  expect(card("P-RHYTHM-400")).toContain("| 전체 회복 시간(초) | 미산출 |")
  expect(card("P-RHYTHM-400")).toContain("| 전체 회복 거리(m) | 1200 |")
  expect(card("P-VO2-2")).toContain("| 전체 회복 거리(m) | 미산출 |")
  expect(card("P-VO2-2")).toContain("| 전체 회복 시간(초) | 300 |")
  expect(card("P-RHYTHM-400")).toContain("ROLL_ON 회복 노력: 숫자 미지정")
})
