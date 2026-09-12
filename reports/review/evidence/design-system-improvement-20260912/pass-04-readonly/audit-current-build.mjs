import { createRequire } from "node:module"
import { mkdir, writeFile } from "node:fs/promises"
import path from "node:path"

const repo = process.cwd()
const require = createRequire(`${repo}/app/package.json`)
const { chromium } = require("@playwright/test")
const out = path.join(
  repo,
  "reports/review/evidence/design-system-improvement-20260912/pass-04-readonly",
)
const url = "http://127.0.0.1:4192/?app=1&uitest=1"

await mkdir(out, { recursive: true })
const browser = await chromium.launch({ channel: "chrome", headless: true })
const page = await browser.newPage({
  viewport: { width: 320, height: 568 },
  locale: "ko-KR",
  timezoneId: "Asia/Seoul",
})
const findings = {}
const errors = []
page.on("pageerror", (error) => errors.push(error.message))
await page.route("**/*", (route) => {
  const requestUrl = new URL(route.request().url())
  if (["127.0.0.1", "localhost"].includes(requestUrl.hostname)
    || ["data:", "blob:"].includes(requestUrl.protocol)) {
    return route.continue()
  }
  return route.abort()
})

const settle = async () => {
  await page.evaluate(async () => {
    await document.fonts.ready
    await Promise.all(document.getAnimations()
      .filter((animation) => animation.effect?.getTiming().iterations !== Infinity)
      .map((animation) => animation.finished.catch(() => undefined)))
  })
}

const fresh = async (width, height, clear = false) => {
  await page.setViewportSize({ width, height })
  await page.goto(url)
  if (clear) {
    await page.evaluate(() => localStorage.clear())
    await page.reload()
  }
  await settle()
}

const screenshot = async (name) => {
  await settle()
  await page.screenshot({ path: path.join(out, `${name}.png`) })
}

const shellGeometry = async () => page.evaluate(() => {
  const rect = (element) => {
    if (!(element instanceof HTMLElement)) return null
    const box = element.getBoundingClientRect()
    return {
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      left: box.left,
      width: box.width,
      height: box.height,
    }
  }
  const scroll = document.querySelector(".app-scroll-region")
  const nav = document.querySelector(".app-tab-bar")
  return {
    viewport: { width: innerWidth, height: innerHeight },
    scroll: {
      ...rect(scroll),
      scrollTop: scroll?.scrollTop ?? null,
      scrollHeight: scroll?.scrollHeight ?? null,
      clientHeight: scroll?.clientHeight ?? null,
      maxScroll: scroll instanceof HTMLElement ? scroll.scrollHeight - scroll.clientHeight : null,
    },
    nav: rect(nav),
    documentHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  }
})

const exactTextGeometry = async (text) => page.evaluate((wanted) => {
  const matches = [...document.querySelectorAll("h1,h2,h3,h4,strong,span,div,p")]
    .filter((element) => element.textContent?.trim() === wanted)
    .sort((a, b) => a.children.length - b.children.length)
  const element = matches[0]
  if (!(element instanceof HTMLElement)) return null
  const box = element.getBoundingClientRect()
  return {
    tag: element.tagName,
    className: element.className,
    top: box.top,
    bottom: box.bottom,
    left: box.left,
    right: box.right,
    width: box.width,
    height: box.height,
  }
}, text)

const revealAndHitButton = async (name) => {
  const button = page.getByRole("button", { name, exact: true })
  await button.scrollIntoViewIfNeeded()
  await page.waitForTimeout(50)
  return button.evaluate((element) => {
    const box = element.getBoundingClientRect()
    const scroll = document.querySelector(".app-scroll-region")?.getBoundingClientRect()
    const nav = document.querySelector(".app-tab-bar")?.getBoundingClientRect()
    const centerX = box.left + box.width / 2
    const centerY = box.top + box.height / 2
    const hit = document.elementFromPoint(centerX, centerY)
    return {
      rect: {
        top: box.top,
        bottom: box.bottom,
        left: box.left,
        right: box.right,
        width: box.width,
        height: box.height,
      },
      withinScrollViewport: !!scroll && box.top >= scroll.top - 0.5 && box.bottom <= scroll.bottom + 0.5,
      aboveNav: !nav || box.bottom <= nav.top + 0.5,
      centerHit: !!hit && element.contains(hit),
      hitTag: hit?.tagName ?? null,
      hitClass: hit instanceof HTMLElement ? hit.className : null,
    }
  })
}

await fresh(320, 568, true)
findings.home320Initial = {
  shell: await shellGeometry(),
  journalHeading: await exactTextGeometry("내 일지"),
}
await screenshot("01-home-320-initial")

await page.getByText("내 일지", { exact: true }).first().scrollIntoViewIfNeeded()
await page.waitForTimeout(50)
findings.home320JournalRevealed = {
  shell: await shellGeometry(),
  journalHeading: await exactTextGeometry("내 일지"),
}
await screenshot("02-home-320-journal-revealed")

