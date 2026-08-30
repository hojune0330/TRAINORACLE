import { expect, test } from "@playwright/test"

test.beforeEach(({}, testInfo) => {
  test.skip(
    !["touch-narrow", "desktop-chromium"].includes(testInfo.project.name),
    "mobile and desktop decoration contract",
  )
})

test("prioritizes the real journal and keeps the compact decoration editor usable", async ({ page }, testInfo) => {
  const isDesktop = testInfo.project.name === "desktop-chromium"
  const consoleErrors: string[] = []
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text())
  })
  page.on("pageerror", (error) => consoleErrors.push(error.message))

  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "decoration-studio-ux-entry",
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
  })

  await page.goto("/?app=1")
  await expect(page.getByText("꾸미기 보관함", { exact: false })).toBeVisible()
  await expect(page.getByRole("region", { name: "꾸미기 미리보기" })).toHaveCount(0)
  await page.getByRole("button", { name: "꾸미기 열기" }).click()

  const studio = page.getByRole("dialog", { name: /일지 꾸미기 · 사용 가능/u })
  await expect(studio).toBeVisible()
  await expect(page.getByRole("region", { name: "꾸미기 미리보기" })).toBeVisible()
  await expect(page.getByRole("combobox", { name: "꾸미기 종류" })).toHaveCount(0)
  await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  await expect(page.getByRole("combobox", { name: "꾸미기 종류" })).toBeVisible()

  const studioGeometry = await page.evaluate(() => {
    const dialog = document.querySelector<HTMLElement>(".decoration-shop--open")
    const catalog = document.querySelector<HTMLElement>(".decoration-studio__catalog")
    const firstCard = document.querySelector<HTMLElement>(".decoration-shop__item")
    const navigation = document.querySelector<HTMLElement>(".app-tab-bar")
    if (dialog === null || catalog === null || firstCard === null || navigation === null) return null
    const dialogRect = dialog.getBoundingClientRect()
    return {
      dialogTop: dialogRect.top,
      dialogBottom: dialogRect.bottom,
      catalogScrollable: catalog.scrollHeight > catalog.clientHeight,
      cardWidth: firstCard.getBoundingClientRect().width,
      buttonCount: dialog.querySelectorAll("button").length,
      navigationHidden: getComputedStyle(navigation).visibility === "hidden",
      pageFits: document.documentElement.scrollWidth <= window.innerWidth,
    }
  })
  expect(studioGeometry).not.toBeNull()
  if (isDesktop) {
    expect(studioGeometry?.dialogTop ?? 0).toBeGreaterThan(0)
    expect(studioGeometry?.dialogBottom ?? 900).toBeLessThan(900)
  } else {
    expect(studioGeometry?.dialogTop).toBe(0)
    expect(studioGeometry?.dialogBottom).toBe(568)
  }
  expect(studioGeometry?.catalogScrollable).toBe(true)
  expect(studioGeometry?.cardWidth ?? 0).toBeGreaterThan(130)
  expect(studioGeometry?.buttonCount ?? 999).toBeLessThan(85)
  expect(studioGeometry?.navigationHidden).toBe(true)
  expect(studioGeometry?.pageFits).toBe(true)

  if (!isDesktop) {
    const catalog = page.locator(".decoration-studio__catalog")
    await catalog.evaluate((element) => { element.scrollTop = 120 })
    await expect(studio).toHaveAttribute("data-header-collapsed", "true")
    await expect(page.locator(".decoration-shop__header")).toHaveCSS("max-height", "0px")
    await page.getByRole("button", { name: "꾸미기 도구 숨기기" }).click()
    await expect(studio).toHaveAttribute("data-header-collapsed", "false")
    await expect(page.getByRole("button", { name: "꾸미기 닫기" })).toBeVisible()
    await page.getByRole("button", { name: "모든 꾸미기 도구" }).click()
  }

  await page.getByRole("button", { name: "결승선 스티커 미리보기" }).click()
  await expect(page.getByRole("region", { name: "선택한 꾸미기" })).toContainText("결승선 스티커")
  await expect(page.getByRole("button", { name: "결승선 스티커 8P로 받기" })).toBeVisible()

  if (!isDesktop) {
    await page.locator(".decoration-studio__catalog").evaluate((element) => { element.scrollTop = 0 })
    await expect(studio).toHaveAttribute("data-header-collapsed", "false")
  }
  await page.getByRole("button", { name: "꾸미기 닫기" }).click()
  await page.getByRole("button", { name: /꾸미기 화면 점검.*상세 열기/u }).click()
  await page.getByRole("button", { name: "일지 꾸미기 열기" }).click()
  await expect(page.getByRole("dialog", { name: "이 일지 꾸미기" })).toBeVisible()
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
  expect(consoleErrors).toEqual([])
})
