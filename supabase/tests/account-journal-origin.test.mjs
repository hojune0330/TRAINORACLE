import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {stripTypeScriptTypes} from 'node:module';
import {createAccountJournalHandler} from '../functions/_shared/account-journal-handler.mjs';

const canonical = 'https://trainoracle.io';
const existing = 'https://journal.example.test';
async function entrypoint(environment) {
  const source = await readFile(new URL('../functions/account-journal/index.ts', import.meta.url), 'utf8');
  const executable = stripTypeScriptTypes(source.replace(/^import[\s\S]*?;\r?\n/gm, ''));
  let handler;
  const untouched = () => { throw new Error('CORS must not read account data or keys'); };
  new Function('Deno', 'createClient', 'createAccountJournalHandler', 'validateAccountJournalDocument', executable)(
    {env: {get: name => environment[name]}, serve: value => { handler = value; }},
    untouched, createAccountJournalHandler, untouched,
  );
  return origin => handler(new Request('https://gateway.example.test/account-journal', {
    method: 'OPTIONS', headers: {Origin: origin, 'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'authorization,apikey,content-type,x-trainoracle-storage-revision'},
  }));
}

test('journal entrypoint adds canonical origin while preserving existing exact origins', async () => {
  const request = await entrypoint({TRAINORACLE_JOURNAL_ALLOWED_ORIGINS: ` ${existing}, ${existing} `,
    TRAINORACLE_CANONICAL_ORIGIN: canonical});
  for (const origin of [existing, canonical]) {
    const response = await request(origin);
    assert.equal(response.status, 204, origin);
    assert.equal(response.headers.get('access-control-allow-origin'), origin);
  }
  const denied = await request('https://trainoracle.io.attacker.example');
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('journal canonical origin remains optional and cannot bypass exact-origin validation', async () => {
  for (const value of [undefined, '', '*', `${canonical}/path`, `${canonical}?query=1`, `${canonical},https://attacker.example`]) {
    const request = await entrypoint({TRAINORACLE_JOURNAL_ALLOWED_ORIGINS: existing,
      TRAINORACLE_CANONICAL_ORIGIN: value});
    assert.equal((await request(existing)).status, 204);
    assert.equal((await request(canonical)).status, 403, String(value));
  }
  assert.equal((await (await entrypoint({}))(existing)).status, 403);
});
