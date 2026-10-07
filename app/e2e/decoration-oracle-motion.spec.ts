import { expect, test } from "@playwright/test"

test("keeps decoration and oracle motion brief, directional, and optional", async ({ page }, testInfo) => {
  await page.addInitScript(() => {
    const now = new Date()
    const date = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, "0"),
      String(now.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "motion-contract-entry",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "모션 점검 일지",
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
  await page.goto("/?app=1&uitest=1")

  const mainTabs = page.getByRole("navigation", { name: "주 탭" })
  await mainTabs.getByRole("button", { name: "오라클" }).click()
  const oracle = page.getByRole("region", { name: "내 훈련 요약" })
  await expect(oracle).toBeVisible()

  const oracleAnimations = await oracle.locator(".personal-oracle__insight").evaluateAll((elements) => (
    elements.map((element) => ({
      name: getComputedStyle(element).animationName,
      duration: getComputedStyle(element).animationDuration,
    }))
  ))
  if (testInfo.project.name === "reduced-motion") {
    expect(oracleAnimations.every((animation) => animation.name === "none")).toBe(true)
  } else {
    expect(oracleAnimations.map((animation) => animation.name)).toEqual([
      "oracle-insight-enter",
      "oracle-insight-enter",
      "oracle-insight-enter",
    ])
    expect(oracleAnimations.every((animation) => animation.duration === "0.3s")).toBe(true)
  }

  /* 홈의 통합 꾸미기 진입은 오늘 일지 편집기를 바로 열고 일지를 기본 대상으로 둔다. */
  await mainTabs.getByRole("button", { name: "홈" }).click()
  await page.getByRole("button", { name: "일지 예시·훈련법·꾸미기", exact: true }).click()
  await page.getByRole("button", { name: "일지 꾸미기", exact: true }).click()
  const editor = page.getByRole("dialog", { name: "일지 꾸미기", exact: true })
  await expect(editor).toBeVisible()
  await expect(editor.getByRole("button", { name: "일지", exact: true })).toHaveAttribute("aria-pressed", "true")

  const canvasAnimation = await page.locator(".journal-decoration-workspace--open > .decorated-journal-page")
    .evaluate((element) => getComputedStyle(element).animationName)
  expect(canvasAnimation).toBe(testInfo.project.name === "reduced-motion" ? "none" : "decoration-canvas-enter")

  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  const drawerContentAnimation = await page
    .locator('.journal-decoration-toolbar[data-open="true"] > .journal-decoration-toolbar__drawer-header')
    .evaluate((element) => getComputedStyle(element).animationName)
  expect(drawerContentAnimation).toBe(
    testInfo.project.name === "reduced-motion" ? "none" : "decoration-tools-content-enter",
  )
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true)
})
