import { createHash } from 'node:crypto';
import { constants } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const RECEIPT = 'trainoracle-domain-receipt.json';
export const STATIC_LIMITS = { files: 20_000, fileBytes: 25 * 1024 * 1024 };
export const CLOUDFLARE_HEADERS = '/*\n  X-Content-Type-Options: nosniff\n  Referrer-Policy: strict-origin-when-cross-origin\n\n/\n  Cache-Control: no-cache\n\n/*.html\n  Cache-Control: no-cache\n\n/sw.js\n  Cache-Control: no-cache\n\n/manifest.webmanifest\n  Cache-Control: no-cache\n\n/trainoracle-*.json\n  Cache-Control: no-cache\n';
export function staticHeaders(names) {
  const assets = names.filter(name => name.startsWith('assets/'));
  // A future unversioned asset must not silently acquire a one-year lifetime.
  const immutable = assets.length > 0 && assets.every(name => /^assets\/[^/]+-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$/.test(name));
  return CLOUDFLARE_HEADERS + (immutable ? '\n/assets/*\n  Cache-Control: public, max-age=31536000, immutable\n' : '');
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const sha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
const inside = (parent, child) => { const path = relative(parent, child); return path === '' || !path.startsWith('..') && !isAbsolute(path); };

export function assertStaticPath(name) {
  if (!name || /[\\:\x00-\x1f]/.test(name) || name.split('/').some(part => !part || part === '.' || part === '..')
    || /(^|\/)(?:\.(?!nojekyll$)|functions(?:\/|$)|node_modules(?:\/|$)|_worker\.js(?:\/|$)|_routes\.json$|_headers$|_redirects$|wrangler\.(?:jsonc?|toml)$)/i.test(name)
    || name === 'trainoracle-hosting-preparation.json'
    || /\.(?:pem|key|p12|pfx|db|sqlite3?|map)$/i.test(name)) throw Error('UNSAFE_STATIC_PATH');
}

async function inventory(root, prefix = '', files = Object.create(null), budget = { count: 0 }) {
  for (const entry of await readdir(join(root, prefix), { withFileTypes: true })) {
    const name = prefix ? prefix + '/' + entry.name : entry.name;
    assertStaticPath(name);
    const stat = await lstat(join(root, name));
    if (stat.isSymbolicLink() || !stat.isFile() && !stat.isDirectory()) throw Error('UNSAFE_STATIC_ENTRY');
    if (stat.isDirectory()) { await inventory(root, name, files, budget); continue; }
    if (stat.size > STATIC_LIMITS.fileBytes) throw Error('STATIC_FILE_TOO_LARGE');
    // Reserve the hosting headers and preparation receipt too.
    if (++budget.count + 2 > STATIC_LIMITS.files) throw Error('STATIC_FILE_COUNT_EXCEEDED');
    const bytes = await readFile(join(root, name));
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|\bsb_(?:secret|publishable)_[A-Za-z0-9_-]{20,}|\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}|\beyJ[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}\.[A-Za-z0-9_-]{15,}/.test(bytes.toString('utf8'))) throw Error('CREDENTIAL_LIKE_CONTENT_REJECTED');
    files[name] = { bytes: stat.size, sha256: digest(bytes) };
  }
  return files;
}

/** Adapt a previously verified DOMAIN artifact; do not rebuild, publish, change
 * DNS, insert functions, copy credentials, or infer CI/account approval.
 */
