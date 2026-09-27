import { createRequire } from "node:module";
import { mkdir, appendFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import readline from "node:readline";

const require = createRequire(resolve(process.cwd(), "package.json"));
const { chromium } = require("@playwright/test");
const evidenceDir = dirname(fileURLToPath(import.meta.url));
const eventsPath = join(evidenceDir, "actions.ndjson");
const origin = "http://127.0.0.1:4209";
await mkdir(join(evidenceDir, "screenshots"), { recursive: true });

const browser = await chromium.launch({ headless: true });
const contexts = new Map();
const counts = new Map();
const externalBlocks = [];
const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

async function record(event) {
  await appendFile(eventsPath, `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`, "utf8");
}

async function snapshot(page) {
  return await page.evaluate(() => {
    const visible = (el) => {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none";
    };
    const controls = [...document.querySelectorAll("button, a, input, textarea, select, [role=button], [role=tab], [role=link], summary")]
      .filter(visible)
      .slice(0, 100)
      .map((el) => ({
        tag: el.tagName.toLowerCase(),
        role: el.getAttribute("role") || "",
        name: (el.getAttribute("aria-label") || el.innerText || el.getAttribute("placeholder") || el.getAttribute("title") || "").trim().replace(/\s+/g, " ").slice(0, 100),
        type: el.getAttribute("type") || "",
        disabled: Boolean(el.disabled),
        rect: (() => { const r = el.getBoundingClientRect(); return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) }; })(),
      }));
    return {
      title: document.title,
      text: (document.body?.innerText || "").replace(/\n{3,}/g, "\n\n").slice(0, 9000),
      controls,
      viewport: { width: innerWidth, height: innerHeight },
      document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight, scrollY },
      focus: document.activeElement ? {
        tag: document.activeElement.tagName.toLowerCase(),
        name: (document.activeElement.getAttribute("aria-label") || document.activeElement.innerText || document.activeElement.getAttribute("placeholder") || "").trim().slice(0, 80),
      } : null,
      localStorage: Object.keys(localStorage).map((key) => ({ key, length: localStorage.getItem(key)?.length || 0 })).sort((a, b) => a.key.localeCompare(b.key)),
    };
  });
}

async function openPersona(cmd) {
  if (contexts.has(cmd.id)) throw new Error(`Persona already open: ${cmd.id}`);
  const context = await browser.newContext({
    viewport: cmd.viewport,
    deviceScaleFactor: 1,
    isMobile: cmd.device === "mobile",
    hasTouch: cmd.device !== "desktop",
    serviceWorkers: "block",
  });
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    if (url.origin === origin) return route.continue();
    externalBlocks.push({ personaId: cmd.id, method: route.request().method(), hostname: url.hostname });
    return route.abort("blockedbyclient");
  });
  if (context.routeWebSocket) {
    await context.routeWebSocket("**/*", (socketRoute) => {
      const url = new URL(socketRoute.url());
      if (url.hostname === "127.0.0.1" && url.port === "4209") return socketRoute.connectToServer();
      externalBlocks.push({ personaId: cmd.id, method: "WEBSOCKET", hostname: url.hostname });
      return socketRoute.close();
    });
  }
  const page = await context.newPage();
  page.on("pageerror", () => record({ personaId: cmd.id, type: "pageerror" }));
  contexts.set(cmd.id, { context, page, action: 0 });
  counts.set(cmd.id, 0);
  await page.goto(`${origin}/?app=1`, { waitUntil: "domcontentloaded", timeout: 12000 });
  await page.waitForTimeout(400);
  const state = await snapshot(page);
  await record({ personaId: cmd.id, type: "open", viewport: cmd.viewport, device: cmd.device, url: page.url(), state });
  emit({ ok: true, type: "opened", personaId: cmd.id, state });
}

async function locate(page, target) {
  if (target.css) return page.locator(target.css).nth(target.nth || 0);
  if (target.role) return page.getByRole(target.role, { name: target.name, exact: target.exact ?? true }).nth(target.nth || 0);
  if (target.label) return page.getByLabel(target.label, { exact: target.exact ?? true }).nth(target.nth || 0);
  if (target.text) return page.getByText(target.text, { exact: target.exact ?? true }).nth(target.nth || 0);
  throw new Error("target needs role, label, text, or css");
}

