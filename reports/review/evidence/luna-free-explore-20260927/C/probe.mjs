import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../');
const require = createRequire(path.join(root, 'app', 'package.json'));
const { chromium } = require('@playwright/test');
const outDir = path.dirname(fileURLToPath(import.meta.url));
const blocked = [];
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 1365, height: 900 } });

await context.route('**/*', async (route) => {
  const request = route.request();
  const url = new URL(request.url());
  const allowedHost = url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '4209';
  const readOnly = ['GET', 'HEAD'].includes(request.method());
  if (allowedHost && readOnly) return route.continue();
  blocked.push({ method: request.method(), url: request.url(), reason: allowedHost ? 'non-read method' : 'non-local host' });
  return route.abort('blockedbyclient');
});

context.on('page', (page) => {
  page.on('websocket', (socket) => socket.close());
});

const page = await context.newPage();
const failures = [];
page.on('requestfailed', (request) => failures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
let navigation;
try {
  const response = await page.goto('http://127.0.0.1:4209/?app=1', { waitUntil: 'domcontentloaded', timeout: 12000 });
  await page.waitForTimeout(1500);
  navigation = { status: response?.status() ?? null, url: page.url(), title: await page.title() };
} catch (error) {
  navigation = { error: String(error), url: page.url() };
}

const snapshot = await page.locator('body').innerText({ timeout: 5000 }).catch((error) => `BODY_READ_ERROR: ${error}`);
const controls = await page.locator('button, a, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"]')
  .evaluateAll((items) => items.map((el) => ({
    tag: el.tagName.toLowerCase(),
    role: el.getAttribute('role'),
    name: (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('value') || '').trim().replace(/\s+/g, ' ').slice(0, 120),
    disabled: Boolean(el.disabled),
    visible: Boolean(el.getClientRects().length),
  })).filter((item) => item.visible));
const assetLinks = await page.locator('script[src], link[href]')
  .evaluateAll((items) => items.map((el) => el.getAttribute('src') || el.getAttribute('href')));
const assetChecks = await Promise.all(assetLinks.filter((href) => href?.startsWith('./assets/')).map(async (href) => {
  const url = new URL(href, page.url()).href;
  const fileName = path.basename(new URL(url).pathname);
  const response = await page.request.get(url);
  const served = Buffer.from(await response.body());
  const local = await readFile(path.join(root, 'app', 'dist', 'assets', fileName));
  const hash = (buffer) => createHash('sha256').update(buffer).digest('hex');
  return { fileName, status: response.status(), servedSha256: hash(served), targetDistSha256: hash(local), matchesTargetDist: hash(served) === hash(local) };
}));
await page.screenshot({ path: path.join(outDir, 'probe-initial.png'), fullPage: true }).catch(() => {});

const report = { navigation, viewport: page.viewportSize(), snapshot, controls, assetLinks, assetChecks, blocked, failures, at: new Date().toISOString() };
await writeFile(path.join(outDir, 'probe.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(JSON.stringify({ ...report, snapshot: snapshot.slice(0, 8000) }, null, 2));
await browser.close();
