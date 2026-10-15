import { expect, test } from "@playwright/test"

test("claims companion stickers, places one and restores it after reloading", async ({ page }) => {
  const origin = new URL(process.env.PLAYWRIGHT_BASE_URL ?? "http://127.0.0.1:4173").origin
  await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort())
  await page.addInitScript(() => {
    if (localStorage.getItem("companion-fixture-seeded")) return
    localStorage.clear(); sessionStorage.clear()
    const now = new Date(), date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, "0"), String(now.getDate()).padStart(2, "0")].join("-")
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "companion-fixture", kind: "post-session", date, savedAt: `${date}T09:00:00.000Z`, syncState: "local",
      system: "base", title: "동물 스티커 확인용 기록", distanceKm: "5", durationMin: "30", avgPace: "6:00", rpe: 4, memo: "",
      fieldProvenance: { distanceKm: { provenance: "EXPLICIT" }, durationMin: { provenance: "EXPLICIT" }, avgPace: { provenance: "EXPLICIT" }, rpe: { provenance: "EXPLICIT" } },
    }]))
    localStorage.setItem("companion-fixture-seeded", "1")
  })
  await page.goto("/?app=1")
  await page.getByRole("button", { name: "오늘 기록 보기", exact: true }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await page.getByRole("button", { name: /운동하는 동물 9종 보기/ }).click()
  await page.getByRole("button", { name: /운동하는 동물 남은 9종 한 번에 받기/ }).click()
  await page.getByRole("button", { name: "무료로 모두 받기", exact: true }).click()
  await expect(page.getByText("운동하는 동물 9종을 무료로 받았어요.")).toBeVisible()
  await expect(page.locator('.journal-decoration-editor__notice img[src$="otter-nod.webp"]')).toBeVisible()
  await page.getByRole("button", { name: "몸 푸는 고양이 붙이기", exact: true }).click()
  const sticker = page.locator('.decorated-journal-page img[src$="cat-warm_up.webp"]')
  await expect(sticker).toBeVisible()
  await expect.poll(() => sticker.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth === 320)).toBe(true)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.reload()
  await page.getByRole("button", { name: "오늘 기록 보기", exact: true }).click()
  await expect(sticker).toBeVisible()
})
