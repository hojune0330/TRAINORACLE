import test from 'node:test';
import assert from 'node:assert/strict';
import { createWhoopReadonlyAdapter, WhoopReadonlyError } from '../functions/_shared/whoop-readonly.mjs';

// Synthetic fixtures only. No env tokens, real accounts, network or persistence.
const id = 'ecfc6a15-4661-442f-a9a4-f160dd7afae8';
const secret = 'synthetic-secret-token';
const fixture = () => ({ id, user_id: 9012, v1_id: 1043, sport_id: 1,
  created_at: '2022-04-24T11:25:44.774Z', updated_at: '2022-04-24T14:25:44.774Z',
  start: '2022-04-24T02:25:44.774Z', end: '2022-04-24T10:25:44.774Z',
  timezone_offset: '-05:00', sport_name: 'running', score_state: 'SCORED',
  score: { distance_meter: 1772.77035916, strain: 8.2463, average_heart_rate: 123,
    max_heart_rate: 146, kilojoule: 1569.34, percent_recorded: 100,
    zone_durations: { zone_one_milli: 100 }, note: 'private' },
  notes: 'private', location: { lat: 1 }, access_token: secret });
const json = value => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' } });
const credentials = async () => ({ accessToken: secret, scopes: ['read:workout'] });
const adapter = (fetchImpl, extra = {}) => createWhoopReadonlyAdapter({ getCredentials: credentials, fetchImpl, ...extra });
const code = expected => error => {
  assert.ok(error instanceof WhoopReadonlyError);
  assert.equal(error.code, expected);
  assert.equal(error.cause, undefined);
  assert.ok(!JSON.stringify(error).includes(secret));
  assert.ok(!error.message.includes(secret));
  assert.ok(!error.message.includes('private'));
  return true;
};

test('official v2 fields and nested privacy allowlist preserve workout start and metres', async () => {
  let calls = 0;
  const api = adapter(async (url, init) => {
    calls++;
    assert.equal(url, 'https://api.prod.whoop.com/developer/v2/activity/workout?limit=10');
    assert.equal(init.method, 'GET'); assert.equal(init.redirect, 'error');
    assert.equal(init.headers.Authorization, `Bearer ${secret}`);
    assert.ok(init.signal instanceof AbortSignal);
    return json({ records: [fixture()], next_token: 'opaque+/=' });
  });
  assert.deepEqual(await api.listWorkoutsPage(), {
    records: [{ id, start: fixture().start, end: fixture().end,
      created_at: fixture().created_at, updated_at: fixture().updated_at,
      timezone_offset: '-05:00', sport_name: 'running', score_state: 'SCORED',
      score: { distance_meter: 1772.77035916 } }],
    nextToken: 'opaque+/=', hasMore: true, coverage: 'single_page_only' });
  assert.equal(calls, 1);
});

test('explicit nextToken retains time bounds and never auto-collects or claims full history', async () => {
  const urls = [];
  const api = adapter(async url => { urls.push(new URL(url)); return json({ records: [], next_token: urls.length === 1 ? 'abc+/=' : '' }); });
  const query = { start: '2026-10-01T00:00:00Z', end: '2026-10-29T00:00:00Z', limit: 25 };
  const first = await api.listWorkoutsPage(query);
  assert.equal(urls.length, 1);
  const second = await api.listWorkoutsPage({ ...query, nextToken: first.nextToken });
  assert.equal(urls[1].searchParams.get('nextToken'), 'abc+/=');
  assert.equal(urls[1].searchParams.get('start'), query.start);
  assert.equal(urls[1].searchParams.get('end'), query.end);
  assert.deepEqual(second, { records: [], nextToken: null, hasMore: false, coverage: 'single_page_only' });
  assert.equal(second.complete, undefined);
});

test('absent next_token is terminal page only', async () => {
  assert.deepEqual(await adapter(async () => json({ records: [] })).listWorkoutsPage(),
    { records: [], nextToken: null, hasMore: false, coverage: 'single_page_only' });
});

test('optional distance stays absent, zero remains zero, unscored data is not promoted', async () => {
  for (const state of ['SCORED', 'PENDING_SCORE', 'UNSCORABLE']) {
    const raw = fixture(); raw.score_state = state; raw.score = {};
    assert.equal((await adapter(async () => json(raw)).getWorkout(id)).score, undefined);
  }
  const raw = fixture(); raw.score.distance_meter = 0;
  assert.equal((await adapter(async () => json(raw)).getWorkout(id)).score.distance_meter, 0);
});

