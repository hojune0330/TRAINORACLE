import { expect, test } from "@playwright/test"

for (const width of [320, 375, 1280]) {
  test(`draft editor at ${width}px uses real local buffer and synthetic transport`, async ({ page }) => {
    await page.setViewportSize({ width, height: 800 })
    await page.route("**/*", route => {
      const url = new URL(route.request().url())
      if (url.origin !== "http://127.0.0.1:4381") return route.abort()
      if (url.pathname === "/__draft_panel__") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:16px;font-family:sans-serif;--line:#ccc;--ink:#111;--paper:#fafafa}button{font:inherit}p{line-height:1.5}button svg{vertical-align:middle}</style><div id="root"></div><script type="module">
        import RefreshRuntime from '/@react-refresh';
        RefreshRuntime.injectIntoGlobalHook(window);
        window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
        window.__vite_plugin_react_preamble_installed__ = true;
        const React = (await import('/node_modules/.vite/deps/react.js')).default;
        const {createRoot} = (await import('/node_modules/.vite/deps/react-dom_client.js')).default;
        const {setActiveLocalAccount} = await import('/src/domain/account/local-journal-ownership.ts');
        setActiveLocalAccount('11111111-1111-4111-8111-111111111111');
        const {AccountJournalDraftPanel} = await import('/src/screens/account/AccountJournalDraftPanel.tsx');
        createRoot(document.getElementById('root')).render(React.createElement(AccountJournalDraftPanel,{userId:'11111111-1111-4111-8111-111111111111'}));
      </script></html>` })
      if (url.pathname === "/src/domain/account/account-journal-api.ts") return route.fulfill({ contentType: "application/javascript", body: `
        const rows = new Map();
        export async function requestAccountJournal(owner, req, current) {
          if(!current()) return {ok:false,code:'STALE_RESPONSE'};
          if(req.action==='list') return {ok:true,data:{kind:'list',documents:[...rows.values()],nextCursor:null}};
          if(req.action==='save') {rows.set(req.documentId,{documentId:req.documentId,revision:req.expectedRevision+1,document:req.document});return {ok:true,data:{kind:'saved',documentId:req.documentId,operationId:req.operationId,revision:req.expectedRevision+1}}}
          return {ok:false,code:'UNAVAILABLE'};
        }` })
      return route.continue()
    })
    const errors: string[] = []
    page.on("pageerror", error => errors.push(error.message))
    await page.goto("/__draft_panel__")
    await expect.poll(async () => ({ errors, ready: await page.getByRole("checkbox").count() })).toEqual({ errors: [], ready: 1 })
    await page.getByRole("checkbox").check()
    await page.getByRole("button", { name: "새 초안", exact: true }).click()
    await page.getByLabel("제목", { exact: true }).fill("합성 시험 초안")
    await page.getByLabel("내용", { exact: true }).fill("실제 개인정보가 아닌 시험 내용입니다.")
    await page.getByRole("button", { name: "계정에 저장", exact: true }).click()
    await expect(page.getByRole("status")).toHaveText("계정에 초안이 저장됐어요.")
    await expect(page.getByLabel("내용", { exact: true })).toHaveValue("실제 개인정보가 아닌 시험 내용입니다.")
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: test.info().outputPath(`draft-panel-${width}.png`), fullPage: true })
    expect(errors).toEqual([])
  })
}
