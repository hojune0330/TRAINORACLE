import { expect, test } from "@playwright/test"

test("keeps explicit energy records separate from legacy defaults across home and analysis", async ({ page }, testInfo) => {
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
  const analysisEntry = page.getByRole("button", { name: "훈련량·변화 보기", exact: true })
  await expect(page.getByRole("region", { name: "최근 하루 기록" })).toContainText("오늘 · 기록 2개")
  await expect(analysisEntry).toBeVisible()
  await analysisEntry.click()
  const detailMenu = page.getByRole("group", { name: "훈련 분석 자세히 보기" })
  await detailMenu.getByRole("button", { name: "훈련량", exact: true }).click()
  const distance = page.getByRole("region", { name: "누적 거리와 변화", exact: true })
  const week = distance.getByText("이번 주", { exact: true }).locator("..")
  await expect(week).toHaveAccessibleName("이번 주, 8킬로미터, 기록 1건")
  await expect(week).toContainText("1건 반영 · 1건 제외")
  await distance.locator("summary", { hasText: "집계 기준과 제외된 기록 보기" }).click()
  await expect(distance.getByText("직접 적어 출처가 확인된 거리만 더해요. 미기록은 0 km로 바꾸지 않아요.", { exact: true })).toBeVisible()
  await detailMenu.getByRole("button", { name: "훈련 구성", exact: true }).click()

  const analysis = page.getByRole("region", { name: "훈련 종류별 합계", exact: true })
  await expect(analysis.getByRole("img", { name: /LT 지속 페이스 1회/u })).toBeVisible()
  await expect(analysis.getByRole("img", { name: /MIX 여러 강도 조합 0회/u })).toBeVisible()
  await expect(analysis.locator(".energy-ledger__row--lt").getByText("지속 페이스", { exact: true })).toBeVisible()
  await expect(analysis.locator(".energy-ledger__row--lt").getByText("1회", { exact: true })).toBeVisible()
  await expect(analysis.getByText("40분 (1회 기록) · 8km (1회 기록) · RPE 6 (1회 기록)", { exact: true })).toBeVisible()
  const basis = analysis.locator("summary", { hasText: "계산 기준 · 기록 1건 사용 · 1건 제외" })
  await expect(basis).toBeVisible()
  await expect(basis.locator("..")).not.toHaveAttribute("open")
  await basis.click()
  await expect(analysis.getByText(/일지에서 직접 고른 훈련 목적을 모은 값/u)).toBeVisible()
  await analysis.getByRole("button", { name: "24주" }).click()
  await expect(analysis.getByRole("button", { name: "24주" })).toHaveAttribute("aria-pressed", "true")

  expect(await page.evaluate(() => {
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    return document.documentElement.scrollWidth <= window.innerWidth
      && (scrollRegion === null || scrollRegion.scrollWidth <= scrollRegion.clientWidth)
  })).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("analysis-integrity.png"), fullPage: true })
})
