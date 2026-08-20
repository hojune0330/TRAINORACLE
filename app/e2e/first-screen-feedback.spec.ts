import { expect, test } from "@playwright/test"

test.use({ serviceWorkers: "block" })

test("explains the first free beta places without implying that account sync is open", async ({ page }) => {
  // Given: a new athlete is using the public local-journal app.
  await page.goto("/")
  await page.getByRole("button", { name: "더보기" }).click()

  // When: the athlete opens the plain-language FAQ and expands the free-beta answer.
  await page.getByRole("button", { name: "쉬운 도움말과 FAQ" }).click()
  await expect(page.getByTestId("beta-price-notice")).toHaveText(
    "TrainOracle 베타는 현재 무료입니다. 서비스 운영을 위해 나중에 월 구독이나 광고가 포함된 선택 상품이 생길 수 있습니다. 가격이나 무료 기능이 바뀌기 전에는 앱에서 먼저 알려드립니다.",
  )
  await page.getByText("지금 무료인가요?").click()

  // Then: capacity and the current local-only boundary are both visible.
  await expect(page.getByText(/첫 200명에게 열리는 무료 베타/u)).toBeVisible()
  await expect(page.getByText(/지금은 로그인 없이 이 기기에서 일지를 쓸 수 있어요/u)).toBeVisible()

  await page.getByText("지금 무엇을 할 수 있나요?").click()
  await expect(page.getByText(/오늘의 일지, 달력과 9.5일 보기, 지난 일지, 백업·복원, 꾸미기를 사용할 수 있어요/u)).toBeVisible()
  await page.getByText("아직 준비 중인 기능은 무엇인가요?").click()
  await expect(page.getByText(/계정 동기화, 코치 연결, 문의 게시판, 자동 훈련 처방은 아직 열지 않았어요/u)).toBeVisible()
})

test("keeps the welcome home clear and usable on narrow phones", async ({ page }, testInfo) => {
  for (const viewport of [{ width: 320, height: 568 }, { width: 375, height: 667 }]) {
    await page.setViewportSize(viewport)
    await page.goto("/")

    await expect(page.getByRole("heading", {
      name: "달리기 일지를 남기고, 내 기록으로 훈련 계획을 받아요.",
    })).toBeVisible()
    await expect(page.getByText("모든 데이터는 이 기기에만 저장돼요.")).toBeVisible()
    await expect(page.getByRole("navigation", { name: "주 탭" })).toBeVisible()
    await expect(page.getByRole("button", { name: "오늘 기록 남기기" })).toBeInViewport()
    const services = page.getByRole("navigation", { name: "내 기록 살펴보기" })
    for (const name of [/^내 일지/u, /^훈련 계획/u, /^분석/u]) {
      await expect(services.getByRole("button", { name })).toBeVisible()
    }
    await expect(services.getByRole("button")).toHaveCount(3)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.screenshot({
      path: testInfo.outputPath(`first-screen-${viewport.width}x${viewport.height}.png`),
      fullPage: true,
    })
  }

  await page.getByRole("button", { name: "오늘 기록 남기기" }).click()
  await expect(page.getByRole("heading", { name: "훈련 후 · 기록" })).toBeVisible()
  await expect(page.getByRole("button", { name: "← 뒤로" })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  // the chooser is reached via the "경기기록" tab bar button (§3-3)
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "경기기록" }).click()
  const heading = page.getByRole("heading", { name: "어떤 일지를 쓰세요?" })
  await expect(heading).toBeFocused()
  await expect(page.getByRole("button", { name: /경기 직전\/직후/u })).toBeInViewport()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await expect(page.getByRole("button", { name: "← 뒤로" })).toBeInViewport()
  await page.screenshot({ path: testInfo.outputPath("record-choice-375x667.png"), fullPage: true })
})

test("shows a returning athlete's latest entry before the decoration studio", async ({ page }, testInfo) => {
  // Given: a returning athlete has one local post-session journal entry.
  await page.addInitScript(() => {
    localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "home-order-entry",
      kind: "post-session",
      date: "2026-08-10",
      savedAt: "2026-08-10T09:00:00.000Z",
      syncState: "local",
      system: "lt",
      title: "아침 템포런",
      distanceKm: "8",
      durationMin: "40",
      avgPace: "5:00",
      rpe: 6,
      memo: "",
      memoPurpose: "PRIVATE_SELF_ONLY",
    }]))
  })
  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto("/")
  const recentEntry = page.getByRole("button", { name: /훈련 후.*아침 템포런.*상세/u })
  const services = page.getByRole("navigation", { name: "내 기록 살펴보기" })
  const decorationEntry = page.getByText("일지 꾸미기 · 사용 가능 4P")

  // When: the athlete opens the first home screen.
  await expect(recentEntry).toBeVisible()
  await expect(page.getByText("8월 10일")).toBeVisible()
  await expect(decorationEntry).toBeVisible()

  // Then: the latest journal appears before decoration, with no horizontal overflow.
  const recentTop = await recentEntry.evaluate((element) => element.getBoundingClientRect().top)
  const servicesTop = await services.evaluate((element) => element.getBoundingClientRect().top)
  const decorationTop = await decorationEntry.evaluate((element) => element.getBoundingClientRect().top)
  expect(recentTop).toBeLessThan(servicesTop)
  expect(recentTop).toBeLessThan(decorationTop)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("returning-home-record-first-320x568.png"), fullPage: true })
})

test("shows a truthful closed feedback screen when its release switch is off", async ({ page }) => {
  await page.goto("/?feedback=1")
  await expect(page.getByRole("heading", { name: "문의 게시판", exact: true })).toBeVisible()
  await expect(page.getByText("문의 게시판을 지금 사용할 수 없어요.")).toBeVisible()
  await expect(page.getByText(/GitHub/u)).toHaveCount(0)
})

test("opens the closed feedback state from the More entry", async ({ page }) => {
  await page.goto("/")

  await page.getByRole("button", { name: "더보기" }).click()
  await expect(page.getByText("지금은 준비 중이에요. 열리면 앱 안에서 알려드려요")).toBeVisible()

  await page.getByRole("link", { name: /^문의 게시판/u }).click()
  await expect(page.getByText("문의 게시판을 지금 사용할 수 없어요.")).toBeVisible()
})
