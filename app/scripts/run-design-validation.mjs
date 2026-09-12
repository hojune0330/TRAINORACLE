import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { preview } from 'vite';

const app = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(app, 'package.json'));
const port = 4190;
const server = await preview({ root: app, preview: { host: '127.0.0.1', port, strictPort: true } });
try {
  const code = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [require.resolve('@playwright/test/cli'), ...process.argv.slice(2)], {
      cwd: app,
      stdio: 'inherit',
      env: { ...process.env, PLAYWRIGHT_PORT: String(port), PLAYWRIGHT_BASE_URL: `http://127.0.0.1:${port}`, PLAYWRIGHT_EXTERNAL_SERVER: '1' },
    });
    child.once('error', reject);
    child.once('exit', (exitCode, signal) => resolve(exitCode ?? (signal ? 1 : 0)));
  });
  process.exitCode = code;
} finally {
  await new Promise((resolve, reject) => server.httpServer.close(error => error ? reject(error) : resolve()));
}
