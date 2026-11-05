import assert from 'node:assert/strict';
import {createHash, randomUUID, webcrypto} from 'node:crypto';
import {readFile, readdir, rm} from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import {fileURLToPath} from 'node:url';
import {buildPagesArtifact} from './build-pages-artifact.mjs';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const tmpDirectory = path.join(repository, 'tmp');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
async function artifact(t, includeIndex = false) {
  const output = path.join(tmpDirectory, `pages-artifact-test-${randomUUID()}`);
  t.after(async () => {
    assert.equal(path.dirname(path.resolve(output)), tmpDirectory);
    await rm(output, {recursive: true, force: true});
  });
  return buildPagesArtifact({outputDirectory: output, includeIndex});
}

// Independently read central-directory offsets and compare local records. The
// Node zlib CRC implementation also validates the writer's CRC calculation.
async function readZip(bytes) {
  const {crc32} = await import('node:zlib');
  const end = bytes.length - 22;
  assert.equal(bytes.readUInt32LE(end), 0x06054b50);
  assert.equal(bytes.readUInt16LE(end + 4), 0);
  assert.equal(bytes.readUInt16LE(end + 6), 0);
  assert.equal(bytes.readUInt16LE(end + 20), 0);
  const count = bytes.readUInt16LE(end + 10), result = new Map();
  assert.equal(bytes.readUInt16LE(end + 8), count);
  let cursor = bytes.readUInt32LE(end + 16);
  assert.equal(cursor + bytes.readUInt32LE(end + 12), end);
  for (let index = 0; index < count; index++) {
    assert.equal(bytes.readUInt32LE(cursor), 0x02014b50);
    assert.equal(bytes.readUInt16LE(cursor + 10), 0); // STORE
    const checksum = bytes.readUInt32LE(cursor + 16), size = bytes.readUInt32LE(cursor + 20);
    assert.equal(bytes.readUInt32LE(cursor + 24), size);
    const nameLength = bytes.readUInt16LE(cursor + 28);
    assert.equal(bytes.readUInt16LE(cursor + 30), 0);
    assert.equal(bytes.readUInt16LE(cursor + 32), 0);
    const name = bytes.subarray(cursor + 46, cursor + 46 + nameLength).toString('ascii');
    const local = bytes.readUInt32LE(cursor + 42);
    assert.equal(bytes.readUInt32LE(local), 0x04034b50);
    assert.equal(bytes.readUInt16LE(local + 8), 0);
    assert.equal(bytes.readUInt32LE(local + 14), checksum);
    assert.equal(bytes.readUInt32LE(local + 18), size);
    assert.equal(bytes.readUInt16LE(local + 26), nameLength);
    assert.equal(bytes.readUInt16LE(local + 28), 0);
    assert.equal(bytes.subarray(local + 30, local + 30 + nameLength).toString('ascii'), name);
    const content = bytes.subarray(local + 30 + nameLength, local + 30 + nameLength + size);
    assert.equal(crc32(content), checksum);
    assert.equal(result.has(name), false);
    result.set(name, content);
    cursor += 46 + nameLength;
  }
  assert.equal(cursor, end);
  return result;
}

test('Pages ZIP preserves reviewed bytes and only includes explicit public files', async t => {
  const receipt = await artifact(t);
  const source = await readFile(new URL('./worker-bundle.mjs', import.meta.url));
  const zip = await readFile(receipt.zipPath), entries = await readZip(zip);
  assert.deepEqual([...entries.keys()], ['_worker.js', '_routes.json']);
  assert.deepEqual(entries.get('_worker.js'), source);
  assert.equal(receipt.workerSha256, hash(source));
  assert.equal(receipt.copiedWorkerSha256, receipt.workerSha256);
  assert.equal(receipt.zipSha256, hash(zip));
  assert.deepEqual(JSON.parse(entries.get('_routes.json')), {version: 1, include: ['/*'], exclude: []});
  assert.deepEqual((await readdir(receipt.uploadDirectory)).sort(), ['_routes.json', '_worker.js']);
  assert.equal(receipt.runtimeConfigurationIncluded, false);
  assert.equal(receipt.cloudflareDeploymentVerified, false);
  const repeat = await artifact(t);
  assert.equal(repeat.zipSha256, receipt.zipSha256);
});

test('output cannot escape tmp or overwrite an existing artifact', async t => {
  await assert.rejects(buildPagesArtifact({outputDirectory: 'server/garmin-ingress'}), /new direct child/);
  await assert.rejects(buildPagesArtifact({outputDirectory: 'tmp/../outside'}), /new direct child/);
  await assert.rejects(buildPagesArtifact({outputDirectory: 'tmp'}), /new direct child/);
  const receipt = await artifact(t), before = await readFile(receipt.zipPath);
  await assert.rejects(buildPagesArtifact({outputDirectory: path.dirname(receipt.zipPath)}), {code: 'EEXIST'});
  assert.deepEqual(await readFile(receipt.zipPath), before);
});

