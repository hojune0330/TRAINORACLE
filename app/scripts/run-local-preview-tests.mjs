import { preview } from 'vite';
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// A local diagnostic lane, not a replacement for any required release checks.
// Own one loopback server for readiness, browser preflight and the requested tests.
const app = fileURLToPath(new URL('../', import.meta.url));
process.chdir(app);
let server;
let browser;
let child;
try {
  server = await preview({ envFile: false, preview: { host: '127.0.0.1', port: 0, strictPort: true } });
  const address = server.httpServer.address();
  if (!address || typeof address === 'string') throw Error('PREVIEW_ADDRESS_UNAVAILABLE');
  const url = `http://127.0.0.1:${address.port}`;
  const response = await fetch(`${url}/?app=1`, { signal: AbortSignal.timeout(8000) });
  if (!response.ok || !(await response.text()).includes('<html')) throw Error('PREVIEW_HTTP_NOT_READY');
  console.log('[preflight] preview HTTP ready');
  browser = await chromium.launch({ headless: true, timeout: 15000 });
  const page = await browser.newPage();
  await page.goto(`${url}/?app=1`, { timeout: 15000, waitUntil: 'domcontentloaded' });
  await page.getByRole('navigation', { name: '주 탭' }).waitFor({ timeout: 15000 });
  console.log('[preflight] browser rendered app navigation');
  await browser.close();
  browser = undefined;
  child = spawn(process.execPath, ['node_modules/playwright/cli.js', 'test', ...process.argv.slice(2)], {
    cwd: app, stdio: 'inherit', env: { ...process.env, CI: '1',
      PLAYWRIGHT_EXTERNAL_SERVER: '1', PLAYWRIGHT_BASE_URL: url },
  });
  process.exitCode = await new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', (code) => resolve(code ?? 1));
  });
} catch (error) {
  console.error('[local-preview] failed before completion:', error.message);
  process.exitCode = 1;
} finally {
  child?.kill();
  await browser?.close();
  if (server) {
    server.httpServer.closeAllConnections();
    await new Promise(resolve => server.httpServer.close(resolve));
  }
}
