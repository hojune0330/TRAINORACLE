import {test,expect,type Page} from '@playwright/test'
const root=(page:Page)=>page.locator('.tower-defense')
const board=(page:Page)=>page.locator('.td-battlefield')
const canvas=(page:Page)=>page.locator('canvas[data-defense-renderer]')
async function open(page:Page,map:'forest'|'starlight'='forest'){
 await page.goto('./?app=1')
 await page.getByRole('button',{name:'더보기',exact:true}).click()
 await page.getByRole('button',{name:'게임 라운지',exact:true}).click()
 // The lounge now opens the pet home first. Follow its visible exit before
 // selecting a game; clicking the catalog behind the modal cannot succeed.
 const petHome=page.getByRole('dialog',{name:'우리 집 친구들',exact:true})
 await expect(petHome).toBeVisible()
 await petHome.getByLabel('다른 게임 보기',{exact:true}).click()
 await expect(petHome).not.toBeVisible()
 await page.getByRole('button',{name:'타워 디펜스 게임 소개',exact:true}).click()
 if(map==='forest')await page.getByRole('button',{name:/^기존 숲길 관문/}).click()
}
async function pauseClock(page:Page){await page.clock.pauseAt(await page.evaluate(()=>Date.now())+60_000)}
async function freeze(page:Page){await page.clock.install();await pauseClock(page)}
async function withoutWebGL(page:Page){
 // Exercise Phaser's supported Canvas fallback; software WebGL on CI is too slow for every full wave.
 await page.addInitScript(()=>{
  const original=HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:Parameters<typeof original>){
   if(String(args[0]).includes('webgl'))return null
   return Reflect.apply(original,this,args)
  } as typeof original
 })
}
async function rendererReady(page:Page,missing=false){
 await expect(board(page)).toHaveAttribute('data-ready','true')
 await expect(canvas(page)).toBeVisible();await expect(canvas(page)).toHaveAttribute('data-defense-renderer',/^(webgl|canvas)$/)
 if(missing)expect(Number(await board(page).getAttribute('data-missing-assets'))).toBeGreaterThan(0)
 else await expect(board(page)).toHaveAttribute('data-missing-assets','0')
}
async function distinctAnimationFrames(page:Page){
 // Inspect the actual decoded atlases too: a rendering loop alone can pass while every animation cell is identical.
 const sheets=await page.evaluate(async()=>Promise.all(['rapid','scout'].map(async kind=>{
  const image=new Image();image.src=new URL(`game/defense-v5/${kind}-atlas.webp`,document.baseURI).href;await image.decode()
  const surface=document.createElement('canvas');surface.width=128;surface.height=128;const ctx=surface.getContext('2d')!
  const frames=[]
  for(let row=0;row<(kind==='rapid'?3:6);row++){
   ctx.clearRect(0,0,128,128);ctx.drawImage(image,0,row*128,128,128,0,0,128,128)
   const pixels=ctx.getImageData(0,0,128,128).data;let hash=2166136261
   for(const channel of pixels)hash=Math.imul(hash^channel,16777619)
   frames.push(hash>>>0)
  }
  return {kind,width:image.width,height:image.height,unique:new Set(frames).size}
 })))
 for(const sheet of sheets){expect(sheet.width).toBe(1024);expect(sheet.unique,`${sheet.kind} animation cells`).toBeGreaterThan(1)}
}
async function build(page:Page,pad:number,name:string){await page.getByRole('button',{name:`${pad}번 건설 지점`,exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${name} ·`)}).click()}
async function upgrade(page:Page,pad:number,final=false){await page.getByRole('button',{name:`${pad}번 건설 지점`,exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${final?'최종 강화':'화력 특화'} ·`)}).click()}
// Long-wave integration uses one rendered frame per 100ms. The app still runs all six 1/60 physics steps;
// no state, damage, money or win condition is injected. Short runFor segments below verify real frame animation.
async function advanceGame(page:Page,milliseconds:number){for(let elapsed=0;elapsed<milliseconds;elapsed+=100)await page.clock.fastForward(Math.min(100,milliseconds-elapsed))}
async function settleWave(page:Page){
 const normal=page.getByRole('button',{name:'전투 속도 1배',exact:true})
 if(await normal.isEnabled())await normal.click()
 for(let i=0;i<24&&await root(page).getAttribute('data-phase')==='wave';i++)await advanceGame(page,2000)
 const fast=page.getByRole('button',{name:'전투 속도 2배',exact:true});if(await fast.isEnabled())await fast.click()
}
async function finishWave(page:Page,n:number){await page.getByRole('button',{name:`${n}웨이브 시작`,exact:true}).click();await settleWave(page);await expect(root(page)).toHaveAttribute('data-phase',n===6?'won':'prepare')}
test('classic TD purchases, pause, save/resume and all six real waves',async({page},info)=>{
 if(info.project.name==='phone')await withoutWebGL(page)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await page.getByRole('button',{name:'새 방어전 시작',exact:true}).click();await rendererReady(page);await distinctAnimationFrames(page);await freeze(page)
 await build(page,2,'연사탑');await expect(page.getByRole('button',{name:'2번 건설 지점',exact:true})).toHaveAttribute('aria-description','연사탑 1레벨');await build(page,3,'포격탑');await expect(root(page)).toHaveAttribute('data-gold','0');await expect(page.getByTestId('tower-range')).toBeVisible();await expect(page.getByRole('button',{name:/^화력 특화 ·/})).toBeDisabled()
 await page.screenshot({path:info.outputPath('td-build.png')});await page.getByRole('button',{name:'1웨이브 시작',exact:true}).click();await advanceGame(page,7000)
 const firstFrame=Number(await canvas(page).getAttribute('data-frames')),pixelsBefore=await canvas(page).screenshot({path:info.outputPath('td-motion-before.png')})
 expect(Number(await canvas(page).getAttribute('data-enemies'))).toBeGreaterThan(0)
 await page.clock.runFor(600)
 const pixelsAfter=await canvas(page).screenshot({path:info.outputPath('td-motion-after.png')})
 expect(Number(await canvas(page).getAttribute('data-frames'))).toBeGreaterThan(firstFrame)
 expect(pixelsAfter.equals(pixelsBefore),'the actual battlefield pixels must change while enemies and projectiles move').toBe(false)
 const slowTime=Number(await root(page).getAttribute('data-time'));await page.getByRole('button',{name:'전투 속도 1배',exact:true}).click();await page.clock.runFor(1000)
 // The HUD samples at 100ms, so displayed simulation time can lag by 0.2s at 2x.
 const accelerated=Number(await root(page).getAttribute('data-time'))-slowTime;expect(accelerated).toBeGreaterThanOrEqual(1.8-1e-6);expect(accelerated).toBeLessThanOrEqual(2.2)
 await page.getByRole('button',{name:'전투 속도 2배',exact:true}).click()
 await page.getByRole('button',{name:'디펜스 일시정지',exact:true}).click();const before=await root(page).getAttribute('data-time');await page.clock.fastForward(4000);expect(await root(page).getAttribute('data-time')).toBe(before);await expect(page.getByRole('button',{name:'저장하고 나가기',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'디펜스 계속하기',exact:true}).click();await settleWave(page);await expect(root(page)).toHaveAttribute('data-phase','prepare');await expect(root(page)).toHaveAttribute('data-lives','20')
 await page.getByRole('button',{name:'디펜스 일시정지',exact:true}).click();await page.getByRole('button',{name:'저장하고 나가기',exact:true}).click();await expect(page.getByRole('heading',{name:'타워 디펜스',exact:true})).toBeVisible()
 await withoutWebGL(page);await page.clock.resume();await page.reload();await open(page);await page.getByRole('button',{name:'2웨이브 이어하기',exact:true}).click();await rendererReady(page);await expect(canvas(page)).toHaveAttribute('data-defense-renderer','canvas');await pauseClock(page);await expect(root(page)).toHaveAttribute('data-gold','104');await expect(root(page)).toHaveAttribute('data-wave','1')
 await build(page,1,'냉각탑');await finishWave(page,2);await upgrade(page,3);await expect(page.getByRole('button',{name:'3번 건설 지점',exact:true})).toHaveAttribute('aria-description','포격탑 2레벨');await finishWave(page,3);await upgrade(page,2);await upgrade(page,3,true);await finishWave(page,4);await build(page,4,'포격탑');await upgrade(page,4);await finishWave(page,5);await upgrade(page,4,true);await upgrade(page,2,true)
 await page.getByRole('button',{name:'6웨이브 시작',exact:true}).click();await advanceGame(page,10000);await page.screenshot({path:info.outputPath('td-battle.png')});await settleWave(page)
 await expect(page.getByRole('heading',{name:'6웨이브 방어 성공!'})).toBeVisible();await expect(page.getByText('완주 등급 ★★★',{exact:true})).toBeVisible();await expect(page.getByText('결과를 이 기기에 저장했어요.',{exact:true})).toBeVisible()
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('trainoracle.tower-defense.records.v1')!));expect(records).toHaveLength(1);expect(records[0]).toMatchObject({won:true,lives:20,kills:100,leaks:0});expect(await page.evaluate(()=>localStorage.getItem('trainoracle.tower-defense.checkpoint.v1'))).toBeNull()
 await page.screenshot({path:info.outputPath('td-result.png')});expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'새 배치로 다시 도전',exact:true}).click();await expect(root(page)).toHaveAttribute('data-gold','180');await expect(root(page)).toHaveAttribute('data-wave','0')
})
test('no towers means defeat, missing art and narrow viewport remain usable',async({page},info)=>{
 await withoutWebGL(page);await page.emulateMedia({reducedMotion:'reduce'})
 if(info.project.name==='phone')await page.setViewportSize({width:320,height:740});else{await page.route('**/game/defense-v5/**',route=>route.abort());await page.route('**/game/kenney-td/*.png',route=>route.abort());await page.route('**/game/image-library-v1/**/*.webp',route=>route.abort())}
 await open(page);await page.getByRole('button',{name:'새 방어전 시작',exact:true}).click();await rendererReady(page,info.project.name!=='phone');await freeze(page)
 for(const pad of [2,5]){
  const button=page.getByRole('button',{name:`${pad}번 건설 지점`,exact:true});await button.scrollIntoViewIfNeeded();const before=await button.boundingBox()
  if(info.project.name==='phone')await button.tap();else{await page.mouse.move(before!.x+before!.width/2,before!.y+before!.height/2);await page.mouse.down();expect(await button.boundingBox(),'reduced-motion active position').toEqual(before);await page.mouse.up()}
  await expect(button).toHaveAttribute('aria-pressed','true');expect(await button.boundingBox(),'tap must not shift the build target').toEqual(before)
 }
 await build(page,2,'연사탑');await expect(page.getByRole('button',{name:'2번 건설 지점',exact:true})).toHaveAttribute('aria-description','연사탑 1레벨');await upgrade(page,2);await page.getByRole('button',{name:'판매 · 91골드 회수 (70%)',exact:true}).click();await expect(root(page)).toHaveAttribute('data-gold','141')
 await page.getByRole('button',{name:'디펜스 나가기',exact:true}).click();await page.getByRole('button',{name:'이번 진행을 저장하지 않고 나가기',exact:true}).click();await page.clock.resume();await page.getByRole('button',{name:'새 방어전 시작',exact:true}).click();await rendererReady(page,info.project.name!=='phone');await pauseClock(page);await expect(root(page)).toHaveAttribute('data-gold','180')
 for(const button of await page.locator('.td-pad-shortcut').all()){const box=await button.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44)}
 await finishWave(page,1);await expect(root(page)).toHaveAttribute('data-lives','12');await page.getByRole('button',{name:'2웨이브 시작',exact:true}).click();await settleWave(page);await expect(page.getByRole('heading',{name:'기지가 함락됐어요'})).toBeVisible();await expect(root(page)).toHaveAttribute('data-lives','0');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.clock.fastForward(2000);await page.screenshot({path:info.outputPath('td-defeat-settled.png')})
 await page.getByRole('button',{name:'게임 소개로',exact:true}).click();await expect(page.getByRole('heading',{name:'타워 디펜스',exact:true})).toBeVisible()
})