test('optional index is operational guidance; the exact artifact Worker never serves assets', async t => {
  const receipt = await artifact(t, true), entries = await readZip(await readFile(receipt.zipPath));
  assert.deepEqual([...entries.keys()], ['_worker.js', '_routes.json', 'index.html']);
  assert.match(entries.get('index.html').toString(), /연결 성공, 기록 수신, 저장 완료 또는 서비스 정상 동작을 증명하지 않습니다/);
  const {default: worker} = await import(`data:text/javascript;base64,${entries.get('_worker.js').toString('base64')}`);
  let assetsCalled = false;
  const env = {
    TRAINORACLE_GARMIN_INGRESS_KEY_ID: 'synthetic-pages-v1',
    TRAINORACLE_GARMIN_INGRESS_AUDIENCE: 'synthetic-pages-origin',
    TRAINORACLE_GARMIN_INGRESS_SECRET_HEX: 'ab'.repeat(32),
    TRAINORACLE_GARMIN_INGRESS_PUBLIC_URL: 'https://synthetic-ingress.pages.dev/webhooks/garmin',
    TRAINORACLE_GARMIN_INGRESS_ORIGIN_URL: 'https://synthetic-origin.example.test/webhooks/garmin',
    ASSETS: {fetch() { assetsCalled = true; throw new Error('Unexpected static fallback'); }},
  };
  for (const pathname of ['/', '/index.html', '/_worker.js', '/_routes.json']) {
    const response = await worker.fetch(new Request(`https://synthetic-ingress.pages.dev${pathname}`), env);
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {error: 'INGRESS_ACCESS_DENIED'});
  }
  assert.equal(assetsCalled, false);
  const missingConfig = await worker.fetch(new Request('https://synthetic-ingress.pages.dev/'), {});
  assert.equal(missingConfig.status, 503);
  assert.deepEqual(await missingConfig.json(), {error: 'INGRESS_CONFIGURATION_PENDING'});
});

test('artifact module signs synthetic direct-origin bytes and blocks spoofed source metadata', async t => {
  const receipt = await artifact(t), entries = await readZip(await readFile(receipt.zipPath));
  const {createGarminIngressWorker} = await import(`data:text/javascript;base64,${entries.get('_worker.js').toString('base64')}`);
  const publicUrl = 'https://synthetic-ingress.pages.dev/webhooks/garmin';
  const originUrl = 'https://synthetic-origin.example.test/webhooks/garmin';
  const source = Buffer.from('{"activities":[]}'), secretHex = 'ab'.repeat(32);
  const forwards = [];
  const worker = createGarminIngressWorker({keyId: 'synthetic-v1', audience: 'synthetic-origin', secretHex, publicUrl, originUrl}, {
    cryptoImpl: webcrypto, now: () => Date.parse('2026-11-05T00:00:00Z'),
    fetchImpl: async (url, options) => { forwards.push({url, options}); return Response.json({private: 'not-reflected'}); },
  });
  const request = ({cf = true, headers = {}, url = publicUrl} = {}) => {
    const value = new Request(url, {method: 'POST', body: source, headers: {'content-type': 'application/json', 'cf-connecting-ip': '204.77.162.1', 'authorization': 'Bearer synthetic-never-forward', ...headers}});
    if (cf) Object.defineProperty(value, 'cf', {value: {colo: 'ICN'}});
    return value;
  };
  const response = await worker.fetch(request());
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {accepted: true});
  assert.equal(forwards.length, 1);
  const forwarded = forwards[0];
  assert.equal(forwarded.url, originUrl);
  assert.deepEqual(Buffer.from(forwarded.options.body), source);
  assert.equal(forwarded.options.headers.get('authorization'), null);
  assert.equal(forwarded.options.headers.get('cf-connecting-ip'), null);
  assert.equal(forwarded.options.headers.get('x-trainoracle-ingress-body-sha256'), hash(source));
  assert.match(forwarded.options.headers.get('x-trainoracle-ingress-signature'), /^[a-f0-9]{64}$/);
  assert.equal(forwarded.options.redirect, 'error');
  assert.equal(forwarded.options.credentials, 'omit');
  for (const options of [{cf: false}, {headers: {'cf-worker': 'another.example'}}, {headers: {'x-real-ip': '204.77.162.1'}}, {headers: {'cf-connecting-ip': '192.0.2.1'}}, {url: 'https://preview.synthetic-ingress.pages.dev/webhooks/garmin'}]) {
    const denied = await worker.fetch(request(options));
    assert.equal(denied.status, 403);
  }
  assert.equal(forwards.length, 1);
});