export async function prepareCloudflarePages(input, output, expectedSourceSha) {
  if (!sha(expectedSourceSha)) throw Error('EXACT_SOURCE_SHA_REQUIRED');
  input = await realpath(input);
  if (!(await lstat(input)).isDirectory()) throw Error('INPUT_DIRECTORY_REQUIRED');
  output = resolve(output);
  const parent = await realpath(dirname(output));
  output = join(parent, relative(dirname(output), output));
  if (inside(input, output) || inside(output, input)) throw Error('OUTPUT_MUST_BE_SEPARATE');
  const files = await inventory(input);
  const receipt = JSON.parse(await readFile(join(input, RECEIPT), 'utf8'));
  if (receipt.schemaVersion !== 1 || receipt.sourceSha !== expectedSourceSha
    || receipt.sourceRepository !== 'hojune0330/TRAINORACLE' || receipt.domain !== 'https://trainoracle.io/'
    || receipt.accountMode !== 'off' || receipt.originPreserved !== true
    || !['source-verified', 'domain-hosting'].includes(receipt.verificationScope)) throw Error('DOMAIN_RECEIPT_REJECTED');
  const env = receipt.buildEnvironment;
  if (!env || env.VITE_ACCOUNT_PUBLIC_ENABLED !== 'false' || env.VITE_KILL_ACCOUNT !== 'true'
    || env.VITE_SUPABASE_URL !== '' || env.VITE_SUPABASE_ANON_KEY !== ''
    || env.VITE_SERVER_OPERATIONS_ENABLED !== 'false' || env.VITE_FRIEND_ARENA_URL !== ''
    || env.VITE_LOUNGE_REALTIME_URL !== '' || env.VITE_LOUNGE_PUBLIC_ENABLED !== 'false'
    || env.VITE_ACCOUNT_STORAGE_PRIVACY_RELEASE_APPROVED !== 'false'
    || Object.entries(env).some(([key, value]) => (/^VITE_FEATURE_/.test(key) || /^VITE_(KAKAO|GOOGLE|EMAIL|PHONE)_AUTH_ENABLED$/.test(key)) && value !== 'false')) throw Error('ACCOUNT_HOLD_REQUIRED');
  const actualNames = Object.keys(files).filter(name => name !== RECEIPT).sort();
  if (!receipt.files || JSON.stringify(actualNames) !== JSON.stringify(Object.keys(receipt.files).sort())
    || actualNames.some(name => files[name].sha256 !== receipt.files[name])) throw Error('DOMAIN_ARTIFACT_MISMATCH');
  for (const required of ['index.html', 'sw.js', 'manifest.webmanifest', 'migration.html', 'legal/privacy.html', 'legal/terms.html', 'support.html']) {
    if (!files[required]) throw Error('REQUIRED_STATIC_FILE_MISSING');
  }
  // Reject an existing target, including symlinks. Partial failures are preserved
  // for inspection and never described as a publishable package.
  await mkdir(output);
  for (const name of Object.keys(files)) {
    await mkdir(dirname(join(output, name)), { recursive: true });
    await copyFile(join(input, name), join(output, name), constants.COPYFILE_EXCL);
    if (digest(await readFile(join(output, name))) !== files[name].sha256) throw Error('COPY_CHANGED');
  }
  const headers = staticHeaders(actualNames);
  await writeFile(join(output, '_headers'), headers, { flag: 'wx' });
  const result = { schemaVersion: 1, sourceSha: expectedSourceSha, hosting: 'cloudflare-pages-static',
    deploymentStatus: 'NOT_PUBLISHED', accountMode: 'off', functions: false,
    verificationScope: receipt.verificationScope, sourceRegressionGate: receipt.sourceRegressionGate,
    dnsChanged: false, oldOriginChanged: false, fileCount: Object.keys(files).length + 2,
    totalBytes: Object.values(files).reduce((sum, file) => sum + file.bytes, 0),
    files: { ...files, _headers: { bytes: Buffer.byteLength(headers), sha256: digest(headers) } } };
  await writeFile(join(output, 'trainoracle-hosting-preparation.json'), JSON.stringify(result, null, 2) + '\n', { flag: 'wx' });
  return { sourceSha: result.sourceSha, fileCount: result.fileCount, totalBytes: result.totalBytes, deploymentStatus: result.deploymentStatus };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [input, output, sourceSha] = process.argv.slice(2);
  if (!input || !output || !sourceSha || process.argv.length !== 5) throw Error('Usage: node .tools/prepare-cloudflare-pages.mjs DOMAIN_DIST NEW_OUTPUT FULL_SOURCE_SHA');
  prepareCloudflarePages(input, output, sourceSha).then(result => console.log(JSON.stringify(result, null, 2)))
    .catch(error => { console.error(error.code === 'EEXIST' ? 'OUTPUT_ALREADY_EXISTS' : error.message); process.exitCode = 1; });
}
