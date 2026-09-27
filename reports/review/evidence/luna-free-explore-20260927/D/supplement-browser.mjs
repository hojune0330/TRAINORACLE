import { chromium } from '../../../../../app/node_modules/@playwright/test/index.mjs';
import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const id = process.argv[2];
if (!['R19', 'R20'].includes(id)) throw new Error('R19 or R20 required');
const output = path.join(here, `${id}-supplement.json`);
if (fs.existsSync(output)) throw new Error('Existing supplement will not be overwritten');
const profile = JSON.parse(fs.readFileSync(path.join(here, 'personas.synthetic.json'), 'utf8')).profiles.find(p => p.id === id);
const selector = 'button,[role="button"],a[href],summary,input:not([type="hidden"]),textarea,select,[contenteditable="true"]';
const forbidden = /계정|로그인|동기화|공유|게시|설정|결제|연결|삭제|지우기|초기화|탈퇴|휴지통|내보내기|가져오기|불러오기|업로드|비밀번호/;
const log = {
  persona: id, profile, startedAt: new Date().toISOString(), status: 'starting',
  method: 'Live screen observation followed by human-readable persona-based choices; no assigned route or mission.',
  isolation: 'Fresh nonpersistent Playwright Chromium context, no imported storage or account.',
  policy: 'Only http://127.0.0.1:4209 GET/HEAD permitted; other HTTP and all WebSockets blocked; service workers blocked.',
  actions: [], network: [], errors: [], browserClosed: false
};
function persist() {
  const temporary = output + '.tmp';
  const fd = fs.openSync(temporary, 'w');
  fs.writeFileSync(fd, JSON.stringify(log, null, 2), 'utf8');
  fs.fsyncSync(fd);
  fs.closeSync(fd);
  fs.renameSync(temporary, output);
}
persist();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: profile.viewport, locale: 'ko-KR', timezoneId: 'Asia/Seoul', reducedMotion: 'reduce', serviceWorkers: 'block' });
await context.route('**/*', async route => {
  const req = route.request();
  const url = new URL(req.url());
  const allowed = url.origin === 'http://127.0.0.1:4209' && ['GET', 'HEAD'].includes(req.method());
  log.network.push({ at: new Date().toISOString(), method: req.method(), origin: url.origin, path: url.pathname, allowed });
  if (allowed) await route.continue(); else await route.abort('blockedbyclient');
});
if (typeof context.routeWebSocket !== 'function') throw new Error('WebSocket blocking API unavailable');
await context.routeWebSocket('**/*', ws => { log.network.push({ method: 'WEBSOCKET', allowed: false }); ws.close(); });
const page = await context.newPage();
page.on('pageerror', e => log.errors.push(String(e)));
page.on('dialog', async dialog => { log.errors.push(`Native dialog dismissed: ${dialog.type()}`); await dialog.dismiss(); });

