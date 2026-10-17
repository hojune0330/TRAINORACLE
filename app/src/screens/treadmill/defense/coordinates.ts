import {getTDMap} from '../../../domain/minigame/tower-defense'
import type {Point, TDMapId} from '../../../domain/minigame/tower-defense'

export const FIELD_WIDTH = 1200
export const FIELD_HEIGHT = 1300
export const FIELD_UNIT = 90
export const FIELD_Y_UNIT = 120
export const fieldPoint = (p: Point) => ({x: 60 + p.x * FIELD_UNIT, y: 40 + p.y * FIELD_Y_UNIT})
export const fieldSize = (mapId?:TDMapId) => {
 const map=getTDMap(mapId)
 return map.id==='forest'?{width:FIELD_WIDTH,height:FIELD_HEIGHT}:{width:120+map.bounds.width*FIELD_UNIT,height:160+map.bounds.height*FIELD_Y_UNIT}
}
export const directionFrame = (angle: number) => (Math.round(angle / (Math.PI / 4)) + 8) % 8
