import {test} from 'node:test';
import assert from 'node:assert/strict';
import {allCandidatesDistinct} from './distinct-activity.mjs';
const row={user_id:'owner',connection_id:'connection',epoch:'epoch',activity_hash:'current'};
const observation={sourceId:'2',startedAt:'2026-11-04T10:00:00Z',durationSeconds:3600,durationMeaning:'UNKNOWN'};
const source={monitoringPeriod:{basis:'GARMIN_MONITORING_PERIOD',seconds:3600}};
const other={...row,activity_hash:'other',document_id:'document',state:'CONFIRMED'};
const candidates=[{active:true,documentId:'document',documentRevision:1,source:other}];
const decode=async()=>({...observation,sourceId:'1',startedAt:'2026-11-04T01:00:00Z'});
test('Starter monitoring span separates sessions without redefining UNKNOWN as timer or elapsed',async()=>{
  assert.equal(await allCandidatesDistinct(row,observation,source,candidates,decode,async()=>source),true);
  assert.equal(observation.durationMeaning,'UNKNOWN');
});
test('overlap, old epochs, same identity, file/memo candidates, tombstones and incomplete comparison stay in review',async()=>{
  for(const candidate of [{...candidates[0],source:null},{...candidates[0],active:false},{...candidates[0],source:{...other,epoch:'old'}},{...candidates[0],source:{...other,activity_hash:'current'}}])
    assert.equal(await allCandidatesDistinct(row,observation,source,[candidate],decode,async()=>source),false);
  assert.equal(await allCandidatesDistinct(row,observation,source,candidates,async()=>({...observation,sourceId:'1'}),async()=>source),false);
  assert.equal(await allCandidatesDistinct(row,observation,source,candidates,decode,async()=>null),false);
  assert.equal(await allCandidatesDistinct(row,observation,source,Array(65).fill(candidates[0]),decode,async()=>source),false);
});
