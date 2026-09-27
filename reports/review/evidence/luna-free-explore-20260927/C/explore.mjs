import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const outDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(outDir, '../../../../../');
const require = createRequire(path.join(root, 'app', 'package.json'));
const { chromium } = require('@playwright/test');
const personas = JSON.parse(await readFile(path.join(outDir, 'personas.json'), 'utf8'));
const syntheticInput = personas.syntheticInput;
const browser = await chromium.launch({ headless: true });
const results = [];

const unsafeLabel = /삭제|탈퇴|로그아웃|공유|동기화|연동|결제|구독|계정 설정|설정 저장|초기화|내보내기|게시/;
const navLabels = ['홈', '일지', '기록하기', '계획', '분석'];

async function visibleControls(page) {
  return page.locator('button, a, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"]')
    .evaluateAll((items) => items.map((el, index) => {
      const rect = el.getBoundingClientRect();
      const name = (el.getAttribute('aria-label') || el.innerText || el.getAttribute('placeholder') || el.getAttribute('title') || el.getAttribute('value') || '').trim().replace(/\s+/g, ' ').slice(0, 140);
      return {
        index,
        name,
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute('role'),
        type: el.getAttribute('type'),
        placeholder: el.getAttribute('placeholder') || '',
        disabled: Boolean(el.disabled),
        visible: Boolean(el.getClientRects().length) && rect.width > 0 && rect.height > 0,
        rect: { x: Math.round(rect.x), y: Math.round(rect.y), width: Math.round(rect.width), height: Math.round(rect.height) },
        text: (el.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 240),
        title: el.getAttribute('title') || '',
        describedBy: el.getAttribute('aria-describedby') || '',
      };
    })).then((items) => items.filter((item) => item.visible && !item.disabled && item.name));
}

async function screenState(page) {
  return page.locator('body').innerText().then((raw) => {
    const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean).filter((line) => !navLabels.includes(line));
    return { signature: lines.slice(0, 5).join(' / ').slice(0, 220), text: lines.slice(0, 12).join(' | ').slice(0, 560) };
  });
}

async function metrics(page) {
  return page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    documentWidth: document.documentElement.scrollWidth,
    bodyWidth: document.body.scrollWidth,
    documentHeight: document.documentElement.scrollHeight,
    visualScale: window.visualViewport?.scale ?? 1,
    reducedMotion: matchMedia('(prefers-reduced-motion: reduce)').matches,
    active: (() => {
      const el = document.activeElement;
      return { tag: el?.tagName?.toLowerCase(), name: (el?.getAttribute?.('aria-label') || el?.innerText || el?.getAttribute?.('placeholder') || '').trim().replace(/\s+/g, ' ').slice(0, 120) };
    })(),
  }));
}

function reasonFor(persona, control, operation) {
  if (persona.interaction === 'keyboard') return operation === 'Enter' ? `현재 포커스의 “${control}”이 실제 화면 선택지라 키보드로 열어 봄` : '포인터 없이 포커스 순서와 이름을 확인';
  if (persona.interaction === 'large-text') return operation === 'zoom' ? '기본 화면을 읽기 편한 크기로 키운 뒤 줄바꿈과 잘림을 살핌' : `확대 상태에서 눈에 먼저 들어온 “${control}”을 따라감`;
  if (persona.interaction === 'one-hand') return `작은 화면에서 엄지에 가까운 “${control}”부터 살펴봄`;
  if (persona.interaction === 'reduced-motion') return `모션 감소 상태에서 “${control}”을 열고 전환 뒤 멈춰 내용을 확인`;
  return `“${control}”의 질문·설명·예시가 낯선 용어보다 이해하기 쉬워 보여 선택`;
}

function scoreControl(persona, control, pageWidth, pageHeight) {
  const name = `${control.name} ${control.text} ${control.title}`.toLowerCase();
  const area = control.rect.width * control.rect.height;
  const centerX = control.rect.x + control.rect.width / 2;
  const centerY = control.rect.y + control.rect.height / 2;
  const bonuses = (words) => words.reduce((sum, word) => sum + (name.includes(word) ? 12 : 0), 0);
  if (persona.interaction === 'large-text') return Math.log2(Math.max(1, area)) + bonuses(['오늘', '기록', '분석', '예시', '자세히']);
  if (persona.interaction === 'one-hand') {
    const thumbX = pageWidth * 0.67;
    const thumbY = pageHeight * 0.82;
    const distance = Math.hypot(centerX - thumbX, centerY - thumbY);
    return 1200 - distance + bonuses(['기록', '일지', '오늘', '저장', '달력']);
  }
  if (persona.interaction === 'plain-language') return bonuses(['?', '무엇', '어떤', '왜', '기록', '예시', '배우기', '설명', '결과']) + Math.min(8, (control.text.match(/[?？]/g) || []).length * 3);
  return bonuses(['홈', '기록', '분석', '일지', '계획', '예시']);
}

