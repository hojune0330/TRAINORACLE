import { expect, test } from "@playwright/test"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"
import { createPlannedSessionLogDraft } from "../src/domain/planned-session-link"

test("archives the original in the real plan flow and compares it from its journal", async ({ page }, testInfo) => {
  const state = stateFixture()
  state.progress = [{ sessionDay: 1, sessionSlot: "AM", state: "COMPLETED" }]
  const draft = createPlannedSessionLogDraft(state, state.activePlan.sessions[0]!, state.generatedAt)!
  const entry = {
    id: "synthetic-original-plan-e2e", kind: "post-session", date: draft.date, savedAt: state.generatedAt,
    syncState: "local", title: "Original plan comparison", system: "", memo: "",
    distanceKm: "3.2", durationMin: "", avgPace: "", rpe: 6,
    plannedSessionLink: draft.link, activitySlot: "AM", activityOutcome: "PARTIAL", planExecutionRelation: "MODIFIED",
    fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" } },
  }
  const errors: string[] = []
  page.on("pageerror", error => errors.push(error.message))
  await page.addInitScript(({ plan, journal }) => {
    if (localStorage.getItem("synthetic-original-plan-seeded")) return
    localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(plan))
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([journal]))
    localStorage.setItem("synthetic-original-plan-seeded", "1")
  }, { plan: state, journal: entry })
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "내 기록 살펴보기" }).getByRole("button", { name: /^훈련 계획/u }).click()
  await page.getByRole("button", { name: "현재 기준으로 다음 계획안 만들기" }).click()
  await expect.poll(() => page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
  const snapshot = await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.history.v1")!))
  expect(snapshot).toHaveLength(1)
  expect(snapshot[0]).toMatchObject({ version: 5, archiveReason: "MANUAL", originalPlan: state })
  expect(snapshot[0].originalPlan).toEqual(state)

  await page.reload()
  await page.getByRole("button", { name: /Original plan comparison 상세 열기/u }).click()
  const summary = page.getByText("계획한 훈련과 비교하기", { exact: true })
  await summary.scrollIntoViewIfNeeded()
  if (testInfo.project.name === "desktop-chromium") {
    await summary.focus()
    await page.keyboard.press("Enter")
  } else await summary.click()
  await expect(page.getByText(/그때 보관한 계획의 훈련이에요/u)).toBeVisible()
  expect((await summary.boundingBox())!.height).toBeGreaterThanOrEqual(44)
  const opener = page.getByRole("button", { name: "훈련 방법과 이유" })
  await opener.click()
  const reader = page.getByRole("dialog")
  await expect(reader.getByRole("heading", { name: "수행 순서" })).toBeVisible()
  await reader.getByRole("tab", { name: "주기·기록" }).click()
  await expect(reader.getByText("계획의 일부를 수행한 기록", { exact: true })).toBeVisible()
  await expect(reader.getByText("3.2km", { exact: true })).toBeVisible()
  await expect(reader.getByText("직접 기록한 RPE 6", { exact: true })).toBeVisible()
  await expect(reader.getByText("미기록", { exact: true })).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("archived-original-comparison.png") })
  await reader.getByRole("heading", { name: "실제 기록", exact: true }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("archived-original-actual.png") })
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  expect(await reader.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
  const clippedHeaderText = await reader.evaluate(element => {
    const bounds = element.getBoundingClientRect()
    return [...element.querySelectorAll(".session-explanation__header h2, .session-explanation__tabs button")].flatMap(node => {
      const range = document.createRange()
      range.selectNodeContents(node)
      return [...range.getClientRects()].filter(rect => rect.right > bounds.right + 1 || rect.left < bounds.left - 1)
        .map(rect => ({ text: node.textContent, left: rect.left, right: rect.right, availableRight: bounds.right }))
    })
  })
  expect(clippedHeaderText).toEqual([])
  await reader.getByRole("button", { name: "일지로 돌아가기" }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: testInfo.outputPath("archived-original-200-percent.png") })
  await page.evaluate(() => { document.documentElement.style.fontSize = "" })
  await reader.getByRole("button", { name: "일지로 돌아가기" }).click()
  await expect(opener).toBeFocused()
  await expect(opener).toBeInViewport()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.history.v1")!))).toEqual(snapshot)
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()
  expect(errors).toEqual([])
})
