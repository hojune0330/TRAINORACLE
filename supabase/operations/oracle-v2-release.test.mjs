import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AUTH_MIGRATIONS, loadMigrations, planRelease, renderApplySql, provisionComparisonKey, SECRET_NAME } from './oracle-v2-release.mjs';

const projectRef='abcdefghijklmnopqrst';
const migrations=loadMigrations();
const source=migrations.filter(m=>m.version>='0058' && m.version<='0061');
function inventory(applied=0) {
  return {projectRef,snapshot:{ledger:[
    ...migrations.filter(m=>m.version<='0050').map(({version,name})=>({version,name,sourceHash:null})),
    ...AUTH_MIGRATIONS.map(m=>({version:m.slice(0,4),name:m.slice(5),sourceHash:null})),
    ...source.slice(0,applied).map(({version,name,sourceHash})=>({version,name,sourceHash})),
  ],functions:[],schemaHash:'a'.repeat(32),capabilities:source.map((_,i)=>i<applied),comparisonTables:applied===4?5:0}};
}

test('preserves auth and purpose consent 0051 through 0057 and stages only Oracle 0058 through 0061',()=>{
  const plan=planRelease(inventory(),projectRef);
  assert.deepEqual(plan.migrations.map(m=>m.targetVersion),['0058','0059','0060','0061']);
  const sql=renderApplySql(plan);
  assert.match(sql,/ORACLE_RELEASE_INVENTORY_DRIFT/);
  assert.match(sql,/lock table supabase_migrations.schema_migrations/);
  assert.match(sql,/begin;\nset local search_path = pg_catalog;/);
  assert.ok(sql.endsWith('commit;\n'));
  assert.doesNotMatch(sql,/create or replace function public.claim_beta_seat/);
});
test('partial prefix stages exact missing SQL, fully applied stages no migration',()=>{
  assert.deepEqual(planRelease(inventory(2),projectRef).migrations.map(m=>m.version),['0060','0061']);
  assert.equal(planRelease(inventory(4),projectRef).migrations.length,0);
});
test('refuses collisions, missing auth, unknown applied contents and missing ledger evidence',()=>{
  const collision=inventory(); collision.snapshot.ledger.push({version:'0058',name:'other'});
  assert.throws(()=>planRelease(collision,projectRef),/MIGRATION_VERSION_COLLISION/);
  const missing=inventory(); missing.snapshot.ledger=missing.snapshot.ledger.filter(r=>r.version!=='0055');
  assert.throws(()=>planRelease(missing,projectRef),/AUTH_MIGRATIONS_REQUIRED/);
  const noConsent=inventory(); noConsent.snapshot.ledger=noConsent.snapshot.ledger.filter(r=>r.version!=='0057');
  assert.throws(()=>planRelease(noConsent,projectRef),/AUTH_MIGRATIONS_REQUIRED/);
  const changed=inventory(1); changed.snapshot.ledger.at(-1).sourceHash='b'.repeat(32);
  assert.throws(()=>planRelease(changed,projectRef),/APPLIED_SOURCE_UNPROVEN/);
  const noLedger=inventory(); noLedger.snapshot.capabilities[0]=true;
  assert.throws(()=>planRelease(noLedger,projectRef),/LEDGER_CAPABILITY_MISMATCH/);
  assert.throws(()=>planRelease(inventory(),'z'.repeat(20)),/PROJECT_MISMATCH/);
});
test('refuses out of order Oracle and partial comparison tables',()=>{
  const out=inventory();out.snapshot.ledger.push(source[1]);out.snapshot.capabilities[1]=true;
  assert.throws(()=>planRelease(out,projectRef),/NON_PREFIX_ORACLE_HISTORY/);
  const partial=inventory();partial.snapshot.comparisonTables=1;
  assert.throws(()=>planRelease(partial,projectRef),/PARTIAL_COMPARISON_SCHEMA/);
});

function keyHarness({edgeExists=false,dbExists=false,enabled=false,postFails=false}={}) {
  const statements=[], requests=[];
  const client={query:async(sql,params)=>{
    statements.push({sql,params:params?.map(p=>Buffer.isBuffer(p)?Buffer.from(p):p)});
    return {rows:sql.startsWith('select enabled')?[{enabled}]:sql.startsWith('select key_id')?(dbExists?[{key_id:'existing'}]:[]):[]};
  }};
  const request=async(url,init)=>{
    requests.push({url,init});
    return {ok:!(init.method==='POST'&&postFails),json:async()=>edgeExists?[{name:SECRET_NAME}]:[]};
  };
  return {client,request,statements,requests};
}
test('new comparison key is same 32 bytes in parameterized DB insert and private Edge request only',async()=>{
  const h=keyHarness();
  const receipt=await provisionComparisonKey(h.client,{projectRef},'test-token','new-key',h.request);
  const insert=h.statements.find(s=>s.sql.startsWith('insert'));
  const published=JSON.parse(JSON.parse(h.requests[1].init.body)[0].value);
  assert.equal(insert.params[1].length,32);
  assert.equal(insert.params[1].toString('base64'),published.key);
  assert.equal(published.keyId,'new-key');
  assert.doesNotMatch(JSON.stringify(receipt),new RegExp(published.key.replace(/[+]/g,'\\+')));
  assert.doesNotMatch(h.statements.map(s=>s.sql).join('\n'),/account_journal_gateway_keys|on conflict|user_private_profiles/);
  assert.equal(receipt.comparisonEnabled,false);
});
test('preserves existing Edge and DB keys and refuses enabled comparison',async()=>{
  for(const options of [{edgeExists:true},{dbExists:true},{enabled:true}]) {
    const h=keyHarness(options);
    await assert.rejects(()=>provisionComparisonKey(h.client,{projectRef},'test-token','existing',h.request));
    assert.ok(!h.statements.some(s=>s.sql.startsWith('insert')));
    assert.ok(!h.requests.some(r=>r.init.method==='POST'));
  }
});
test('uncertain Edge publication retains DB key and reports reconciliation without raw error',async()=>{
  const h=keyHarness({postFails:true});
  await assert.rejects(()=>provisionComparisonKey(h.client,{projectRef},'test-token','new-key',h.request),
    /DB_KEY_RETAINED_EDGE_OUTCOME_REQUIRES_OPERATOR_RECONCILIATION/);
  assert.ok(h.statements.some(s=>s.sql==='commit'));
  assert.ok(!h.statements.some(s=>/delete|update|rollback/i.test(s.sql) && !s.sql.includes('for update')));
});
