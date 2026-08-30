import { expect, test } from "@playwright/test"

test("offers a rest-day path without pressuring the athlete to log more", async ({ page }) => {
  await page.addInitScript(() => {
    const date = new Date().toISOString().slice(0, 10)
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "legacy-rest-copy",
      kind: "post-session",
      date,
      savedAt: `${date}T00:00:00.000Z`,
      syncState: "local",
      system: "easy",
      title: "legacy entry",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 3,
      memo: "",
    }]))
  })
  await page.goto("/?app=1")

  await expect(page.getByText("오늘 기록을 마쳤어요.")).toBeVisible()
  await expect(page.getByRole("button", { name: "오늘 기록하기" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "하루 마무리 기록하기" })).toHaveCount(0)
  await expect(page.getByText(/일만 더 쓰면/u)).toHaveCount(0)

  // 추가 기록은 완료 상태를 깨지 않고 보조 동작으로만 열 수 있다.
  await page.getByRole("button", { name: "기록 더 남기기" }).click()
  await page.getByRole("button", { name: /회복 · 하루 마무리/u }).click()
  await expect(page.getByRole("heading", { name: "회복 · 하루 마무리" })).toBeVisible()

  // 하루 마무리 폼에서 탭바 "경기기록"을 누르면 종류 선택으로 돌아온다(§3-3).
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "경기기록" }).click()
  await expect(page.getByRole("button", { name: /회복 · 하루 마무리.*쉬는 날도 그대로/u })).toBeVisible()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
  const distance = page.getByRole("region", { name: "누적 거리와 변화" })
  await expect(distance.getByLabel(/이번 주, 집계 가능한 거리 기록 없음/u)).toBeVisible()
  await expect(distance.getByText(/집계 기준에 맞지 않아 제외한 기록 1건/u).first()).toBeVisible()
  await expect(page.getByText(/계획·안전 판정·다음 훈련 결정에는 쓰이지 않아요/u)).toBeVisible()
  await expect(page.getByText(/준비가 됐|부상 위험|좋아졌|나빠졌/u)).toHaveCount(0)
})