async function snapshot() {
  return await page.evaluate(sel => {
    function visible(e) {
      const s = getComputedStyle(e), r = e.getBoundingClientRect();
      return s.visibility !== 'hidden' && s.display !== 'none' && r.width > 0 && r.height > 0;
    }
    function inViewport(e) {
      let r = e.getBoundingClientRect();
      let top = 0, bottom = innerHeight, left = 0, right = innerWidth;
      for (let p = e.parentElement; p; p = p.parentElement) {
        const s = getComputedStyle(p), pr = p.getBoundingClientRect();
        if (/(auto|scroll|hidden|clip)/.test(s.overflowY)) { top = Math.max(top, pr.top); bottom = Math.min(bottom, pr.bottom); }
        if (/(auto|scroll|hidden|clip)/.test(s.overflowX)) { left = Math.max(left, pr.left); right = Math.min(right, pr.right); }
      }
      return visible(e) && r.bottom > top && r.top < bottom && r.right > left && r.left < right;
    }
    const controls = [...document.querySelectorAll(sel)].map((e, index) => ({
      index, tag: e.tagName, type: e.getAttribute('type'),
      name: (e.getAttribute('aria-label') || (e.labels ? [...e.labels].map(x => x.innerText).join(' ') : '') || e.getAttribute('placeholder') || e.innerText || e.getAttribute('title') || e.id || '').replace(/\s+/g, ' ').trim(),
      value: e.value ?? null, pressed: e.getAttribute('aria-pressed'), expanded: e.getAttribute('aria-expanded'), selected: e.getAttribute('aria-selected'),
      disabled: !!e.disabled || e.getAttribute('aria-disabled') === 'true', visible: visible(e), inViewport: inViewport(e), href: e.getAttribute('href')
    })).filter(x => x.visible);
    const scrolling = [...document.querySelectorAll('*')].filter(e => e.scrollHeight > e.clientHeight + 30 && /(auto|scroll)/.test(getComputedStyle(e).overflowY)).map(e => ({ tag: e.tagName, className: String(e.className), y: e.scrollTop, max: e.scrollHeight - e.clientHeight }));
    return { url: location.href, text: document.body.innerText, controls, scrolling, windowScrollY: scrollY, viewport: { width: innerWidth, height: innerHeight }, horizontalOverflow: document.documentElement.scrollWidth > innerWidth };
  }, selector);
}
function comparable(s) {
  return JSON.stringify({ url: s.url, text: s.text, controls: s.controls.map(({ index, inViewport, visible, ...rest }) => rest), scrolling: s.scrolling, windowScrollY: s.windowScrollY });
}
function emit(state) {
  console.log(JSON.stringify({ persona: id, completedActions: log.actions.filter(x => x.status === 'completed' && x.meaningful).length, text: state.text.slice(0, 8000), controls: state.controls.filter(x => x.inViewport), scrolling: state.scrolling }));
}
async function finish(reason, normal = true) {
  log.stopReason = reason;
  log.localStorageKeys = await page.evaluate(() => Object.keys(localStorage)).catch(() => []);
  persist();
  await context.close();
  await browser.close();
  log.browserClosed = true;
  log.endedAt = new Date().toISOString();
  log.meaningfulActions = log.actions.filter(x => x.status === 'completed' && x.meaningful).length;
  log.status = normal && log.meaningfulActions >= 12 ? 'completed' : 'incomplete';
  persist();
  console.log(JSON.stringify({ status: log.status, meaningfulActions: log.meaningfulActions, browserClosed: true, output }));
}

try {
  await page.goto('http://127.0.0.1:4209/?app=1', { waitUntil: 'networkidle', timeout: 15000 });
  log.initial = await snapshot();
  log.status = 'exploring';
  persist();
  await page.screenshot({ path: path.join(here, `${id}-supplement-start.png`) });
  emit(log.initial);
  const input = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
  for await (const line of input) {
    if (!line.trim()) continue;
    let cmd;
    try { cmd = JSON.parse(line); } catch { console.log('Invalid JSON command'); continue; }
    if (cmd.type === 'finish') { await finish(cmd.reason); input.close(); break; }
    const before = await snapshot();
    if (cmd.type === 'observe') { emit(before); continue; }
    const action = { sequence: log.actions.length + 1, at: new Date().toISOString(), ...cmd, status: 'pending', meaningful: false, before };
    log.actions.push(action);
    persist();
    try {
      if (cmd.type === 'scroll') {
        await page.mouse.move(profile.viewport.width / 2, profile.viewport.height * 0.5);
        await page.mouse.wheel(0, cmd.delta);
      } else {
        const control = before.controls.find(x => x.index === cmd.index);
        if (!control?.inViewport || control.name !== cmd.name || control.disabled || forbidden.test(control.name)) throw new Error('Target not currently available or excluded');
        if (['password', 'email', 'tel', 'file'].includes(control.type)) throw new Error('Excluded input type');
        if (control.href && new URL(control.href, before.url).origin !== 'http://127.0.0.1:4209') throw new Error('External navigation excluded');
        const locator = page.locator(selector).nth(cmd.index);
        if (cmd.type === 'click') await locator.click({ timeout: 3500 });
        else if (cmd.type === 'fill') await locator.fill(cmd.value, { timeout: 3500 });
        else if (cmd.type === 'select') await locator.selectOption(cmd.value, { timeout: 3500 });
        else throw new Error('Unsupported command');
      }
      await page.waitForTimeout(300);
      action.after = await snapshot();
      action.meaningful = comparable(before) !== comparable(action.after);
      action.status = 'completed';
      action.finishedAt = new Date().toISOString();
      persist();
      action.screenshot = `${id}-supplement-${String(action.sequence).padStart(2, '0')}.png`;
      await page.screenshot({ path: path.join(here, action.screenshot) });
      persist();
      emit(action.after);
    } catch (error) {
      action.status = 'failed'; action.error = String(error); action.after = await snapshot(); persist(); emit(action.after);
    }
  }
  if (!log.browserClosed) await finish('Input session ended before explicit completion', false);
} catch (error) {
  log.errors.push(String(error));
  await finish('Execution error', false);
  process.exitCode = 1;
}
