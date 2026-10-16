import {describe,it,expect} from 'vitest'
import {survivalPoint} from './survival-view'
describe('survival depth projection',()=>{
  it('keeps approach continuous, enlarges approaching hazards and leaves both lanes in view',()=>{
    for(const [w,h] of [[320,640],[390,760],[1000,520]]) for(const lane of [-1,1]) {
      let previous=survivalPoint(1.2,lane,w!,h!)
      for(let x=1.19;x>=.055;x-=.01){const p=survivalPoint(x,lane,w!,h!);expect(p.y).toBeGreaterThan(previous.y);expect(p.scale).toBeGreaterThan(previous.scale);expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(w!);expect(Math.abs(p.y-previous.y)).toBeLessThan(h!*.015);previous=p}
    }
  })
  it('uses exactly the same projected ground for a runner and its matching hazard, without reduced-motion drift',()=>{
    const runner=survivalPoint(.5,-1,390,760,12,true,true)
    const hazard=survivalPoint(.5,-1,390,760,40,true,true)
    expect(runner).toEqual(hazard)
    expect(survivalPoint(.5,1,390,760,12,true,true).y).toBe(runner.y)
    expect(survivalPoint(.5,1,390,760,12,true,true).x).toBeGreaterThan(runner.x)
  })
})
