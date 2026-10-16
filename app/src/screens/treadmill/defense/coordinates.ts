import type {Point} from '../../../domain/minigame/tower-defense'

export const FIELD_WIDTH = 1200
export const FIELD_HEIGHT = 1300
export const FIELD_UNIT = 90
export const FIELD_Y_UNIT = 120
export const fieldPoint = (p: Point) => ({x: 60 + p.x * FIELD_UNIT, y: 40 + p.y * FIELD_Y_UNIT})
export const directionFrame = (angle: number) => (Math.round(angle / (Math.PI / 4)) + 8) % 8
