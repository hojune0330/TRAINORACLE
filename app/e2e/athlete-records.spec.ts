import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"

async function openAthleteRecords(page: Page): Promise<void> {
  await page.goto("/?app=1")
  await page.getByRole("navigation", { name: "주 탭" })
    .getByRole("button", { name: "계획" })
    .click()
  await page.getByRole("button", { name: "내 경기 기록 관리" }).click()
  await expect(page.getByRole("heading", { name: "내 경기 기록" })).toBeVisible()
}

test("stores an achieved PB and an aspirational goal without choosing a pace anchor", async ({
  page,
}, testInfo) => {
  await openAthleteRecords(page)

  await page.getByRole("combobox", { name: "기록 역할" })
    .selectOption("PERSONAL_BEST")
  await page.getByRole("combobox", { name: "종목 거리" }).selectOption("5000")
  await page.getByRole("textbox", { name: "기록 분" }).fill("18")
  await page.getByRole("textbox", { name: "기록 초" }).fill("30")
  await page.getByRole("textbox", { name: "달성일" }).fill("2024-03-10")
  await page.getByRole("button", { name: "기록 저장" }).click()

  await page.getByRole("combobox", { name: "기록 역할" })
    .selectOption("RACE_GOAL")
  await page.getByRole("textbox", { name: "기록 분" }).fill("17")
  await page.getByRole("textbox", { name: "기록 초" }).fill("30")
  await page.getByRole("button", { name: "기록 저장" }).click()

  const list = page.getByRole("region", { name: "저장한 경기 기록" })
  await expect(list.getByText("5000m · 18분 30초 · 개인 최고")).toBeVisible()
  await expect(list.getByText(/2024-03-10.*직접 입력한 기록/u)).toBeVisible()
  await expect(list.getByText("5000m · 17분 30초 · 경기 목표")).toBeVisible()
  await expect(list.getByText(
    "직접 입력한 목표 · 현재 경기력 기록이 아님",
  )).toBeVisible()
  await expect(page.getByText(/기준 기록으로 선택/u)).toHaveCount(0)
  await expect(page.getByText(/\/km/u)).toHaveCount(0)

  const stored = await page.evaluate(() => {
    const raw = window.localStorage.getItem("trainoracle.athlete-records.v1")
    return raw === null ? null : JSON.parse(raw) as unknown
  })
  expect(stored).toMatchObject([
    {
      purpose: "PERSONAL_BEST",
      enteredBy: "ATHLETE",
      verificationState: "SELF_REPORTED",
    },
    {
      purpose: "RACE_GOAL",
      achievedOn: null,
      enteredBy: "ATHLETE",
      verificationState: "SELF_REPORTED",
    },
  ])
  expect(JSON.stringify(stored)).not.toMatch(/COACH|VERIFIED_IMPORT|"VERIFIED"/u)
  expect(await page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  )).toBe(true)

  await page.getByRole("button", { name: "계획으로" }).click()
  await page.getByRole("button", { name: "내 경기 기록 관리" }).click()
  await expect(page.getByRole("region", { name: "저장한 경기 기록" })
    .getByText("5000m · 17분 30초 · 경기 목표")).toBeVisible()

  if (testInfo.project.name === "mobile-chromium") {
    await list.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: "../.omo/evidence/task-5-p1-records-393x852.png",
    })
  }
})

test("rejects invalid records and never migrates a legacy race note", async ({
  page,
}, testInfo) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "legacy-race",
      kind: "race",
      record: "18:30",
      goalPace: {
        schemaVersion: 1,
        unit: "seconds_per_kilometer",
        secondsPerKm: 210,
      },
    }]))
  })
  await openAthleteRecords(page)

  await page.getByRole("combobox", { name: "종목 거리" }).selectOption("CUSTOM")
  await page.getByRole("textbox", { name: "직접 입력 거리 (m)" }).fill("59")
  await page.getByRole("textbox", { name: "기록 분" }).fill("1")
  await page.getByRole("textbox", { name: "기록 초" }).fill("0")
  await page.getByRole("textbox", { name: "달성일" }).fill("2024-03-10")
  await page.getByRole("button", { name: "기록 저장" }).click()
  await expect(page.getByRole("alert")).toContainText("종목 거리는 60m 이상")

  await page.getByRole("textbox", { name: "직접 입력 거리 (m)" }).fill("400")
  await page.getByRole("textbox", { name: "달성일" }).fill("2099-01-01")
  await page.getByRole("button", { name: "기록 저장" }).click()
  await expect(page.getByRole("alert")).toContainText("미래 달성일")
  await expect(page.getByText("저장한 기록이 아직 없어요.")).toBeVisible()
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.athlete-records.v1"),
  )).toBeNull()

  await page.evaluate(() => {
    window.localStorage.setItem("trainoracle.athlete-records.v1", JSON.stringify([{
      schemaVersion: 1,
      id: "tampered-goal",
      purpose: "RACE_GOAL",
      eventDistanceM: 5000,
      performanceSeconds: 1050,
      achievedOn: "2026-07-01",
      seasonId: null,
      enteredBy: "ATHLETE",
      verificationState: "SELF_REPORTED",
      sourceRef: "athlete-record:tampered-goal",
      savedAt: "2026-07-01T00:00:00.000Z",
    }]))
  })
  await page.reload()
  await openAthleteRecords(page)
  await expect(page.getByText("저장한 기록이 아직 없어요.")).toBeVisible()
  await expect(page.getByText("5000m · 17분 30초 · 경기 목표")).toHaveCount(0)

  if (testInfo.project.name === "touch-narrow") {
    await page.screenshot({
      path: "../.omo/evidence/task-5-p1-records-error.png",
      fullPage: true,
    })
  }
})

test("reports a record save failure when the browser silently drops the write", async ({ page }) => {
  await page.addInitScript(() => {
    const originalSetItem = Storage.prototype.setItem
    Storage.prototype.setItem = function (this: Storage, key: string, value: string): void {
      if (key === "trainoracle.athlete-records.v1") return
      originalSetItem.call(this, key, value)
    }
  })
  await openAthleteRecords(page)

  await page.getByRole("textbox", { name: "기록 분" }).fill("18")
  await page.getByRole("textbox", { name: "기록 초" }).fill("30")
  await page.getByRole("textbox", { name: "달성일" }).fill("2024-03-10")
  await page.getByRole("button", { name: "기록 저장" }).click()

  await expect(page.getByRole("alert")).toContainText("기록을 저장하지 못했어요")
  await expect(page.getByText("저장한 기록이 아직 없어요.")).toBeVisible()
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("trainoracle.athlete-records.v1"),
  )).toBeNull()
})
