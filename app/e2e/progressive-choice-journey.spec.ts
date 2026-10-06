import { expect, test, type Page, type Locator } from "@playwright/test"
import { completeQuickPlan } from "./plan-flow"

const personas = [
  { id: "small-phone-new-runner", width: 320, height: 740, seed: 17, event: "800m", reduced: false },
  { id: "commuter-short-visit", width: 375, height: 667, seed: 43, event: "5km", reduced: false },
  { id: "reduced-motion-returner", width: 390, height: 844, seed: 71, event: "10km", reduced: true },
  { id: "desktop-marathon-reader", width: 1280, height: 900, seed: 97, event: "마라톤", reduced: false },
] as const

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
}

for (const persona of personas) {
  test.describe(persona.id, () => {
    test.use({ viewport: { width: persona.width, height: persona.height } })
    test.beforeEach(async ({ page }) => {
      // These tests use Playwright's disposable context, never the user's browser profile.
      await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
        ? route.continue() : route.abort())
      if (persona.reduced) await page.emulateMedia({ reducedMotion: "reduce" })
      await page.goto("/?app=1&uitest=1")
      await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
      await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true }).click()
    })

    test("opens Oracle details on demand and returns through random sections", async ({ page }, info) => {
      let actions = 0
      const click = async (locator: Locator) => { await locator.click(); actions++ }
      const nav = page.getByRole("navigation", { name: "주 탭" })
      await expect(page.getByRole("button", { name: "오늘 기록 남기기" })).toBeInViewport()
      await click(nav.getByRole("button", { name: "오라클", exact: true }))
      await expect(page.getByRole("heading", { name: "첫 운동부터 남겨볼까요?" })).toBeVisible()
      await expect(page.getByRole("button", { name: "훈련량", exact: true })).not.toBeVisible()
      await page.screenshot({ path: info.outputPath("oracle-first.png") })
      let seed: number = persona.seed
      const choices = ["러닝 취향", "읽을거리", "내 훈련"]
      for (let n = 0; n < 6; n++) {
        seed = (seed * 16807) % 2147483647
        await click(page.getByRole("button", { name: choices[seed % choices.length], exact: true }))
        await noHorizontalOverflow(page)
      }
      await click(page.getByRole("button", { name: "내 훈련", exact: true }))
      await click(page.getByText("훈련량·구성·변화 보기", { exact: true }))
      await click(page.getByRole("button", { name: "훈련량", exact: true }))
      await expect(page.getByText("훈련량 · 다른 항목 보기", { exact: true })).toBeVisible()
      await click(page.getByText("훈련량 · 다른 항목 보기", { exact: true }))
      await click(page.getByRole("button", { name: "훈련 요약", exact: true }))
      await click(page.getByText("오라클 예시 보기", { exact: true }))
      await expect(page.getByRole("button", { name: /^내 경기 기록 비교.*결과 보기/u })).toBeVisible()
      await click(nav.getByRole("button", { name: "일지", exact: true }))
      await expect(page.getByRole("heading", { name: "지난 일지", exact: true })).toBeVisible()
      await click(nav.getByRole("button", { name: "홈", exact: true }))
      await expect(page.getByRole("button", { name: "오늘 기록 남기기" })).toBeVisible()
      await noHorizontalOverflow(page)
      await info.attach("synthetic-actions", { body: JSON.stringify({ persona, actions }), contentType: "application/json" })
    })

    test("generates a plan without a record and explicitly starts it", async ({ page }, info) => {
      const errors: string[] = []
      page.on("pageerror", error => errors.push(error.message))
      await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
      await completeQuickPlan(page, { event: persona.event })
      await expect(page.getByRole("region", { name: "이번 일정", exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "다른 계획 보기", exact: true })).not.toBeVisible()
      await page.getByText("일정·훈련 바꾸기", { exact: true }).click()
      await expect(page.getByRole("button", { name: "다른 계획 보기", exact: true })).toBeVisible()
      await page.getByText("일정·훈련 바꾸기", { exact: true }).click()
      await noHorizontalOverflow(page)
      await page.screenshot({ path: info.outputPath("plan-ready.png"), fullPage: true })
      await page.getByRole("button", { name: "이 일정으로 시작", exact: true }).click()
      await expect(page.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
      await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "홈", exact: true }).click()
      await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련", exact: true }).click()
      await expect(page.getByRole("heading", { name: /9일 훈련 계획/u })).toBeVisible()
      await noHorizontalOverflow(page)
      expect(errors).toEqual([])
    })

    test("saves a short journal and opens it from the calendar", async ({ page }, info) => {
      await page.getByRole("button", { name: "오늘 기록 남기기", exact: true }).click()
      await page.getByRole("button", { name: "운동을 마쳤어요", exact: true }).click()
      await page.getByRole("button", { name: "오후", exact: true }).click()
      await page.getByRole("button", { name: /힘든 정도 6\/10,/u }).click()
      await page.getByRole("button", { name: "없어요", exact: true }).click()
      await expect(page.getByRole("heading", { name: "이 내용으로 남길까요?" })).toBeVisible()
      await noHorizontalOverflow(page)
      await page.getByRole("button", { name: "이대로 저장", exact: true }).click()
      await expect(page.getByRole("heading", { name: "오늘 기록을 남겼어요." })).toBeVisible()
      const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]"))
      expect(stored).toHaveLength(1)
      await page.getByRole("button", { name: "완료", exact: true }).click()
      await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "일지", exact: true }).click()
      await expect(page.getByRole("heading", { name: "지난 일지", exact: true })).toBeVisible()
      await page.screenshot({ path: info.outputPath("journal-calendar.png") })
      await page.locator(`button[data-date="${stored[0].date}"]`).click()
      await expect(page.getByRole("region", { name: "이날 남긴 기록", exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "일지·메모 원문 열기", exact: true })).toBeVisible()
      await page.getByRole("button", { name: "달력으로 돌아가기", exact: true }).click()
      await page.getByText("월별 기록 모아보기", { exact: true }).click()
      await noHorizontalOverflow(page)
      await expect(page.getByText("월별 기록 모아보기", { exact: true })).toBeVisible()
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.journal.v1") ?? "[]"))).toEqual(stored)
    })
  })
}
