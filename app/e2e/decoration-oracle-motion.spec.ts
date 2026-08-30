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
  await mainTabs.getByRole("button", { name: "분석" }).click()
  const oracle = page.getByRole("region", { name: "지금까지 기록으로 알 수 있는 것" })
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

  await mainTabs.getByRole("button", { name: "홈" }).click()
  await page.getByRole("button", { name: "꾸미기 열기" }).click()
  const canvas = page.locator(".decoration-studio-preview__canvas")
  await expect(canvas).toHaveAttribute("data-motion-direction", "STAY")

  await page.getByRole("button", { name: "이모지 스티커 도구" }).click()
  const controlsAnimation = await page.locator(".decoration-studio__controls").evaluate((element) => (
    getComputedStyle(element).animationName
  ))
  expect(controlsAnimation).toBe(testInfo.project.name === "reduced-motion" ? "none" : "decoration-tool-enter")
  await page.getByRole("button", { name: "꾸미기 도구 숨기기" }).click()

  await page.getByTestId("decoration-date-next").click()
  await expect(canvas).toHaveAttribute("data-motion-direction", "FORWARD")
  const pageAnimation = await canvas.evaluate((element) => getComputedStyle(element).animationName)
  expect(pageAnimation).toBe(testInfo.project.name === "reduced-motion" ? "none" : "decoration-page-forward")

  await page.getByTestId("decoration-date-previous").click()
  await expect(canvas).toHaveAttribute("data-motion-direction", "BACKWARD")
  expect(await page.locator("body").evaluate((body) => body.scrollWidth <= window.innerWidth)).toBe(true)
})
