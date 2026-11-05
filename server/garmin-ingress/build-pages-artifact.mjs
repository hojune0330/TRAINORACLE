import {createHash} from 'node:crypto';
import {lstat, mkdir, readFile, realpath, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const repository = fileURLToPath(new URL('../../', import.meta.url));
const bundlePath = fileURLToPath(new URL('./worker-bundle.mjs', import.meta.url));
const tmpDirectory = path.join(repository, 'tmp');
const digest = value => createHash('sha256').update(value).digest('hex');
const routes = Buffer.from(`${JSON.stringify({version: 1, include: ['/*'], exclude: []}, null, 2)}\n`);
const operationalIndex = Buffer.from(`<!doctype html>
<html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex,nofollow"><title>TrainOracle 기록 수신 안내</title>
<main><h1>TrainOracle 기록 수신 전용 주소</h1>
<p>이 주소는 승인된 Garmin 전송 요청을 받는 데 사용합니다. 사용자 로그인이나 기록 조회 화면이 아닙니다.</p>
<p>이 안내 파일은 연결 성공, 기록 수신, 저장 완료 또는 서비스 정상 동작을 증명하지 않습니다.</p>
<p>앱은 <a href="https://trainoracle.io/">trainoracle.io</a>에서 이용할 수 있습니다.</p></main></html>
`);

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit++) value = (value >>> 1) ^ (value & 1 ? 0xedb88320 : 0);
  }
  return (value ^ 0xffffffff) >>> 0;
}

// Bounded ZIP STORE writer: only the fixed, tiny allowlist below. Fixed DOS date
// and no comments/extras make identical source bytes produce identical archives.
function zipEntries(entries) {
  const local = [], central = [];
  let offset = 0;
  for (const {name, bytes} of entries) {
    const filename = Buffer.from(name, 'ascii'), checksum = crc32(bytes);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x21, 12); // 1980-01-01
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(bytes.length, 18);
    header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x21, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    local.push(header, filename, bytes);
    central.push(directory, filename);
    offset += header.length + filename.length + bytes.length;
  }
  const centralBytes = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralBytes.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, centralBytes, end]);
}

export async function buildPagesArtifact({outputDirectory, includeIndex = false}) {
  if (typeof outputDirectory !== 'string' || !outputDirectory || typeof includeIndex !== 'boolean')
    throw new Error('An output directory under repository tmp is required.');
  const output = path.resolve(repository, outputDirectory);
  if (path.dirname(output) !== tmpDirectory || !/^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$/.test(path.basename(output)))
    throw new Error('Output must be a new direct child directory of repository tmp.');
  await mkdir(tmpDirectory, {recursive: true});
  const tmpStat = await lstat(tmpDirectory);
  if (!tmpStat.isDirectory() || tmpStat.isSymbolicLink() || await realpath(tmpDirectory) !== path.join(await realpath(repository), 'tmp'))
    throw new Error('Repository tmp must be a real directory inside the checkout.');
  const bundleStat = await lstat(bundlePath);
  if (!bundleStat.isFile() || bundleStat.isSymbolicLink()) throw new Error('Worker bundle must be the reviewed regular file.');
  const bundle = await readFile(bundlePath);
  if (bundle.length === 0 || bundle.length > 1_000_000) throw new Error('Worker bundle size is outside this artifact contract.');
  const workerSha256 = digest(bundle);
  // Never merge into an old folder: no accidental environment or private files.
  await mkdir(output);
  const uploadDirectory = path.join(output, 'upload');
  await mkdir(uploadDirectory);
  const entries = [{name: '_worker.js', bytes: bundle}, {name: '_routes.json', bytes: routes}];
  if (includeIndex) entries.push({name: 'index.html', bytes: operationalIndex});
  for (const entry of entries) await writeFile(path.join(uploadDirectory, entry.name), entry.bytes, {flag: 'wx'});
  const copied = await readFile(path.join(uploadDirectory, '_worker.js'));
  if (!copied.equals(bundle) || digest(copied) !== workerSha256 || !(await readFile(bundlePath)).equals(bundle))
    throw new Error('Worker source or copy changed while building; do not upload this output.');
  const zip = zipEntries(entries);
  const zipPath = path.join(output, 'trainoracle-garmin-ingress-pages.zip');
  await writeFile(zipPath, zip, {flag: 'wx'});
  if (!(await readFile(zipPath)).equals(zip)) throw new Error('ZIP write verification failed.');
  const receipt = {
    schemaVersion: 'GARMIN_PAGES_ARTIFACT_V1',
    sourceBundle: 'server/garmin-ingress/worker-bundle.mjs',
    workerSha256, copiedWorkerSha256: digest(copied), zipSha256: digest(zip),
    zipPath, uploadDirectory, includeIndex,
    entries: entries.map(({name, bytes}) => ({name, bytes: bytes.length, sha256: digest(bytes)})),
    runtimeConfigurationIncluded: false, cloudflareDeploymentVerified: false,
  };
  await writeFile(path.join(output, 'artifact-receipt.json'), `${JSON.stringify(receipt, null, 2)}\n`, {flag: 'wx'});
  return receipt;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.length < 1 || args.length > 2 || args.length === 2 && args[1] !== '--include-index')
    throw new Error('Usage: node server/garmin-ingress/build-pages-artifact.mjs tmp/<new-name> [--include-index]');
  console.log(JSON.stringify(await buildPagesArtifact({outputDirectory: args[0], includeIndex: args[1] === '--include-index'}), null, 2));
}
