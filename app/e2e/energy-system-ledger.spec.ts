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
  const distance = page.getByRole("region", { name: "기간별 훈련 리포트", exact: true })
  await expect(distance.getByRole("img", { name: /내 기록.*월별 누적 거리.*8 km/u })).toBeVisible()
  await expect(distance.getByText(/집계 제외 · 거리 1건 · 훈련 종류 1건/u)).toBeVisible()
  await distance.locator("summary", { hasText: "집계 기준·출처" }).click()
  await expect(distance.getByText(/거리 합계: 반영 1건 · 제외 1건/u)).toBeVisible()
  await expect(distance.getByText(/기록이 없는 값은 0으로 채우지 않아요/u)).toBeVisible()
  await detailMenu.getByRole("button", { name: "훈련 구성", exact: true }).click()

  const analysis = distance
  await expect(analysis).toHaveAttribute("data-view", "mix")
  await expect(analysis.getByRole("img", { name: /지속 페이스 1회/u })).toBeVisible()
  await expect(analysis.getByRole("img", { name: /여러 강도 조합 0회/u })).toHaveCount(0)
  const unrecorded = analysis.locator("details").filter({ has: page.locator("summary", { hasText: "기록 없는 종류 6개" }) })
  await unrecorded.locator("summary").click()
  await expect(unrecorded).toContainText("여러 강도 조합")
  await expect(analysis.getByText(/훈련 종류: 반영 1건 · 제외 1건/u)).toBeVisible()
  await expect(analysis.getByText(/일지에서 직접 선택한 주된 목적의 횟수/u)).toBeVisible()
  await analysis.getByRole("button", { name: "6개월", exact: true }).click()
  await expect(analysis.getByRole("button", { name: "6개월", exact: true })).toHaveAttribute("aria-pressed", "true")
  await expect(analysis.getByRole("region", { name: "리포트 근거" }).getByRole("button", { name: /운동 일지 보기/u })).toHaveCount(1)
  // A new report presentation must not rewrite its original evidence.
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("to-local-journal.journal.v2") ?? "[]")
    .find((entry: { id: string }) => entry.id === "explicit-lt-e2e"))).toMatchObject({
    distanceKm: "8", durationMin: "40", rpe: 6, system: "lt",
  })

  expect(await page.evaluate(() => {
    const scrollRegion = document.querySelector<HTMLElement>(".app-scroll-region")
    return document.documentElement.scrollWidth <= window.innerWidth
      && (scrollRegion === null || scrollRegion.scrollWidth <= scrollRegion.clientWidth)
  })).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("analysis-integrity.png"), fullPage: true })
})
