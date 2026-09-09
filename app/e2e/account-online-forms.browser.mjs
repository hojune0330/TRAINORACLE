import assert from "node:assert/strict"
import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { chromium } from "@playwright/test"
import { createServer } from "vite"

// Isolated form surfaces: synthetic transport only, never the account runtime.
const origin = "http://127.0.0.1:4382"
const tokenUrl = name => `/@fs/${fileURLToPath(new URL(`../../${name}`, import.meta.url)).replaceAll("\\", "/")}`
const server = await createServer({ root: fileURLToPath(new URL("..", import.meta.url)),
  server: { host: "127.0.0.1", port: 4382, strictPort: true }, clearScreen: false })
let browser
try {
  await server.listen()
  browser = await chromium.launch({ channel: "chrome", headless: true })
  const output = fileURLToPath(new URL("../test-results/account-online-forms/", import.meta.url))
  await mkdir(output, { recursive: true })
  for (const width of [375, 1280]) {
    for (const form of ["QuickSessionForm", "PostSessionForm", "EveningCheckin", "RaceForm"]) {
      for (const storage of ["ACCOUNT", "PENDING"]) {
        const page = await browser.newPage({ viewport: { width, height: 800 }, serviceWorkers: "block" })
        const errors = []
        page.on("pageerror", error => { errors.push(error.message); console.error("Synthetic harness:", error.message) })
        await page.route("**/*", route => {
          const url = new URL(route.request().url())
          if (url.origin !== origin) return route.abort()
          if (url.pathname === "/__forms__") return route.fulfill({ contentType: "text/html", body: `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root" style="max-width:560px;position:relative;margin:auto"></div><script type="module">
            import RefreshRuntime from '/@react-refresh';
            RefreshRuntime.injectIntoGlobalHook(window);
            window.$RefreshReg$=()=>{};window.$RefreshSig$=()=>type=>type;window.__vite_plugin_react_preamble_installed__=true;
            const React=(await import('/node_modules/.vite/deps/react.js')).default;
            const {createRoot}=(await import('/node_modules/.vite/deps/react-dom_client.js')).default;
            await import('/src/styles/app.css');
            await import('${tokenUrl("colors_and_type.css")}');
            await import('${tokenUrl("colors_and_type_journal.css")}');
            const {${form}}=await import('/src/screens/log-entry/${form}.tsx');
            window.calls=0;window.saved=null;
            createRoot(document.getElementById('root')).render(React.createElement(${form},{onDone:(...args)=>{window.saved=args}}));
          </script></html>` })
          if (url.pathname === "/src/domain/account/account-journal-record-service.ts") return route.fulfill({ contentType: "application/javascript", body: `
            export const accountJournalRecordsEnabled=()=>true;
            export async function persistAccountJournalRecord(){window.calls++;await new Promise(resolve=>setTimeout(resolve,150));return {ok:true,storage:'${storage}'}}
          ` })
          return route.continue()
        })
        await page.goto(`${origin}/__forms__`)
        const quick = form === "QuickSessionForm"
        const save = page.getByRole("button", { name: quick ? "오늘은 쉬었어요" : /^저장/ })
        await save.click()
        if (quick) {
          await page.getByRole("heading", { name: "오늘 기록을 남겼어요." }).waitFor()
          const status = page.getByRole("status")
          assert.match(await status.innerText(), storage === "ACCOUNT" ? /계정에 저장했어요/ : /계정 전송 대기/)
          await page.screenshot({ path: `${output}/quick-${storage}-${width}.png`, fullPage: true })
          await page.getByRole("button", { name: "완료", exact: true }).click()
        }
        await page.waitForFunction(() => window.saved !== null)
        assert.equal(await page.evaluate(() => window.calls), 1)
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true)
        assert.deepEqual(errors, [])
        console.log(`PASS ${form} ${storage} ${width}px`)
        await page.close()
      }
    }
  }
} finally {
  await browser?.close()
  await server.close()
}
