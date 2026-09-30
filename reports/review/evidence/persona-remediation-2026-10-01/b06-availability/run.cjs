const fs = require('node:fs/promises')
const path = require('node:path')
const http = require('node:http')
const { createRequire } = require('node:module')
const root = path.resolve(__dirname, '../..')
const appRequire = createRequire(path.join(root, 'app/package.json'))
const { build } = appRequire('esbuild')
const { chromium } = appRequire('playwright')
const out = path.join(__dirname, 'output')
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
      for (const mode of ['changed', 'missing', 'supported']) {
        const context = await browser.newContext({ viewport: { width, height: 667 }, reducedMotion: enlarged ? 'reduce' : 'no-preference', serviceWorkers: 'block' })
        const page = await context.newPage()
        const errors = []
        page.on('pageerror', error => errors.push(String(error)))
        await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`)
        await page.getByRole('button', { name: mode === 'supported' ? '다음 계획 조정하기' : '이번 주기 기록 확인', exact: true }).click()
        await page.evaluate(() => document.fonts.ready)
        if (enlarged) await page.evaluate(() => {
          for (const el of document.querySelectorAll('h1,h2,strong,small,p,button')) {
            el.style.fontSize = `${parseFloat(getComputedStyle(el).fontSize) * 2}px`
          }
        })
        const screenshot = `${mode}-${width}${enlarged ? '-text200-reduced' : ''}.png`
        await page.screenshot({ path: path.join(__dirname, screenshot), fullPage: true })
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
        const adjustmentChoices = await page.getByRole('button', { name: /다음 계획을 조정하고 싶어요/ }).count()
        if ((mode === 'supported') !== (adjustmentChoices === 1) || overflow || errors.length) throw Error(JSON.stringify({ mode, width, enlarged, adjustmentChoices, overflow, errors }))
        if (mode === 'supported') await page.getByRole('button', { name: /이번 주기 수행 기록을 볼래요/ }).click()
        await page.getByRole('heading', { name: '이번 주기 기록 요약' }).waitFor()
        const targets = await page.locator('button:visible').evaluateAll(buttons => buttons.map(el => ({ name: el.textContent?.trim(), height: el.getBoundingClientRect().height, width: el.getBoundingClientRect().width })))
        if (targets.some(t => t.height < 43 || t.width < 43)) throw Error(`Small target: ${JSON.stringify(targets)}`)
        results.push({ mode, width, enlarged, overflow, errors, adjustmentChoices, cycleEvidenceReached: true, targets, screenshot })
        await context.close()
      }
    }
  } finally {
    await browser?.close()
    await new Promise(resolve => server.close(resolve))
  }
  await fs.writeFile(path.join(__dirname, 'result.json'), JSON.stringify({ scope: 'isolated real component with synthetic fixtures, not full app or production', cases: results }, null, 2))
  console.log(JSON.stringify({ passed: results.length, file: path.join(__dirname, 'result.json') }))
})().catch(error => { console.error(error); process.exitCode = 1 })
