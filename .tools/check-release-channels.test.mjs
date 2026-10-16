import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CHANNEL_URLS, checkReleaseChannels } from './check-release-channels.mjs';
const a = 'a'.repeat(40), b = 'b'.repeat(40);
function fixture(overrides = {}) {
  const values = { main: { sha: a }, legacy: { kind: 'TRAINORACLE_PAGES_DEPLOYMENT', sourceSha: a },
    web: { schemaVersion: 1, sourceRepository: 'hojune0330/TRAINORACLE', domain: 'https://trainoracle.io/', sourceSha: a, accountMode: 'off' },
    mobile: { schemaVersion: 1, sourceRepository: 'hojune0330/TRAINORACLE', appId: 'io.trainoracle.app', sourceSha: a, signingConfigured: false, storeUploadEnabled: false }, ...overrides };
  return async (url, options) => {
    assert.equal(options.credentials, 'omit'); assert.equal(options.redirect, 'error');
    const name = Object.keys(CHANNEL_URLS).find(key => CHANNEL_URLS[key] === url);
    assert.ok(name);
    return new Response(JSON.stringify(values[name]), { status: values[name] ? 200 : 503 });
  };
}
test('reports same source but never claims runtime, storage or store verification', async () => {
  const result = await checkReleaseChannels(fixture());
  assert.equal(result.aligned, true);
  assert.equal(result.authenticatedStorage, 'NOT_VERIFIED');
  assert.equal(result.channels[2].evidence, 'BUILD_CONFIG_NOT_STORE_RELEASE');
});
test('different sources are visible without asserting chronological freshness', async () => {
  const result = await checkReleaseChannels(fixture({ legacy: { kind: 'TRAINORACLE_PAGES_DEPLOYMENT', sourceSha: b } }));
  assert.equal(result.aligned, false); assert.equal(result.channels[0].status, 'DIFFERENT_SOURCE');
});
test('network, malformed SHA and wrong repository fail to unknown rather than success', async () => {
  const result = await checkReleaseChannels(fixture({ main: null, legacy: { sourceSha: 'bad' }, web: { sourceSha: a, sourceRepository: 'other' } }));
  assert.equal(result.aligned, false);
  assert.ok(result.channels.every(channel => channel.status === 'UNKNOWN'));
  assert.equal(result.channels[1].sourceSha, null);
});
test('does not print extra metadata from a public response', async () => {
  const result = await checkReleaseChannels(fixture({ legacy: { sourceSha: a, privateSentinel: 'never-echo' } }));
  assert.equal(JSON.stringify(result).includes('never-echo'), false);
});
