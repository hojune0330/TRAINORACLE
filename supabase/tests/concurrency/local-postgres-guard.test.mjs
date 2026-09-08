import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTarget, childEnvironment, literal } from './local-postgres.mjs';

const valid = { host: '127.0.0.1', port: 55001, database: 'trainoracle_concurrency_test_0123456789abcdef', user: 'trainoracle_test_admin' };
test('connection guard accepts only generated loopback synthetic targets', () => {
  assert.doesNotThrow(() => validateTarget(valid));
  for (const host of ['localhost', '::1', '0.0.0.0', '127.0.0.2', 'db.supabase.co', '/tmp', '127.0.0.1.evil'])
    assert.throws(() => validateTarget({ ...valid, host }));
  for (const database of ['postgres', 'template1', 'production', 'trainoracle', 'trainoracle_concurrency_test_',
    'postgresql://127.0.0.1/test', 'trainoracle_concurrency_test_0123456789abcdef;drop'])
    assert.throws(() => validateTarget({ ...valid, database }));
  for (const port of [5432, 0, -1, 65536, '55001', 55001.5])
    assert.throws(() => validateTarget({ ...valid, port }));
  assert.throws(() => validateTarget({ ...valid, user: 'postgres' }));
});
test('child processes receive no inherited connection, password or service environment', () => {
  const env = childEnvironment('C:\\synthetic-bin', 'C:\\synthetic-temp');
  assert.deepEqual(Object.keys(env).sort(), ['ComSpec', 'LC_ALL', 'PATH', 'PGAPPNAME', 'PGPASSFILE', 'PGSERVICEFILE',
    'SystemRoot', 'TEMP', 'TMP', 'WINDIR'].sort());
  assert.ok(env.PATH.startsWith('C:\\synthetic-bin'));
  assert.ok(env.PGPASSFILE.endsWith('absent.pgpass'));
  assert.ok(env.PGSERVICEFILE.endsWith('absent.pg_service.conf'));
});
test('fixture SQL literal quoting cannot terminate a string', () => {
  assert.equal(literal("a'b"), "'a''b'");
  assert.equal(literal(null), 'NULL');
});
