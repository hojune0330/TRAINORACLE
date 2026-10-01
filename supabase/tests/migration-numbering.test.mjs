import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';

test('parallel migrations have unique version prefixes', async () => {
  const names = (await readdir(new URL('../migrations/', import.meta.url)))
    .filter(name => /^\d+_.+\.sql$/.test(name));
  const versions = new Map();
  for (const name of names) {
    const version = name.split('_')[0];
    assert.equal(versions.has(version), false, `Duplicate migration version: ${versions.get(version)} and ${name}`);
    versions.set(version, name);
  }
  assert.ok(names.length > 0);
});
