import { expect, test } from "@playwright/test"

test("keeps explicit energy records separate from legacy defaults across home and analysis", async ({ page }) => {
  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([
      {
        id: "explicit-lt-e2e",
        kind: "post-session",
        date,
        savedAt: `${date}T08:00:00.000Z`,
        syncState: "local",
        system: "lt",
        title: "지속주",
        distanceKm: "8",
        durationMin: "40",
        avgPace: "5:00",
        rpe: 6,
        memo: "",
        fieldProvenance: {
          system: { provenance: "EXPLICIT" },
          distanceKm: { provenance: "EXPLICIT" },
          durationMin: { provenance: "EXPLICIT" },
          avgPace: { provenance: "EXPLICIT" },
          rpe: { provenance: "EXPLICIT" },
        },
      },
      {
        id: "legacy-default-base-e2e",
        kind: "post-session",
        date,
        savedAt: `${date}T09:00:00.000Z`,
        syncState: "local",
        system: "base",
        title: "예전 기록",
        distanceKm: "10",
        durationMin: "50",
        avgPace: "5:00",
        rpe: 4,
        memo: "",
      },
    ]))
  })

  await page.goto("/?app=1")
  const home = page.getByRole("region", { name: "에너지 시스템 요약" })
  await expect(home.getByText("지속 페이스")).toBeVisible()
  await expect(home.getByText("1회")).toBeVisible()
  await expect(home.getByText("MIX 복합·미배분 0회")).toBeVisible()
  await home.getByRole("button", { name: "에너지 시스템 자세히 보기" }).click()

  const analysis = page.getByRole("region", { name: "에너지 시스템 누적" })
  await expect(analysis.getByRole("img", { name: /LT 지속 페이스 1회/u })).toBeVisible()
  await expect(analysis.getByText("40분 · 8km · RPE 6", { exact: true })).toBeVisible()
  await expect(analysis.getByText(/직접 선택 1건 · 제외 1건/u)).toBeVisible()
  await analysis.getByRole("button", { name: "24주" }).click()
  await expect(analysis.getByRole("button", { name: "24주" })).toHaveAttribute("aria-pressed", "true")

  expect(await page.evaluate(() => {
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    return document.documentElement.scrollWidth <= window.innerWidth
      && (scrollRegion === null || scrollRegion.scrollWidth <= scrollRegion.clientWidth)
  })).toBe(true)
})
