import { expect, test } from "@playwright/test"
import {
  TOUCH_PROJECTS,
  auditTouchTargets,
  expectMinimumTouchSize,
  expectNoHorizontalOverflow,
  openEntry,
  seedTouchAuditEntries,
} from "./touch-audit"

function requireTouchProject(projectName: string) {
  test.skip(!TOUCH_PROJECTS.has(projectName), "Rendered size assertions only apply to touch viewports")
}

test("audits empty home and chooser touch actions", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await page.goto("/")
  await auditTouchTargets(page, [
    { name: "empty-home.plan", locator: page.getByRole("button", { name: /훈련계획 먼저 보기/u }), heightOnly: true },
    { name: "empty-home.first-entry", locator: page.getByRole("button", { name: /오늘 기록 시작하기/u }), heightOnly: true },
    { name: "empty-home.browse", locator: page.getByRole("button", { name: /홈 먼저 둘러보기/u }), heightOnly: true },
  ])
  await expect(page.getByRole("navigation", { name: "주 탭" })).toHaveCount(0)
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: /오늘 기록 시작하기/u }).click()
  await auditTouchTargets(page, [
    { name: "chooser.back", locator: page.getByRole("button", { name: "이전 화면으로" }) },
    { name: "chooser.post", locator: page.getByRole("button", { name: /훈련을 기록하고 싶어요/u }), heightOnly: true },
    { name: "chooser.evening", locator: page.getByRole("button", { name: /하루와 몸 상태를 기록할래요/u }), heightOnly: true },
    { name: "chooser.race", locator: page.getByRole("button", { name: /경기를 기록할래요/u }), heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
})

test("audits populated home, detail, and trends actions", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await seedTouchAuditEntries(page)
  await page.goto("/?app=1")
  const entries = page.getByRole("button", { name: /상세 열기/u })
  await auditTouchTargets(page, [
    { name: "populated-home.write", locator: page.getByRole("button", { name: /오늘 일지 더 쓰기/u }), heightOnly: true },
    { name: "populated-home.export", locator: page.getByRole("button", { name: /내 일지 데이터 내려받기/u }), heightOnly: true },
    { name: "populated-home.full-export", locator: page.getByRole("button", { name: /메모 포함 파일 내보내기/u }), heightOnly: true },
    { name: "populated-home.entries", locator: entries, count: 5, heightOnly: true },
    { name: "populated-home.tabs", locator: page.getByRole("navigation", { name: "주 탭" }).getByRole("button"), count: 5 },
  ])
  await page.getByRole("button", { name: /메모 포함 파일 내보내기/u }).click()
  await auditTouchTargets(page, [
    { name: "full-export.cancel", locator: page.getByRole("button", { name: "취소" }) },
    { name: "full-export.confirm", locator: page.getByRole("button", { name: "파일 만들기" }) },
  ])
  await page.getByRole("button", { name: "취소" }).click()
  await expectNoHorizontalOverflow(page)
  await entries.nth(0).click()
  await auditTouchTargets(page, [
    { name: "detail.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "detail.delete", locator: page.getByRole("button", { name: "이 일지 지우기" }), count: 2, heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "← 뒤로" }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /추이/u }).click()
  const metricButtons = page
    .getByRole("region", { name: "최근 4개월 추이" })
    .getByRole("button")
  await auditTouchTargets(page, [
    { name: "trends.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "trends.metrics", locator: metricButtons, count: 4 },
  ])
  await expectNoHorizontalOverflow(page)
  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({ path: "../.omo/evidence/mobile-touch-targets/task-5-320.png" })
  }
})

test("saves post-session and evening entries through the mobile shell", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /훈련 후/u)
  await page.getByRole("button", { name: /^저장/u }).click()
  await expect(page.getByRole("button", { name: /상세 열기/u })).toHaveCount(1)
  await openEntry(page, /하루 마무리/u)
  await page.getByRole("button", { name: /^저장/u }).click()
  await expect(page.getByRole("button", { name: /상세 열기/u })).toHaveCount(2)
})

test("keeps the review toast dismissal touchable", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await openEntry(page, /경기 직전\/직후/u)
  await page.getByRole("textbox", { name: "경기 메모" }).fill("무릎이 아파")
  await page.getByRole("radio", { name: "훈련 메모" }).click()
  await page.getByRole("button", { name: /^저장/u }).click()
  const alert = page.getByRole("alert")
  await expect(alert).toBeVisible()
  await expectMinimumTouchSize(alert.getByRole("button", { name: "검토 안내 닫기" }))
})
