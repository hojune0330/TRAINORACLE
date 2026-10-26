import {cleanup,fireEvent,render,screen,within} from '@testing-library/react'
import {afterEach,describe,expect,it,vi} from 'vitest'
import {TDArtwork,TDSprite,TDTowerArtwork} from './TowerDefenseArtwork'
import {tdUpgradePreview} from './TowerDefenseGrowth'
import {TowerDefense} from './TowerDefense'
import {newTowerDefense,buildTower,upgradeTower} from '../../domain/minigame/tower-defense'
import {saveTD} from '../../domain/minigame/tower-defense-storage'

vi.mock('./TowerDefenseBoard',()=>({TowerDefenseBoard:()=>null}))
vi.mock('../../hooks/useTaskFlowBack',()=>({useTaskFlowBack:()=>()=>false}))

afterEach(()=>{cleanup();localStorage.clear()})
describe('tower defense artwork recovery',()=>{
 it('keeps the previous HTML artwork when the new image fails',()=>{
  const {container}=render(<TDArtwork id="td-rapid-tower" size={64} fallbackTile={249}/>)
  const primary=container.querySelector('img[src*="defense-v5"]')!
  expect(container.querySelector('img[src*="kenney-td"]')).not.toBeNull()
  fireEvent.error(primary)
  expect(container.querySelector('img[src*="defense-v5"]')).toBeNull()
  expect(container.querySelector('img[src*="kenney-td"]')).not.toBeNull()
 })
 it('keeps the matching battlefield model loaded when only the tower level changes',()=>{
  const {container,rerender}=render(<TDArtwork id="td-rapid-tower" size={64} fallbackTile={249}/>)
  fireEvent.load(container.querySelector('img[src*="defense-v5"]')!)
  expect(container.querySelector('img[src*="kenney-td"]')).toBeNull()
  rerender(<TDArtwork id="td-rapid-tower-upgraded" size={64} fallbackTile={249}/>)
  expect(container.querySelector('img[src*="defense-v5"]')?.getAttribute('src')).toContain('rapid-preview.webp')
  expect(container.querySelector('img[src*="kenney-td"]')).toBeNull()
 })
 it('retains SVG geometry on failure and replaces it only after successful load',()=>{
  const {container,rerender}=render(<svg><TDSprite id="td-enemy-scout" x={0} y={0} width={160} fallback={<circle data-testid="old-geometry" r="22"/>}/></svg>)
  fireEvent.error(container.querySelector('image')!)
  expect(container.querySelector('[data-testid="old-geometry"]')).not.toBeNull()
  rerender(<svg><TDSprite id="td-enemy-armored" x={0} y={0} width={160} fallback={<circle data-testid="old-geometry" r="22"/>}/></svg>)
  fireEvent.load(container.querySelector('image')!)
  expect(container.querySelector('[data-testid="old-geometry"]')).toBeNull()
 })
 it('keeps branch silhouettes and the final crest readable when a tower image fails',()=>{
  const {container,rerender}=render(<TDTowerArtwork kind="rapid" size={80} level={1} fallbackTile={249}/>)
  expect(container.querySelector('.td-growth-shape')).toBeNull()
  rerender(<TDTowerArtwork kind="rapid" size={80} level={2} branch="power" fallbackTile={249}/>)
  expect(container.querySelector('polygon.td-growth-power')).not.toBeNull()
  expect(container.querySelector('.td-growth-final')).toBeNull()
  rerender(<TDTowerArtwork kind="rapid" size={80} level={3} branch="reach" fallbackTile={249}/>)
  fireEvent.error(container.querySelector('img[src*="defense-v5"]')!)
  expect(container.querySelector('img[src*="kenney-td"]')).not.toBeNull()
  expect(container.querySelector('circle.td-growth-reach')).not.toBeNull()
  expect(container.querySelector('.td-growth-power')).toBeNull()
  expect(container.querySelector('.td-growth-final')).not.toBeNull()
 })
})

describe('tower growth decisions and confirmed purchases',()=>{
 it('previews real prices and stats, including fixed branch and faster final cadence',()=>{
  const state=newTowerDefense();buildTower(state,0,'rapid')
  const tower=state.towers[0]!,first=tdUpgradePreview(tower,'power',60)!
  expect(first).toMatchObject({cost:60,remaining:0,affordable:true,level:2,branch:'power',before:{damage:12,range:2.45,interval:.45},after:{damage:21.6,range:2.45,interval:.45}})
  expect(tdUpgradePreview(tower,'reach',59)).toMatchObject({affordable:false,remaining:-1,after:{damage:15,range:3.25,interval:.45}})
  upgradeTower(state,0,'power')
  const final=tdUpgradePreview(tower,'reach',95)!
  expect(final.branch).toBe('power')
  expect(final.cost).toBe(95)
  expect(final.after.damage).toBeCloseTo(35.64)
  expect(final.after.range).toBeCloseTo(2.65)
  expect(final.after.interval).toBeCloseTo(.3825)
 })
 it('shows the actual gold debit and does not offer an unaffordable final purchase',()=>{
  const {container}=render(<TowerDefense onBack={()=>{}} entry="new" mapId="forest"/>)
  fireEvent.click(screen.getByRole('button',{name:/^연사탑 ·/}))
  const power=screen.getByRole('button',{name:/^화력 특화 · 60골드/})
  expect(within(power).getByText('강화 후 50골드')).toBeVisible()
  fireEvent.click(power)
  expect(container.querySelector('.tower-defense')).toHaveAttribute('data-gold','50')
  expect(screen.getByRole('status')).toHaveTextContent('보강 완료 · 화력 특화')
  expect(screen.getByRole('status')).toHaveTextContent('피해 12.0 → 21.6')
  const final=screen.getByRole('button',{name:/^최종 강화 · 95골드/})
  expect(final).toBeDisabled()
  expect(within(final).getByText('45골드 더 필요')).toBeVisible()
  fireEvent.click(final)
  expect(container.querySelector('.tower-defense')).toHaveAttribute('data-gold','50')
  expect(container.querySelector('.td-current-tower .td-tower-art')).toHaveAttribute('data-level','2')
 })
 it('restores the branch, applies final growth once and replaces purchase controls with a maximum state',()=>{
  const state=newTowerDefense();state.gold=300;buildTower(state,0,'frost');upgradeTower(state,0,'reach');saveTD(localStorage,state,'growth-fixture')
  const {container}=render(<TowerDefense onBack={()=>{}} entry="resume" mapId="forest"/>)
  expect(screen.getByText('감속 세기와 지속 시간은 강화해도 같아요.')).toBeVisible()
  expect(container.querySelector('.td-current-tower .td-tower-art')).toHaveAttribute('data-branch','reach')
  fireEvent.click(screen.getByRole('button',{name:/^최종 강화 · 115골드/}))
  expect(container.querySelector('.tower-defense')).toHaveAttribute('data-gold','28')
  expect(screen.getByText('최대 레벨 · 최종 단계 완료')).toBeVisible()
  expect(screen.queryByRole('button',{name:/^최종 강화 ·/})).toBeNull()
  expect(container.querySelector('.td-current-tower .td-tower-art')).toHaveAttribute('data-level','3')
  expect(container.querySelector('.td-current-tower .td-growth-final')).not.toBeNull()
 })
})
