import { test, expect, type Page } from '@playwright/test'
import type { SoloDefense } from '../src/domain/minigame/solo-defense'
import { newSoloDefense } from '../src/domain/minigame/solo-defense'
import { advanceSoloPush, newSoloPush, pushSeriesPoints, startSoloPush, type SoloPush } from '../src/domain/minigame/solo-push'
import { SOLO_CHECKPOINT_KEY, SOLO_RECORDS_KEY, saveSoloCheckpoint } from '../src/domain/minigame/solo-party-storage'

async function seedLegacyDefense(page: Page) {
  let value = ''
  saveSoloCheckpoint({getItem:()=>value,setItem:(_key,raw)=>{value=raw},removeItem:()=>{}},newSoloDefense(),'legacy-compatibility')
  await page.addInitScript(({key,raw})=>{if(!sessionStorage.getItem('legacy-seeded')){localStorage.setItem(key,raw);sessionStorage.setItem('legacy-seeded','1')}},{key:SOLO_CHECKPOINT_KEY,raw:value})
}

test('solo survival finishes two rounds and saves jump achievements separately', async ({page}) => {
  await openParty(page)
  await page.getByRole('button', {name:'장애물 생존 게임 소개',exact:true}).click()
  await expect(page.getByText(/이 종목에서는 서로 밀리지 않아요/)).toBeVisible()
  await freezeFullSeries(page)
  for (const round of [1,2]) {
    await page.getByRole('button', {name:round===1?'컴퓨터와 시작하기':'2라운드 시작',exact:true}).click()
    await page.clock.runFor(6000)
    expect((await state(page) as SoloPush).game.mode).toBe('survival')
    await expectPushProgress(page, 'survival', round as 1 | 2, 6000)
    await page.clock.runFor(88000)
  }
  await expect(page.getByRole('heading',{name:'두 라운드 완주!'})).toBeVisible()
  await expect(page.getByText('완주 기록을 이 기기에 저장했어요.')).toBeVisible()
  const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('trainoracle.solo-party.survival-records.v1')!))
  expect(records).toHaveLength(1); expect(records[0].mode).toBe('survival')
  expect(records[0]).toMatchObject(await expectSeriesScore(page, 'survival'))
  expect(await page.evaluate(key=>localStorage.getItem(key),SOLO_RECORDS_KEY)).toBeNull()
  await page.getByRole('button',{name:'같은 종목 새로 시작'}).click()
  await expect(page.getByRole('heading',{name:'연속 장애물을 넘고, 낙하를 줄이세요'})).toBeVisible()
})

async function openParty(page: Page, legacy = false) {
  await page.goto('./?app=1')
  await page.getByRole('button', { name: '더보기', exact: true }).click()
  await page.getByRole('button', { name: '게임 라운지', exact: true }).click()
  if (legacy) { await page.getByText('이전 버전 저장', {exact:true}).click(); await page.getByRole('button', {name:'이전 러닝 디펜스 열기',exact:true}).click() }
}
async function freeze(page: Page) {
  await page.clock.install()
  await page.clock.pauseAt(await page.evaluate(() => Date.now()) + 100)
}
async function freezeFullSeries(page: Page) {
  await freeze(page)
  // runFor yields to a real timer after every RAF. A 100ms render cadence keeps
  // both full 90s rounds and SoloParty's accumulated 1/60s physics steps, without
  // paying for ~12,000 canvas renders/timer yields. Do not fastForward whole rounds:
  // SoloParty caps each frame's elapsed time at 100ms, so that would skip simulation.
  // Short input/visual tests below retain the default RAF cadence.
  await page.evaluate(() => {
    window.requestAnimationFrame = callback => window.setTimeout(() => callback(performance.now()), 100)
    window.cancelAnimationFrame = handle => window.clearTimeout(handle)
  })
}
const field = (page: Page) => page.locator('.solo-party canvas')
const state = async (page: Page) => JSON.parse((await field(page).getAttribute('data-state'))!) as SoloDefense | SoloPush

async function expectPushProgress(page: Page, mode: SoloPush['mode'], round: 1 | 2, elapsedMs: number) {
  // A reference uses every fixed physics step, never the test's render cadence.
  // It supplies expectations only; the browser still runs the real UI/engine.
  const expected = newSoloPush(mode)
  if (round === 2) expected.phase = 'between'
  startSoloPush(expected)
  for (let n = 0; n < elapsedMs * 60 / 1000; n++) advanceSoloPush(expected, 1 / 60, false)
  const actual = await state(page) as SoloPush
  expect(actual.round).toBe(round)
  expect(actual.game.duration).toBe(90)
  expect(actual.game).toEqual(expected.game)
}

