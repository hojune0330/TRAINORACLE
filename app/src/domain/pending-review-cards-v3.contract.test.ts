import { readFileSync } from "node:fs"
import { expect, it } from "vitest"
import { buildPendingOwnerReviewBundleV3 } from "../../../reports/research/method-owner-review-bundle-v3"

const cards = readFileSync("../reports/review/METHOD_CONFIGURATION_REVIEW_CARDS_V3.md", "utf8").replaceAll("\r\n", "\n")
const card = (id: string) => cards.split(`## ${id}\n`)[1]!.split("\n## ")[0]!

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
