import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { newTreadmillRun, treadmillCommand } from '../../domain/minigame/treadmill'
import { actionFeedback } from './action-feedback'
import { useActionFeedback } from './ActionFeedback'
import { drawMotionBurst } from './motion-bursts'
import type { GamePalette } from './sprites'

afterEach(()=>{cleanup();vi.useRealTimers()})
const running=()=>({...newTreadmillRun(),mode:'running' as const,countdown:0})
describe('truthful game reactions',()=>{
  it('reports only engine-accepted jump/dash and their actual cost',()=>{
    const before={...running(),jumpCost:4}
    for(const type of ['jump','dash'] as const){
      const after=treadmillCommand(before,{type})
      expect(actionFeedback(before,after,{type})).toMatchObject({kind:type,detail:`에너지 −${type==='jump'?4:20}`})
      expect(actionFeedback(before,before,{type})?.kind).not.toBe(type)
    }
  })
  it('explains energy, cooldown, air and countdown rejections without claiming success',()=>{
    for(const [before,type,text] of [
      [{...running(),energy:2},'jump','에너지가 부족해요'],
      [{...running(),cooldown:1.2},'dash','대시 충전 중'],
      [{...running(),y:40},'jump','아직 공중이에요'],
      [{...running(),countdown:2},'dash','출발 준비 중'],
    ] as const) expect(actionFeedback(before,treadmillCommand(before,{type}),{type})).toMatchObject({kind:'wait',text})
    const paused={...running(),mode:'paused' as const}
    expect(actionFeedback(paused,paused,{type:'jump'})).toBeNull()
    expect(actionFeedback(running(),running(),{type:'run',held:true})).toBeNull()
  })
  it('replaces an old reaction without its timeout erasing the newer one',()=>{
    vi.useFakeTimers(); const {result,unmount}=renderHook(()=>useActionFeedback())
    act(()=>result.current.show({kind:'jump',text:'점프!',detail:'에너지 −8'}))
    act(()=>vi.advanceTimersByTime(600))
    act(()=>result.current.show({kind:'wait',text:'대시 충전 중',detail:'1초'}))
    act(()=>vi.advanceTimersByTime(100))
    expect(result.current.cue?.kind).toBe('wait')
    act(()=>vi.advanceTimersByTime(1300));expect(result.current.cue).toBeNull()
    act(()=>result.current.show({kind:'dash',text:'대시!',detail:''}))
    act(()=>result.current.clear());expect(result.current.cue).toBeNull()
    unmount();expect(vi.getTimerCount()).toBe(0)
  })
  it('draws short bursts only inside their lifetime and respects reduced motion',()=>{
    const stroke=vi.fn(), noop=()=>{}
    const ctx={save:noop,restore:noop,stroke,beginPath:noop,ellipse:noop,moveTo:noop,lineTo:noop} as unknown as CanvasRenderingContext2D
    const palette={} as GamePalette
    for(const kind of ['jump','dash','land','clear'] as const){
      stroke.mockClear();drawMotionBurst(ctx,palette,kind,100,400,.1,false);expect(stroke).toHaveBeenCalled()
      stroke.mockClear()
      drawMotionBurst(ctx,palette,kind,100,400,.1,true)
      drawMotionBurst(ctx,palette,kind,100,400,.36,false)
      expect(stroke).not.toHaveBeenCalled()
    }
  })
})