async function expectSeriesScore(page: Page, mode: SoloPush['mode']) {
  const expected = newSoloPush(mode)
  for (let round = 1; round <= 2; round++) {
    startSoloPush(expected)
    for (let n = 0; n < 94 * 60; n++) advanceSoloPush(expected, 1 / 60, false)
  }
  expect(expected.phase).toBe('finished')
  expect(expected.results).toHaveLength(2)
  for (const [i, round] of expected.results.entries()) {
    const me = round.find(p => p.id === 'you')!
    await expect(page.getByText(`${i + 1}라운드 · ${me.rank}위 · ${mode === 'survival' ? `점프 회피 ${me.dodges}` : `밀어냄 ${me.kos}`} · 낙하 ${me.falls}`, {exact: true})).toBeVisible()
  }
  const wins = pushSeriesPoints(expected.results, 'you')
  await expect(page.getByText(`시리즈 승점 ${wins} : ${pushSeriesPoints(expected.results, 'bot')}`, {exact: true})).toBeVisible()
  const self = expected.results.flat().filter(p => p.id === 'you')
  return {mode, success: self.reduce((sum, p) => sum + (mode === 'survival' ? p.dodges : p.kos), 0), falls: self.reduce((sum, p) => sum + p.falls, 0), wins}
}

test('legacy saved defense builds, handles continuous touch and pause, resumes a saved wave and records a full series', async ({ page }, info) => {
  const errors: string[] = [], sockets: string[] = []
  page.on('pageerror', e => errors.push(e.message)); page.on('websocket', s => sockets.push(s.url()))
  await seedLegacyDefense(page)
  await openParty(page, true)
  await page.getByRole('button', { name: '이전 러닝 디펜스 1웨이브 이어하기' }).click()
  await page.getByRole('button', { name: /^공 발사기 설치/ }).click()
  await expect(page.getByText('남은 예산 3개 · 변경 미확정')).toBeVisible()
  await page.getByRole('button', { name: '이번 변경 취소' }).click()
  await expect(page.getByText('남은 예산 6개', { exact: true })).toBeVisible()
  await page.getByRole('button', { name: /^공 발사기 설치/ }).click()
  await page.getByRole('button', { name: /^2번 칸/ }).click()
  await page.getByRole('button', { name: /^바람 장치 설치/ }).click()
  await page.screenshot({ path: info.outputPath('defense-build-phone.png'), fullPage: true })
  await freeze(page)
  await page.getByRole('button', { name: '배치 확정하고 1웨이브 시작' }).click()
  await page.clock.runFor(3400)
  const bounds = (await field(page).boundingBox())!, x = bounds.x + bounds.width * .6, y = bounds.y + bounds.height * .55
  const touch = await page.context().newCDPSession(page)
  const move = (py: number) => touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y: py, id: 1 }] })
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] })
  await move(y - 70); await page.clock.runFor(180)
  expect((await state(page) as SoloDefense).runner.y).toBeGreaterThan(0)
  await move(y); await page.clock.runFor(900); await move(y - 70); await page.clock.runFor(180)
  expect((await state(page) as SoloDefense).runner.y).toBeGreaterThan(0)
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  await page.getByRole('button', { name: '혼자 경기 일시정지' }).click()
  const before = (await state(page) as SoloDefense).time
  await page.clock.runFor(3000)
  expect((await state(page) as SoloDefense).time).toBe(before)
  await page.getByRole('button', { name: '돌아가기', exact: true }).click()
  await page.clock.runFor(17000)
  expect((await state(page) as SoloDefense).runner.falls).toBeGreaterThan(0)
  await page.screenshot({ path: info.outputPath('defense-play-phone.png') })
  await page.clock.runFor(44000)
  await expect(page.getByRole('heading', { name: '2웨이브 준비' })).toBeVisible()
  const recap = page.getByLabel('웨이브별 결과')
  await recap.getByText('웨이브별 결과 살펴보기', { exact: true }).click()
  await expect(recap).toContainText('1웨이브 · 막은 적')
  await recap.getByText('이때 사용한 시설', { exact: true }).click()
  await expect(recap).toContainText('1번 공 발사기 1단계')
  await expect(recap).toContainText('2번 바람 장치 1단계')
  await page.getByRole('button', { name: '확정·저장하고 종목 선택으로' }).click()
  const checkpoint = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SOLO_CHECKPOINT_KEY)
  expect(checkpoint.wave).toBe(2); expect(checkpoint.facilities[1].kind).toBe('fan')
  await page.reload(); await openParty(page, true)
  await page.getByRole('button', { name: '이전 러닝 디펜스 2웨이브 이어하기' }).click()
  await expect(page.getByText(`남은 예산 ${checkpoint.budget}개`, { exact: true })).toBeVisible()
  await expect(page.getByLabel('웨이브별 결과')).toContainText('이어하기 전 웨이브는 합계만 남아 있어요')
  for (const wave of [2, 3]) {
    await page.getByRole('button', { name: `배치 확정하고 ${wave}웨이브 시작` }).click()
    await page.clock.runFor(63500)
  }
  await expect(page.getByRole('heading', { name: '세 웨이브 완주!' })).toBeVisible()
  await expect(page.getByText('완주 기록을 이 기기에 저장했어요.')).toBeVisible()
  await expect(page.getByLabel('웨이브별 결과')).toContainText('2웨이브 · 막은 적')
  await expect(page.getByLabel('웨이브별 결과')).toContainText('3웨이브 · 막은 적')
  await expect(page.getByLabel('웨이브별 결과')).not.toContainText('1웨이브 · 막은 적')
  await expect(page.locator('.solo-party__comparison')).toContainText('첫 완주 기록')
  const results = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SOLO_RECORDS_KEY)
  expect(results).toHaveLength(1); expect(results[0].success + results[0].missed).toBe(48)
  expect(await page.evaluate(key => localStorage.getItem(key), SOLO_CHECKPOINT_KEY)).toBeNull()
  await page.screenshot({ path: info.outputPath('defense-result-phone.png'), fullPage: true })
  await page.getByRole('button', { name: '다른 종목 고르기' }).click()
  await expect(page.getByRole('button', { name: /^타워 디펜스/ })).toBeVisible()
  await page.getByText('최근 도전 기록 1판', { exact: true }).click()
  await expect(page.locator('.solo-party__history')).toContainText(`막은 적 ${results[0].success}/48`)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  expect(errors).toEqual([]); expect(sockets.filter(url => !url.includes('vite') && !url.includes('127.0.0.1'))).toEqual([])
})

