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
  const services = page.getByRole("navigation", { name: "내 기록 살펴보기" })
  await auditTouchTargets(page, [
    { name: "empty-home.first-entry", locator: page.getByRole("button", { name: "오늘 기록 남기기" }), heightOnly: true },
    { name: "empty-home.create-plan", locator: page.getByRole("button", { name: "훈련 계획 만들기" }), heightOnly: true },
    { name: "empty-home.journal", locator: services.getByRole("button", { name: /^내 일지/u }), heightOnly: true },
    { name: "empty-home.plan", locator: services.getByRole("button", { name: /^훈련 계획/u }), heightOnly: true },
    { name: "empty-home.more", locator: page.getByRole("button", { name: "더보기" }) },
  ])
  await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  // 홈의 주 행동은 세부 입력 전에 빠른 기록으로 시작한다.
  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await auditTouchTargets(page, [
    { name: "quick.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "quick.outcome", locator: page.getByRole("button", { name: /^(계획한 훈련을 했어요|가볍게 움직였어요|오늘은 쉬었어요|훈련을 건너뛰었어요)$/u }), count: 4, heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  // the chooser is reached via the "경기기록" tab bar button
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "경기기록" }).click()
  await auditTouchTargets(page, [
    { name: "chooser.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "chooser.post", locator: page.getByRole("button", { name: /훈련 후/u }), heightOnly: true },
    { name: "chooser.evening", locator: page.getByRole("button", { name: /회복 · 하루 마무리/u }), heightOnly: true },
    { name: "chooser.race", locator: page.getByRole("button", { name: /경기 직전\/직후/u }), heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
})

test("audits populated home, detail, and trends actions", async ({ page }, testInfo) => {
  requireTouchProject(testInfo.project.name)
  await seedTouchAuditEntries(page)
  await page.goto("/?app=1")
  const entries = page.getByRole("button", { name: /상세 열기/u })
  await auditTouchTargets(page, [
    { name: "populated-home.open-today", locator: page.getByRole("button", { name: "오늘 기록 보기" }), heightOnly: true },
    { name: "populated-home.add", locator: page.getByRole("button", { name: "기록 더 남기기" }), heightOnly: true },
    { name: "populated-home.entries", locator: entries, count: 5, heightOnly: true },
    { name: "populated-home.tabs", locator: page.getByRole("navigation", { name: "주 탭" }).getByRole("button"), count: 5 },
  ])
  await page.getByRole("button", { name: "더보기" }).click()
  await auditTouchTargets(page, [
    { name: "more.export", locator: page.getByRole("button", { name: /내 일지 데이터 내려받기/u }), heightOnly: true },
    { name: "more.full-export", locator: page.getByRole("button", { name: /메모 포함 파일 내보내기/u }), heightOnly: true },
  ])
  await page.getByRole("button", { name: /메모 포함 파일 내보내기/u }).click()
  await auditTouchTargets(page, [
    { name: "full-export.cancel", locator: page.getByRole("button", { name: "취소" }) },
    { name: "full-export.confirm", locator: page.getByRole("button", { name: "파일 만들기" }) },
  ])
  await page.getByRole("button", { name: "취소" }).click()
  await page.getByRole("button", { name: "홈으로 돌아가기" }).click()
  await expectNoHorizontalOverflow(page)
  await entries.nth(0).click()
  await auditTouchTargets(page, [
    { name: "detail.back", locator: page.getByRole("button", { name: "← 뒤로" }) },
    { name: "detail.delete", locator: page.getByRole("button", { name: "이 일지 지우기" }), count: 2, heightOnly: true },
  ])
  await expectNoHorizontalOverflow(page)
  await page.getByRole("button", { name: "← 뒤로" }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
  const metricButtons = page
    .getByRole("region", { name: "최근 4개월 추이" })
    .getByRole("button")
  await auditTouchTargets(page, [
    { name: "trends.back", locator: page.getByRole("button", { name: "뒤로", exact: true }) },
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
