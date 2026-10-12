import assert from 'node:assert/strict'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const base = 'http://127.0.0.1:4176'
const output = new URL('../.codex-calendar-visual-qa/entry-clarity-20261012/', import.meta.url)
await mkdir(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const results = []
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 812 }, serviceWorkers: 'block', reducedMotion: 'reduce' })
  await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort())
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.setDefaultTimeout(30_000)
  const open = () => page.goto(`${base}/?app=1&uitest=1`, { waitUntil: 'domcontentloaded', timeout: 60_000 })
  const nav = name => page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name, exact: true })
  const capture = async (name, width = 375, large = false) => {
    await page.setViewportSize({ width, height: 812 })
    if (large) await page.evaluate(() => {
      const sizes = [...document.querySelectorAll('h1,h2,h3,p,button,small,span,summary,label')]
        .map(element => [element, parseFloat(getComputedStyle(element).fontSize)])
      for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`
    })
    const dimensions = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
      regionFits: [...document.querySelectorAll('.app-scroll-region')].every(node => node.scrollWidth <= node.clientWidth + 1) }))
    assert.ok(dimensions.scroll <= dimensions.width && dimensions.regionFits, `${name}: horizontal overflow`)
    const smallTargets = await page.locator('button.app-choice-control').evaluateAll(elements => elements.flatMap(element => {
      const box = element.getBoundingClientRect()
      if (!element.checkVisibility() || box.width === 0) return []
      return box.height >= 44 && box.width >= 44 ? [] : [{ name: element.textContent, width: box.width, height: box.height }]
    }))
    assert.deepEqual(smallTargets, [], `${name}: new choice targets must remain 44px`)
    await page.locator('.app-scroll-region').evaluateAll(nodes => nodes.forEach(node => node.scrollTo(0, 0)))
    await page.screenshot({ path: fileURLToPath(new URL(`${name}.png`, output)), fullPage: true })
    results.push({ name, width, large, ...dimensions })
  }
  await open()
  await nav('홈').waitFor()
  await page.locator('.home-hub').waitFor()
  await page.getByRole('button', { name: '일지 꾸미기', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '일지 꾸미기', exact: true }).evaluate(el => !!el.closest('details:not([open])')), false)
  await capture('home-empty-375')
  await capture('home-empty-320', 320)
  await nav('기록하기').click()
  await page.getByRole('heading', { name: '어떤 일지를 쓰세요?' }).waitFor()
  assert.equal(await page.locator('[data-testid^="entry-choice-"]').count(), 4)
  await capture('record-320', 320)
  await page.getByRole('button', { name: '워치 기록 불러오기', exact: false }).click()
  await page.getByRole('button', { name: '파일 준비하기', exact: true }).waitFor()
  assert.equal(await page.getByRole('group', { name: '기록이 있는 곳 선택' }).count(), 0)
  await capture('import-pick-375')
  await page.getByRole('button', { name: '파일 준비하기', exact: true }).click()
  await page.getByRole('button', { name: 'Garmin · 가민', exact: true }).click()
  assert.equal(await page.getByRole('heading', { name: 'Garmin 파일 준비' }).evaluate(el => document.activeElement === el), true)
  await capture('import-garmin-320', 320)
  await page.getByRole('button', { name: '준비 안내 닫기' }).click()
  assert.equal(await page.getByRole('button', { name: '파일 준비하기' }).evaluate(el => document.activeElement === el), true)
  await open()
  await nav('훈련').click()
  await page.getByRole('heading', { name: '어떤 종목을 준비하세요?' }).waitFor()
  await capture('training-375')
  await page.getByRole('button', { name: '1500m', exact: true }).click()
  assert.equal(await page.getByLabel('분', { exact: true }).count(), 0)
  await page.getByRole('button', { name: '내 기록', exact: true }).click()
  await page.getByLabel('분', { exact: true }).fill('4')
  await page.getByLabel('초', { exact: true }).fill('23.4')
  await page.getByRole('button', { name: '기준 다시 선택' }).click()
  await page.getByRole('button', { name: '내 기록', exact: true }).click()
  assert.equal(await page.getByLabel('초', { exact: true }).inputValue(), '23.4')
  assert.equal(await page.evaluate(() => localStorage.getItem('trainoracle.plan-beta.v1')), null)
  // A fresh page avoids asking the user to discard the synthetic unsent form.
  await open()
  await nav('일지').click()
  await page.getByRole('button', { name: '월간 달력', exact: true }).waitFor()
  await capture('journal-375')
  await nav('오라클').click()
  await page.getByRole('button', { name: '훈련량', exact: true }).waitFor()
  await capture('oracle-empty-375')
  await page.getByRole('button', { name: '훈련량', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '훈련량', exact: true }).getAttribute('aria-pressed'), 'true')
  await capture('oracle-distance-320', 320)
  await nav('기록하기').click()
  await page.getByRole('heading', { name: '어떤 일지를 쓰세요?' }).waitFor()
  await page.goBack()
  await page.getByRole('button', { name: '훈련량', exact: true }).waitFor()
  assert.equal(await page.getByRole('button', { name: '훈련량', exact: true }).getAttribute('aria-pressed'), 'true')
  await page.getByRole('button', { name: '러닝 취향', exact: true }).click()
  await page.getByRole('button', { name: '내 훈련 방식 알아보기 · 질문 3개' }).waitFor()
  await capture('profile-first-375')
  await page.getByRole('button', { name: '읽을거리', exact: true }).click()
  assert.equal(await page.getByRole('button', { name: '내 훈련 방식 알아보기 · 질문 3개' }).count(), 0)
  await capture('profile-library-375')
  await open()
  await nav('오라클').click()
  await page.getByRole('button', { name: '훈련량', exact: true }).waitFor()
  await capture('oracle-large-text-320', 320, true)
  await open()
  await page.locator('.home-hub').waitFor()
  await capture('home-desktop-1280', 1280)
  // Synthetic local-only data: the user's sparse day-wrap + saved-plan case.
  await page.evaluate(async () => {
    const { stateFixture } = await import('/src/domain/plan-beta-store.test-fixture.ts')
    const { savePlanBetaState } = await import('/src/domain/plan-beta-store.ts')
    const state = stateFixture()
    state.intake.startDate = '2026-10-01'
    state.progress = [{ sessionDay: 1, sessionSlot: 'AM', state: 'COMPLETED' }]
    if (!savePlanBetaState(state).ok) throw new Error('Synthetic plan setup failed')
    localStorage.setItem('trainoracle.journal.v1', JSON.stringify([{
      id: 'synthetic-entry-clarity-evening', kind: 'evening', date: '2026-10-11',
      savedAt: '2026-10-11T12:00:00Z', syncState: 'local', sleepH: 0, sleepQuality: 0,
      weightKg: '', restingHr: '', painParts: {}, mood: 0,
      note: 'SYNTHETIC_PRIVATE_MEMO_MUST_NOT_APPEAR', memoPurpose: 'PRIVATE_SELF_ONLY',
    }]))
  })
  await open()
  await page.getByRole('button', { name: '계획 자세히 보기' }).waitFor()
  assert.equal(await page.getByText('운동 일지와 별도', { exact: true }).isVisible(), true)
  assert.equal(await page.getByText('이 기기만', { exact: true }).isVisible(), true)
  assert.equal(await page.getByText('이번 주 직접 입력 기록이 없어요', { exact: true }).count(), 0)
  assert.equal(await page.getByText('SYNTHETIC_PRIVATE_MEMO_MUST_NOT_APPEAR', { exact: true }).count(), 0)
  await capture('home-saved-plan-day-wrap-375')
  await capture('home-saved-plan-day-wrap-320', 320)
  assert.deepEqual(errors, [], 'No page errors in tested paths')
  await writeFile(new URL('result.json', output), JSON.stringify({ status: 'PASS', results, pageErrors: errors }, null, 2))
  console.log(JSON.stringify({ status: 'PASS', screenshots: results.length, pageErrors: errors.length }))
  await context.close()
} finally {
  await browser.close()
}
