import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startVisibleRefresh } from '../src/hooks/visible-refresh-scheduler.ts';
function fixture(run,waiting=false){
  let now=0,visible=true,id=0;const timers=new Map();
  const scheduler=startVisibleRefresh(run,()=>visible,{now:()=>now,set:(run,delay)=>{timers.set(++id,{run,at:now+delay});return id},clear:id=>timers.delete(id)},waiting);
  return {scheduler,timers,hide(){visible=false;scheduler.wake()},show(){visible=true;scheduler.wake()},async advance(ms){const end=now+ms;while(true){const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;now=entry[1].at;timers.delete(entry[0]);entry[1].run();await Promise.resolve();await Promise.resolve()}now=end;await Promise.resolve()}};
}
test('transient failure retries with backoff and focus events share one flight',async()=>{
 let calls=0;const f=fixture(async()=>++calls>1);f.scheduler.wake();f.scheduler.wake();await f.advance(0);assert.equal(calls,1);await f.advance(14999);assert.equal(calls,1);await f.advance(1);assert.equal(calls,2);await f.advance(60000);assert.equal(calls,3);f.scheduler.stop();
});
test('hidden views stop timers; resume refreshes immediately and disposal stops scheduling',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return true});f.hide();await f.advance(180000);assert.equal(calls,0);f.show();await f.advance(0);assert.equal(calls,1);f.scheduler.stop();await f.advance(180000);assert.equal(calls,1);
});
test('a slow request cannot overlap or schedule work after disposal',async()=>{
 let finish,calls=0;const f=fixture(()=>{calls++;return new Promise(resolve=>finish=resolve)});await f.advance(60000);await f.advance(180000);f.scheduler.wake();assert.equal(calls,1);f.scheduler.stop();finish(true);await f.advance(0);assert.equal(f.timers.size,0);
});
test('first receipt polling backs off to the normal interval',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return true},true);await f.advance(15000);assert.equal(calls,1);await f.advance(30000);assert.equal(calls,2);await f.advance(60000);assert.equal(calls,3);f.scheduler.stop();
});
