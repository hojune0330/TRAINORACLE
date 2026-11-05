import {test} from 'node:test';
import assert from 'node:assert/strict';
import {expiryState} from './check-deployment-expiry.mjs';
test('deployment expiry alerts at 14/7/1 days and expired; invalid metadata fails',()=>{
  const expiry='2026-12-04T15:00:00Z',end=Date.parse(expiry);
  for(const [days,level] of [[15,'READY'],[14,'FOURTEEN_DAYS'],[7,'SEVEN_DAYS'],[1,'ONE_DAY'],[0,'EXPIRED']])assert.equal(expiryState(expiry,end-days*86400000).level,level);
  assert.throws(()=>expiryState('invalid'));
});
