import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname);
const requireFromApp = createRequire(resolve(root, "../../app/package.json"));
const { chromium } = requireFromApp("@playwright/test");
const evidenceDir = resolve(root, "../../runtime-evidence/formation-projection");
const prototypeUrl = pathToFileURL(resolve(root, "index.html")).href;
const browser = await chromium.launch({ headless: true });
const uniqueValues = (values) => [...new Set(values)];

const contrastRatio = (foreground, background) => {
  const channels = (value) => value.match(/[0-9.]+/gu)?.slice(0, 3).map(Number) ?? [];
  const luminance = (value) => {
    const components = channels(value).map((channel) => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    assert.equal(components.length, 3, `cannot parse color ${value}`);
    return 0.2126 * components[0] + 0.7152 * components[1] + 0.0722 * components[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
};

mkdirSync(evidenceDir, { recursive: true });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const requests = [];
  page.on("request", (request) => requests.push(request.url()));
  await page.goto(prototypeUrl);

  const projection = page.locator("[data-fact-hash]");
  const beforeFact = await projection.getAttribute("data-fact-hash");
  const beforePlan = await projection.getAttribute("data-real-plan-hash");
  const explanationCopies = new Set();
  for (const level of ["쉽게", "짧게", "균형", "자세히", "정확히"]) {
    await page.getByText(level, { exact: true }).click();
    explanationCopies.add(await page.getByTestId("explanation-copy").innerText());
  }
  assert.equal(explanationCopies.size, 5);
  assert.equal(await page.getByRole("radio", { name: "정확히" }).isChecked(), true);
  assert.match(await page.getByTestId("explanation-copy").innerText(), /출처 꼬리표/u);
  assert.equal(await projection.getAttribute("data-fact-hash"), beforeFact);
  assert.equal(await projection.getAttribute("data-real-plan-hash"), beforePlan);
  assert.equal(await page.getByRole("button", { name: "검토 요청" }).isDisabled(), true);
  const scenarioMessages = {
    current: "비실행 시뮬레이션",
    missing: "기록이 더 필요해요",
    stale: "최근 상태를 확인해 주세요",
    unknown: "지금은 판단할 수 없어요",
    conflict: "서로 다른 기록이 있어요",
    paused: "분석이 잠시 멈췄어요",
    withdrawn: "분석 동의가 철회됐어요",
    stopped: "검토가 중단됐어요",
  };
  for (const [value, message] of Object.entries(scenarioMessages)) {
    await page.locator("#scenario").selectOption(value);
    assert.equal(await page.locator("#status-title").innerText(), message);
  }

  await page.getByText("일지만", { exact: true }).click();
  assert.equal(await page.locator(".projection-panel").isVisible(), false);
  assert.equal(await page.locator(".journal-panel").isVisible(), true);
  assert.equal(await page.getByText("Formation 화면 없음", { exact: true }).isVisible(), true);

  await page.getByText("허용된 보호자", { exact: true }).click();
  assert.equal(await page.locator(".projection-panel").isVisible(), false);
  assert.equal(await page.locator(".journal-panel").isVisible(), false);
  assert.equal(await page.getByText("허용된 요약만 표시", { exact: true }).isVisible(), true);
  assert.equal(await page.getByText("최근 RPE", { exact: true }).isVisible(), false);

  await page.getByText("코치", { exact: true }).click();
  assert.equal(await page.locator(".projection-panel").isVisible(), true);
  await page.getByText("선수", { exact: true }).click();
  assert.equal(await page.locator(".journal-panel").isVisible(), true);

  const undersized = await page.locator("a, select, button, .segment span").evaluateAll((nodes) =>
    nodes.filter((node) => {
      const style = getComputedStyle(node);
      const rect = node.getBoundingClientRect();
      return style.display !== "none" && style.visibility !== "hidden" && (rect.width < 44 || rect.height < 44);
    }).map((node) => `${node.tagName}:${node.textContent?.trim() ?? ""}`),
  );
  assert.deepEqual(undersized, []);

  const bandRects = await page.locator(".topbar, .status-band, .controls-band, .workspace, footer").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    }),
  );
  for (let index = 1; index < bandRects.length; index += 1) {
    assert.ok(bandRects[index - 1].bottom <= bandRects[index].top + 1, `major bands overlap at ${index}`);
  }

  for (const selector of ["h1", ".status-line strong", ".segment input:checked + span"]) {
    const colors = await page.locator(selector).first().evaluate((node) => {
      const style = getComputedStyle(node);
      let backgroundNode = node;
      let background = style.backgroundColor;
      while (background === "rgba(0, 0, 0, 0)" && backgroundNode.parentElement) {
        backgroundNode = backgroundNode.parentElement;
        background = getComputedStyle(backgroundNode).backgroundColor;
      }
      return { foreground: style.color, background };
    });
    assert.ok(contrastRatio(colors.foreground, colors.background) >= 4.5, `${selector} contrast is below 4.5:1`);
  }

  const focused = [];
  for (let index = 0; index < 7; index += 1) {
    await page.keyboard.press("Tab");
    focused.push(await page.evaluate(() => `${document.activeElement?.tagName}:${document.activeElement?.getAttribute("name") ?? document.activeElement?.id ?? ""}`));
  }
  assert.ok(uniqueValues(focused).length >= 5, "keyboard order does not reach enough controls");
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
  assert.equal((await page.context().cookies()).length, 0);
  assert.deepEqual(requests.filter((url) => !url.startsWith("file:")), []);
  assert.equal(await projection.getAttribute("data-fact-hash"), beforeFact);
  assert.equal(await projection.getAttribute("data-real-plan-hash"), beforePlan);
  await page.close();

  const viewports = [
    { name: "mobile-320", width: 320, height: 700 },
    { name: "mobile-375", width: 375, height: 667 },
    { name: "desktop", width: 1440, height: 900 },
  ];
  for (const viewport of viewports) {
    const viewportPage = await browser.newPage({ viewport });
    await viewportPage.goto(prototypeUrl);
    const overflow = await viewportPage.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    assert.equal(overflow, false, `${viewport.name} has horizontal overflow`);
    await viewportPage.screenshot({
      path: resolve(evidenceDir, `${viewport.name}.png`),
      fullPage: true,
    });
    await viewportPage.close();
  }

  const zoomPage = await browser.newPage({ viewport: { width: 720, height: 900 } });
  await zoomPage.emulateMedia({ reducedMotion: "reduce" });
  await zoomPage.goto(prototypeUrl);
  await zoomPage.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await zoomPage.keyboard.press("Tab");
  assert.equal(await zoomPage.locator(":focus-visible").count(), 1);
  const zoomOverflow = await zoomPage.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  assert.equal(zoomOverflow, false, "200 percent zoom has horizontal overflow");
  const animationName = await zoomPage
    .locator(".status-beacon")
    .evaluate((node) => getComputedStyle(node).animationName);
  assert.equal(animationName, "none");
  await zoomPage.screenshot({
    path: resolve(evidenceDir, "zoom-200-reduced-motion.png"),
    fullPage: true,
  });
  await zoomPage.close();
} finally {
  await browser.close();
}

console.log("PASS Formation projection browser contract levels=5 audiences=4 states=8 viewports=4 network=0");
