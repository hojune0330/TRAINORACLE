import { chromium } from "playwright";
const BASE = "http://127.0.0.1:4173/";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 375, height: 667 } });
const shot = (n) => page.screenshot({ path: `e2e-review/pr237/${n}.png` });
const scrollRegion = async (px) => { await page.evaluate((v) => { const el = document.querySelector(".app-scroll-region"); if (el) el.scrollTop = v; }, px); await page.waitForTimeout(300); };

await page.goto(BASE); await page.waitForTimeout(800);
await shot("A-welcome-fold");
const foldA = await page.evaluate(() => {
  const vh = document.querySelector(".app-scroll-region")?.clientHeight ?? 0;
  const btn = (name) => { const el = [...document.querySelectorAll("button")].find(b => b.textContent.includes(name)); return el ? Math.round(el.getBoundingClientRect().bottom) : null; };
  const h1 = document.querySelector("h1");
  return { vh, h1: h1 ? Math.round(h1.getBoundingClientRect().bottom) : null,
    trust: !!document.querySelector(".training-home__trust"),
    cta1: btn("오늘 기록 남기기"), cta2: btn("훈련 계획 만들기"), minji: btn("민지의 예시 일지 보기"),
    todaySection: !!document.querySelector(".training-home__today"),
    restBtn: [...document.querySelectorAll("button")].some(b => b.textContent.trim() === "하루 마무리 기록하기") };
});
console.log("WELCOME fold:", JSON.stringify(foldA));
await scrollRegion(4000); await shot("A-welcome-bottom");
const bottomA = await page.evaluate(() => ({
  minjiButtons: [...document.querySelectorAll("button")].filter(b => b.textContent.includes("민지의 예시")).length,
  shop: !!document.querySelector(".decoration-shop"),
  engagement: !!document.querySelector(".engagement-strip"),
  engagementText: document.querySelector(".engagement-strip")?.textContent?.slice(0,80) ?? null,
}));
console.log("WELCOME bottom:", JSON.stringify(bottomA));
const tab = await page.evaluate(() => [...document.querySelectorAll(".app-tab-bar__button span")].map(s => ({ t: s.textContent, h: Math.round(s.getBoundingClientRect().height) })));
console.log("TABS:", JSON.stringify(tab));

await scrollRegion(0);
await page.getByRole("button", { name: "훈련 계획 만들기" }).click(); await page.waitForTimeout(700);
await shot("A-cta2-plan");
console.log("CTA2 heading:", await page.evaluate(() => document.querySelector("h1,h2")?.textContent?.slice(0,40)));

await page.goto(BASE); await page.evaluate(() => {
  const today = new Date().toISOString().slice(0,10);
  localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{ id: "e1", kind: "post-session", date: today, title: "가볍게 조깅", system: "easy", distanceKm: "5", durationMin: "30", avgPace: "", rpe: 3, memo: "", painParts: {} }]));
});
await page.goto(BASE); await page.waitForTimeout(800);
const foldC = await page.evaluate(() => ({
  h1: document.querySelector("h1")?.textContent,
  secs: [...document.querySelectorAll("section")].map(s => s.className.split(" ")[0]).slice(0,4),
}));
console.log("JOURNAL:", JSON.stringify(foldC));
await shot("C-journal-fold");
await browser.close();
