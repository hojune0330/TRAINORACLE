import { after, before, beforeEach, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import { startCluster, literal } from './local-postgres.mjs';
import { A, bootstrap, prepareSession, resetFixture, login, plan, index, commit, signed,
  stage, mutate, readIndex, readReceipt } from './fixture.mjs';

const args = process.argv.slice(2);
const run = args.includes('--run');
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : null;
const selected = option('--case'), mutation = option('--mutation');
const cases = ['wait-date', 'nested-date', 'replay', 'signature'];
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--run') continue;
  assert.ok(['--pg-bin', '--case', '--mutation'].includes(args[i]), 'Only local test options are accepted');
  assert.ok(args[++i] && !args[i].startsWith('--'), 'Missing option value');
}
assert.ok(!selected || cases.includes(selected), 'Unknown test case');
assert.ok(!mutation || ['calendar-guards', 'post-calendar'].includes(mutation), 'Unknown mutation');
let cluster, admin, left, right, pids, today, tomorrow, beforeIndex, body;

before(async () => {
  if (!run) return;
  assert.ok(option('--pg-bin'), 'Explicit local --pg-bin is required');
  cluster = await startCluster(option('--pg-bin'));
  admin = cluster.connect(); left = cluster.connect(); right = cluster.connect();
  await bootstrap(admin);
  await admin.query(await readFile(new URL('../../migrations/0040_execution_replan_journal_guard.sql', import.meta.url), 'utf8'));
  let sql = await readFile(new URL('../../migrations/0041_catalog_replacement_calendar_guard.sql', import.meta.url), 'utf8');
  const guard = "to_char(clock_timestamp() at time zone (calendar->>'timeZone'),'YYYY-MM-DD') is distinct from calendar->>'today'";
  assert.equal(sql.split(guard).length - 1, 2, 'Both production clock guards must be located before modifying in-memory bytes');
  if (mutation === 'calendar-guards') sql = sql.replaceAll(guard, 'false');
  if (mutation === 'post-calendar') {
    const post = `and ${guard}`;
    assert.equal(sql.split(post).length - 1, 1);
    sql = sql.replace(post, 'and false');
  }
  await admin.query(`create table public.fixture_calendar_clock_state(instant timestamptz not null, nested_rollover boolean not null);
    insert into public.fixture_calendar_clock_state values(clock_timestamp(),false);
    create function public.fixture_calendar_clock() returns timestamptz language plpgsql volatile as $$
    declare instant_value timestamptz; nested boolean; calls integer;
    begin
      select instant,nested_rollover into instant_value,nested from public.fixture_calendar_clock_state;
      if nested then
        calls := coalesce(nullif(current_setting('review.catalog_clock_calls',true),''),'0')::integer;
        perform set_config('review.catalog_clock_calls',(calls+1)::text,true);
        if calls>0 then return instant_value + interval '1 day'; end if;
      end if;
      return instant_value;
    end; $$;`);
  // Only the two date clock reads are replaced in this fresh test DB. Production SQL bytes are untouched.
  await admin.query(sql.replaceAll('clock_timestamp()', 'public.fixture_calendar_clock()'));
  for (const session of [left, right]) {
    await prepareSession(session);
    await session.query(`create function pg_temp.submit_calendar(request text, signature text, key_id text)
      returns jsonb language plpgsql security invoker as $$
      begin return public.mutate_account_plan_catalog_replacement_attested(request,signature,key_id);
      exception when others then return jsonb_build_object('sqlstate',SQLSTATE); end; $$;`);
  }
  pids = [];
  for (const session of [admin, left, right]) pids.push(await session.value('pg_backend_pid()'));
  assert.equal(new Set(pids).size, 3, 'Observer and two independent PostgreSQL writer sessions');
  console.log(`Independent backends: observer=${pids[0]}, left=${pids[1]}, right=${pids[2]}`);
}, { timeout: 120000 });

beforeEach(async () => {
  if (!run) return;
  for (const session of [admin, left, right]) await session.query('rollback;');
  await resetFixture(admin);
  await admin.query('update public.fixture_calendar_clock_state set instant=clock_timestamp(),nested_rollover=false;');
  today = await admin.value("(select to_char(instant at time zone 'UTC','YYYY-MM-DD') from public.fixture_calendar_clock_state)");
  tomorrow = await admin.value("(select to_char((instant + interval '1 day') at time zone 'UTC','YYYY-MM-DD') from public.fixture_calendar_clock_state)");
  await login(left); await login(right);
  const p = plan('calendar-guard');
  await stage(left, p);
  assert.equal((await mutate(left, 'planCommit', commit(index([p], p.planId)))).kind, 'committed');
  beforeIndex = await readIndex(left);
  body = { ...commit(beforeIndex.index_document, beforeIndex), journalGuard: [], calendarGuard: { today, timeZone: 'UTC' } };
});
after(async () => { if (cluster) await cluster.stop(); }, { timeout: 45000 });