findings.home320TrainingButton = await revealAndHitButton("훈련 계획 만들기")
await screenshot("03-home-320-training-row-revealed")
await page.locator(".app-scroll-region").evaluate((element) => {
  element.scrollTop = element.scrollHeight
})
await page.waitForTimeout(50)
findings.home320Bottom = await shellGeometry()
await screenshot("04-home-320-bottom")

await fresh(375, 667)
findings.home375Initial = {
  shell: await shellGeometry(),
  journalHeading: await exactTextGeometry("내 일지"),
}
findings.home375TrainingButton = await revealAndHitButton("훈련 계획 만들기")
await screenshot("05-home-375-training-row-revealed")

await fresh(375, 667)
await page.getByRole("button", { name: "오늘 기록 남기기", exact: true }).click()
await page.getByRole("button", { name: "운동을 마쳤어요", exact: true }).click()
await page.getByRole("button", { name: "오후", exact: true }).click()
await page.getByRole("button", { name: /RPE 6,/ }).click()
await page.getByRole("button", { name: "없어요", exact: true }).click()
await page.getByRole("button", { name: "일지 더 쓰기", exact: true }).click()
await page.getByLabel("거리 (km)", { exact: true }).fill("5")
await page.getByRole("button", { name: /^수정 저장/ }).click()
await page.getByRole("button", { name: "일지 꾸미기 열기", exact: true }).click()
await page.getByRole("button", { name: "모든 꾸미기 도구", exact: true }).click()
await settle()
await page.getByRole("button", { name: "맑은 날 붙이기", exact: true }).click()
await settle()

const editorGeometry = async () => page.evaluate(() => {
  const rect = (element) => {
    if (!(element instanceof HTMLElement)) return null
    const box = element.getBoundingClientRect()
    return {
      top: box.top,
      right: box.right,
      bottom: box.bottom,
      left: box.left,
      width: box.width,
      height: box.height,
    }
  }
  const workspace = document.querySelector(".journal-decoration-workspace--open")
  const topbar = document.querySelector(".journal-decoration-editor__topbar")
  const tray = document.querySelector(".journal-decoration-editor__selection-actions")
  const body = document.querySelector(".decorated-journal-page__body")
  const metric = document.querySelector(".journal-entry-metrics")
  const workspaceRect = rect(workspace)
  const topbarRect = rect(topbar)
  const trayRect = rect(tray)
  const metricRect = rect(metric)
  const overlap = (a, b) => {
    if (!a || !b) return null
    return Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left))
      * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  }
  const trayButtons = tray ? [...tray.querySelectorAll("button")].map((button) => {
    const box = button.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return {
      name: button.textContent?.trim() ?? button.getAttribute("aria-label"),
      disabled: button.disabled,
      width: box.width,
      height: box.height,
      centerHit: !!hit && button.contains(hit),
      hitTag: hit?.tagName ?? null,
    }
  }) : []
  const editorChromeButtons = [...document.querySelectorAll(
    ".journal-decoration-editor__topbar button,.journal-decoration-editor__dock button",
  )].map((button) => {
    const box = button.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return {
      name: button.getAttribute("aria-label") ?? button.textContent?.trim() ?? "",
      width: box.width,
      height: box.height,
      centerHit: !!hit && button.contains(hit),
    }
  })
  const metricControls = metric ? [...metric.querySelectorAll("button,a,summary,input")].map((control) => {
    const box = control.getBoundingClientRect()
    const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
    return {
      name: control.getAttribute("aria-label") ?? control.textContent?.trim() ?? "",
      width: box.width,
      height: box.height,
      top: box.top,
      bottom: box.bottom,
      centerHit: !!hit && control.contains(hit),
      hitTag: hit?.tagName ?? null,
      hitClass: hit instanceof HTMLElement ? hit.className : null,
      hitText: hit instanceof HTMLElement ? hit.textContent?.trim().replace(/\s+/gu, " ").slice(0, 60) : null,
      coveredByTray: !!trayRect && box.bottom > trayRect.top && box.top < trayRect.bottom,
    }
  }) : []
  const contentBlocks = body ? [...body.children].map((element) => ({
    tag: element.tagName,
    className: element.className,
    top: element.getBoundingClientRect().top,
    bottom: element.getBoundingClientRect().bottom,
    text: element.textContent?.trim().replace(/\s+/gu, " ").slice(0, 80) ?? "",
  })) : []
  return {
    workspace: {
      ...workspaceRect,
      scrollTop: workspace?.scrollTop ?? null,
      scrollHeight: workspace?.scrollHeight ?? null,
      clientHeight: workspace?.clientHeight ?? null,
      maxScroll: workspace instanceof HTMLElement ? workspace.scrollHeight - workspace.clientHeight : null,
    },
    topbar: topbarRect,
    tray: trayRect,
    body: rect(body),
    metric: metricRect ? { ...metricRect, className: metric?.className ?? "" } : null,
    metricTrayOverlapArea: overlap(metricRect, trayRect),
    metricUnobstructed: !!metricRect && !!topbarRect && !!trayRect
      && metricRect.top >= topbarRect.bottom - 0.5
      && metricRect.bottom <= trayRect.top + 0.5,
    trayButtons,
    editorChromeButtons,
    metricControls,
    contentBlocks,
    documentHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  }
})