test('UUID-only fixed official getWorkout GET verifies response identity', async () => {
  await adapter(async (url, init) => { assert.equal(url, `https://api.prod.whoop.com/developer/v2/activity/workout/${id}`); assert.equal(init.method, 'GET'); return json(fixture()); }).getWorkout(id);
  const raw = fixture(); raw.id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
  await assert.rejects(adapter(async () => json(raw)).getWorkout(id), code('INVALID_RESPONSE'));
  await assert.rejects(adapter(() => assert.fail()).getWorkout('https://evil.invalid/'), code('INVALID_ID'));
});

test('browser invocation is blocked before credentials or transport', () => {
  globalThis.window = {};
  try { assert.throws(() => adapter(() => assert.fail()), code('SERVER_ONLY')); }
  finally { delete globalThis.window; }
});

test('exact read:workout-only credentials and token header safety', async () => {
  for (const scopes of [[], ['read:profile'], ['read:workout', 'read:sleep'], ['read:workout', 'read:workout']]) {
    await assert.rejects(adapter(() => assert.fail(), { getCredentials: async () => ({ accessToken: secret, scopes }) }).listWorkoutsPage(), code('INVALID_CREDENTIALS'));
  }
  for (const accessToken of ['', 'x\r\nAuthorization: evil', 'x y']) {
    await assert.rejects(adapter(() => assert.fail(), { getCredentials: async () => ({ accessToken, scopes: ['read:workout'] }) }).listWorkoutsPage(), code('INVALID_CREDENTIALS'));
  }
});

test('credential callback receives narrow scope; raw failure never escapes', async () => {
  await assert.rejects(adapter(() => assert.fail(), { getCredentials: async request => {
    assert.equal(request.scope, 'read:workout'); assert.ok(request.signal instanceof AbortSignal);
    throw Error(`${secret} private`);
  } }).listWorkoutsPage(), code('CREDENTIALS_UNAVAILABLE'));
});

test('query SSRF, invalid dates, oversized cursor and limit rejected before credentials', async () => {
  const api = adapter(() => assert.fail(), { getCredentials: () => assert.fail() });
  for (const q of [null, [], { url: 'http://evil.invalid' }, { limit: 26 }, { limit: 0 }, { limit: 1.5 },
    { start: '2026-02-30T00:00:00Z' }, { start: '2026-01-01' }, { nextToken: 'a\nb' }, { nextToken: 'a'.repeat(4097) },
    { start: '2026-02-01T00:00:00Z', end: '2026-01-01T00:00:00Z' }]) {
    await assert.rejects(api.listWorkoutsPage(q), code('INVALID_QUERY'));
  }
});

for (const [status, expected] of [[302, 'REDIRECT_REJECTED'], [401, 'UNAUTHORIZED'], [403, 'UNAUTHORIZED'], [429, 'RATE_LIMITED'], [500, 'UPSTREAM_FAILURE']]) {
  test(`status ${status} never parses or exposes provider error body`, async () => {
    const response = new Response(`${secret} private`, { status });
    response.text = () => assert.fail('must not read body');
    await assert.rejects(adapter(async () => response).listWorkoutsPage(), code(expected));
    assert.equal(response.bodyUsed, true);
  });
}

test('transport error raw message and cause never escape', async () => {
  await assert.rejects(adapter(async () => { throw new Error(`${secret} private`, { cause: secret }); }).listWorkoutsPage(), code('TRANSPORT_FAILURE'));
});

test('redirected or wrong-origin transport response is rejected despite 200', async () => {
  const redirected = json({ records: [] }); Object.defineProperty(redirected, 'redirected', { value: true });
  await assert.rejects(adapter(async () => redirected).listWorkoutsPage(), code('REDIRECT_REJECTED'));
  const wrong = json({ records: [] }); Object.defineProperty(wrong, 'url', { value: 'https://evil.invalid' });
  await assert.rejects(adapter(async () => wrong).listWorkoutsPage(), code('REDIRECT_REJECTED'));
});

