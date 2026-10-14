import { createServer } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
import { spawn } from 'node:child_process'
const app = fileURLToPath(new URL('../', import.meta.url)), root = resolve(app, '..')
const fault = process.argv.includes('--fault')
const server = await createServer({ configFile: false, envDir: false, root: app, base: './', logLevel: 'error',
  cacheDir: resolve(root, '.scratch/calendar-ui/cache'), plugins: [react(), ...(fault ? [{
    name: 'calendar-escape-fault', enforce: 'pre', transform(code, id) {
      if (id.split('?')[0].replaceAll('\\', '/').endsWith('/MonthCalendar.tsx')) {
        if (!code.includes('event.key === "Escape"')) throw new Error('Fault target missing')
        return code.replace('event.key === "Escape"', 'event.key === "NEVER_ESCAPE"')
      }
    }
  }] : [])], resolve: { alias: { '@impl': resolve(root, 'impl/src') } },
  server: { host: '127.0.0.1', port: 51840, strictPort: true, hmr: false, fs: { allow: [root] }, watch: { ignored: ['**/*'] } },
})
await server.listen()
try {
  process.exitCode = await new Promise((done, reject) => {
    const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config=playwright.calendar-ui.config.ts',
      '--output=' + resolve(root, '.scratch/calendar-ui/' + (fault ? 'fault' : 'after'))], { cwd: app, stdio: 'inherit', windowsHide: true })
    child.on('error', reject); child.on('exit', code => done(code ?? 1))
  })
} finally { await server.close() }
