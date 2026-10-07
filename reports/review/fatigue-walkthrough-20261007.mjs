import { createRequire } from 'node:module'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const require = createRequire(path.join(root, 'app/package.json'))
const { chromium } = require('playwright')
const output = path.join(root, 'reports/review/evidence/fatigue-walkthrough-20261007')
await fs.mkdir(output, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const timeout = setTimeout(() => browser.close(), 180_000)
const records = []
const mode = process.argv[2] ?? 'entry'
const context = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, timezoneId: 'Asia/Seoul' })
const page = await context.newPage()
page.setDefaultTimeout(60_000)
const errors = []
page.on('pageerror', error => errors.push(error.message))
await page.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort())
const button = name => page.getByRole('button', { name, exact: typeof name === 'string' })
const tab = name => page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name, exact: true })
async function capture(name) {
  await page.waitForFunction(() => !document.body.innerText.includes('화면을 준비하고 있어요.'), undefined, {timeout:60_000})
  console.log(`Capturing ${name}`)
  await page.evaluate(async () => {
    const bounded = promise => Promise.race([promise, new Promise(resolve => setTimeout(resolve, 1500))])
    await bounded(document.fonts.ready)
    await bounded(Promise.allSettled(Array.from(document.images, image => image.decode())))
    await bounded(Promise.allSettled(document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).map(animation => animation.finished)))
  })
  const data = await page.evaluate(() => {
    const root = Array.from(document.querySelectorAll('dialog[open],[role="dialog"]')).find(element => element.getClientRects().length > 0) ?? document.querySelector('.app-scroll-region') ?? document.body
    const rendered = element => element.getClientRects().length > 0 && getComputedStyle(element).visibility !== 'hidden'
      && !Array.from(document.querySelectorAll('details:not([open])')).some(detail => detail.contains(element) && !detail.querySelector(':scope > summary')?.contains(element))
    const controls = Array.from(root.querySelectorAll('button,summary,input,select,textarea,a')).filter(rendered).map(element => {
      const rect = element.getBoundingClientRect()
      return { label: element.getAttribute('aria-label') || element.innerText || element.getAttribute('placeholder') || element.getAttribute('type'), tag: element.tagName, inViewport: rect.top >= 0 && rect.bottom <= innerHeight - 54, calendarDate: element.hasAttribute('data-date') }
    })
    return { text: root.innerText, controls, scrollHeight: root.scrollHeight, viewportHeight: root.clientHeight, scrollTop: root.scrollTop, disclosureCount: controls.filter(control => control.tag === 'SUMMARY').length }
  })
  await page.screenshot({ path: path.join(output, `${mode}-${name}.png`) })
  records.push({name, ...data})
  console.log(JSON.stringify({name, text:data.text, actions:data.controls.filter(item=>!item.calendarDate).map(item=>item.label), height:data.scrollHeight, viewport:data.viewportHeight}))
  await fs.writeFile(path.join(output, `${mode}.json`), JSON.stringify({ mode, evidence:'isolated local browser, synthetic or empty data, not human observation', errors, records }, null, 2))
}
async function click(name, screenshot) {
  await button(name).click()
  await page.waitForTimeout(250)
  if (screenshot) await capture(screenshot)
}
try {
  await page.goto('http://127.0.0.1:4467/?app=1&uitest=1', {waitUntil:'domcontentloaded', timeout:60_000})
  await tab('홈').waitFor({ timeout: 60_000 })
  await tab('홈').click()
  if (mode === 'entry') {
    await capture('home-empty')
    await tab('오라클').click(); await capture('oracle-empty')
    await click('러닝 취향', 'oracle-profile-gateway')
    await click('러닝 취향 보기', 'profile-entry')
    await click(/뒤로|돌아가기/)
    await tab('오라클').click()
    await click('읽을거리·관심', 'oracle-library-gateway')
    await tab('일지').click(); await capture('journal-empty')
    await tab('홈').click()
    await click('오늘 기록 남기기', 'record-outcome')
    await click(/뒤로/)
    await tab('홈').click()
    await click('더보기', 'more')
    await click('경기 기록 추가·수정', 'records-entry')
  } else if (mode === 'plan') {
    await tab('훈련').click(); await capture('event')
    await click('800m', 'record-choice')
    await click('기록 없이', 'experience')
    await click(/훈련 계획에 맞춰 달려 본 경험/, 'days')
    await click(/^3일/, 'body-check')
    await click(/통증은 없고 몸 상태는 평소와 같아요/, 'candidate')
    await click('이 일정으로 시작', 'active')
    const dates = page.locator('button[data-date]')
    const today = await dates.evaluateAll(elements => elements.find(element => element.getAttribute('aria-current') === 'date')?.getAttribute('data-date'))
    if (today) await page.locator(`button[data-date="${today}"]`).click()
    else await page.locator('button[data-date]').filter({hasText:'오전'}).first().click()
    await capture('day-detail')
    await click('이 훈련 일지 쓰기', 'planned-log-outcome')
    await click('계획대로 마쳤어요', 'planned-log-slot')
    await click('오전', 'planned-log-effort')
    await click(/^힘든 정도 6\/10/, 'planned-log-body')
    await click('없어요', 'planned-log-review')
    await click('이대로 저장', 'planned-log-saved')
    await click('완료', 'return-after-log')
    await click('달력으로 돌아가기')
    await tab('오라클').click(); await capture('oracle-after-one-log')
  } else if (mode === 'tools') {
    await click('더보기')
    await click('페이스 계산', 'pace-menu')
    await click('페이스 도구 닫기')
    await click('워치 파일 가져오기', 'import-entry')
    await click('뒤로')
    await click('최고기록으로 풀이하기', 'reading-entry')
  } else if (mode === 'oracle') {
    await tab('오라클').click()
    await click('러닝 취향')
    await click('러닝 취향 보기')
    await click('내 훈련 방식 알아보기 · 질문 3개', 'question-first')
    await click('닫기')
    await click('읽을거리', 'library')
  }
} catch (error) {
  await capture('stopped').catch(() => {})
  console.error(error.message)
  process.exitCode = 1
} finally {
  clearTimeout(timeout)
  await context.close()
  await browser.close()
}
