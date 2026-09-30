const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../..'), requireApp = createRequire(path.join(root, 'app/package.json'))
const { build } = requireApp('esbuild'), { chromium, expect } = requireApp('@playwright/test')
const out = path.join(__dirname, 'browser-output')
;(async () => {
  await fs.mkdir(out, { recursive: true })
  await build({ entryPoints: [path.join(__dirname, 'entry.tsx')], bundle: true, outdir: out, platform: 'browser', format: 'esm',
    nodePaths: [path.join(root, 'app/node_modules')], alias: { '@impl': path.join(root, 'impl/src') },
    define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
    loader: { '.woff2': 'file', '.woff': 'file', '.png': 'file', '.webp': 'file', '.svg': 'file' },
    plugins: [{ name: 'synthetic-account-only', setup(builder) {
      builder.onLoad({ filter: /account-plan-service\.ts$/ }, async ({ path: filename }) => {
        const original = await fs.readFile(filename, 'utf8')
        const enabled = 'export function accountPlansEnabled() { return accountJournalPreviewEnabled() && activeLocalAccount() !== null }'
        const start = 'export function accountPlanService(): AccountPlanService | null {'
        if (original.split(enabled).length !== 2 || original.split(start).length !== 2) throw Error('Missing exact synthetic service seam')
        return { contents: original.slice(0, original.indexOf(start)).replace(enabled, 'export function accountPlansEnabled() { return !!window.__historyRuntime }')
          + 'export function accountPlanService() { return window.__historyRuntime ?? null }', loader: 'ts' }
      })
    } }] })
  const html = '<!doctype html><html lang="ko"><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/entry.css"><body><div id="root"></div><script type="module" src="/entry.js"></script></body></html>'
  const server = http.createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname
      if (pathname === '/') { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(html); return }
      const file = path.resolve(out, '.' + pathname)
      if (!file.startsWith(out + path.sep)) { res.writeHead(403).end(); return }
      res.setHeader('Content-Type', ({ '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2' })[path.extname(file)] ?? 'application/octet-stream')
      res.end(await fs.readFile(file))
    } catch { res.writeHead(404).end() }
  })
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve))
  let browser
  const results = []
  try {
    browser = await chromium.launch({ channel: 'chrome', headless: true })
    for (const [width, enlarged] of [[320, false], [375, false], [320, true]]) for (const view of ['cycle', 'detail', 'oracle']) {
      const context = await browser.newContext({ viewport: { width, height: 667 }, reducedMotion: enlarged ? 'reduce' : 'no-preference', serviceWorkers: 'block' })
      const page = await context.newPage(), errors = [], external = []
      page.on('pageerror', error => errors.push(String(error)))
      await page.route('**/*', route => {
        if (new URL(route.request().url()).hostname !== '127.0.0.1') { external.push(route.request().url()); return route.abort() }
        return route.continue()
      })
      await page.goto(`http://127.0.0.1:${server.address().port}/?view=${view}`)
      if (enlarged) await page.addStyleTag({ content: 'html { font-size: 200% !important; } button,p,small { font-size: 1rem !important; }' })
      const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
      if (view !== 'oracle') await page.getByRole('button', { name: view === 'cycle' ? '이번 주기 기록 확인' : '훈련 방법과 이유', exact: true }).click()
      await expect(page.getByText('이전 계획과 연결된 기록을 확인하고 있어요.', { exact: true })).toBeVisible()
      await page.evaluate(() => window.__historyCommands.finish(false))
      const retry = page.getByRole('button', { name: '이전 계획 다시 불러오기', exact: true })
      await expect(retry).toBeVisible()
      expect(await page.evaluate(() => window.__historyCommands.requests())).toBe(1)
      const box = await retry.boundingBox()
      expect(box.height).toBeGreaterThanOrEqual(44)
      await page.screenshot({ path: path.join(__dirname, `${view}-${width}${enlarged ? '-large' : ''}-failed.png`), fullPage: true })
      await retry.click()
      await expect(page.getByText('이전 계획과 연결된 기록을 확인하고 있어요.', { exact: true })).toBeVisible()
      await page.evaluate(() => window.__historyCommands.finish(true))
      await expect(retry).toHaveCount(0)
      if (view === 'cycle') await expect(page.getByText('현재 계획에 연결된 훈련 1건', { exact: true })).toBeVisible()
      else if (view === 'detail') {
        await expect(page.getByRole('tab', { name: '주기·기록', exact: true })).toHaveAttribute('aria-selected', 'true')
        await expect(page.getByText('직접 기록한 RPE 3', { exact: true })).toBeVisible()
      } else await expect(page.getByText('계획과 실제 느낌을 1건 비교했어요', { exact: true })).toBeVisible()
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('dialog,.session-explanation__content')].some(el => el.scrollWidth > el.clientWidth + 1))
      expect(overflow).toBe(false)
      const screenshot = `${view}-${width}${enlarged ? '-large' : ''}-ready.png`
      await page.screenshot({ path: path.join(__dirname, screenshot), fullPage: true })
      expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before)
      expect(errors).toEqual([]); expect(external).toEqual([])
      results.push({ width, enlarged, view, overflow, errors, external, localStorageUnchanged: true, retryTarget: box, screenshot })
      await context.close()
    }
  } finally {
    await fs.writeFile(path.join(__dirname, 'browser-result.json'), JSON.stringify({ scope: 'real components, synthetic account transport; no live account', results }, null, 2))
    await browser?.close(); await new Promise(resolve => server.close(resolve))
  }
  console.log(JSON.stringify({ passed: results.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
