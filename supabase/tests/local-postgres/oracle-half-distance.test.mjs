import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

test('half distance migration preserves legacy records, consent checks and function privileges', async () => {
  const db = new PGlite();
  try {
    const base = await readFile(new URL('../../migrations/0031_friend_oracle_comparison.sql', import.meta.url), 'utf8');
    await db.exec(base.slice(0, base.indexOf('create table if not exists')));
    const state = async () => (await db.query("select proacl,prosecdef,proconfig from pg_proc where oid='public.oracle_comparison_snapshot_is_safe(jsonb)'::regprocedure")).rows[0];
    const before = await state();
    const payload = distance => ({ schemaVersion: 1, sharedFields: ['BEST_RECORD'],
      record: { eventDistanceM: distance, bestSeconds: 5400 }, recent8WeekDistanceKm: null,
      structuredSessionCount: null, energySessionCounts: [] });
    const safe = async value => (await db.query('select public.oracle_comparison_snapshot_is_safe($1::jsonb) as safe', [JSON.stringify(value)])).rows[0].safe;
    assert.equal(await safe(payload(21097.5)), false, 'baseline reproduces the rejected half record');
    const migration = await readFile(new URL('../../migrations/0050_oracle_half_distance.sql', import.meta.url), 'utf8');
    await db.exec(migration);
    for (const distance of [800, 5000, 21097, 21097.5, 42195]) assert.equal(await safe(payload(distance)), true);
    for (const distance of [59, 800.5, 21097.6]) assert.equal(await safe(payload(distance)), false);
    assert.equal(await safe({ ...payload(21097.5), sharedFields: [] }), false);
    assert.equal(await safe({ ...payload(21097.5), privateMemo: 'synthetic' }), false);
    assert.deepEqual(await state(), before);
    await assert.rejects(db.exec(migration), /ORACLE_HALF_DISTANCE_ANCHOR_MISMATCH/);
    await db.exec('rollback');
    assert.equal(await safe(payload(21097.5)), true);
  } finally { await db.close(); }
});
