import {towerStats,upgradeCost} from '../../domain/minigame/tower-defense'
import type {Tower,Branch} from '../../domain/minigame/tower-defense'

/** Presentation only: every purchase preview comes from the unchanged combat rules. */
export const tdStageName = (level:number) => level===3?'최종':level===2?'보강':'기본'
export const tdBranchName = (branch:Branch|null) => branch==='power'?'화력 특화':branch==='reach'?'사거리 특화':'기본형'
export const tdTowerSize = (level:number) => 212+(level-1)*8
export function tdUpgradePreview(tower:Tower,branch:Branch,gold:number){
 if(tower.level===3)return null
 const chosen=tower.branch??branch,level=(tower.level+1) as 2|3,cost=upgradeCost(tower)
 return {level,branch:chosen,cost,remaining:gold-cost,affordable:gold>=cost,
  before:towerStats(tower),after:towerStats({...tower,level,branch:chosen})}
}

export type GrowthTone='metal'|'power'|'reach'|'final'
export type GrowthShape=({type:'polygon';points:[number,number][]}|{type:'line';points:[number,number][]}|{type:'circle';x:number;y:number;r:number})&{tone:GrowthTone;layer:'back'|'front'}
/** The same 128px attachment geometry is used by preview, Phaser and SVG fallback.
 * It surrounds the approved Tripo model; no new model or combat reach is implied. */
export function tdGrowthShapes(level:number,branch:Branch|null):GrowthShape[]{
 if(level<2)return []
 const tone=branch==='reach'?'reach':'power'
 const shapes:GrowthShape[]=[
  {type:'polygon',points:[[20,82],[35,76],[93,76],[108,82],[102,97],[26,97]],tone:'metal',layer:'back'},
  {type:'polygon',points:[[22,82],[34,78],[36,92],[27,96]],tone,layer:'front'},
  {type:'polygon',points:[[106,82],[94,78],[92,92],[101,96]],tone,layer:'front'},
 ]
 if(branch==='reach'){
  for(const x of [27,101]){
   shapes.push({type:'line',points:[[x,83],[x,48]],tone:'metal',layer:'back'})
   shapes.push({type:'circle',x,y:43,r:level===3?10:7,tone:'reach',layer:'back'})
   shapes.push({type:'line',points:[[x-5,43],[x+5,43]],tone:'metal',layer:'back'})
  }
 }else{
  shapes.push({type:'polygon',points:[[18,76],[18,56],[28,48],[38,55],[37,84]],tone,layer:'back'})
  shapes.push({type:'polygon',points:[[110,76],[110,56],[100,48],[90,55],[91,84]],tone,layer:'back'})
 }
 if(level===3){
  shapes.push({type:'polygon',points:[[17,94],[30,89],[98,89],[111,94],[102,105],[26,105]],tone:'final',layer:'back'})
  shapes.push({type:'polygon',points:[[55,98],[64,88],[73,98],[64,108]],tone:'final',layer:'front'})
 }
 return shapes
}
