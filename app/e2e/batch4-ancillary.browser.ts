import { expect, test, type Page } from "@playwright/test"

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => new URL(route.request().url()).hostname === "127.0.0.1"
    ? route.continue() : route.abort())
})

async function fits(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}

test("named More destinations return and legal, backup and tools remain reachable", async ({ page }, testInfo) => {
  await page.goto("/e2e/fixtures/batch4-ancillary.html")
  await expect(page.getByRole("button", { name: "페이스 계산", exact: true })).toBeVisible()
  await fits(page)
  await page.screenshot({ path: testInfo.outputPath("more-tools.png"), fullPage: true })
  for (const name of ["배우기·꾸미기", "계정·기록 보관", "백업·복원·휴지통", "앱 정보·개인정보·문의"]) {
    await page.getByRole("button", { name, exact: true }).click()
    await expect(page.getByRole("heading", { name, level: 1 })).toBeVisible()
    if (name === "백업·복원·휴지통") await expect(page.getByRole("button", { name: "내려받은 백업 되돌리기" })).toBeVisible()
    if (name === "앱 정보·개인정보·문의") await expect(page.getByRole("link", { name: "개인정보처리방침" })).toHaveAttribute("href", "./legal/privacy.html")
    await fits(page)
    await page.getByRole("button", { name: "더보기로 돌아가기" }).click()
  }
})

test("provider preparation preserves direct file picking and previews without saving", async ({ page }, testInfo) => {
  await page.goto("/e2e/fixtures/batch4-ancillary.html?screen=import")
  const pick = page.getByRole("button", { name: "파일이 있어요 · 바로 선택" })
  await expect(pick).toBeVisible()
  await page.getByRole("combobox", { name: "어디에 기록이 있나요?" }).selectOption("coros")
  await expect(page.getByRole("heading", { name: "COROS 파일 준비" })).toBeVisible()
  await fits(page)
  await page.screenshot({ path: testInfo.outputPath("import-coros.png"), fullPage: true })
  await page.getByRole("button", { name: "다른 기록 위치" }).click()
  await page.getByRole("combobox", { name: "어디에 기록이 있나요?" }).selectOption("health")
  await expect(page.getByText("애플 건강·삼성 헬스의 전체 ZIP·XML 백업은 아직 읽지 못해요.")).toBeVisible()
  const chooser = page.waitForEvent("filechooser")
  await pick.click()
  await (await chooser).setFiles({ name: "synthetic-run.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify([
    { date: "2026-10-07", name: "Synthetic run", sport: "running", distanceKm: 5, durationMin: 25 },
  ])) })
  await expect(page.getByText("Synthetic run", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "고른 1건 일지에 저장" })).toBeVisible()
  await fits(page)
})

test("unknown archive states never masquerade as an empty real calendar", async ({ page }, testInfo) => {
  for (const readiness of ["LOADING", "ERROR", "STALE"]) {
    await page.goto(`/e2e/fixtures/batch4-ancillary.html?screen=archive&readiness=${readiness}`)
    await expect(page.getByRole("heading", { name: "지난 일지" })).toBeVisible()
    await expect(page.getByRole(readiness === "ERROR" ? "alert" : "status")).toBeVisible()
    await expect(page.getByRole("grid")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "내 달력" })).toHaveCount(0)
    await fits(page)
    if (readiness === "ERROR") await page.screenshot({ path: testInfo.outputPath("archive-error.png"), fullPage: true })
  }
  await page.goto("/e2e/fixtures/batch4-ancillary.html?screen=archive&readiness=READY")
  await page.getByRole("button", { name: "내 달력" }).click()
  await expect(page.getByRole("grid")).toBeVisible()
  await fits(page)
})
