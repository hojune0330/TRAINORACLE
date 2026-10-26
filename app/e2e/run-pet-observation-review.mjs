import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

// Focused local synthetic journey. No production accounts, records or clock changes.
const root = fileURLToPath(new URL('../../', import.meta.url))
const output = path.join(root, 'reports/qa/pet-observation-20261026')
const base = process.env.PET_PREVIEW_URL || 'http://127.0.0.1:4232'
fs.mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []
const results = []
try {
  const page = await browser.newPage({ viewport: { width: 375, height: 812 }, timezoneId: 'Asia/Seoul' })
  page.on('pageerror', error => errors.push(String(error)))
  const open = () => page.goto(base + '/e2e/pet-observation-preview.html', { waitUntil: 'domcontentloaded' })
  const click = name => page.getByRole('button', { name, exact: true }).click()
  const decode = () => page.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  const saved = () => page.evaluate(() => {
    const key = Object.keys(localStorage).find(key => {
      try { const value = JSON.parse(localStorage.getItem(key)); return value?.version === 2 && value?.observation && value?.pets } catch { return false }
    })
    return key ? JSON.parse(localStorage.getItem(key)) : null
  })
  await open()
  await click('아침 예시 열기')
  await page.getByRole('heading', { name: '어젯밤에 뭐 했니?' }).waitFor()
  await decode()
  await page.screenshot({ path: path.join(output, 'morning-375.png') })
  const nightBefore = (await saved()).observation.nights
  await click('침대 옆, 동글 모습 보기')
  await click('이 모습 사진첩에 담기')
  assert.equal((await saved()).observation.photos.length, 1)
  await open()
  await click('저장한 방 다시 열기')
  assert.deepEqual((await saved()).observation.nights, nightBefore)
  await click('사진첩 열기')
  const album = page.locator('.pet-activity').last()
  await album.getByText('공을 안고 쿨쿨', { exact: true }).waitFor()
  await decode()
  await page.screenshot({ path: path.join(output, 'album-375.png') })
  await album.getByRole('button', { name: '방으로 돌아가기', exact: true }).click()
  await click('나도 일어났어')
  await click('어떻게 잤는지 적기')
  await page.getByLabel('수면 시간', { exact: true }).fill('5')
  await page.getByText('나쁨', { exact: true }).click()
  await click('입력 확인으로')
  await click('저장')
  const greeting = page.getByRole('region', { name: '내 수면 기록과 아침 인사' })
  await greeting.getByText('잠을 잘 못 잤구나. 피곤하겠다. 내 옆에서 잠깐 쉴래?', { exact: true }).waitFor()
  await greeting.scrollIntoViewIfNeeded()
  await page.screenshot({ path: path.join(output, 'greeting-375.png') })
  assert.equal((await saved()).observation.photos.length, 1)
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  results.push('375px: morning scene, explicit photo, reload persistence, album, exact-date journal save, explicit poor-quality greeting')
  await page.close()

  const narrow = await browser.newPage({ viewport: { width: 320, height: 720 }, timezoneId: 'Asia/Seoul', reducedMotion: 'reduce' })
  narrow.on('pageerror', error => errors.push(String(error)))
  await narrow.goto(base + '/e2e/pet-observation-preview.html', { waitUntil: 'domcontentloaded' })
  await narrow.getByRole('button', { name: '잠자리 준비 예시 열기', exact: true }).click()
  await narrow.getByRole('button', { name: /^같이 자기/ }).click()
  const setup = narrow.locator('.pet-activity').last()
  await setup.getByRole('heading', { name: '오늘은 뭘 놓아 둘까?' }).waitFor()
  await narrow.evaluate(() => Promise.all([...document.images].map(img => img.decode().catch(() => {}))))
  await narrow.screenshot({ path: path.join(output, 'setup-320.png') })
  assert.equal(await narrow.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
  assert.equal(await setup.evaluate(el => el.scrollWidth > el.clientWidth), false)
  await setup.getByRole('button', { name: '이대로 잠자리 준비', exact: true }).click()
  await narrow.getByRole('button', { name: '졸려요, 바로 재우기', exact: true }).click()
  await narrow.getByRole('region', { name: '친구들이 함께 자는 방' }).waitFor()
  await narrow.screenshot({ path: path.join(output, 'sleeping-320.png') })
  results.push('320px with reduced motion: preparation layout, scrollable controls, explicit sleep commit, no horizontal overflow')
  await narrow.close()
  assert.deepEqual(errors, [])
  fs.writeFileSync(path.join(output, 'browser-result.json'), JSON.stringify({ checkedAt: new Date().toISOString(), fixture: 'local synthetic guest only', results, errors }, null, 2) + '\n')
  console.log(JSON.stringify({ results, errors, output }, null, 2))
} finally {
  await browser.close()
}
