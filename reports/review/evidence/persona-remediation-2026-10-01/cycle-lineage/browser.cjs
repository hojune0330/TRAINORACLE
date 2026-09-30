const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../..')
const requireApp = createRequire(path.join(root, 'app/package.json'))
const { build } = requireApp('esbuild')
const { chromium, expect } = requireApp('@playwright/test')
const out = path.join(__dirname, 'browser-output')
;(async () => {
  await fs.mkdir(out, { recursive: true })
  await build({ entryPoints: [path.join(__dirname, 'entry.tsx')], bundle: true, outdir: out, platform: 'browser', format: 'esm',
    nodePaths: [path.join(root, 'app/node_modules')], alias: { '@impl': path.join(root, 'impl/src') },
    define: { 'import.meta.env': '{"DEV":false}', 'process.env.NODE_ENV': '"production"' },
    loader: { '.woff2': 'file', '.woff': 'file', '.png': 'file', '.webp': 'file', '.svg': 'file' } })
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
    for (const [width, enlarged] of [[320, false], [375, false], [320, true]]) {
      for (const view of ['cycle', 'detail', 'detail-changed']) {
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
        await page.getByRole('button', { name: view === 'cycle' ? '이번 주기 기록 확인' : '훈련 방법과 이유', exact: true }).click()
        if (view === 'cycle') {
          await page.getByText('훈련별 비교 근거 1건', { exact: true }).click()
          await expect(page.getByText('변경 전 계획의 같은 훈련 기준', { exact: true })).toBeVisible()
          await expect(page.getByText(/직접 기록 RPE 3/)).toBeVisible()
        } else {
          await expect(page.getByText('직접 기록한 RPE 3', { exact: true })).toBeVisible()
          if (view === 'detail-changed') {
            await expect(page.getByText(/계획 오전 · 실제 오후/)).toBeVisible()
            await expect(page.getByText(/일부만 하거나 바꾼 훈련이라 원래 계획과 비교하지 않음/)).toBeVisible()
          }
          await expect(page.getByRole('heading', { name: '실제 기록', exact: true })).toBeInViewport()
          await expect(page.getByText(/연결된 일지가 아직 없어요/)).toHaveCount(0)
          const panel = page.getByRole('tabpanel')
          const beforeTab = await panel.evaluate(el => el.scrollTop)
          expect(beforeTab).toBeGreaterThan(0)
          await page.getByRole('tab', { name: '방법', exact: true }).click()
          await page.getByRole('tab', { name: '주기·기록', exact: true }).click()
          expect(await panel.evaluate(el => el.scrollTop)).toBeCloseTo(beforeTab, 0)
        }
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('dialog,.session-explanation__content')].some(el => el.scrollWidth > el.clientWidth + 1))
        expect(overflow).toBe(false)
        const screenshot = `${view}-${width}${enlarged ? '-large-reduced' : ''}.png`
        await page.screenshot({ path: path.join(__dirname, screenshot), fullPage: true })
        expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before)
        expect(errors).toEqual([])
        expect(external).toEqual([])
        results.push({ width, enlarged, view, overflow, errors, external, localStorageUnchanged: true, screenshot })
        await context.close()
      }
    }
  } finally {
    await fs.writeFile(path.join(__dirname, 'browser-result.json'), JSON.stringify({ scope: 'real components with synthetic local-only fixtures', results }, null, 2))
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
  console.log(JSON.stringify({ passed: results.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
