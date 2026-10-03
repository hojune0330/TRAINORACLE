import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

// Disposable, single-session PostgreSQL. No production connection or secrets.
const db = new PGlite({extensions:{pgcrypto}});
const root = new URL('../../migrations/',import.meta.url);
const lineEndingName = process.env.PACE_TEST_LINE_ENDING ?? 'CRLF';
const lineEnding = {LF:'\n',CRLF:'\r\n',CR:'\r'}[lineEndingName];
assert.ok(lineEnding, 'PACE_TEST_LINE_ENDING must be LF, CRLF or CR');
const owner = 'a1111111-1111-4111-8111-111111111111';
const key = Buffer.alloc(32,57);
const payload = {version:1,algorithm:'AES-GCM',keyId:'fixture',iv:Buffer.alloc(12).toString('base64'),ciphertext:Buffer.alloc(16).toString('base64')};
const metadata = kind => ({kind,occurrenceId:null,journalDate:null,eligible:false});
const request = (kind,extra={}) => ({documentId:randomUUID(),operationId:randomUUID(),expectedRevision:0,encryptedPayload:payload,metadata:metadata(kind),...extra});
const canonical = value => value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
    : `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
const hash = value => `sha256:${createHash('sha256').update(`trainoracle.account-plan.v1\0${canonical(value)}`).digest('hex')}`;
async function submit(body,action='commit',rpc='mutate_account_journal_attested') {
  const raw=JSON.stringify({domain:'trainoracle.account-journal.gateway.v1',ownerId:owner,action,expiresAt:Math.floor(Date.now()/1000)+90,...body});
  const signature=createHmac('sha256',key).update(raw).digest('hex');
  return (await db.query(`select public.${rpc}($1,$2,$3) result`,[raw,signature,'fixture'])).rows[0].result;
}
before(async()=>{
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema extensions;
    create table auth.users(id uuid primary key,aud text,role text,email text,created_at timestamptz,updated_at timestamptz);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    grant usage on schema auth to anon,authenticated,service_role;
    grant execute on all functions in schema auth to anon,authenticated,service_role;`);
  for(const file of readdirSync(root).filter(name=>/^\d+_.+\.sql$/.test(name)&&name<'0050'&&!/^(0038|0039|0041|0042)_/.test(name)).sort()) {
    let sql=readFileSync(new URL(file,root),'utf8');
    // Exercise stored function bodies independently of the checkout's line endings.
    if(file.startsWith('0044_')) sql=sql.replace(/\r\n|\r|\n/g,lineEnding);
    if(file.startsWith('0049_')) {
      const signature='public.mutate_account_plan_replan_attested(text,text,text)';
      const definition=async sig=>(await db.query('select pg_get_functiondef($1::regprocedure) source',[sig])).rows[0].source;
      const original=await definition(signature);
      assert.ok(original.includes(`'array'${lineEnding}    or jsonb_array_length`),
        `the replan anchor must contain ${lineEndingName}`);
      const journalSignature='public.mutate_account_journal_attested(text,text,text)';
      const journalBefore=await definition(journalSignature);
      if(lineEndingName !== 'LF') {
        // Kill the newline fix in memory: the original before-hook error must return.
        const normalization="source := replace(replace(source,E'\\r\\n',E'\\n'),E'\\r',E'\\n');";
        assert.equal(sql.split(normalization).length-1,2);
        await assert.rejects(()=>db.exec(sql.replaceAll(normalization,'')),
          /PACE_RECORD_COLLECTION_OPTIONAL_JOURNAL_ANCHOR_MISSING/);
        await db.exec('rollback');
        assert.equal(await definition(journalSignature),journalBefore);
        assert.equal(await definition(signature),original);
        assert.equal((await db.query("select to_regprocedure('public.verify_account_pace_record_revision(uuid,jsonb)') guard")).rows[0].guard,null);
      }
      const preflight=readFileSync(new URL('../../../reports/implementation/0046_pace_record_preflight.sql',import.meta.url),'utf8');
      const preflightChecks=async()=>(await db.exec(preflight)).flatMap(result=>result.rows);
      const checks=await preflightChecks();
      assert.ok(checks.length>0);
      assert.deepEqual(checks.filter(check=>check.passed!==true),[]);
      const anchor="jsonb_array_length(req->'journalGuard')>5000";
      assert.ok(original.includes(anchor));
      // A non-line-ending difference must still abort and roll back the whole migration.
      await db.exec(original.replace(anchor,"jsonb_array_length(req->'journalGuard') >5000"));
      assert.deepEqual((await preflightChecks()).filter(check=>!check.passed).map(check=>check.check_id),
        ['anchor.0046.optional_journal']);
      await assert.rejects(()=>db.exec(sql),/PACE_RECORD_COLLECTION_OPTIONAL_JOURNAL_ANCHOR_MISSING/);
      await db.exec('rollback');
      assert.equal((await db.query("select to_regprocedure('public.verify_account_pace_record_revision(uuid,jsonb)') guard")).rows[0].guard,null);
      assert.equal(await definition(journalSignature),journalBefore);
      await db.exec(original);
    }
    await db.exec(sql);
  }
  await db.query("insert into auth.users(id,created_at) values($1,'2020-01-01')",[owner]);
  await db.query(`insert into public.user_private_profiles(user_id,birth_date,privacy_policy_version,terms_of_service_version,legal_consented_at)
    values($1,'1990-01-01','fixture','fixture',clock_timestamp())`,[owner]);
  await db.query('insert into public.beta_enrollments(user_id) values($1)',[owner]);
  await db.exec("update public.service_feature_controls set enabled=true where feature_key in ('ACCOUNT','ACCOUNT_JOURNAL_V2','SYNC')");
  await db.query('insert into public.account_journal_gateway_keys(key_id,secret) values($1,$2)',['fixture',key]);
  await db.exec('set role authenticated');
  await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[owner,JSON.stringify({sub:owner,role:'authenticated'})]);
},{timeout:120000});
after(()=>db.close());
beforeEach(async()=>{
  await db.exec('reset role; truncate public.account_journal_history,public.account_journal_operations,public.account_journal_documents,public.account_journal_identity; set role authenticated;');
});

