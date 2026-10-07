import { expect, test } from "@playwright/test"
import { replanFixture } from "../src/domain/execution-replan.test-fixture"

test.use({ serviceWorkers: "block" })
for (const width of [375,320]) test(`remaining schedule selection and persisted original at ${width}px`, async ({page},testInfo) => {
  await page.setViewportSize({ width, height: 667 })
  await page.clock.install({ time: new Date("2026-09-29T03:00:00.000Z") })
  await page.route("**/*", route => ["localhost","127.0.0.1"].includes(new URL(route.request().url()).hostname) ? route.continue() : route.abort())
  const f = replanFixture()
  await page.addInitScript(fixture => {
    if (sessionStorage.getItem("replan-fixture")) return
    localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(fixture.state))
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify(fixture.entries))
    sessionStorage.setItem("replan-fixture","yes")
  },f)
  const errors: string[] = []
  page.on("pageerror", e => errors.push(e.message))
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "오라클" }).click()
  await page.getByRole("button", { name: /일부만 한 훈련/ }).click()
  await page.getByRole("button", { name: "남은 일정 조정", exact: true }).click()
  const dialog = page.getByRole("dialog")
  await dialog.getByRole("button", { name: "알고 있는 통증·이상이 없어요" }).click()
  await dialog.getByRole("button", { name: "운동 시간 줄이기" }).click()
  await expect(dialog.getByRole("heading", { name: "이렇게 바꿀까요?" })).toBeVisible()
  await expect(dialog.getByText("변경 전",{exact:true})).toBeVisible()
  await expect(dialog.getByText("변경 후",{exact:true})).toBeVisible()
  expect(await dialog.evaluate(el => el.scrollWidth<=el.clientWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath(`replan-comparison-${width}.png`) })
  await dialog.getByRole("button", { name: "이 일정으로 바꾸기" }).click()
  await expect(dialog.getByRole("heading", { name: "남은 일정을 바꿨어요" })).toBeVisible()
  const stored = await page.evaluate(() => ({ plan: JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!),
    history: JSON.parse(localStorage.getItem("trainoracle.plan-beta.history.v1")!), journals: JSON.parse(localStorage.getItem("trainoracle.journal.v1")!) }))
  expect(stored.plan.executionReplan.action).toBe("REDUCE")
  expect(stored.history[0].originalPlan).toEqual(f.state)
  expect(stored.journals).toEqual(f.entries)
  await dialog.getByRole("button", { name: "현재 일정 확인" }).click()
  await expect(page.getByRole("heading", { name: "9일 훈련 계획",exact:true })).toBeVisible()
  await page.reload()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("trainoracle.plan-beta.v1")!).executionReplan.action)).toBe("REDUCE")
  expect(errors).toEqual([])
})