async function perform(cmd) {
  const session = contexts.get(cmd.id);
  if (!session) throw new Error(`Persona not open: ${cmd.id}`);
  const { page } = session;
  const before = { url: page.url(), scrollY: await page.evaluate(() => scrollY), state: await snapshot(page) };
  let result = "";
  const op = cmd.action;
  if (op === "click") {
    const locator = await locate(page, cmd.target);
    await locator.click({ timeout: 3000 });
    result = "clicked";
  } else if (op === "fill") {
    const locator = await locate(page, cmd.target);
    await locator.fill(cmd.value, { timeout: 3000 });
    result = "filled synthetic text";
  } else if (op === "check") {
    const locator = await locate(page, cmd.target);
    await locator.check({ timeout: 3000 });
    result = "checked";
  } else if (op === "press") {
    if (cmd.target) await (await locate(page, cmd.target)).press(cmd.key, { timeout: 3000 });
    else await page.keyboard.press(cmd.key);
    result = `pressed ${cmd.key}`;
  } else if (op === "scroll") {
    await page.mouse.wheel(0, cmd.deltaY || 600);
    result = "scrolled";
  } else if (op === "back") {
    const response = await page.goBack({ waitUntil: "domcontentloaded", timeout: 4000 }).catch(() => null);
    if (!response && page.url() === before.url) {
      const backButtons = page.getByRole("button", { name: /뒤로|이전|닫기|홈/ }).first();
      if (await backButtons.count()) await backButtons.click({ timeout: 2500 });
    }
    result = "back navigation attempted";
  } else if (op === "tab") {
    await page.keyboard.press("Tab");
    result = "moved keyboard focus";
  } else if (op === "resize") {
    await page.setViewportSize(cmd.viewport);
    result = "resized viewport";
  } else if (op === "screenshot") {
    result = "captured screenshot";
  } else {
    throw new Error(`Unsupported operation: ${op}`);
  }
  await page.waitForTimeout(180);
  const after = { url: page.url(), scrollY: await page.evaluate(() => scrollY), state: await snapshot(page) };
  const changed = before.url !== after.url || before.scrollY !== after.scrollY || before.state.text !== after.state.text || before.state.focus?.name !== after.state.focus?.name;
  const counted = ["click", "fill", "check", "press", "scroll", "back", "tab"].includes(op) && (op !== "scroll" || before.scrollY !== after.scrollY) && (op !== "tab" || before.state.focus?.name !== after.state.focus?.name || before.state.focus?.tag !== after.state.focus?.tag);
  if (counted) {
    session.action += 1;
    counts.set(cmd.id, session.action);
  }
  const event = {
    personaId: cmd.id,
    type: "action",
    n: session.action,
    op,
    reason: cmd.reason || "",
    counted,
    changed,
    result,
    before: { url: before.url, scrollY: before.scrollY },
    after: { url: after.url, scrollY: after.scrollY },
    visibleText: after.state.text.slice(0, 1200),
    storage: after.state.localStorage,
  };
  if (op === "screenshot" || (counted && session.action % 4 === 0)) {
    const name = `${cmd.id}-${String(session.action).padStart(2, "0")}-${op}.png`;
    await page.screenshot({ path: join(evidenceDir, "screenshots", name), fullPage: false });
    event.screenshot = name;
  }
  await record(event);
  emit({ ok: true, ...event, state: after.state });
}

for await (const line of rl) {
  if (!line.trim()) continue;
  let cmd;
  try {
    cmd = JSON.parse(line);
    if (cmd.op === "open") await openPersona(cmd);
    else if (cmd.op === "act") await perform(cmd);
    else if (cmd.op === "snapshot") {
      const s = contexts.get(cmd.id);
      if (!s) throw new Error(`Persona not open: ${cmd.id}`);
      emit({ ok: true, type: "snapshot", personaId: cmd.id, actionCount: counts.get(cmd.id), state: await snapshot(s.page) });
    } else if (cmd.op === "close") {
      const s = contexts.get(cmd.id);
      if (s) await s.context.close();
      contexts.delete(cmd.id);
      emit({ ok: true, type: "closed", personaId: cmd.id, actionCount: counts.get(cmd.id) || 0 });
    } else if (cmd.op === "status") {
      emit({ ok: true, type: "status", counts: Object.fromEntries(counts), externalBlocks });
    } else if (cmd.op === "quit") {
      for (const { context } of contexts.values()) await context.close();
      emit({ ok: true, type: "summary", counts: Object.fromEntries(counts), externalBlocks });
      await browser.close();
      process.exit(0);
    } else throw new Error(`Unknown command: ${cmd.op}`);
  } catch (error) {
    emit({ ok: false, personaId: cmd?.id, op: cmd?.op, error: String(error?.message || error) });
  }
}

await browser.close();
