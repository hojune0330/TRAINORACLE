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
      for (const frame of [6, 18]) {
        const context = await browser.newContext({ viewport: { width, height: 667 }, reducedMotion: enlarged ? 'reduce' : 'no-preference', serviceWorkers: 'block' })
        const page = await context.newPage(), errors = [], external = []
        page.on('pageerror', error => errors.push(String(error)))
        await page.route('**/*', route => {
          if (new URL(route.request().url()).hostname !== '127.0.0.1') { external.push(route.request().url()); return route.abort() }
          return route.continue()
        })
        await page.clock.setFixedTime(new Date('2026-10-01T03:00:00.000Z'))
        await page.goto(`http://127.0.0.1:${server.address().port}/?frame=${frame}`)
        if (enlarged) await page.addStyleTag({ content: 'html { font-size: 200% !important; } button,p,small { font-size: 1rem !important; }' })
        const before = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
        await page.getByRole('button', { name: '현재 기준으로 다음 계획안 만들기', exact: true }).click()
        await page.getByRole('button', { name: '현재 계획으로 돌아가기', exact: true }).waitFor()
        expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before)
        await page.getByRole('button', { name: '현재 계획으로 돌아가기', exact: true }).click()
        expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(before)
        await page.getByRole('button', { name: '현재 기준으로 다음 계획안 만들기', exact: true }).click()
        await page.getByRole('button', { name: /통증은 없고 몸 상태는 평소와 같아요/ }).click()
        await page.getByRole('button', { name: '이 일정으로 시작', exact: true }).waitFor()
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth || [...document.querySelectorAll('.app-scroll-region')].some(el => el.scrollWidth > el.clientWidth + 1))
        expect(overflow).toBe(false)
        const screenshot = `next-frame-${frame}-${width}${enlarged ? '-large-reduced' : ''}.png`
        await page.screenshot({ path: path.join(__dirname, screenshot), fullPage: true })
        await page.getByRole('button', { name: '이 일정으로 시작', exact: true }).click()
        await expect(page.getByRole('button', { name: '현재 계획으로 돌아가기', exact: true })).toHaveCount(0)
        const state = await page.evaluate(() => window.b07Read())
        expect(state.kind).toBe('loaded')
        expect(state.state.periodization.frameOrdinal).toBe(frame === 18 ? 1 : 7)
        expect(state.state.periodization.macrocycleOrdinal).toBe(frame === 18 ? 2 : 1)
        const accepted = await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))
        await page.reload()
        await page.getByRole('heading', { name: /훈련 계획/ }).first().waitFor()
        expect(await page.evaluate(() => Object.fromEntries(Object.entries(localStorage)))).toEqual(accepted)
        expect(errors).toEqual([]); expect(external).toEqual([])
        results.push({ width, enlarged, frame, overflow, errors, external, preservedBeforeAcceptance: true, periodization: state.state.periodization, screenshot })
        await context.close()
      }
    }
  } finally { await browser?.close(); await new Promise(resolve => server.close(resolve)) }
  await fs.writeFile(path.join(__dirname, 'browser-result.json'), JSON.stringify({ scope: 'Real PlanBeta screen; synthetic guest storage; not production/account/iOS', cases: results }, null, 2))
  console.log(JSON.stringify({ passed: results.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
