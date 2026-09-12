import { createRequire } from 'node:module';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
const repo = 'D:/admin/Documents/ChatGPT/트레인 오라클/TRAINORACLE-integrate-pr317-20260911';
const out = 'D:/admin/Documents/ChatGPT/트레인 오라클/.scratch/design-review-20260912';
const require = createRequire(`${repo}/app/package.json`);
const { chromium } = require('@playwright/test');
const browser = await chromium.launch({ channel:'chrome', headless:true });
const page = await browser.newPage({ viewport:{width:1440,height:1000}, locale:'ko-KR' });
await page.route(/^https?:/, r => r.abort());
const rows = [];
try {
  for (const [file, target] of [['17 Session Prep.html','.phone'],['18 Weekly Wrap.html','.phone'],['19 Coach Handoff.html','body'],['20 Handoff Risk Review.html','body']]) {
    await page.goto(pathToFileURL(`${repo}/design_handoff_plan_beta_extension/${file}`).href);
    await page.evaluate(() => document.fonts.ready);
    if (target === 'body') await page.screenshot({path:`${out}/proposal-${file.slice(0,2)}.png`});
    else await page.locator(target).first().screenshot({path:`${out}/proposal-${file.slice(0,2)}.png`});
    rows.push({file, title:await page.title(), images:await page.locator('img').evaluateAll(imgs => imgs.map(img => ({src:img.getAttribute('src'),loaded:img.complete&&img.naturalWidth>0}))), externalFontsBlocked:true});
  }
  const directory = `${repo}/design_handoff_plan_beta_extension/shared/decorations`;
  const assets = await readdir(directory);
  const cells=[];
  for (const file of assets) {
    const source=await readFile(`${directory}/${file}`,'utf8');
    cells.push(`<figure><img src="data:image/svg+xml;base64,${Buffer.from(source).toString('base64')}"/><figcaption>${file}</figcaption></figure>`);
  }
  await page.setContent(`<html><head><style>body{margin:24px;background:#FAFAF7;color:#0E1412;font:14px Arial}main{display:grid;grid-template-columns:repeat(4,1fr);gap:16px}figure{margin:0;background:#F7F3E8;border:1px solid #D9D6CE;padding:12px}img{display:block;width:100%;height:130px;object-fit:contain}figcaption{margin-top:12px;font-size:13px}</style></head><body><h1>Proposal assets: visual review only</h1><main>${cells.join('')}</main></body></html>`);
  await page.locator('img').evaluateAll(imgs=>Promise.all(imgs.map(i=>i.decode())));
  await page.screenshot({path:`${out}/proposal-assets.png`,fullPage:true});
  await writeFile(`${out}/proposal-observations.json`,JSON.stringify({rows,assets},null,2));
  console.log(JSON.stringify({screens:rows.length,assets:assets.length,failedImages:rows.flatMap(r=>r.images).filter(i=>!i.loaded).length}));
} finally { await browser.close(); }
