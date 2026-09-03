import { expect, test } from "@playwright/test"
import { undersizedInteractiveTargets } from "./touch-audit"

test("measures native label hit areas without accepting small or unrelated targets", async ({ page }) => {
  await page.setContent(`
    <style>
      input { width:18px; height:18px; margin:0; }
      label { display:block; width:100px; height:44px; }
      #small { width:43px; }
      button { width:18px; height:18px; padding:0; border:0; }
    </style>
    <label><input id="valid" type="radio" name="method">Native label</label>
    <label id="small"><input type="checkbox">Small</label>
    <label for="missing"><input aria-label="Unrelated" type="radio">Not associated</label>
    <input aria-label="No label" type="radio">
    <button aria-label="Small button"></button>
  `)
  const failures = await undersizedInteractiveTargets(page.locator("body"))
  expect(failures.map(item => item.label)).toEqual(["Small", "Unrelated", "No label", "Small button"])
  expect(failures[0]?.width).toBe(43)
  await page.getByText("Native label", { exact: true }).click({ position: { x: 80, y: 22 } })
  await expect(page.locator("#valid")).toBeChecked()
  await page.locator("label").first().evaluate(node => { node.style.width = "43px" })
  expect((await undersizedInteractiveTargets(page.locator("body"))).map(item => item.label)).toContain("Native label")
})

test("audits revealed controls but not descendants hidden by collapsed details", async ({ page }) => {
  await page.setContent(`
    <style>
      summary { width:100px; height:44px; }
      button { width:18px; height:18px; padding:0; border:0; }
    </style>
    <details><summary>Reveal</summary><button>Small</button></details>
  `)
  expect(await undersizedInteractiveTargets(page.locator("body"))).toEqual([])
  await page.getByText("Reveal", { exact: true }).click()
  expect((await undersizedInteractiveTargets(page.locator("body"))).map(item => item.label)).toEqual(["Small"])
})
