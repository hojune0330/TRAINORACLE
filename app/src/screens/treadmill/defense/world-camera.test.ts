import {describe,it,expect} from 'vitest'
import {constrainCamera,cameraRect,worldToView,viewToWorld,zoomAt,overviewZoom} from './world-camera'
describe('defense world camera',()=>{
 const world={width:2280,height:2080}
 it('keeps a close view inside every map edge after extreme drags',()=>{
  for(const x of [-10000,10000])for(const y of [-10000,10000]){
   const r=cameraRect(constrainCamera({x,y,zoom:1.2,follow:false},world))
   expect(r.x).toBeGreaterThanOrEqual(0);expect(r.y).toBeGreaterThanOrEqual(0)
   expect(r.x+r.width).toBeLessThanOrEqual(world.width);expect(r.y+r.height).toBeLessThanOrEqual(world.height)
  }
 })
 it('keeps render and touch coordinates aligned when panned and zoomed',()=>{
  const camera=constrainCamera({x:1400,y:1000,zoom:1.35,follow:false},world),point={x:1300,y:900}
  const restored=viewToWorld(worldToView(point,camera),camera)
  expect(restored.x).toBeCloseTo(point.x,10);expect(restored.y).toBeCloseTo(point.y,10)
 })
 it('zooms around the touched point without jumping to the origin',()=>{
  const c={x:1100,y:1000,zoom:1,follow:true},anchor={x:350,y:440}
  const next=zoomAt(c,world,1.4,anchor)
  const before=viewToWorld(anchor,c),after=viewToWorld(anchor,next)
  expect(next.follow).toBe(false);expect(after.x).toBeCloseTo(before.x,10);expect(after.y).toBeCloseTo(before.y,10)
 })
 it('shows the whole world and rejects nonpositive zoom',()=>{
  const c=constrainCamera({x:0,y:0,zoom:-1,follow:false},world),r=cameraRect(c)
  expect(c.zoom).toBe(overviewZoom(world));expect(r.width).toBeGreaterThanOrEqual(world.width);expect(r.height).toBeGreaterThanOrEqual(world.height)
 })
})
