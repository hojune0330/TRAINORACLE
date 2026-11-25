// Measure the required first-lap path in Chrome. Pass the single-file HTML to check the offline edition.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "@playwright/test";

const input = process.argv[2] ? pathToFileURL(resolve(process.argv[2])) : new URL("../public/run-bti/index.html", import.meta.url);
const screenshots = process.env.RUN_BTI_SCREENSHOTS;
const browser = await chromium.launch({ channel: process.env.RUN_BTI_BROWSER_CHANNEL || "chrome" });
try {
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, reducedMotion: "reduce" });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(() => {
    window.notesStarted = 0;
    const start = OscillatorNode.prototype.start;
    OscillatorNode.prototype.start = function (...args) {
      window.notesStarted++;
      return start.apply(this, args);
    };
  });
  if (screenshots) await mkdir(screenshots, {recursive:true});
  async function capture(name) {
    if (!screenshots) return;
    await page.screenshot({path:join(screenshots, name + ".png"), animations:"disabled"});
  }
  async function readScreen() {
    return page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const words = [];
      while (walker.nextNode()) {
        const node = walker.currentNode, parent = node.parentElement;
        if (!parent || parent.closest("script,style,noscript,[aria-hidden=true],.fp-sr")) continue;
        const closed = parent.closest("details:not([open])");
        if (closed && !closed.querySelector(":scope > summary")?.contains(parent)) continue;
        const word = node.textContent.replace(/\s+/g, " ").trim();
        if (!word) continue;
        const range = document.createRange();
        range.selectNodeContents(node);
        if (range.getBoundingClientRect().width > 1) words.push(word);
      }
      return words.join(" ");
    });
  }
  await page.goto(input.href);
  await page.locator('[data-fp="start"]').waitFor();
  await capture("01-home");
  let chars = [...await readScreen()].length, taps = 0, screens = 0;
  await page.locator('[data-fp="start"]').click();
  taps++;
  const requested = {strength:"endurance", goal:"speed"};
  const phases = new Set();
  while (await page.locator('[data-fp="next"]').count()) {
    assert.ok(++screens < 20);
    assert.equal(await page.locator(".lap-mate, img[src*='/mini-']").count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    phases.add(await page.locator("[data-lap-stage]").getAttribute("data-lap-stage"));
    chars += [...await readScreen()].length;
    if (screens === 2) {
      await page.evaluate(() => Promise.all(Array.from(document.querySelectorAll(".lap-tableau img"), img => img.decode())));
      await capture("02-track");
    }
    for (const field of await page.locator(".fp-question").all()) {
      const first = field.locator("input:is([type=radio],[type=checkbox])").first();
      const name = await first.getAttribute("name");
      const side = name.split("-")[0];
      const value = requested[name] || (name.includes("-") ? (["distance","numbers"].includes(side) ? "2" : "0") : await first.inputValue());
      await field.locator("label").filter({has:page.locator('input[value="' + value + '"]')}).click();
      taps++;
    }
    await page.locator('[data-fp="next"]').click();
    taps++;
  }
  const finish = page.locator('[data-lap-stage="finish"]');
  await finish.waitFor({state:"attached"});
  assert.equal(phases.size, 7, "all seven pre-finish stops were visited");
  assert.match(await page.locator(".fp-result-top").innerText(), /황제펭귄/);
  const facts = await page.locator(".lap-finish-facts").innerText();
  assert.match(facts, /오래 달리기/);
  assert.match(facts, /속도 내기/);
  await page.evaluate(() => Promise.all(Array.from(document.querySelectorAll(".lap-finish img"), img => img.decode())));
  await capture("03-result");
  await finish.scrollIntoViewIfNeeded();
  await capture("04-finish");
  const bag = page.locator(".lap-finish details.lap-bag");
  await bag.locator("summary").click();
  assert.equal(await bag.locator("[data-lap-item]").count(), 6);
  await bag.scrollIntoViewIfNeeded();
  await capture("05-bag");
  const decoded = await page.evaluate(async () => {
    const keys = Object.keys(window.RBPairsModel.characters);
    const files = keys.flatMap(key => ["mini", "silhouette", "face"].map(kind => kind + "-" + key.replace("+", "-")));
    await Promise.all(files.map(async file => {
      const path = "assets/lap/" + file + ".webp";
      const img = new Image();
      img.src = window.RBScene.assetURL(path);
      await img.decode();
      if (img.naturalWidth < 48 || img.naturalHeight < 48) throw new Error(file);
      if (window.RBAssets && !img.src.startsWith("data:")) throw new Error("External image in offline file: " + file);
    }));
    return files.length;
  });
  assert.equal(decoded, 96);
  const sound = page.locator('#mast [data-fp="sound"]');
  assert.equal(await page.evaluate(() => window.notesStarted), 0);
  await sound.click();
  await page.waitForFunction(() => window.notesStarted > 0 && window.RBLapSound.enabled);
  await sound.click();
  assert.equal(await sound.getAttribute("aria-pressed"), "false");
  const muted = await page.evaluate(() => {
    const before = window.notesStarted;
    window.RBLapSound.play("finish");
    return before === window.notesStarted && !window.RBLapSound.enabled;
  });
  assert.equal(muted, true);
  assert.deepEqual(errors, []);
  const estimate = Math.ceil(chars / 500 * 60 + taps);
  console.log(JSON.stringify({width:360,height:800,screens,characters:chars,taps,mandatoryAnimationWait:0,estimatedSeconds:estimate}));
  assert.ok(estimate <= 240, "required reading and taps should fit the four-minute budget");
} finally {
  await browser.close();
}
