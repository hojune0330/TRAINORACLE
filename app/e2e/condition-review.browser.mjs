import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { chromium, expect } from '@playwright/test'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const app = fileURLToPath(new URL('../', import.meta.url)), root = resolve(app, '..')
const fault = process.argv.includes('--fault')
const server = await createServer({ configFile: false, envDir: false, root: app, base: '/', logLevel: 'error',
  plugins: [react(), ...(fault ? [{ name: 'condition-label-fault', enforce: 'pre', transform(code, id) {
    if (id.replaceAll('\\', '/').endsWith('/EveningCheckin.tsx')) return code.replace('<label htmlFor="evening-weight">체중 (kg)</label>', '')
  } }] : [])], cacheDir: resolve(root, '.scratch/condition-review/cache'),
  resolve: { alias: { '@impl': resolve(root, 'impl/src') } },
  server: { host: '127.0.0.1', port: 51842, strictPort: true, hmr: false, fs: { allow: [root] } } })
await server.listen()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
try {
  for (const width of [320, 375]) {
    const context = await browser.newContext({ viewport: { width, height: 812 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
    await context.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:51842' ? route.continue() : route.abort())
    const page = await context.newPage()
    page.setDefaultTimeout(60_000)
    await page.goto('http://127.0.0.1:51842/?app=1&uitest=1', { waitUntil: 'domcontentloaded', timeout: 60_000 })
    await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '기록하기', exact: true }).click()
    await page.getByTestId('entry-choice-evening').click()
    await expect(page.getByRole('heading', { name: '무엇을 남길까요?' })).toBeVisible()
    await page.screenshot({ path: resolve(root, `.scratch/condition-review/choose-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: '체중·심박', exact: true }).click()
    await expect(page.locator('label[for="evening-weight"]')).toBeVisible()
    await expect(page.getByRole('button', { name: '이전 질문' })).toHaveCount(0)
    await page.getByLabel('체중 (kg)', { exact: true }).fill('abc')
    await page.getByRole('button', { name: '입력 확인으로', exact: true }).click()
    await expect(page.getByLabel('체중 (kg)', { exact: true })).toHaveAttribute('aria-invalid', 'true')
    await page.getByLabel('체중 (kg)', { exact: true }).fill('50')
    await page.screenshot({ path: resolve(root, `.scratch/condition-review/metrics-${width}.png`), fullPage: true })
    await page.getByRole('button', { name: '입력 확인으로', exact: true }).click()
    await expect(page.getByText('체중 50kg', { exact: true })).toBeVisible()
    await page.getByRole('button', { name: '기분 입력', exact: true }).click()
    await page.getByRole('button', { name: '기분 4 좋음', exact: true }).click()
    await page.getByRole('button', { name: '← 뒤로', exact: true }).click()
    await expect(page.getByText('기분 좋음', { exact: true })).toBeVisible()
    await page.screenshot({ path: resolve(root, `.scratch/condition-review/review-${width}.png`), fullPage: true })
    const form = page.locator('.evening-checkin')
    expect(await form.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true)
    await page.getByRole('button', { name: '나가기', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText('작성 중인 기록을 저장할까요?')
    await page.getByRole('button', { name: '계속 작성하기', exact: true }).click()
    await expect(page.getByText('체중 50kg', { exact: true })).toBeVisible()
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: '기분 수정', exact: true }).click()
      await page.getByRole('button', { name: '입력 확인으로', exact: true }).click()
    }
    await page.getByRole('button', { name: '← 뒤로', exact: true }).click()
    await expect(page.getByRole('heading', { name: '무엇을 남길까요?' })).toBeVisible()
    await page.getByRole('button', { name: '메모 쓰기', exact: true }).click()
    await page.getByRole('radio', { name: '나만의 메모', exact: true }).check()
    await page.getByRole('textbox', { name: '오늘의 메모', exact: true }).fill('합성 메모')
    await page.getByRole('button', { name: '나만의 메모 저장 준비', exact: true }).click()
    await expect(page.getByRole('button', { name: '코드가 있어요', exact: true })).toBeVisible()
    await expect(page.getByLabel('기존 복구 코드', { exact: true })).toHaveCount(0)
    await page.getByRole('button', { name: '코드가 있어요', exact: true }).click()
    await expect(page.getByLabel('기존 복구 코드', { exact: true })).toBeVisible()
    await page.screenshot({ path: resolve(root, `.scratch/condition-review/memo-${width}.png`), fullPage: true })
    await context.close()
    console.log(`PASS ${width}: choice, metrics, review, back, exit protection`)
  }
} finally { await browser.close(); await server.close() }