test('migration installs capability and preserves source revision for atomic plan changes',async()=>{
  assert.deepEqual(await submit({},'athleteRecordSupport'),{kind:'athlete-record-support',version:1});
  const records=request('ATHLETE_RECORDS');
  assert.equal((await submit(records)).kind,'saved');
  const plan=request('PLAN',{metadata:{...metadata('PLAN'),paceRecordDocumentId:records.documentId,paceRecordRevision:1}});
  assert.equal((await submit(plan)).kind,'saved');
  assert.equal((await submit({...records,operationId:randomUUID(),expectedRevision:1})).kind,'saved');
  assert.equal((await submit(plan)).kind,'saved'); // Lost response retry is the original receipt.
  await assert.rejects(()=>submit({...plan,operationId:randomUUID(),expectedRevision:1}),error=>error.code==='TD001');
  const fresh={...plan,operationId:randomUUID(),expectedRevision:1,metadata:{...plan.metadata,paceRecordRevision:2}};
  assert.equal((await submit(fresh)).kind,'saved');
  await submit({documentId:records.documentId,operationId:randomUUID(),expectedRevision:2},'delete');
  await assert.rejects(()=>submit({...fresh,operationId:randomUUID(),expectedRevision:2}),error=>error.code==='TD001');
});

test('source guards cannot be attached to unrelated document kinds',async()=>{
  await assert.rejects(()=>submit(request('ATHLETE_RECORDS',{metadata:{...metadata('ATHLETE_RECORDS'),paceRecordDocumentId:randomUUID(),paceRecordRevision:1}})),error=>error.code==='22023');
});

test('private guard cannot be called directly by an authenticated user',async()=>{
  await assert.rejects(()=>db.query('select public.verify_account_pace_record_revision($1,$2)',[owner,{}]),error=>error.code==='42501');
  for(const rpc of ['mutate_account_journal_attested','mutate_account_plan_replan_attested']) {
    await assert.rejects(()=>db.query(`select public.${rpc}($1,$2,$3)`,['{}','0'.repeat(64),'fixture']),
      error=>error.code==='42501');
  }
});

test('collection wrapper checks source revision before commit and preserves lost-ACK retries',async()=>{
  const records=request('ATHLETE_RECORDS');
  await submit(records);
  const index={version:1,kind:'PLAN_COLLECTION',documentFingerprint:hash({synthetic:true}),currentPlanId:null,plans:[]};
  const body={operationId:randomUUID(),expectedRevision:0,previousIndexFingerprint:null,previousCurrentPlanId:null,index,legacy:null};
  const guarded={...body,indexFingerprint:hash(index),requestFingerprint:hash({ownerId:owner,...body}),payload,journalGuard:[],
    paceRecordGuard:{documentId:records.documentId,revision:1}};
  await submit({...records,operationId:randomUUID(),expectedRevision:1});
  const rpc='mutate_account_plan_replan_attested';
  assert.deepEqual(await submit(guarded,'planCommit',rpc),{kind:'conflict'});
  guarded.paceRecordGuard.revision=2;
  guarded.journalGuard=[{documentId:randomUUID(),revision:1}];
  assert.deepEqual(await submit(guarded,'planCommit',rpc),{kind:'conflict'});
  delete guarded.journalGuard; // Initial record-based selection has no journal guard.
  const {paceRecordGuard: ignoredGuard,...unguarded}=guarded;
  await assert.rejects(()=>submit(unguarded,'planCommit',rpc),error=>error.code==='22023');
  assert.equal((await submit(guarded,'planCommit',rpc)).kind,'committed');
  await submit({...records,operationId:randomUUID(),expectedRevision:2});
  assert.equal((await submit(guarded,'planCommit',rpc)).kind,'committed');
});
