import { expect, test } from "@playwright/test"

test.beforeEach(({}, testInfo) => {
  test.skip(
    !["touch-narrow", "desktop-chromium"].includes(testInfo.project.name),
    "mobile and desktop decoration contract",
  )
})

test("routes the home decoration card into the real journal editor with points", async ({ page }, testInfo) => {
  const isDesktop = testInfo.project.name === "desktop-chromium"
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript(() => {
    const now = new Date()
    const iso = (d: Date) => [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, "0"),
      String(d.getDate()).padStart(2, "0"),
    ].join("-")
    const date = iso(now)
    const yesterday = new Date(now)
    yesterday.setDate(yesterday.getDate() - 1)
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "decoration-unified-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "꾸미기 화면 점검",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 4,
      memo: "",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
      },
    }]))
    /* 일지 2일 = 8P — 결승선 스티커(8P) 구매를 실제 편집기 서랍에서 검증한다. */
    window.localStorage.setItem("trainoracle.engagement.v2", JSON.stringify({
      version: 2,
      visitDates: [],
      journalDates: [date, iso(yesterday)],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }))
  })

  await page.goto("/?app=1")
  /* 홈 카드는 이제 진입 카드 — 별도 편집 화면이나 placeholder 미리보기가 없다. */
  await expect(page.getByRole("heading", { name: "꾸미기 보관함 · 사용 가능 8P" })).toBeVisible()
  await expect(page.getByRole("region", { name: "꾸미기 미리보기" })).toHaveCount(0)
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await page.getByRole("button", { name: "꾸미기 열기" }).click()

  /* 오늘 일지 상세로 이동해 진짜 페이지 위에서 편집기가 자동으로 열린다. */
  const editor = page.getByRole("dialog", { name: "이 일지 꾸미기" })
  await expect(editor).toBeVisible()
  await expect(page.getByText("꾸미기 화면 점검")).toBeVisible()

  await expect(page.locator(".journal-decoration-toolbar")).toHaveAttribute("data-open", "false")
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await expect(page.locator(".journal-decoration-toolbar")).toHaveAttribute("data-open", "true")
  await expect(page.locator(".journal-decoration-toolbar")).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, 0)")

  const drawerGeometry = await page.evaluate(() => {
    const drawer = document.querySelector<HTMLElement>(".journal-decoration-toolbar")
    const pageFrame = document.querySelector<HTMLElement>(".decorated-journal-page")
    const navigation = document.querySelector<HTMLElement>(".app-tab-bar")
    if (drawer === null || pageFrame === null || navigation === null) return null
    const drawerRect = drawer.getBoundingClientRect()
    const pageRect = pageFrame.getBoundingClientRect()
    return {
      drawerTop: drawerRect.top,
      drawerBottom: drawerRect.bottom,
      paperStartsAboveDrawer: pageRect.top < drawerRect.top,
      paperDrawerOverlap: pageRect.right - drawerRect.left,
      paperVisibleWidth: Math.min(pageRect.right, drawerRect.left) - pageRect.left,
      navigationHidden: getComputedStyle(navigation).visibility === "hidden",
      pageFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(drawerGeometry).not.toBeNull()
  if (isDesktop) {
    expect(drawerGeometry?.drawerTop ?? 0).toBeGreaterThanOrEqual(50)
    expect(drawerGeometry?.drawerBottom ?? 900).toBeLessThanOrEqual(850)
    expect(drawerGeometry?.paperDrawerOverlap ?? 0).toBeGreaterThan(300)
    expect(drawerGeometry?.paperVisibleWidth ?? 0).toBeGreaterThan(400)
  } else {
    expect(drawerGeometry?.drawerTop ?? 0).toBeGreaterThan(0)
    expect(drawerGeometry?.drawerBottom ?? 568).toBeLessThanOrEqual(511)
    expect(drawerGeometry?.paperStartsAboveDrawer).toBe(true)
  }
  expect(drawerGeometry?.navigationHidden).toBe(true)
  expect(drawerGeometry?.pageFits).toBe(true)

  /* 포인트 구매는 타일 선택 뒤 같은 자리의 확인 행에서 한 번 더 확인한다. */
  await expect(page.getByText("베타 포인트 · 사용 가능 8P")).toBeVisible()
  await page.getByRole("button", { name: "결승선 스티커 8P로 받기" }).click()
  const purchaseConfirmation = page.getByRole("group", { name: "결승선 스티커 받기 확인" })
  await expect(purchaseConfirmation).toBeVisible()
  await expect(purchaseConfirmation.getByText("8P를 사용해 받을까요?")).toBeVisible()
  await purchaseConfirmation.getByRole("button", { name: "8P로 받기" }).click()
  await expect(page.getByText("받았어요. 0P가 남았어요.")).toBeVisible()
  await expect(page.getByRole("button", { name: "결승선 스티커 8P로 받기" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "결승선 스티커 붙이기" })).toBeVisible()
  await expect(page.getByText("베타 포인트 · 사용 가능 0P")).toBeVisible()

  /* 자동-열기 인텐트는 1회용 — 새로고침 뒤에는 저절로 열리지 않는다. */
  await page.reload()
  await page.getByRole("button", { name: /꾸미기 화면 점검.*상세 열기/u }).click()
  await expect(page.getByRole("dialog", { name: "이 일지 꾸미기" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "일지 꾸미기 열기" })).toBeVisible()

  expect(consoleErrors).toEqual([])
})
