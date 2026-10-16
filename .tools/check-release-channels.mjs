import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// Public metadata only. Never read credentials, provider usage, user records or
// private endpoints. These are receipts/configurations, not a runtime health test.
export const CHANNEL_URLS = {
  main: 'https://api.github.com/repos/hojune0330/TRAINORACLE/commits/main',
  legacy: 'https://hojune0330.github.io/TRAINORACLE/trainoracle-deploy-receipt.json',
  web: 'https://trainoracle.io/trainoracle-domain-receipt.json',
  mobile: 'https://raw.githubusercontent.com/hojune0330/TRAINORACLE-MOBILE/main/release-config.json',
};
const validSha = value => typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
async function readPublicJson(url, fetcher) {
  const response = await fetcher(url, { headers: { Accept: 'application/json', 'User-Agent': 'TrainOracle-release-channel-check' },
    cache: 'no-store', credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(15_000) });
  if (!response.ok) throw Error('PUBLIC_METADATA_UNAVAILABLE');
  const reader = response.body.getReader(); const chunks = []; let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 2 * 1024 * 1024) throw Error('METADATA_LIMIT_EXCEEDED');
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } finally { await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function checkReleaseChannels(fetcher = fetch) {
  const replies = Object.fromEntries(await Promise.all(Object.entries(CHANNEL_URLS).map(async ([name, url]) => {
    try { return [name, await readPublicJson(url, fetcher)]; } catch { return [name, null]; }
  })));
  const mainSha = validSha(replies.main?.sha) ? replies.main.sha : null;
  const channels = ['legacy', 'web', 'mobile'].map(channel => {
    const data = replies[channel];
    const sourceSha = validSha(data?.sourceSha) ? data.sourceSha : null;
    const identity = channel === 'legacy' ? data?.kind === 'TRAINORACLE_PAGES_DEPLOYMENT'
      : data?.schemaVersion === 1 && data?.sourceRepository === 'hojune0330/TRAINORACLE'
        && (channel === 'web' ? data.domain === 'https://trainoracle.io/' : data.appId === 'io.trainoracle.app');
    const valid = identity && sourceSha !== null;
    return { channel, sourceSha: valid ? sourceSha : null,
      status: !mainSha || !valid ? 'UNKNOWN' : mainSha === sourceSha ? 'SAME_SOURCE' : 'DIFFERENT_SOURCE',
      evidence: channel === 'mobile' ? 'BUILD_CONFIG_NOT_STORE_RELEASE' : 'PUBLIC_RECEIPT_NOT_RUNTIME_VERIFICATION',
      ...(channel !== 'legacy' ? { accountMode: data?.accountMode === 'off' ? 'off' : 'UNKNOWN' } : {}),
      ...(channel === 'mobile' ? { signingConfigured: typeof data?.signingConfigured === 'boolean' ? data.signingConfigured : null,
        storeUploadEnabled: typeof data?.storeUploadEnabled === 'boolean' ? data.storeUploadEnabled : null } : {}) };
  });
  return { mainSha, channels, checkedAt: new Date().toISOString(),
    aligned: mainSha !== null && channels.every(channel => channel.status === 'SAME_SOURCE'),
    billingAndQuota: 'NOT_QUERIED', authenticatedStorage: 'NOT_VERIFIED' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const result = await checkReleaseChannels();
  console.log(JSON.stringify(result, null, 2));
  if (!result.aligned) process.exitCode = 1;
}
