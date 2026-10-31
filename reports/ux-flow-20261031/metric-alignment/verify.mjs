import { createServer } from '../../../app/node_modules/vite/dist/node/index.js'
import { chromium } from '../../../app/node_modules/playwright-core/index.mjs'
import { mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'
const out = fileURLToPath(new URL('./evidence/', import.meta.url)); await mkdir(out, { recursive: true })
const origin = 'http://127.0.0.1:5189'
const server = await createServer({ root: fileURLToPath(new URL('../../../app', import.meta.url)), envFile: false, configLoader: 'runner', clearScreen: false,
  cacheDir: out + 'vite-cache', define: { 'import.meta.env.DEV': 'false', 'import.meta.env.VITE_ACCOUNT_PUBLIC_ENABLED': '"false"', 'import.meta.env.VITE_KILL_ACCOUNT': '"true"' },
  server: { host: '127.0.0.1', port: 5189, strictPort: true, hmr: false } })
let browser
const result = { conditions: [], posts: [], pageErrors: [] }
const tcx = long => `<TrainingCenterDatabase><Activities>${[2,3,4,5,6,7].map((km,i)=>`<Activity Sport="Running"><Id>2026-10-16T0${i+1}:00:00Z</Id><Lap StartTime="2026-10-16T0${i+1}:00:00Z"><TotalTimeSeconds>${long&&i===0?75406.8:km*300}</TotalTimeSeconds><DistanceMeters>${km*1000}</DistanceMeters></Lap></Activity>`).join('')}</Activities></TrainingCenterDatabase>`
try {
  await server.listen(); browser = await chromium.launch({ channel:'chrome',headless:true })
  const context = await browser.newContext({ viewport:{width:320,height:812}, timezoneId:'Asia/Seoul', reducedMotion:'reduce',serviceWorkers:'block' })
  await context.route('**/*',route=>route.request().url().startsWith(origin+'/')?route.continue():route.abort())
  const page = await context.newPage(); page.on('pageerror',error=>result.pageErrors.push(error.message)); page.on('request',request=>{if(request.method()==='POST')result.posts.push(request.url())})
  await page.goto(origin+'/?app=1'); await page.evaluate(async()=>{await document.fonts.load('14px "Pretendard Variable"');await document.fonts.ready})
  await page.getByRole('button',{name:'더보기',exact:true}).click();await page.getByRole('button',{name:'기기 연동 상태',exact:true}).click();await page.getByRole('button',{name:'워치 파일 가져오기',exact:true}).click()
  const upload=async long=>{await page.getByLabel('가져올 운동 파일 선택',{exact:true}).setInputFiles({name:'six-synthetic.tcx',mimeType:'application/xml',buffer:Buffer.from(tcx(long))});await page.getByTestId('import-draft-row').nth(5).waitFor()}
  await upload(false)
  result.subgridSupported = await page.evaluate(()=>CSS.supports('grid-template-rows','subgrid'));assert.equal(result.subgridSupported,true)
  const rows = page.getByTestId('import-draft-row')
  for(const condition of [{width:320,font:100},{width:375,font:100},{width:430,font:100},{width:320,font:200}]) {
    await page.setViewportSize({width:condition.width,height:812})
    if(condition.font===200) {
      await page.getByRole('button',{name:'다른 파일 고르기',exact:true}).click();await upload(true)
      await page.locator('.import-flow').evaluate(root=>{const sizes=[root,...root.querySelectorAll('*')].map(element=>[element,parseFloat(getComputedStyle(element).fontSize)]);for(const[element,size]of sizes)if(element instanceof HTMLElement)element.style.fontSize=`${size*2}px`})
    }
    assert.equal(await rows.count(),6)
    const observations = await rows.evaluateAll(elements=>elements.map(row=>{
      const metrics=[...row.querySelectorAll('.metric-summary__item')].map(item=>{const value=item.querySelector('.metric-summary__value'),label=item.querySelector('.metric-summary__label'),detail=item.querySelector('.metric-summary__detail');const r=value.getBoundingClientRect();return {label:label.textContent,value:value.textContent,top:r.top,left:r.left,bottom:r.bottom,detail:detail?.textContent??null}})
      const source=row.querySelector('.record-source'),sourceRect=source.getBoundingClientRect()
      return {metrics,source:source.textContent,sourceTop:sourceRect.top,labelHeight:row.querySelector('.record-choice__label').getBoundingClientRect().height,selectHeight:row.querySelector('select').getBoundingClientRect().height}
    }))
    for(const observation of observations) {
      assert.equal(observation.metrics.length,2);assert.equal(observation.metrics[1].detail,'종류 미확인')
      assert.ok(observation.source.includes('파일에서 가져옴')&&observation.source.includes('TCX')&&observation.source.includes('Asia/Seoul'))
      assert.ok(observation.sourceTop>=Math.max(...observation.metrics.map(metric=>metric.bottom))-0.5)
      assert.ok(observation.labelHeight>=44&&observation.selectHeight>=44)
      const [distance,time]=observation.metrics
      if(condition.font===100)assert.ok(Math.abs(time.top-distance.top)<=0.5)
      else {assert.ok(Math.abs(time.left-distance.left)<=0.5);assert.ok(time.top>=distance.bottom)}
    }
    const before=await rows.nth(1).evaluate(row=>row.offsetTop);await rows.first().getByRole('checkbox').uncheck();const unselected=await rows.nth(1).evaluate(row=>row.offsetTop);await rows.first().getByRole('checkbox').check();const reselected=await rows.nth(1).evaluate(row=>row.offsetTop)
    assert.equal(unselected-before,0);assert.equal(reselected-before,0)
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)
    let longNumberLines=null
    if(condition.font===200) {longNumberLines=await rows.first().getByText('1,256.78분',{exact:true}).evaluate(element=>{const range=document.createRange();range.setStart(element.firstChild,0);range.setEnd(element.firstChild,'1,256.78'.length);return [...range.getClientRects()].filter(rect=>rect.width>0).length});assert.equal(longNumberLines,1)}
    await rows.first().scrollIntoViewIfNeeded();await page.screenshot({path:out+`actual-six-${condition.width}-${condition.font}-top.png`})
    await rows.last().scrollIntoViewIfNeeded();await page.screenshot({path:out+`actual-six-${condition.width}-${condition.font}-last.png`})
    result.conditions.push({...condition,rows:observations,alignment:condition.font===100?'same-row':'stacked',nextRowMovement:{unselected:unselected-before,reselected:reselected-before},overflow:false,longNumberLines})
  }
  result.savedCount=await page.evaluate(()=>JSON.parse(localStorage.getItem('to-local-journal.journal.v2')??'[]').length);assert.equal(result.savedCount,0);assert.deepEqual(result.posts,[]);assert.deepEqual(result.pageErrors,[])
  result.browser=await browser.version();await writeFile(out+'results.json',JSON.stringify(result,null,2));console.log(JSON.stringify({conditions:result.conditions.map(({width,font,alignment,nextRowMovement,longNumberLines})=>({width,font,alignment,nextRowMovement,longNumberLines})),savedCount:result.savedCount,posts:result.posts,pageErrors:result.pageErrors}))
}finally{await browser?.close();await server.close()}