test('deadline bounds stalled credentials, fetch and body; abort signal fires', async () => {
  const never = () => new Promise(() => {});
  await assert.rejects(adapter(never, { getCredentials: never, timeoutMs: 10 }).listWorkoutsPage(), code('TIMEOUT'));
  let signal;
  await assert.rejects(adapter(async (_, init) => { signal = init.signal; return never(); }, { timeoutMs: 10 }).listWorkoutsPage(), code('TIMEOUT'));
  assert.equal(signal.aborted, true);
  const response = new Response(new ReadableStream({ start() {} }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(adapter(async () => response, { timeoutMs: 10 }).listWorkoutsPage(), code('TIMEOUT'));
});

test('bounded body rejects oversized declared and streamed lengths', async () => {
  const large = json({ records: [] }); large.headers.set('content-length', '1000000');
  await assert.rejects(adapter(async () => large, { maxBodyBytes: 32 }).listWorkoutsPage(), code('BODY_LIMIT'));
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(33)); }, cancel() { cancelled = true; } });
  await assert.rejects(adapter(async () => new Response(stream, { headers: { 'content-type': 'application/json' } }), { maxBodyBytes: 32 }).listWorkoutsPage(), code('BODY_LIMIT'));
  assert.equal(cancelled, true);
});

test('malformed JSON, non-JSON and invalid UTF8 safely rejected', async () => {
  for (const response of [new Response(`${secret} private`, { headers: { 'content-type': 'application/json' } }),
    new Response('<html>private</html>', { headers: { 'content-type': 'text/html' } }),
    new Response(new Uint8Array([255]), { headers: { 'content-type': 'application/json' } })]) {
    await assert.rejects(adapter(async () => response).listWorkoutsPage(), code('INVALID_RESPONSE'));
  }
});

test('invalid schema and pagination never return partial records', async () => {
  const mutations = [r => { r.id = 12; }, r => { delete r.start; }, r => { r.end = '2022-04-23T00:00:00Z'; },
    r => { r.score.distance_meter = -1; }, r => { r.score.distance_meter = '10'; }, r => { r.score.distance_meter = null; },
    r => { r.score_state = 'FUTURE_STATE'; }, r => { r.timezone_offset = 'Asia/Seoul'; }, r => { r.sport_name = ''; }];
  for (const mutate of mutations) { const raw = fixture(); mutate(raw);
    await assert.rejects(adapter(async () => json({ records: [fixture(), raw] })).listWorkoutsPage(), code('INVALID_RESPONSE'));
  }
  for (const raw of [{ records: {} }, { records: [], next_token: null }, { records: [fixture(), fixture()] }]) {
    await assert.rejects(adapter(async () => json(raw)).listWorkoutsPage({ limit: 1 }), code('INVALID_RESPONSE'));
  }
  await assert.rejects(adapter(async () => json({ records: [], next_token: 'same' })).listWorkoutsPage({ nextToken: 'same' }), code('INVALID_PAGINATION'));
});

test('configuration cannot disable timeout or byte bound', () => {
  for (const options of [{ timeoutMs: 0 }, { timeoutMs: Infinity }, { timeoutMs: 30001 }, { maxBodyBytes: 0 }, { maxBodyBytes: 1048577 }, { getCredentials: null }]) {
    assert.throws(() => adapter(async () => json({ records: [] }), options), code('INVALID_CONFIG'));
  }
});

test('uncooperative cancellation cannot extend deadline or error cleanup', async () => {
  const response = new Response(new ReadableStream({ cancel() { return new Promise(() => {}); } }), { status: 401 });
  await assert.rejects(adapter(async () => response, { timeoutMs: 10 }).listWorkoutsPage(), code('UNAUTHORIZED'));
  const streamed = new Response(new ReadableStream({ start(c) { c.enqueue(new Uint8Array(33)); }, cancel() { return new Promise(() => {}); } }), { headers: { 'content-type': 'application/json' } });
  await assert.rejects(adapter(async () => streamed, { maxBodyBytes: 32, timeoutMs: 10 }).listWorkoutsPage(), code('BODY_LIMIT'));
});

test('forged adapter error cannot put provider text into public error code', async () => {
  await assert.rejects(adapter(async () => { throw new WhoopReadonlyError(`${secret} private`); }).listWorkoutsPage(), code('TRANSPORT_FAILURE'));
});

test('late uncooperative fetch responses are cancelled after the caller deadline', async () => {
  let resolveFetch; let started = false; let cancelled = false;
  const api = adapter(() => { started = true; return new Promise(resolve => { resolveFetch = resolve; }); }, { timeoutMs: 10 });
  await assert.rejects(api.listWorkoutsPage(), code('TIMEOUT'));
  assert.equal(started, true);
  resolveFetch(new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'content-type': 'application/json' } }));
  await new Promise(resolve => setTimeout(resolve, 0));
  assert.equal(cancelled, true);
});
