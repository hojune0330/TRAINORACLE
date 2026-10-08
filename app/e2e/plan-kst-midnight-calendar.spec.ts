import { expect, test } from "@playwright/test"
import { completeQuickPlan, openPlanOptions } from "./plan-flow"

test.use({ serviceWorkers: "block", timezoneId: "Asia/Seoul" })

test("a plan waiting across KST midnight requires today's date and keeps its calendar journal link", async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
  await page.clock.pauseAt(new Date("2026-10-07T14:59:00.000Z")) // KST 23:59
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await completeQuickPlan(page, { days: /^매일/u })
  await openPlanOptions(page)

  const startDate = page.getByLabel("계획 시작 날짜", { exact: true })
  const start = page.getByRole("button", { name: "이 일정으로 시작", exact: true })
  await expect(startDate).toHaveValue("2026-10-07")
  await expect(start).toBeEnabled()

  await page.clock.fastForward(120_000) // KST 00:01 on the next civil day
  await expect(startDate).toHaveValue("2026-10-07")
  await expect(start).toBeDisabled()
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()

  await startDate.fill("2026-10-08")
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획", exact: true })).toBeVisible()
  const plan = await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1") ?? "null") as {
    intake: { startDate: string }
    activePlan: { sessions: { day: number; slot: "AM" | "PM"; role: string }[] }
  } | null)
  expect(plan?.intake.startDate).toBe("2026-10-08")
  const firstSession = plan?.activePlan.sessions.find(session => session.day === 1 && session.role !== "REST")
  expect(firstSession).toBeDefined()
  if (!firstSession) return

  const calendar = page.getByRole("grid", { name: "2026년 10월 달력" })
  const day = calendar.locator('button[data-date="2026-10-08"]')
  await expect(day).toHaveAttribute("aria-label", /2026년 10월 8일/u)
  await day.click()
  const reader = page.getByRole("dialog", { name: /2026년 10월 8일/u })
  const session = reader.locator(`[data-session-slot="${firstSession.slot}"]`)
  await session.getByText("일지·진행 기록", { exact: true }).click()
  await session.getByRole("button", { name: "이 훈련 일지 쓰기" }).click()
  await expect(page.getByText(new RegExp(`계획 1일차 · ${firstSession.slot === "AM" ? "오전" : "오후"}`, "u"))).toBeVisible()
  await page.getByRole("button", { name: "계획대로 마쳤어요" }).click()
  await page.getByRole("button", { name: firstSession.slot === "AM" ? "오전" : "오후", exact: true }).click()
  await page.getByRole("button", { name: /힘든 정도 6\/10,/u }).click()
  await page.getByRole("button", { name: "없어요" }).click()
  await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
  await page.getByRole("button", { name: "완료", exact: true }).click()

  const journal = await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]") as {
    date: string
    plannedSessionLink?: { plannedDate: string; sessionDay: number; sessionSlot: string }
  }[])
  expect(journal).toHaveLength(1)
  expect(journal[0]).toMatchObject({
    date: "2026-10-08",
    plannedSessionLink: { plannedDate: "2026-10-08", sessionDay: 1, sessionSlot: firstSession.slot },
  })

  const returnedReader = page.getByRole("dialog", { name: /2026년 10월 8일/u })
  if (await returnedReader.isVisible()) await returnedReader.getByRole("button", { name: "달력으로 돌아가기" }).click()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()
  const journalDay = page.getByRole("grid", { name: "2026년 10월 달력" }).locator('button[data-date="2026-10-08"]')
  await expect(journalDay).toHaveAttribute("aria-label", /훈련 후 1건/u)
})

test("a midnight save rejection recovers after choosing the new local date", async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL!).origin
  await page.route("**/*", route => new URL(route.request().url()).origin === appOrigin
    ? route.continue() : route.abort())
  await page.clock.setFixedTime(new Date("2026-10-07T14:59:00.000Z")) // KST 23:59
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
  await completeQuickPlan(page)
  await openPlanOptions(page)

  const startDate = page.getByLabel("계획 시작 날짜", { exact: true })
  const start = page.getByRole("button", { name: "이 일정으로 시작", exact: true })
  await expect(startDate).toHaveValue("2026-10-07")
  await expect(start).toBeEnabled()

  // Change Date immediately, before the visible tab's next minute refresh.
  await page.clock.setFixedTime(new Date("2026-10-07T15:00:01.000Z"))
  await start.click()
  await expect(page.getByRole("alert")).toContainText("시작 날짜가 지났어요")
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBeNull()

  await startDate.fill("2026-10-08")
  await expect(start).toBeEnabled()
  await start.click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획", exact: true })).toBeVisible()
})
