import { expect, test } from "@playwright/test"
import { undersizedInteractiveTargets } from "./touch-audit"

test("audits independent links including links revealed inside details", async ({ page }) => {
  await page.setContent(`
    <style>
      a { display:block; width:100px; height:44px; }
      #small-link { height:24px; }
      #narrow-link { width:43px; }
      summary { width:100px; height:44px; }
    </style>
    <a href="#valid">Valid link</a>
    <a id="small-link" href="#small">Small link</a>
    <a id="narrow-link" href="#narrow">Narrow link</a>
    <a style="height:20px">Not a link</a>
    <details><summary>Reveal link</summary><a href="#hidden" style="height:24px">Revealed link</a></details>
  `)
  expect((await undersizedInteractiveTargets(page.locator("body"))).map(item => item.label)).toEqual(["Small link", "Narrow link"])
  await page.getByText("Reveal link", { exact: true }).click()
  expect((await undersizedInteractiveTargets(page.locator("body"))).map(item => item.label)).toEqual(["Small link", "Narrow link", "Revealed link"])
  await page.getByRole("link", { name: "Valid link" }).click({ position: { x: 80, y: 40 } })
  await expect.poll(() => page.evaluate(() => location.hash)).toBe("#valid")
})

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

test("audits visible labels even when their native inputs are transparent", async ({ page }) => {
  await page.setContent(`
    <style>
      input { width:18px; height:18px; margin:0; opacity:0; }
      label { display:block; width:100px; height:44px; }
      #small-label { width:43px; }
      #hidden-label { opacity:0; }
    </style>
    <label for="large-input">Large visible label</label><input id="large-input" type="checkbox">
    <label id="small-label"><input id="small-input" type="checkbox">Small visible label</label>
    <label id="hidden-label"><input type="checkbox">Hidden label</label>
  `)
  await page.getByText("Small visible label", { exact: true }).click()
  await expect(page.locator("#small-input")).toBeChecked()
  await page.getByText("Large visible label", { exact: true }).click()
  await expect(page.locator("#large-input")).toBeChecked()
  const failures = await undersizedInteractiveTargets(page.locator("body"))
  expect(failures).toEqual([{ label: "Small visible label", width: 43, height: 44 }])
})