const check = (id, name, fn) => test(`${id}: ${name}`, {
  skip: !run ? 'Opt-in local PostgreSQL only' : Boolean(selected && selected !== id), timeout: 45000,
}, fn);
const submit = (session, signedRequest) => session.value(`pg_temp.submit_calendar(${signedRequest.map(literal).join(',')})`);
const receiptCount = () => admin.value('(select count(*)::int from public.account_plan_collection_receipts)');
async function waitBlocked(waiting) {
  const deadline = Date.now() + 4000;
  do {
    const state = await admin.value(`(select jsonb_build_object('blockers',pg_blocking_pids(pid),
      'event',wait_event,'type',wait_event_type) from pg_stat_activity where pid=${waiting})`);
    if (state?.blockers.includes(pids[0]) && state.type === 'Lock' && state.event === 'advisory') {
      console.log(`Observed advisory wait: ${waiting} blocked by ${pids[0]}`);
      return;
    }
    await delay(20);
  } while (Date.now() < deadline);
  assert.fail('Expected actual advisory lock wait was not observed');
}
const blockOwner = () => admin.query(`begin; select pg_advisory_xact_lock(hashtextextended('account_journal_v2:${A}',0));`);

check('wait-date', 'calendar rollover while a real writer waits rejects the commit without changing index or receipt', async () => {
  await blockOwner();
  const pending = submit(right, signed('planCommit', body)); pending.catch(() => {});
  try {
    await waitBlocked(pids[2]);
    await admin.query("update public.fixture_calendar_clock_state set instant=instant + interval '1 day';");
  } finally {
    await admin.query('commit;');
  }
  assert.deepEqual(await pending, { sqlstate: 'PT409' });
  assert.deepEqual(await readIndex(left), beforeIndex);
  assert.equal(await readReceipt(left, body.operationId), null);
  assert.equal(await receiptCount(), 1);
  // Explicitly re-prepared calendar input remains accepted; blanket rejection would fail this control.
  const current = { ...body, calendarGuard: { today: tomorrow, timeZone: 'UTC' } };
  assert.equal((await submit(right, signed('planCommit', current))).kind, 'committed');
  assert.equal((await readIndex(left)).revision, 2);
});

check('nested-date', 'rollover after nested SQL commit rolls back the entire new index and receipt', async () => {
  await admin.query('update public.fixture_calendar_clock_state set nested_rollover=true;');
  assert.deepEqual(await submit(right, signed('planCommit', body)), { sqlstate: 'PT409' });
  assert.deepEqual(await readIndex(left), beforeIndex);
  assert.equal(await readReceipt(left, body.operationId), null);
  assert.equal(await receiptCount(), 1);
  await admin.query('update public.fixture_calendar_clock_state set nested_rollover=false;');
  assert.equal((await submit(right, signed('planCommit', body))).kind, 'committed');
  assert.equal((await readIndex(left)).revision, 2);
});

check('replay', 'two waiting requests with the same operation produce one receipt and next-day replay does not recommit', async () => {
  await blockOwner();
  const request = signed('planCommit', body);
  const first = submit(left, request), second = submit(right, request);
  first.catch(() => {}); second.catch(() => {});
  try { await waitBlocked(pids[1]); await waitBlocked(pids[2]); }
  finally { await admin.query('commit;'); }
  const accepted = await first;
  assert.equal(accepted.kind, 'committed');
  assert.deepEqual(await second, accepted);
  assert.equal((await readIndex(left)).revision, 2);
  assert.equal(await receiptCount(), 2);
  await admin.query("update public.fixture_calendar_clock_state set instant=instant + interval '1 day';");
  assert.deepEqual(await submit(right, signed('planCommit', body)), accepted);
  assert.equal((await readIndex(left)).revision, 2);
  assert.equal(await receiptCount(), 2);
});

check('signature', 'unsigned calendar changes and missing calendar input cannot bypass the guarded RPC', async () => {
  const request = signed('planCommit', body);
  const tampered = JSON.parse(request[0]); tampered.calendarGuard.today = tomorrow;
  assert.deepEqual(await submit(right, [JSON.stringify(tampered), request[1], request[2]]), { sqlstate: '42501' });
  const { calendarGuard: _calendar, ...withoutCalendar } = body;
  assert.deepEqual(await submit(right, signed('planCommit', withoutCalendar)), { sqlstate: '22023' });
  assert.equal((await readIndex(left)).revision, 1);
  assert.equal(await receiptCount(), 1);
  assert.equal((await submit(right, signed('planCommit', body))).kind, 'committed');
});