async function fillVisibleSyntheticField(page, persona, logs, step) {
  if (persona.id !== 'R13') return false;
  const fields = await page.locator('input:not([type="password"]):not([type="email"]), textarea, select').evaluateAll((items) => items.map((el, index) => {
    const label = (el.labels?.[0]?.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.name || '').trim().replace(/\s+/g, ' ');
    const type = (el.type || el.tagName).toLowerCase();
    const rect = el.getBoundingClientRect();
    return { index, label, type, visible: Boolean(el.getClientRects().length) && rect.width > 0 && rect.height > 0, value: el.value || '' };
  }).filter((field) => field.visible && !field.value && field.label));
  const field = fields.find((entry) => /거리|km|distance/i.test(entry.label))
    || fields.find((entry) => /시간|소요|time|duration/i.test(entry.label))
    || fields.find((entry) => /rpe|체감강도|강도/i.test(entry.label))
    || fields.find((entry) => /메모|내용|기록/i.test(entry.label) && entry.type !== 'date');
  if (!field) return false;
  let value = syntheticInput.note;
  if (/거리|km|distance/i.test(field.label)) value = String(syntheticInput.distanceKm);
  else if (/시간|소요|time|duration/i.test(field.label)) value = syntheticInput.duration;
  else if (/rpe|체감강도|강도/i.test(field.label)) value = String(syntheticInput.perceivedExertion);
  const locator = page.locator('input:not([type="password"]):not([type="email"]), textarea, select').nth(field.index);
  await locator.fill(value);
  logs.push({ step, operation: 'fill', target: field.label, why: '입력 화면이 보여 작은 화면 사용자로서 합성값만 넣어 보고 저장 전 반응을 확인', after: await screenState(page), metrics: await metrics(page), synthetic: true });
  return true;
}

async function chooseControl(page, persona, seen) {
  const controls = await visibleControls(page);
  const usable = controls.filter((control) => !unsafeLabel.test(control.name) && !/^(input|select|textarea)$/.test(control.tag));
  const state = await screenState(page);
  const pageMetrics = await metrics(page);
  const candidates = usable.map((control) => ({ control, score: scoreControl(persona, control, pageMetrics.viewport.width, pageMetrics.viewport.height), seen: seen.get(`${state.signature}::${control.name}`) || 0 }));
  candidates.sort((a, b) => (a.seen ? 100000 : 0) - (b.seen ? 100000 : 0) || b.score - a.score || a.control.index - b.control.index);
  return candidates[0]?.control ?? null;
}

