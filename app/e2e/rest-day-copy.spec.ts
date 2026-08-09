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

  await expect(page.getByRole("button", { name: "하루 마무리 기록하기" })).toBeVisible()
  await expect(page.getByText(/일만 더 쓰면/u)).toHaveCount(0)

  // 승격의 핵심은 "누를 수 있다"는 것이다. 보이는 것만 확인하면 절반이다.
  await page.getByRole("button", { name: "하루 마무리 기록하기" }).click()
  await expect(page.getByRole("heading", { name: "회복 · 하루 마무리" })).toBeVisible()

  // 하루 마무리 폼에서 탭바 "기록"을 누르면 종류 선택으로 돌아온다(§3-3).
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: /기록/u }).click()
  await expect(page.getByRole("button", { name: /회복 · 하루 마무리.*쉬는 날도 그대로/u })).toBeVisible()

  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "분석" }).click()
  await expect(page.getByText("집계 가능한 거리 없음")).toBeVisible()
  await expect(page.getByText(/집계 제외 1건/u).first()).toBeVisible()
  await expect(page.getByText(/계획·안전 판정·다음 훈련 결정에는 쓰이지 않아요/u)).toBeVisible()
  await expect(page.getByText(/준비가 됐|부상 위험|좋아졌|나빠졌/u)).toHaveCount(0)
})
