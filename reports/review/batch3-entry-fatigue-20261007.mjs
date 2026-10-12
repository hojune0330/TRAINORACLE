import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'app/package.json'))
const { chromium, expect } = require('@playwright/test')
const { createServer } = await import(pathToFileURL(path.join(root, 'app/node_modules/vite/dist/node/index.js')).href)
const output = path.join(root, 'reports/review/evidence/batch3-entry-fatigue-20261007')
await fs.mkdir(output, { recursive: true })
const server = await createServer({ root: path.join(root, 'app'), server: { host: '127.0.0.1', port: 4474, strictPort: true, fs: { allow: [root] } } })
await server.listen()
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const results = []
try {
  for (const viewport of [{ width: 375, height: 667 }, { width: 1280, height: 900 }]) {
    const context = await browser.newContext({ viewport, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
    const page = await context.newPage()
    const errors = []
    page.on('pageerror', error => errors.push(error.message))
    await page.route('**/*', route => new URL(route.request().url()).origin === 'http://127.0.0.1:4474' ? route.continue() : route.abort())
    page.setDefaultTimeout(30_000)
    const button = name => page.getByRole('button', { name, exact: true })
    const tab = name => page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name, exact: true })
    const capture = async name => {
      await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled([...document.images].map(image => image.decode())) })
      const dimensions = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
        brokenImages: [...document.images].filter(image => image.getClientRects().length && (!image.complete || image.naturalWidth === 0)).map(image => image.getAttribute('src')) }))
      assert.ok(dimensions.scrollWidth <= dimensions.width, `${name}: horizontal overflow`)
      assert.deepEqual(dimensions.brokenImages, [], `${name}: broken image`)
      await page.screenshot({ path: path.join(output, `${viewport.width}-${name}.png`) })
      results.push({ viewport, name, ...dimensions })
    }
    try {
      await page.goto('http://127.0.0.1:4474/?app=1&uitest=1', { waitUntil: 'domcontentloaded' })
      await tab('홈').click()
      await expect(button('오늘 기록 남기기')).toBeVisible()
      await expect(button('훈련 계획 만들기')).toBeVisible()
      await expect(button('일지 꾸미기')).toBeHidden()
      await capture('home')
      await tab('오라클').click()
      await expect(button('첫 기록 남기기')).toBeVisible()
      await expect(page.getByRole('region', { name: '몸 상태와 회복 기록' })).toHaveCount(0)
      await capture('oracle')
      await button('이 예시 자세히 보기').click()
      await expect(page.getByText('내 기록을 분석한 결과가 아니에요')).toBeVisible()
      await capture('example')
      await button('이전 화면으로 돌아가기').click()
      await button('러닝 취향').click()
      await expect(button('내 훈련 방식 알아보기 · 질문 3개')).toBeVisible()
      await expect(button('러닝 취향 보기')).toHaveCount(0)
      await expect(page.getByRole('complementary')).toHaveCount(0)
      await capture('profile')
      await button('마리·친구·프로필 설정').click()
      await expect(page.getByRole('dialog', { name: '프로필 설정' })).toBeVisible()
      await capture('profile-settings')
      await button('내 훈련 해설').click()
      await expect(page.getByRole('dialog', { name: '훈련 목적이 쌓이는 모습' })).toBeVisible()
      await expect(page.getByRole('dialog', { name: '프로필 설정' })).toHaveCount(0)
      await button('닫기').click()
      await expect(page.getByRole('dialog')).toHaveCount(0)
      await expect(button('마리·친구·프로필 설정')).toBeFocused()
      await button('오라클로 돌아가기').click()
      await expect(button('내 훈련')).toHaveAttribute('aria-pressed', 'true')
      await button('읽을거리·관심').click()
      await expect(page.getByRole('article', { name: '먼저 읽을 글' })).toBeVisible()
      await expect(page.getByRole('heading', { name: '운동과 회복의 순서' })).toBeVisible()
      await expect(page.getByRole('group', { name: '읽을거리 주제' })).toBeHidden()
      await capture('library')
      await page.getByText('전체 주제·다른 글', { exact: true }).click()
      await button('배우기').click()
      await button('한 문제로 배우기').click()
      await expect(page.getByRole('dialog', { name: '한 문제로 배우기' })).toBeVisible()
      await button('닫기').click()
      await expect(page.getByRole('article', { name: '먼저 읽을 글' }).getByRole('heading', { name: '한 문제로 배우기' })).toBeVisible()
      await capture('library-resumed')
      assert.deepEqual(errors, [], 'browser runtime errors')
    } finally { await context.close() }
  }
  await fs.writeFile(path.join(output, 'browser-results.json'), JSON.stringify({ scope: 'isolated local guest browser, no external requests', results }, null, 2))
  console.log(JSON.stringify({ passed: true, states: results.length, viewports: [375, 1280], output }))
} finally {
  await browser.close()
  await server.close()
}
