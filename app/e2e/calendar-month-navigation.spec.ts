import { expect, test } from "@playwright/test"
import { completeQuickPlan, refinePlan } from "./plan-flow"
import { openActivePlanCards } from "./active-plan-flow"

test.use({ serviceWorkers: "block" })

test("real month navigation, today, AM/PM and narrow layout", async ({ page }, info) => {
  await page.route("**/*", route => {
    const hostname = new URL(route.request().url()).hostname
    return hostname === "127.0.0.1" || hostname === "localhost" ? route.continue() : route.abort()
  })
  await page.clock.setFixedTime(new Date(2026, 8, 27, 12))
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("button", { name: "훈련 계획 만들기", exact: true }).click()
  await completeQuickPlan(page, { days: /^매일/u })
  await refinePlan(page, "하루 두 번", /하루 두 번 운동할게요/u)
  await page.getByRole("button", { name: "이 일정으로 시작" }).click()
  const calendar = page.getByRole("grid", { name: "2026년 9월 달력" })
  const before = await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))
  await expect(calendar.getByRole("columnheader", { name: "일요일" })).toBeVisible()
  const today = calendar.getByRole("button", { name: /2026년 9월 27일 일요일/u })
  await expect(today).toHaveAttribute("aria-current", "date")
  await expect(today).toContainText("AM")
  await expect(today).toContainText("PM")
  await expect(today).toHaveAccessibleName(/오전.*오후/u)

  for (const width of [320, 375, 1024]) {
    await page.setViewportSize({ width, height: 800 })
    await calendar.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    const box = await today.boundingBox()
    expect(box!.width).toBeGreaterThanOrEqual(43.9)
    expect(box!.height).toBeGreaterThanOrEqual(44)
    await page.locator(".plan-training-flow").screenshot({ path: info.outputPath(`calendar-${width}.png`) })
  }

  await page.setViewportSize({ width: 375, height: 667 })
  await page.getByRole("button", { name: "다음 달", exact: true }).click()
  await page.getByRole("button", { name: /2026년 10월 1일 목요일/u }).click()
  const enlarged = page.getByRole("dialog", { name: "2026년 10월 1일 목요일" })
  await expect(enlarged).toBeVisible()
  await expect(enlarged.getByRole("navigation", { name: "오전·오후 바로가기" })).toBeVisible()
  await enlarged.getByRole("button", { name: "크게 보기 다음 날짜" }).click()
  await expect(page.getByRole("dialog")).toHaveAccessibleName("2026년 10월 2일 금요일")
  await page.getByRole("dialog").getByRole("button", { name: "크게 보기 이전 날짜" }).click()
  await enlarged.getByRole("button", { name: "달력으로 돌아가기" }).click()
  await expect(enlarged).not.toBeVisible()
  await openActivePlanCards(page)
  await expect(page.locator('[data-active-card="true"]')).toContainText("10월 1일 목요일")
  const day = page.getByRole("group", { name: "10월 1일 목요일 · 훈련 2개", exact: true })
  await expect.poll(async () => {
    return day.evaluate(element => {
      const list = element.parentElement!
      return Math.abs(element.getBoundingClientRect().left - list.getBoundingClientRect().left)
    })
  }).toBeLessThan(2)
  await expect(day.getByText("오전", { exact: true })).toBeVisible()
  await expect(day.getByText("오후", { exact: true })).toBeVisible()
  await day.getByText("오후 훈련 방법과 기록", { exact: true }).click()
  await expect(day.locator('.plan-day-card__details[open]')).toBeVisible()
  await day.evaluate(element => element.scrollIntoView({ block: "start", inline: "start", behavior: "instant" }))
  await page.screenshot({ path: info.outputPath("selected-am-pm.png") })
  await page.getByRole("button", { name: "오늘", exact: true }).click()
  await expect(calendar).toBeVisible()
  await expect(page.locator('[data-active-card="true"]')).toContainText("9월 27일 일요일")
  expect(await page.evaluate(() => localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(before)

  await page.emulateMedia({ reducedMotion: "reduce" })
  await page.locator(".month-calendar").evaluate(element => {
    const nodes = [element, ...element.querySelectorAll<HTMLElement>("*")].filter(node => !(node instanceof SVGElement))
    const sizes = nodes.map(node => parseFloat(getComputedStyle(node).fontSize))
    nodes.forEach((node, i) => (node as HTMLElement).style.setProperty("font-size", `${sizes[i]! * 2}px`, "important"))
  })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.locator(".month-calendar").evaluate(element => element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" }))
  await page.screenshot({ path: info.outputPath("calendar-200-percent.png") })
})
