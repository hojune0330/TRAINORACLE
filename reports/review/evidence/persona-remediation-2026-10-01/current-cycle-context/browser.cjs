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
    for (const [width, enlarged] of [[320, false], [375, false], [320, true]]) for (const history of ['yes', 'no']) {
      const context = await browser.newContext({ viewport: { width, height: 667 }, reducedMotion: enlarged ? 'reduce' : 'no-preference', serviceWorkers: 'block' })
      const page = await context.newPage(), errors = [], external = []
      page.on('pageerror', error => errors.push(String(error)))
      await page.route('**/*', route => {
        if (new URL(route.request().url()).hostname !== '127.0.0.1') { external.push(route.request().url()); return route.abort() }
        return route.continue()
      })
      await page.clock.install({ time: new Date('2026-10-10T03:00:00.000Z') })
      await page.goto(`http://127.0.0.1:${server.address().port}/?history=${history}`)
      if (enlarged) await page.addStyleTag({ content: 'html { font-size: 200% !important; } button,p,small { font-size: 1rem !important; }' })
      const before = await page.evaluate(() => ({ active: localStorage.getItem('trainoracle.plan-beta.v1'), history: localStorage.getItem('trainoracle.plan-beta.history.v1') }))
      const open = () => page.getByRole('button', { name: '이번 주기 기록 확인', exact: true }).click()
      await open()
      const next = page.getByRole('button', { name: /다음 주기 계획 만들기/ })
      await expect(next).toBeVisible()
      const box = await next.boundingBox()
      expect(box.height).toBeGreaterThanOrEqual(44)
      const prefix = `cycle-${width}${enlarged ? '-large' : ''}-history-${history}`
      await next.scrollIntoViewIfNeeded()
      await page.screenshot({ path: path.join(__dirname, `${prefix}-summary.png`) })
      await page.getByText('어떤 계획을 기준으로 하나요?', { exact: true }).click()
      await expect(page.getByText(history === 'yes' ? '이번 주기에 계획을 바꾼 기록 2건을 원래 계획까지 확인했어요.'
        : '변경 전 계획을 모두 확인하지 못했어요. 지금 계획은 보존하며, 확인하지 못한 이전 구성은 새 계획의 근거로 사용하지 않아요.', { exact: true })).toBeVisible()
      await next.click()
      await expect(page.getByRole('button', { name: /통증은 없고 몸 상태는 평소와 같아요/ })).toBeVisible()
      await page.getByRole('button', { name: '현재 계획으로 돌아가기', exact: true }).click()
      expect(await page.evaluate(() => ({ active: localStorage.getItem('trainoracle.plan-beta.v1'), history: localStorage.getItem('trainoracle.plan-beta.history.v1') }))).toEqual(before)
      await open(); await next.click()
      await page.getByRole('button', { name: /통증은 없고 몸 상태는 평소와 같아요/ }).click()
      await page.getByRole('button', { name: '이 일정으로 시작', exact: true }).click()
      await expect.poll(() => page.evaluate(() => localStorage.getItem('trainoracle.plan-beta.v1'))).not.toBe(before.active)
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('trainoracle.plan-beta.history.v1'))[0].originalPlan)).toEqual(JSON.parse(before.active))
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
      expect(overflow).toBe(false)
      await page.screenshot({ path: path.join(__dirname, `${prefix}-selected.png`) })
      expect(errors).toEqual([]); expect(external).toEqual([])
      results.push({ width, enlarged, history, overflow, errors, external, cancelledStorageUnchanged: true, exactPredecessorRetained: true, nextTarget: box, screenshots: [`${prefix}-summary.png`, `${prefix}-selected.png`] })
      await context.close()
    }
  } finally {
    await fs.writeFile(path.join(__dirname, 'browser-result.json'), JSON.stringify({ scope: 'real PlanBeta; synthetic guest data; no provider or live account', results }, null, 2))
    await browser?.close(); await new Promise(resolve => server.close(resolve))
  }
  console.log(JSON.stringify({ passed: results.length }))
})().catch(error => { console.error(error); process.exitCode = 1 })
