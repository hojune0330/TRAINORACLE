import { test, expect } from '@playwright/test'

test('two isolated browsers invite, push, repeatedly respawn, rank and rematch in the same room', async ({ browser, page }, info) => {
  // Match the existing dedicated arena budget: a real 90-second server round
  // cannot fit the generic 60-second limit. All four fixture projects run it.
  test.setTimeout(135_000)
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message))
  await page.goto('./?app=1')
  await page.getByRole('button', { name: '더보기', exact: true }).click()
  await page.getByRole('button', { name: '게임 라운지', exact: true }).click()
  await page.getByRole('button', {name:'밀어내기 게임 소개',exact:true}).click()
  await page.getByRole('radio', {name:/친구와 하기/}).check()
  await page.getByRole('button', {name:'친구 초대 준비하기',exact:true}).click()
  await page.getByLabel('게임에서 쓸 이름').fill('토리')
  await page.getByRole('button', { name: '방 만들고 친구 초대' }).click()
  const link = page.getByLabel('초대 링크')
  await expect(link).toBeVisible({ timeout: 80_000 })
  const url = await link.inputValue()
  const otherContext = await browser.newContext({ viewport: { width: 390, height: 844 } })
  const other = await otherContext.newPage(); other.on('pageerror', e => errors.push(e.message))
  try {
    await other.goto(url)
    await other.getByLabel('게임에서 쓸 이름').fill('하나')
    await other.getByRole('button', { name: '초대받은 방 입장' }).click()
    await expect(other.getByLabel('초대 링크')).toBeVisible()
    await other.getByText('친구에게 반응 보내기', {exact:true}).click()
    await other.getByRole('button', { name: '반가워요!', exact: true }).click()
    await expect(page.locator('.arena-bubble').filter({hasText:'반가워요!'})).toBeVisible()
    await other.getByText('게임 바꾸기',{exact:true}).click()
    await page.getByText('게임 바꾸기',{exact:true}).click()
    await other.getByRole('button', { name: '장애물 생존 투표', exact: true }).click()
    await expect(page.locator('.arena-mode').filter({hasText:'장애물 생존'})).toContainText('1표')
    await expect(page.getByRole('heading', {name:'밀어내기',exact:true})).toBeVisible()
    await page.getByLabel('다음 종목 고르기').scrollIntoViewIfNeeded()
    await expect(page.getByRole('button',{name:'준비 완료',exact:true})).toBeInViewport()
    await expect(page.getByRole('button',{name:'함께 출발',exact:true})).toBeInViewport()
    await page.screenshot({ path: info.outputPath('party-lobby.png'), fullPage: true })
    await page.getByRole('button', { name: '준비 완료', exact: true }).click()
    await other.getByRole('button', { name: '준비 완료', exact: true }).click()
    await page.getByRole('button', { name: '함께 출발', exact: true }).click()
    await expect(page.locator('.friend-arena')).toHaveAttribute('data-phase', 'playing', { timeout: 8000 })
    await expect(other.locator('.friend-arena')).toHaveAttribute('data-phase', 'playing')
    const field = page.getByLabel('친구 파티 경기장'), otherField = other.getByLabel('친구 파티 경기장')
    const id = await field.getAttribute('data-self')
    let sawPush = false, sawRespawn = false, sawReturn = false, captured = false, sawFall = false
    let lastDash = -10
    while (await field.isVisible()) {
      const data = await field.evaluate(el => ({ time: Number(el.getAttribute('data-time')), players: JSON.parse(el.getAttribute('data-players')!) }))
      const a = data.players.find((p: { id: string }) => p.id === id), b = data.players.find((p: { id: string }) => p.id !== id)
      if (a.state === 'alive' && a.x < b.x + .045) await page.keyboard.down('ArrowRight')
      else await page.keyboard.up('ArrowRight')
      if (b.x < .29 && Math.abs(a.x - b.x) < .11 && data.time - lastDash > 2.6) { await page.keyboard.press('d'); lastDash = data.time }
      if (a.kos > 0) sawPush = true
      if (b.state === 'respawning') { sawRespawn = true; sawFall = true }
      if (sawFall && b.state === 'alive') sawReturn = true
      if (data.time > 6 && !captured) { await page.screenshot({ path: info.outputPath('phone-live-arena.png'), fullPage: true }); captured = true }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (data.time > 89.5) break
      await page.waitForTimeout(100)
    }
    await page.keyboard.up('ArrowRight')
    await expect(page.getByRole('heading', { name: '경기 종료' })).toBeVisible({ timeout: 8000 })
    await expect(other.getByRole('heading', { name: '경기 종료' })).toBeVisible()
    expect(sawPush).toBe(true); expect(sawRespawn).toBe(true); expect(sawReturn).toBe(true)
    const rankA = await page.getByLabel('최종 순위').innerText(), rankB = await other.getByLabel('최종 순위').innerText()
    expect(rankA.replaceAll(' (나)', '')).toBe(rankB.replaceAll(' (나)', ''))
    await page.screenshot({ path: info.outputPath('phone-results.png'), fullPage: true })
    await expect(page.getByLabel('이 멤버들의 최근 전적')).toContainText('최근 1판')
    await page.getByRole('button', { name: '한 판 더 · 준비' }).click(); await other.getByRole('button', { name: '한 판 더 · 준비' }).click()
    await page.getByRole('button', { name: '장애물 생존 선택' }).click()
    await expect(other.getByRole('heading', {name:'90초 장애물 생존'})).toBeVisible()
    await expect(page.getByRole('button', {name:'함께 출발',exact:true})).toBeDisabled()
    await page.getByRole('button', { name: '한 판 더 · 준비' }).click(); await other.getByRole('button', { name: '한 판 더 · 준비' }).click()
    await expect(link).toHaveValue(url)
    await page.getByRole('button', { name: '함께 출발', exact: true }).click()
    await expect(field).toBeVisible(); await expect(otherField).toBeVisible()
    await expect(field).toHaveAttribute('data-mode','survival'); await expect(otherField).toHaveAttribute('data-mode','survival')
    await page.getByRole('button', { name: '친구 경기 나가기' }).click()
    await expect(page.getByRole('dialog')).toBeVisible()
    await page.getByRole('button', { name: '경기 나가기', exact: true }).click()
    await expect(other.getByRole('heading', { name: '경기가 중단됐어요' })).toBeVisible()
    await expect(page.getByRole('heading', { name: '러닝 투어', exact: true })).toBeVisible()
    expect(errors).toEqual([])
  } finally { await otherContext.close() }
})
