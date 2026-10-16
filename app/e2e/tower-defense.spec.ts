import {test,expect,type Page} from '@playwright/test'
const root=(page:Page)=>page.locator('.tower-defense')
async function open(page:Page){await page.goto('./?app=1');await page.getByRole('button',{name:'더보기',exact:true}).click();await page.getByRole('button',{name:'미니게임',exact:true}).click();await page.getByRole('button',{name:'혼자 도전 · 세 가지 종목',exact:true}).click();await page.getByRole('button',{name:/^타워 디펜스/}).click()}
async function freeze(page:Page){await page.clock.install();await page.clock.pauseAt(await page.evaluate(()=>Date.now())+100)}
async function build(page:Page,pad:number,name:string){await page.getByRole('button',{name:`${pad}번 건설 지점`,exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${name} ·`)}).click()}
async function upgrade(page:Page,pad:number,final=false){await page.getByRole('button',{name:`${pad}번 건설 지점`,exact:true}).click();await page.getByRole('button',{name:new RegExp(`^${final?'최종 강화':'화력 특화'} ·`)}).click()}
async function settleWave(page:Page){for(let i=0;i<24&&await root(page).getAttribute('data-phase')==='wave';i++)await page.clock.runFor(5000)}
async function finishWave(page:Page,n:number){await page.getByRole('button',{name:`${n}웨이브 시작`,exact:true}).click();await settleWave(page);await expect(root(page)).toHaveAttribute('data-phase',n===6?'won':'prepare')}
test('classic TD purchases, pause, save/resume and all six real waves',async({page},info)=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await open(page);await page.getByRole('button',{name:'새 방어전 시작',exact:true}).click();await freeze(page)
 await build(page,2,'연사탑');await build(page,3,'포격탑');await expect(root(page)).toHaveAttribute('data-gold','0');await expect(page.getByTestId('tower-range')).toBeVisible();await expect(page.getByRole('button',{name:/^화력 특화 ·/})).toBeDisabled()
 await page.screenshot({path:info.outputPath('td-build.png')});await page.getByRole('button',{name:'1웨이브 시작',exact:true}).click();await page.clock.runFor(7000)
 const slowTime=Number(await root(page).getAttribute('data-time'));await page.getByRole('button',{name:'전투 속도 1배',exact:true}).click();await page.clock.runFor(1000);expect(Number(await root(page).getAttribute('data-time'))-slowTime).toBeGreaterThan(1.8);await page.getByRole('button',{name:'전투 속도 2배',exact:true}).click()
 await page.getByRole('button',{name:'디펜스 일시정지',exact:true}).click();const before=await root(page).getAttribute('data-time');await page.clock.runFor(4000);expect(await root(page).getAttribute('data-time')).toBe(before);await expect(page.getByRole('button',{name:'저장하고 나가기',exact:true})).toHaveCount(0)
 await page.getByRole('button',{name:'디펜스 계속하기',exact:true}).click();await page.clock.runFor(30000);await expect(root(page)).toHaveAttribute('data-phase','prepare');await expect(root(page)).toHaveAttribute('data-lives','20')
 await page.getByRole('button',{name:'디펜스 일시정지',exact:true}).click();await page.getByRole('button',{name:'저장하고 나가기',exact:true}).click();await expect(page.getByRole('heading',{name:'오늘은 어떤 경기?'})).toBeVisible()
 await page.reload();await open(page);await page.getByRole('button',{name:'2웨이브 준비 이어하기',exact:true}).click();await expect(root(page)).toHaveAttribute('data-gold','104');await expect(root(page)).toHaveAttribute('data-wave','1')
 await build(page,1,'냉각탑');await finishWave(page,2);await upgrade(page,3);await finishWave(page,3);await upgrade(page,2);await upgrade(page,3,true);await finishWave(page,4);await build(page,4,'포격탑');await upgrade(page,4);await finishWave(page,5);await upgrade(page,4,true);await upgrade(page,2,true)
 await page.getByRole('button',{name:'6웨이브 시작',exact:true}).click();await page.clock.runFor(10000);await page.screenshot({path:info.outputPath('td-battle.png')});await settleWave(page)
 await expect(page.getByRole('heading',{name:'6웨이브 방어 성공!'})).toBeVisible();await expect(page.getByText('완주 등급 ★★★',{exact:true})).toBeVisible();await expect(page.getByText('결과를 이 기기에 저장했어요.',{exact:true})).toBeVisible()
 const records=await page.evaluate(()=>JSON.parse(localStorage.getItem('trainoracle.tower-defense.records.v1')!));expect(records).toHaveLength(1);expect(records[0]).toMatchObject({won:true,lives:20,kills:100,leaks:0});expect(await page.evaluate(()=>localStorage.getItem('trainoracle.tower-defense.checkpoint.v1'))).toBeNull()
 await page.screenshot({path:info.outputPath('td-result.png')});expect(errors).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'새 배치로 다시 도전',exact:true}).click();await expect(root(page)).toHaveAttribute('data-gold','180');await expect(root(page)).toHaveAttribute('data-wave','0')
})
test('no towers means defeat, missing art and narrow viewport remain usable',async({page},info)=>{
 if(info.project.name==='phone')await page.setViewportSize({width:320,height:740});else{await page.emulateMedia({reducedMotion:'reduce'});await page.route('**/game/kenney-td/*.png',route=>route.abort())}
 await open(page);await page.getByRole('button',{name:'새 방어전 시작',exact:true}).click();await freeze(page)
 await build(page,2,'연사탑');await upgrade(page,2);await page.getByRole('button',{name:'판매 · 91골드 회수 (70%)',exact:true}).click();await expect(root(page)).toHaveAttribute('data-gold','141')
 await page.getByRole('button',{name:'디펜스 나가기',exact:true}).click();await page.getByRole('button',{name:'이번 진행을 저장하지 않고 나가기',exact:true}).click();await page.getByRole('button',{name:/^타워 디펜스/}).click();await page.getByRole('button',{name:'새 방어전 시작',exact:true}).click();await expect(root(page)).toHaveAttribute('data-gold','180')
 for(const button of await page.locator('.td-pad').all()){const box=await button.boundingBox();expect(box!.width).toBeGreaterThanOrEqual(44);expect(box!.height).toBeGreaterThanOrEqual(44)}
 await finishWave(page,1);await expect(root(page)).toHaveAttribute('data-lives','12');await page.getByRole('button',{name:'2웨이브 시작',exact:true}).click();await settleWave(page);await expect(page.getByRole('heading',{name:'기지가 함락됐어요'})).toBeVisible();await expect(root(page)).toHaveAttribute('data-lives','0');expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 await page.getByRole('button',{name:'종목 선택으로',exact:true}).click();await expect(page.getByRole('heading',{name:'오늘은 어떤 경기?'})).toBeVisible()
})