test('solo push completes two rounds, ranks real actions, starts fresh and leaves without a false result', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await openParty(page)
  await page.getByRole('button', { name: '밀어내기 게임 소개',exact:true }).click()
  await freezeFullSeries(page)
  await page.getByRole('button', { name: '컴퓨터와 시작하기' }).click()
  await page.clock.runFor(19000)
  expect((await state(page) as SoloPush).game.players[0]!.falls).toBeGreaterThan(1)
  await expectPushProgress(page, 'push', 1, 19000)
  await page.clock.runFor(74500)
  await expect(page.getByRole('heading', { name: '1라운드 완료 · 다음은 커브' })).toBeVisible()
  await page.getByRole('button', { name: '2라운드 시작' }).click()
  await page.clock.runFor(6000)
  await expectPushProgress(page, 'push', 2, 6000)
  await page.screenshot({ path: info.outputPath('push-curve-phone.png') })
  await page.clock.runFor(87500)
  await expect(page.getByRole('heading', { name: '두 라운드 완주!' })).toBeVisible()
  await expect(page.getByText('완주 기록을 이 기기에 저장했어요.')).toBeVisible()
  const expectedRecord = await expectSeriesScore(page, 'push')
  await page.getByRole('button', { name: '같은 종목 새로 시작' }).click()
  await page.getByRole('button', { name: '1라운드 시작' }).click()
  await page.clock.runFor(3500)
  expect((await state(page) as SoloPush).game.players[0]!.falls).toBe(0)
  await page.getByRole('button', { name: '게임 소개로', exact: true }).click()
  await page.getByRole('button', { name: '이번 경기 나가기' }).click()
  const records = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!), SOLO_RECORDS_KEY)
  expect(records).toHaveLength(1)
  expect(records[0]).toMatchObject(expectedRecord)
  expect(errors).toEqual([])
})

test('small screens and missing art retain playable controls and readable navigation', async ({ page }, info) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  if (info.project.name === 'desktop') {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.route('**/game/**', route => route.request().resourceType() === 'image' ? route.abort() : route.continue())
  } else await page.setViewportSize({ width: 320, height: 800 })
  await seedLegacyDefense(page)
  await openParty(page, true)
  await page.screenshot({ path: info.outputPath('solo-selection.png'), fullPage: true })
  await page.getByRole('button', { name: '이전 러닝 디펜스 1웨이브 이어하기' }).click()
  await page.getByRole('button', { name: /^공 발사기 설치/ }).click()
  await page.getByRole('button', { name: /^2번 칸/ }).click()
  await page.getByRole('button', { name: /^바람 장치 설치/ }).click()
  await freeze(page)
  await page.getByRole('button', { name: '배치 확정하고 1웨이브 시작' }).click()
  await page.clock.runFor(3400)
  await page.keyboard.down('ArrowRight'); await page.clock.runFor(3000); await page.keyboard.up('ArrowRight')
  await page.clock.runFor(2500)
  await page.keyboard.press('Space'); await page.clock.runFor(150)
  expect((await state(page) as SoloDefense).runner.y).toBeGreaterThan(0)
  await page.screenshot({ path: info.outputPath('solo-defense-live.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: '종목 선택으로', exact: true }).click()
  await expect(page.getByRole('dialog', { name: '잠깐 쉬는 중' })).toBeVisible()
  await page.getByRole('button', { name: '저장 없이 종목 선택으로' }).click()
  await page.getByRole('button', { name: '친구와 할 게임 보기', exact: true }).click()
  await expect(page.getByRole('button', {name:'친구와',exact:true})).toHaveAttribute('aria-pressed','true')
  await page.getByRole('button', {name:'밀어내기 게임 소개',exact:true}).click()
  await page.getByRole('button', {name:'친구 초대 준비하기',exact:true}).click()
  await expect(page.getByRole('heading', { name: '밀어내기', exact:true })).toBeVisible()
  await page.getByRole('button', { name: '친구 경기 나가기' }).click()
  await page.getByRole('button', {name:'게임 목록으로',exact:true}).click()
  await expect(page.getByRole('heading', { name: '게임 라운지' })).toBeVisible()
  expect(errors).toEqual([])
})
