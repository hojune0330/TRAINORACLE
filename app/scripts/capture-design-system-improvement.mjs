import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const require = createRequire(`${repo}/app/package.json`);
const { chromium } = require('@playwright/test');
const runName = process.argv[2] ?? 'pass-01';
assert.match(runName, /^[a-z0-9-]+$/u);
const out = path.join(repo, 'reports/review/evidence/design-system-improvement-20260912', runName);
await mkdir(out, { recursive: true });
const { preview } = await import(pathToFileURL(require.resolve('vite')).href);
const server = await preview({ root: `${repo}/app`, preview: { host: '127.0.0.1', port: 4188, strictPort: true } });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 375, height: 667 }, locale: 'ko-KR', timezoneId: 'Asia/Seoul' });
const findings = [];
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.route('**/*', route => {
  const url = new URL(route.request().url());
  if (url.hostname === '127.0.0.1' || url.protocol === 'data:' || url.protocol === 'blob:') return route.continue();
  return route.abort();
});

async function capture(name) {
  await page.evaluate(async () => { await document.fonts.ready; await Promise.all(document.getAnimations().filter(a => a.effect?.getTiming().iterations !== Infinity).map(a => a.finished.catch(() => {}))); });
  const data = await page.evaluate(() => {
    const root = document.querySelector('.app-scroll-region');
    const visible = el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const controls = [...document.querySelectorAll('button,input,select,textarea,summary,a')].filter(visible).map(el => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { text: el.getAttribute('aria-label') || el.textContent?.trim().slice(0, 80), tag: el.tagName, className: String(el.className), width: Math.round(r.width), height: Math.round(r.height), top: Math.round(r.top), font: s.fontSize, weight: s.fontWeight }; });
    const geometry = [...document.querySelectorAll('.plan-training-flow__legend,.personal-oracle__mark,.personal-oracle__status,.journal-decoration-toolbar,.saved-toast,.home-welcome-fold,.app-tab-bar')].map(el => { const r = el.getBoundingClientRect(); const c = getComputedStyle(el); return { className: el.className, top:r.top, width:r.width, height:r.height, display:c.display, columns:c.gridTemplateColumns, font:c.fontSize, color:c.color, border:c.borderTop, accent:c.getPropertyValue('--accent'), lineDark:c.getPropertyValue('--line-dark') }; });
    return { title: document.title, text: document.body.innerText, scrollHeight: root?.scrollHeight, clientHeight: root?.clientHeight, overflow: document.documentElement.scrollWidth > innerWidth, fontReady: document.fonts.check('14px "Pretendard Variable"'), loadedFonts:[...document.fonts].map(f => ({ family:f.family, status:f.status })), geometry, controls, headings: [...document.querySelectorAll('h1,h2,h3')].map(el => ({ text: el.textContent, top: Math.round(el.getBoundingClientRect().top), size: getComputedStyle(el).fontSize })) };
  });
  findings.push({ name, ...data });
  assert.equal(data.overflow, false, `${name}: document horizontal overflow`);
  assert.equal(data.fontReady, true, `${name}: Pretendard did not load`);
  assert.equal(data.loadedFonts.some(font => font.family.includes('Pretendard Variable') && font.status === 'loaded'), true, `${name}: expected bundled font face is not loaded`);
  await page.screenshot({ path: path.join(out, `${name}.png`) });
  console.log(name, JSON.stringify({ overflow: data.overflow, headings: data.headings.map(h => h.text), controls: data.controls.length, scrollHeight: data.scrollHeight }));
}
async function fresh() { await page.goto('http://127.0.0.1:4188/?app=1&uitest=1'); }
try {
  await fresh(); await capture('01-home-new-375');
  for (const [label, name] of [['일지','02-journal-empty-375'], ['경기기록','03-race-entry-375'], ['계획','04-plan-start-375'], ['분석','05-analysis-empty-375']]) {
    await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: label, exact: true }).click();
    await capture(name);
  }
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '홈', exact: true }).click();
  await page.getByRole('button', { name: '더보기', exact: true }).click(); await capture('06-more-375');
  await page.getByRole('button', { name: '민지의 예시 일지', exact: true }).click(); await capture('07-example-index-375');
  await page.getByRole('button', { name: /첫날.*4\.6km를 달린 첫 기록/ }).click(); await capture('08-example-paper-375');
  await page.getByRole('button', { name: '다음 일지', exact: true }).click(); await capture('09-example-next-375');
  await fresh();
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await page.getByRole('button', { name: '훈련 용어집·도움말', exact: true }).click(); await capture('10-guide-375');
  await fresh();
  await page.getByRole('button', { name: '더보기', exact: true }).click();
  await page.getByRole('button', { name: '요즘 주목받는 훈련법', exact: true }).click(); await capture('11-content-375');
  await fresh();
  if (await page.getByRole('button', { name: '로그인 또는 가입' }).count()) { await page.getByRole('button', { name: '로그인 또는 가입' }).click(); await capture('12-login-375'); }
  await page.setViewportSize({ width: 1440, height: 900 }); await fresh(); await capture('13-home-new-1440');
  await page.setViewportSize({ width: 320, height: 568 }); await fresh(); await capture('14-home-new-320');
  await page.setViewportSize({ width: 375, height: 667 }); await fresh();
  await page.getByRole('button', { name: '오늘 기록 남기기', exact: true }).click(); await capture('15-quick-outcome-375');
  await page.getByRole('button', { name: '운동을 마쳤어요', exact: true }).click(); await capture('16-quick-slot-375');
  await page.getByRole('button', { name: '오후', exact: true }).click(); await capture('17-quick-rpe-375');
  await page.getByRole('button', { name: /RPE 6,/ }).click(); await capture('18-quick-body-375');
  await page.getByRole('button', { name: '없어요', exact: true }).click(); await capture('19-quick-saved-375');
  await page.getByRole('button', { name: '일지 더 쓰기', exact: true }).click(); await capture('20-detailed-journal-375');
  await page.getByLabel('거리 (km)', { exact: true }).fill('5');
  await page.getByRole('button', { name: /^수정 저장/ }).click(); await capture('21-saved-journal-detail-375');
  await page.getByRole('button', { name: '일지 꾸미기 열기', exact: true }).click(); await capture('22-editor-canvas-375');
  await page.getByRole('button', { name: '모든 꾸미기 도구', exact: true }).click();
  await page.evaluate(async () => {
    await Promise.all(document.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity)
      .map(animation => animation.finished.catch(() => {})));
  });
  const overlap = await page.evaluate(() => {
    const toast = document.querySelector('.saved-toast');
    const drawer = document.querySelector('.journal-decoration-toolbar[data-open="true"]');
    if (!toast || !drawer) return { observed: false };
    const a = toast.getBoundingClientRect();
    const b = drawer.getBoundingClientRect();
    const width = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left));
    const height = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
    const tile = [...drawer.querySelectorAll('button')].find(el => {
      const r = el.getBoundingClientRect();
      return r.width >= 44 && r.height >= 44 && r.top >= b.top && r.bottom <= b.bottom;
    });
    const r = tile?.getBoundingClientRect();
    const hit = r ? document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2) : null;
    const toastHit = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
    return { observed: true, overlapArea: width * height, receiptExposed: !!toastHit && toast.contains(toastHit), controlReachable: !!tile && !!hit && tile.contains(hit), control: tile?.getAttribute('aria-label') || tile?.textContent, hit: hit?.tagName, hitClass: hit?.className, drawer: { top: b.top, bottom: b.bottom }, controlBounds: r ? { top: r.top, bottom: r.bottom } : null };
  });
  findings.push({ name: 'receipt-drawer-hit-test', ...overlap });
  await page.screenshot({ path: path.join(out, '23-editor-drawer-hitcheck-375.png') });
  assert.equal(overlap.observed, true, 'Receipt expired before overlap scenario was measured');
  assert.equal(overlap.overlapArea, 0, 'Save receipt overlaps material drawer');
  assert.equal(overlap.receiptExposed, true, 'Save receipt is hidden behind another layer');
  assert.equal(overlap.controlReachable, true, 'Material drawer control is occluded');
  await capture('23-editor-drawer-375');
  await page.setViewportSize({ width: 1440, height: 900 }); await capture('24-editor-drawer-1440');
  await page.setViewportSize({ width: 320, height: 568 }); await capture('25-editor-drawer-320');
  await page.locator('.saved-toast').waitFor({ state: 'hidden', timeout: 20000 });
  await capture('25b-editor-drawer-clear-320');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('button', { name: '맑은 날 붙이기', exact: true }).click(); await capture('25c-editor-sticker-375');
  await page.setViewportSize({ width: 1440, height: 900 }); await capture('25d-editor-sticker-1440');
  await page.setViewportSize({ width: 375, height: 667 }); await fresh();
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '계획', exact: true }).click();
  await page.getByRole('button', { name: /^1500m/ }).click(); await capture('26-plan-division-375');
  await page.getByRole('button', { name: /고등부/ }).click(); await capture('27-plan-experience-375');
  await page.getByRole('button', { name: /훈련 계획에 맞춰 달려 본 경험이 있어요/ }).click();
  await page.getByRole('button', { name: /통증은 없고 몸 상태는 평소와 같아요/ }).click(); await capture('28-plan-preview-375');
  await page.getByRole('button', { name: '내 계획 완성하기', exact: true }).click(); await capture('29-plan-purpose-375');
  await page.getByRole('button', { name: /지속 페이스.*LT/ }).click(); await capture('30-plan-method-375');
  await page.getByRole('button', { name: /^RPE 기준으로 받기/ }).click();
  await page.getByRole('button', { name: /^3일/ }).click();
  await page.getByRole('button', { name: /^9일 계획 받기/ }).click();
  await page.getByRole('button', { name: /아침에 운동해요/ }).click();
  await page.getByRole('button', { name: /하루 한 번 운동/ }).click();
  await page.getByRole('button', { name: '날짜 없이 계획안 보기', exact: true }).click(); await capture('31-plan-candidates-375');
  await page.getByRole('button', { name: '시간 조절 계획 선택하기', exact: true }).click(); await capture('34-saved-plan-375');
  await page.getByRole('button', { name: '훈련 방법과 이유', exact: true }).first().click(); await capture('35-session-method-375');
  await page.getByRole('tab', { name: '이유·근거', exact: true }).click(); await capture('36-session-reason-375');
  await page.setViewportSize({ width: 320, height: 568 }); await page.getByLabel('전문 보기', { exact: true }).check(); await capture('37-session-reason-expert-320');
  await page.getByRole('button', { name: '훈련 일정으로 돌아가기', exact: true }).click();
  await page.setViewportSize({ width: 375, height: 667 });
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '홈', exact: true }).click(); await capture('38-home-returning-375');
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '분석', exact: true }).click(); await capture('32-analysis-recorded-375');
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '일지', exact: true }).click(); await capture('33-journal-recorded-375');
  await page.setViewportSize({ width: 768, height: 1024 });
  await fresh(); await capture('41-home-returning-768');
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '분석', exact: true }).click();
  await capture('42-analysis-recorded-768');
  await page.setViewportSize({ width: 375, height: 667 });
  await page.evaluate(() => {
    // Uniform text scaling is a stress test, not native browser/system zoom evidence.
    const sizes = [...document.querySelectorAll('*')].filter(el => el instanceof HTMLElement)
      .map(el => [el, parseFloat(getComputedStyle(el).fontSize)]);
    for (const [el, size] of sizes) el.style.fontSize = `${size * 2}px`;
  });
  await capture('43-analysis-uniform-text-200-percent-375');
  await fresh();
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByRole('navigation', { name: '주 탭' }).getByRole('button', { name: '일지', exact: true }).click();
  await capture('44-journal-reduced-motion-375');
  assert.deepEqual(errors, [], 'Unexpected application page errors');
} finally {
  await writeFile(path.join(out, 'observations.json'), JSON.stringify({ observations: findings, errors }, null, 2));
  await browser.close();
  await new Promise(resolve => server.httpServer.close(resolve));
}
