import { expect, test } from "@playwright/test"

for (const width of [320, 375, 1280]) {
  test(`draft editor at ${width}px uses real local buffer and synthetic transport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.route("**/*", route => {
      const url = new URL(route.request().url())
      if (url.origin !== "http://127.0.0.1:4381") return route.abort()
      if (url.pathname === "/__draft_panel__") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const fixturePath = '/e2e/fixtures/account-journal-draft-ui.tsx';
        const {mount} = await import(fixturePath);
        mount();
      </script></html>` })
      if (url.pathname === "/src/domain/account/account-journal-api.ts") return route.fulfill({ contentType: "application/javascript", body: `
        const rows = new Map();
        export async function requestAccountJournal(owner, req, current) {
          if(!current()) return {ok:false,code:'STALE_RESPONSE'};
          if(req.action==='list' && globalThis.__DS06_FAIL_LIST__) return {ok:false,code:'UNAVAILABLE'};
          if(req.action==='list') return {ok:true,data:{kind:'list',documents:[...rows.values()],nextCursor:null}};
          if(req.action==='save') {rows.set(req.documentId,{documentId:req.documentId,revision:req.expectedRevision+1,document:req.document});return {ok:true,data:{kind:'saved',documentId:req.documentId,operationId:req.operationId,revision:req.expectedRevision+1}}}
          return {ok:false,code:'UNAVAILABLE'};
        }` })
      return route.continue()
    })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto("/__draft_panel__")
    await expect.poll(async () => ({ errors, ready: await page.getByRole("checkbox").count() }), { timeout: 20_000 }).toEqual({ errors: [], ready: 1 })
    await page.evaluate(() => document.fonts.load('14px "Pretendard Variable"'))
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes("Pretendard Variable") && font.status === "loaded"))).toBe(true)
    expect(await page.locator(".account-journal-draft").evaluate(element => ({
      display: getComputedStyle(element).display,
      touchMinimum: getComputedStyle(document.documentElement).getPropertyValue("--app-touch-min").trim(),
    }))).toEqual({ display: "flex", touchMinimum: "44px" })
    await page.getByRole("checkbox").check()
    await page.getByRole("button", { name: "새 초안", exact: true }).click()
    await page.getByLabel("제목", { exact: true }).fill("합성 시험 초안")
    await page.getByLabel("내용", { exact: true }).fill("실제 개인정보가 아닌 시험 내용입니다.")
    await page.getByRole("button", { name: "계정에 저장", exact: true }).click()
    await expect(page.getByRole("status")).toHaveText("계정에 초안이 저장됐어요.")
    await expect(page.getByLabel("내용", { exact: true })).toHaveValue("실제 개인정보가 아닌 시험 내용입니다.")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`draft-panel-${width}.png`), fullPage: true })
    if (width <= 375) {
      const buttonHeights = await page.locator(".account-journal-draft button:visible").evaluateAll(buttons => (
        buttons.map(button => button.getBoundingClientRect().height)
      ))
      expect(buttonHeights.length).toBeGreaterThan(0)
      expect(Math.min(...buttonHeights)).toBeGreaterThanOrEqual(44)
      const consentTarget = await page.locator(".account-journal-draft .account-panel__check").first().boundingBox()
      expect(consentTarget?.height ?? 0).toBeGreaterThanOrEqual(44)

      await page.evaluate(() => {
        (globalThis as typeof globalThis & { __DS06_FAIL_LIST__?: boolean }).__DS06_FAIL_LIST__ = true
      })
      await page.getByRole("button", { name: "계정 초안 불러오기", exact: true }).click()
      const longState = page.getByRole("status")
      await expect(longState).toHaveText("계정 목록을 모두 불러오지 못했어요. 기존 초안은 지우지 않았어요. 다시 불러와 주세요.")
      await expect(longState).toHaveAttribute("data-state", "error")
      expect(await longState.evaluate(element => {
        const rect = element.getBoundingClientRect()
        return {
          insideViewport: rect.left >= 0 && rect.right <= document.documentElement.clientWidth,
          noHorizontalOverflow: element.scrollWidth <= element.clientWidth,
          wraps: getComputedStyle(element).whiteSpace !== "nowrap",
        }
      })).toEqual({ insideViewport: true, noHorizontalOverflow: true, wraps: true })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: test.info().outputPath(`draft-panel-long-error-${width}.png`), fullPage: true })
    }
    expect(errors).toEqual([])
  })
}