test('fantasy map camera, relay entrances, split save and running connection',async({page},info)=>{
 await withoutWebGL(page)
 const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message))
 await open(page,'starlight');await page.getByRole('button',{name:'새 방어전 시작',exact:true}).click();await rendererReady(page)
 await expect(board(page)).toHaveAttribute('data-map','starlight')
 await expect(page.getByRole('button',{name:'14번 건설 지점',exact:true})).toBeVisible()
 const initialX=Number(await board(page).getAttribute('data-camera-x'))
 await page.getByRole('button',{name:'숲의 관문',exact:true}).click()
 expect(Number(await board(page).getAttribute('data-camera-x'))).toBeGreaterThan(initialX+500)
 await page.getByRole('button',{name:'전체 지도',exact:true}).click()
 expect(Number(await board(page).getAttribute('data-camera-zoom'))).toBeLessThan(.5)
 await page.screenshot({path:info.outputPath('fantasy-overview.png')})
 await page.getByRole('button',{name:'수정 다리',exact:true}).click()
 await board(page).scrollIntoViewIfNeeded();const box=(await board(page).boundingBox())!,before=Number(await board(page).getAttribute('data-camera-x'))
 await page.mouse.move(box.x+box.width*.5,box.y+box.height*.5);await page.mouse.down();await page.mouse.move(box.x+box.width*.25,box.y+box.height*.5,{steps:8});await page.mouse.up()
 expect(Number(await board(page).getAttribute('data-camera-x'))).toBeGreaterThan(before+100)
 await page.getByRole('button',{name:'선두 따라가기',exact:true}).click();await expect(page.getByRole('button',{name:'선두 따라가기',exact:true})).toHaveAttribute('aria-pressed','true')
 await page.getByRole('button',{name:'별빛 샘',exact:true}).click();await expect(page.getByRole('button',{name:'선두 따라가기',exact:true})).toHaveAttribute('aria-pressed','false')
 await freeze(page)
 const sell=async(pad:number)=>{await page.getByRole('button',{name:`${pad}번 건설 지점`,exact:true}).click();await page.getByRole('button',{name:/^판매 ·/}).click()}
 await build(page,2,'연사탑');await build(page,3,'포격탑');await finishWave(page,1);await expect(root(page)).toHaveAttribute('data-gold','104')
 await page.getByRole('button',{name:'디펜스 일시정지',exact:true}).click();await page.getByRole('button',{name:'저장하고 나가기',exact:true}).click()
 const saved=await page.evaluate(()=>({legacy:localStorage.getItem('trainoracle.tower-defense.checkpoint.v1'),fantasy:JSON.parse(localStorage.getItem('trainoracle.tower-defense.checkpoint.v1.starlight')!)}))
 expect(saved.legacy).toBeNull();expect(saved.fantasy).toMatchObject({mapId:'starlight',wave:1,gold:104})
 await page.clock.resume();await page.getByRole('button',{name:'2웨이브 이어하기',exact:true}).click();await rendererReady(page);await pauseClock(page)
 await upgrade(page,2);await finishWave(page,2)
 await expect(page.locator('.td-entry-notice')).toContainText('수정 다리')
 await sell(2);await expect(page.getByRole('button',{name:'3번 건설 지점',exact:true})).toHaveAttribute('aria-description','포격탑 1레벨');await sell(3)
 await build(page,5,'연사탑');await build(page,6,'포격탑');await upgrade(page,6);await finishWave(page,3)
 await build(page,8,'냉각탑');await upgrade(page,6,true);await finishWave(page,4)
 await expect(page.locator('.td-entry-notice')).toContainText('숲의 관문')
 await sell(5);await sell(6);await sell(8)
 await build(page,11,'연사탑');await build(page,12,'포격탑');await build(page,10,'냉각탑');await upgrade(page,12);await upgrade(page,12,true);await upgrade(page,11);await finishWave(page,5)
 await upgrade(page,11,true);await build(page,13,'포격탑');await finishWave(page,6)
 await expect(root(page)).toHaveAttribute('data-lives','20');await expect(root(page)).toHaveAttribute('data-gold','492')
 await page.screenshot({path:info.outputPath('fantasy-result.png')})
 await page.clock.resume();await page.getByRole('button',{name:'이 숲을 달려보기',exact:true}).click()
 await expect(page.getByText('판타지 러닝 · 90초',{exact:true})).toBeVisible()
 await expect(page.getByRole('heading',{name:'별빛 릴레이 숲 투어',exact:true})).toBeVisible()
 expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
})
