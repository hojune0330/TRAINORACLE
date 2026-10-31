import { createServer } from '../../../app/node_modules/vite/dist/node/index.js'
import { chromium } from '../../../app/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const out = fileURLToPath(new URL('./evidence/', import.meta.url)); await mkdir(out, { recursive: true })
const origin = 'http://127.0.0.1:5188'
const server = await createServer({ root: fileURLToPath(new URL('../../../app', import.meta.url)), envFile: false, configLoader: 'runner', clearScreen: false,
  cacheDir: out + 'review-cache', define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_ACCOUNT_PUBLIC_ENABLED': '"false"', 'import.meta.env.VITE_KILL_ACCOUNT': '"true"' }, server: { host: '127.0.0.1', port: 5188, strictPort: true, hmr: false } })
let browser
const result = { selection: [], widths: [], errors: [], posts: [] }
try {
  await server.listen(); browser = await chromium.launch({ channel: 'chrome', headless: true })
  const context = await browser.newContext({ viewport: { width: 320, height: 812 }, reducedMotion: 'reduce', serviceWorkers: 'block' })
  await context.route('**/*', route => route.request().url().startsWith(origin + '/') ? route.continue() : route.abort())
  const page = await context.newPage(); page.on('request', r => { if (r.method() === 'POST') result.posts.push(r.url()) })
  await page.goto(origin + '/?app=1'); await page.evaluate(async () => { await document.fonts.load('14px "Pretendard Variable"'); await document.fonts.ready })
  await page.getByRole('button', { name: '더보기', exact: true }).click(); await page.getByRole('button', { name: '기기 연동 상태', exact: true }).click()
  assert.equal(await page.getByText('연결 미제공', { exact: true }).count(), 3)
  await page.screenshot({ path: out + 'connections-common-320.png' })
  await page.getByRole('button', { name: '워치 파일 가져오기', exact: true }).click()
  const input = () => page.getByLabel('가져올 운동 파일 선택', { exact: true })
  const tcx = `<TrainingCenterDatabase><Activities>${[2,3,4,5,6,7].map((km, i) => `<Activity Sport="Running"><Id>2026-10-16T0${i+1}:00:00Z</Id><Lap StartTime="2026-10-16T0${i+1}:00:00Z"><TotalTimeSeconds>${km*300}</TotalTimeSeconds><DistanceMeters>${km*1000}</DistanceMeters></Lap></Activity>`).join('')}</Activities></TrainingCenterDatabase>`
  await input().setInputFiles({ name: 'six-synthetic.tcx', mimeType: 'application/xml', buffer: Buffer.from(tcx) })
  const rows = page.getByTestId('import-draft-row'); await rows.nth(5).waitFor()
  for (const width of [320,375,430]) {
    await page.setViewportSize({ width, height: 812 })
    const before = await rows.nth(1).evaluate(n => n.offsetTop)
    await rows.first().getByRole('checkbox').uncheck()
    const after = await rows.nth(1).evaluate(n => n.offsetTop)
    assert.equal(after-before, 0); assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false)
    result.widths.push({ width, nextRowMovement: after-before, overflow: false })
    await rows.first().getByRole('checkbox').check()
  }
  await page.setViewportSize({ width: 320, height: 812 })
  result.density = await rows.evaluateAll(nodes => ({ first: nodes[0].offsetTop, last: nodes.at(-1).offsetTop + nodes.at(-1).offsetHeight, span: nodes.at(-1).offsetTop + nodes.at(-1).offsetHeight - nodes[0].offsetTop }))
  assert.ok(result.density.span<1946)
  await page.screenshot({ path: out + 'review-six-common-320.png' })
  const boxes = rows.getByRole('checkbox'); for (const checkbox of await boxes.all()) await checkbox.uncheck()
  const count = async () => boxes.evaluateAll(nodes => nodes.filter(n => n.checked).length)
  result.selection.push(await count()); assert.equal(await page.getByRole('button', { name: '저장할 활동을 골라 주세요', exact: true }).isDisabled(), true)
  for (const index of [0,1,0,1,0]) { await boxes.nth(index).focus(); await page.keyboard.press('Space'); result.selection.push(await count()) }
  assert.deepEqual(result.selection, [0,1,2,1,0,1])
  await rows.first().getByRole('combobox').selectOption('exclude'); await boxes.first().uncheck(); await boxes.first().check()
  assert.equal(await rows.first().getByRole('combobox').inputValue(), 'exclude')
  await page.getByRole('button', { name: '다른 파일 고르기', exact: true }).click()
  for (const [id, text] of [['empty','<TrainingCenterDatabase><Activities /></TrainingCenterDatabase>'],['malformed','<broken>']]) {
    await input().setInputFiles({ name: 'synthetic.tcx', mimeType: 'application/xml', buffer: Buffer.from(text) })
    const notice = page.getByTestId('import-failure'); await notice.waitFor(); result.errors.push({ id, text: await notice.innerText() })
    await notice.scrollIntoViewIfNeeded(); await page.screenshot({ path: out + `common-error-${id}-320.png` })
  }
  await page.getByRole('button', { name: '확인하던 운동 6건 이어보기', exact: true }).click()
  assert.equal(await rows.first().getByRole('combobox').inputValue(), 'exclude')
  await page.getByRole('button', { name: '다른 파일 고르기', exact: true }).click()
  const longRecords = Array.from({length:6}, (_,i) => ({ date:'2026-10-16', sport:'running', name:`긴 합성 운동 이름으로 날짜와 선택 상태를 함께 확인하는 기록 ${i+1}`, distanceKm:String(i+2), durationMin:i===0?'1256.78':String((i+2)*5) }))
  await input().setInputFiles({ name:'long-synthetic.json', mimeType:'application/json', buffer:Buffer.from(JSON.stringify(longRecords)) }); await rows.nth(5).waitFor()
  await page.locator('.import-flow').evaluate(root => { const sizes=[root,...root.querySelectorAll('*')].map(n=>[n,parseFloat(getComputedStyle(n).fontSize)]); for (const [n,size] of sizes) if(n instanceof HTMLElement) n.style.fontSize=`${size*2}px` })
  const beforeLarge=await rows.nth(1).evaluate(n=>n.offsetTop); await rows.first().getByRole('checkbox').uncheck(); const afterLarge=await rows.nth(1).evaluate(n=>n.offsetTop)
  assert.equal(afterLarge-beforeLarge,0); assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
  await rows.first().getByRole('checkbox').check(); await rows.first().getByRole('combobox').selectOption('exclude'); await rows.first().getByRole('combobox').scrollIntoViewIfNeeded()
  await page.screenshot({path:out+'review-long-200-320.png'})
  assert.equal(await rows.first().getByText('1,256.78분',{exact:true}).count(),1)
  const longNumberLines=await rows.first().getByText('1,256.78분',{exact:true}).evaluate(element=>{const range=document.createRange();range.setStart(element.firstChild,0);range.setEnd(element.firstChild,'1,256.78'.length);return [...range.getClientRects()].filter(rect=>rect.width>0).length})
  assert.equal(longNumberLines,1)
  result.large={width:320,overflow:false,nextRowMovement:afterLarge-beforeLarge,longDuration:'1,256.78분',longNumberLines,unitMayWrap:true}
  result.savedCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('to-local-journal.journal.v2')??'[]').length); assert.equal(result.savedCount,0); assert.deepEqual(result.posts,[])
  await writeFile(out+'review-results.json',JSON.stringify(result,null,2)); console.log(JSON.stringify(result))
} finally { await browser?.close(); await server.close() }