findings.editor375SelectedInitial = await editorGeometry()
await screenshot("06-editor-375-selected-initial")
await page.evaluate(() => {
  const workspace = document.querySelector(".journal-decoration-workspace--open")
  const topbar = document.querySelector(".journal-decoration-editor__topbar")?.getBoundingClientRect()
  const tray = document.querySelector(".journal-decoration-editor__selection-actions")?.getBoundingClientRect()
  const body = document.querySelector(".decorated-journal-page__body")
  const metric = document.querySelector(".journal-entry-metrics")
  if (!(workspace instanceof HTMLElement) || !(metric instanceof HTMLElement) || !topbar || !tray) return
  const box = metric.getBoundingClientRect()
  const availableTop = topbar.bottom + 8
  const availableBottom = tray.top - 8
  if (box.bottom > availableBottom) workspace.scrollTop += box.bottom - availableBottom
  const moved = metric.getBoundingClientRect()
  if (moved.top < availableTop) workspace.scrollTop -= availableTop - moved.top
})
await page.waitForTimeout(50)
findings.editor375SelectedRevealed = await editorGeometry()
await screenshot("07-editor-375-selected-content-revealed")
await page.locator(".journal-decoration-workspace--open").evaluate((element) => {
  element.scrollTop = element.scrollHeight
})
await page.waitForTimeout(50)
findings.editor375Bottom = await editorGeometry()
await screenshot("08-editor-375-bottom")

const applyUniformTextScale = async () => page.evaluate(() => {
  const sizes = [...document.querySelectorAll("*")]
    .filter((element) => element instanceof HTMLElement)
    .map((element) => [element, Number.parseFloat(getComputedStyle(element).fontSize)])
  for (const [element, size] of sizes) element.style.fontSize = `${size * 2}px`
})

const analysisHeaderGeometry = async () => page.evaluate(() => {
  const heading = [...document.querySelectorAll("h1")].find((element) => element.textContent?.trim() === "분석")
  const button = [...document.querySelectorAll("button")].find((element) => element.textContent?.trim() === "뒤로")
  const label = button?.querySelector("span")
  const rect = (element) => {
    if (!(element instanceof Element)) return null
    const box = element.getBoundingClientRect()
    return { top: box.top, right: box.right, bottom: box.bottom, left: box.left, width: box.width, height: box.height }
  }
  const range = document.createRange()
  if (label) range.selectNodeContents(label)
  const lineRects = label ? [...range.getClientRects()].map((box) => ({
    top: box.top,
    right: box.right,
    bottom: box.bottom,
    left: box.left,
    width: box.width,
    height: box.height,
  })) : []
  const buttonRect = rect(button)
  const headingRect = rect(heading)
  return {
    button: buttonRect,
    label: rect(label),
    heading: headingRect,
    labelLineCount: lineRects.length,
    labelLineRects: lineRects,
    minTouchTarget: !!buttonRect && buttonRect.width >= 44 && buttonRect.height >= 44,
    buttonHeadingOverlap: buttonRect && headingRect
      ? Math.max(0, Math.min(buttonRect.right, headingRect.right) - Math.max(buttonRect.left, headingRect.left))
        * Math.max(0, Math.min(buttonRect.bottom, headingRect.bottom) - Math.max(buttonRect.top, headingRect.top))
      : null,
    headingCenterDelta: headingRect ? (headingRect.left + headingRect.width / 2) - innerWidth / 2 : null,
    documentHorizontalOverflow: document.documentElement.scrollWidth > innerWidth,
  }
})

for (const width of [320, 375]) {
  await fresh(width, width === 320 ? 568 : 667)
  await page.getByRole("navigation", { name: "주 탭" })
    .getByRole("button", { name: "분석", exact: true }).click()
  await page.getByRole("heading", { name: "분석", exact: true }).waitFor()
  await page.waitForTimeout(300)
  await applyUniformTextScale()
  await settle()
  findings[`analysis${width}Uniform200`] = await analysisHeaderGeometry()
  await screenshot(`09-analysis-${width}-uniform-text-200`)
}

findings.errors = errors
await writeFile(path.join(out, "findings.json"), JSON.stringify(findings, null, 2))
await browser.close()
console.log(JSON.stringify(findings, null, 2))