for (const persona of personas.personas) {
  const blocked = [];
  const requests = [];
  const failures = [];
  const logs = [];
  const seen = new Map();
  const context = await browser.newContext({
    viewport: persona.viewport,
    isMobile: persona.interaction === 'one-hand' || persona.interaction === 'reduced-motion' || persona.interaction === 'plain-language',
    hasTouch: persona.interaction === 'one-hand' || persona.interaction === 'reduced-motion' || persona.interaction === 'plain-language',
    reducedMotion: persona.reducedMotion ?? 'no-preference',
    serviceWorkers: 'block',
    acceptDownloads: false,
  });
  context.setDefaultTimeout(3500);
  if (typeof context.routeWebSocket === 'function') {
    await context.routeWebSocket('**/*', (socket) => {
      blocked.push({ kind: 'websocket', url: socket.url(), reason: 'all WebSocket traffic blocked' });
      socket.close({ code: 1008, reason: 'isolated review' });
    });
  }
  await context.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const allowed = url.protocol === 'http:' && url.hostname === '127.0.0.1' && url.port === '4209';
    const readOnly = ['GET', 'HEAD'].includes(request.method());
    requests.push({ method: request.method(), url: request.url(), outcome: allowed && readOnly ? 'allowed-local-read' : 'blocked' });
    if (allowed && readOnly) return route.continue();
    blocked.push({ method: request.method(), url: request.url(), reason: allowed ? 'non-read method' : 'non-local host' });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.on('requestfailed', (request) => failures.push({ url: request.url(), error: request.failure()?.errorText ?? 'unknown' }));
  page.on('pageerror', (error) => failures.push({ type: 'pageerror', error: String(error) }));
  const started = new Date().toISOString();
  const initialResponse = await page.goto('http://127.0.0.1:4209/?app=1', { waitUntil: 'domcontentloaded', timeout: 12000 }).catch((error) => null);
  await page.waitForTimeout(500);
  const initial = await screenState(page).catch((error) => ({ signature: 'unavailable', text: String(error) }));
  const initialMetrics = await metrics(page).catch((error) => ({ error: String(error) }));
  await page.screenshot({ path: path.join(outDir, `${persona.id}-00-initial.png`), fullPage: true }).catch(() => {});
  let previousOperation = '';

  for (let step = 1; step <= 12; step += 1) {
    const before = await screenState(page).catch(() => ({ signature: 'unavailable', text: '' }));
    let operation = '';
    let target = '';
    let synthetic = false;
    try {
      if (persona.interaction === 'large-text' && step === 1) {
        await page.keyboard.press('Control+Shift+Equal').catch(async () => page.keyboard.press('Control+Plus'));
        operation = 'browser-zoom-in';
        target = 'browser text zoom';
      } else if (persona.interaction === 'keyboard') {
        const active = await metrics(page);
        const activeControl = await page.evaluate(() => {
          const el = document.activeElement;
          return { tag: el?.tagName?.toLowerCase(), role: el?.getAttribute?.('role'), name: (el?.getAttribute?.('aria-label') || el?.innerText || '').trim().replace(/\s+/g, ' ').slice(0, 120), disabled: Boolean(el?.disabled) };
        });
        const canActivate = previousOperation === 'Tab' && ['button', 'a'].includes(activeControl.tag) && !activeControl.disabled && !unsafeLabel.test(activeControl.name);
        if (canActivate) {
          target = activeControl.name || active.active.name || '현재 포커스';
          await page.keyboard.press('Enter');
          operation = 'Enter';
        } else {
          await page.keyboard.press('Tab');
          operation = 'Tab';
          target = (await metrics(page)).active.name || '다음 포커스 항목';
        }
      } else if (await fillVisibleSyntheticField(page, persona, logs, step)) {
        operation = 'fill-synthetic';
        target = '합성 기록 필드';
        synthetic = true;
      } else {
        const control = await chooseControl(page, persona, seen);
        if (!control) {
          await page.mouse.wheel(0, Math.round(persona.viewport.height * 0.7));
          operation = 'scroll';
          target = '새 컨트롤을 찾기 위한 화면 이동';
        } else {
          target = control.name;
          const key = `${before.signature}::${control.name}`;
          seen.set(key, (seen.get(key) || 0) + 1);
          const locator = page.locator('button, a, input, select, textarea, [role="button"], [role="tab"], [role="menuitem"]').nth(control.index);
          if (persona.interaction === 'one-hand' || persona.interaction === 'reduced-motion' || persona.interaction === 'plain-language') {
            await locator.tap({ timeout: 3500 }).catch(() => locator.click({ timeout: 3500 }));
            operation = 'tap';
          } else {
            await locator.click({ timeout: 3500 });
            operation = 'click';
          }
        }
      }
      previousOperation = operation === 'Enter' ? '' : operation === 'Tab' ? 'Tab' : operation;
      await page.waitForTimeout(persona.interaction === 'reduced-motion' ? 650 : 300);
      const after = await screenState(page);
      const afterMetrics = await metrics(page);
      const entry = { step, operation, target, why: reasonFor(persona, target, operation), before, after, metrics: afterMetrics, synthetic };
      if (operation === 'Enter') entry.keyboardName = target;
      logs.push(entry);
    } catch (error) {
      logs.push({ step, operation: operation || 'attempt', target, why: `현재 화면에서 다음 반응을 확인하려 했으나 동작 불가: ${String(error).slice(0, 180)}`, before, after: await screenState(page).catch(() => ({ signature: 'unavailable', text: '' })), blocked: true });
      previousOperation = '';
      await page.keyboard.press('Escape').catch(() => {});
    }
    if ([4, 8, 12].includes(step)) await page.screenshot({ path: path.join(outDir, `${persona.id}-a${String(step).padStart(2, '0')}.png`), fullPage: true }).catch(() => {});
  }

  const storageKeys = await page.evaluate(() => ({
    local: Object.keys(localStorage),
    session: Object.keys(sessionStorage),
  })).catch(() => ({ local: [], session: [] }));
  results.push({
    id: persona.id,
    profile: persona.profile,
    interaction: persona.interaction,
    initial: { status: initialResponse?.status() ?? null, ...initial, metrics: initialMetrics },
    actions: logs,
    meaningfulActionCount: logs.filter((item) => !item.blocked).length,
    storageKeys,
    blockedNetwork: blocked,
    requestSummary: {
      allowedLocalReads: requests.filter((request) => request.outcome === 'allowed-local-read').length,
      blockedRequests: requests.filter((request) => request.outcome === 'blocked').length,
      failedRequests: failures,
    },
    started,
    finished: new Date().toISOString(),
  });
  await context.close();
}

await browser.close();
const output = { appUrl: 'http://127.0.0.1:4209/?app=1', syntheticInput, personas: results, generatedAt: new Date().toISOString() };
await writeFile(path.join(outDir, 'exploration-log.json'), JSON.stringify(output, null, 2), 'utf8');
console.log(JSON.stringify({
  personas: results.map((persona) => ({ id: persona.id, initialStatus: persona.initial.status, meaningfulActionCount: persona.meaningfulActionCount, actions: persona.actions.map((action) => ({ step: action.step, operation: action.operation, target: action.target, after: action.after?.signature })), blocked: persona.blockedNetwork.length, storageKeys: persona.storageKeys })),
  output: path.join(outDir, 'exploration-log.json'),
}, null, 2));
