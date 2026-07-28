/**
 * 스크롤 길이 계약 — 작업지시서 UX1 §0-B (원본 §5-3 은 폐기됐다).
 *
 * 오너가 말한 문제: "너무 아래로 스크롤 하거나 계속 한 화면에 텍스트가
 * 너무 많다거나 하면 피로감이 커지거든."
 *
 * 두 가지에 주의한다.
 *
 * 1) 스크롤은 document 가 아니라 <main class="app-scroll-region"> 에서
 *    일어난다 (AppShell.tsx). document 로 재면 scrollHeight === clientHeight
 *    가 나와서 "스크롤이 아예 없다" 는 잘못된 결론이 난다.
 *
 * 2) 상한을 화면 수(비율)로 걸지 않는다. 원본 지시서가 그렇게 했다가
 *    틀렸다. 지시서는 390x844(스크롤 영역 787px)에서 재고 이 검사는
 *    mobile-chromium(393x727, 스크롤 영역 670px)에서 돈다. 같은 1581px 가
 *    2.01 화면과 2.36 화면으로 갈리고, touch-narrow(511px)에서는 3.42 화면이
 *    된다. 분모가 기기마다 다르므로 비율은 상한이 될 수 없다.
 *    **줄여야 하는 것은 px 다.** 그래서 px 로 잠근다.
 *
 * 상한을 못 맞추면 상한을 올리지 말고 보고에 남긴다. 숫자를 고쳐서
 * 통과시키는 건 금지다. 단 자가 틀렸으면 자를 고친다 — 그게 여기서 한 일이고
 * 근거는 위에 적어 뒀다.
 */
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { TOUCH_PROJECTS, openEntry } from "./touch-audit"

const SCROLL_REGION = "main.app-scroll-region"

/** 손대기 전 실측값 (git worktree 로 HEAD 를 따로 빌드해서 쟀다). */
const BEFORE = {
  "mobile-chromium": { post: 1581, evening: 1685, race: 956 },
  "touch-narrow": { post: 1747, evening: 1700, race: 970 },
} as const

/**
 * 상한. 실측 after 값에 여유를 둔 값이다.
 * 목적은 "지금 줄인 만큼을 잠그는 것" — 다음 사람이 길이를 되돌리면 깨진다.
 *
 * 빈 상태 post 값은 자동 접기를 넣은 뒤 1250 → 1268px 로 18px **늘었다**.
 * 접기 단추(44px)가 예전 라벨보다 크기 때문이다. 숨기지 않고 적어 둔다.
 * 이 18px 을 치르고 얻는 것은 아래 FILLED_LIMIT 쪽이다.
 */
const LIMIT = {
  "mobile-chromium": { post: 1300, evening: 1300, race: 1000 },
  "touch-narrow": { post: 1350, evening: 1350, race: 1000 },
} as const

/**
 * 답을 채운 뒤의 상한. 빈 상태와 따로 잰다.
 *
 * 자동 접기(오너 결정 "건드릴 때")는 **답이 있을 때만** 이득이다. 빈 상태에서는
 * 오히려 44px 를 더 쓴다 — 접기 단추가 라벨보다 크기 때문이다. 그 값을
 * 치르고 얻는 것이 이 숫자다. 그러니 여기를 재지 않으면 접기가 이득인지
 * 손해인지 알 수 없다.
 */
const FILLED_LIMIT = {
  "mobile-chromium": 1200,
  "touch-narrow": 1220,
} as const

type TouchProject = keyof typeof LIMIT

function limitsFor(projectName: string) {
  test.skip(!TOUCH_PROJECTS.has(projectName), "스크롤 길이는 터치 화면 크기에서만 의미가 있다")
  return {
    before: BEFORE[projectName as TouchProject],
    limit: LIMIT[projectName as TouchProject],
  }
}

async function scrollHeightPx(page: Page) {
  await page.locator(SCROLL_REGION).waitFor()
  return page.evaluate(() => {
    const region = document.querySelector("main.app-scroll-region")
    if (!region) throw new Error("scroll region not found — AppShell 구조가 바뀌었는지 확인")
    return region.scrollHeight
  })
}

test("훈련 후 일지가 빈 상태에서 길지 않다", async ({ page }, testInfo) => {
  const { before, limit } = limitsFor(testInfo.project.name)
  await openEntry(page, /훈련 후/u)
  const height = await scrollHeightPx(page)
  console.log(`[SCROLL] ${testInfo.project.name} post-empty before=${before.post} after=${height} limit=${limit.post}`)
  expect(height).toBeLessThanOrEqual(limit.post)
  // 줄었다는 것 자체도 잠근다. 상한만 두면 원래도 통과하는 값이 섞인다.
  expect(height).toBeLessThan(before.post)
})

test("하루 마무리가 빈 상태에서 길지 않다", async ({ page }, testInfo) => {
  const { before, limit } = limitsFor(testInfo.project.name)
  await openEntry(page, /하루 마무리/u)
  const height = await scrollHeightPx(page)
  console.log(`[SCROLL] ${testInfo.project.name} evening-empty before=${before.evening} after=${height} limit=${limit.evening}`)
  expect(height).toBeLessThanOrEqual(limit.evening)
  expect(height).toBeLessThan(before.evening)
})

test("RPE 를 채우고 다음으로 넘어가면 화면이 더 짧아진다", async ({ page }, testInfo) => {
  limitsFor(testInfo.project.name)
  await openEntry(page, /훈련 후/u)
  const emptyHeight = await scrollHeightPx(page)

  // 사람이 하는 순서대로 한다. RPE 를 고르고 다음 구획을 건드린다.
  await page.getByRole("button", { name: /^8$/u }).click()
  const afterAnswer = await scrollHeightPx(page)
  // 답을 넣은 것만으로 접히지 않는다. 방금 누른 값을 확인할 시간을 준다.
  await expect(page.getByRole("button", { name: /RPE · 주관 강도/u })).toHaveAttribute("aria-expanded", "true")

  await page.getByRole("button", { name: "예상 강도 7" }).click()
  await expect(page.getByRole("button", { name: /RPE · 주관 강도/u })).toHaveAttribute("aria-expanded", "false")
  const filledHeight = await scrollHeightPx(page)

  const limit = FILLED_LIMIT[testInfo.project.name as TouchProject]
  console.log(`[SCROLL] ${testInfo.project.name} post-filled empty=${emptyHeight} answered=${afterAnswer} filled=${filledHeight} limit=${limit}`)
  // 접힌 뒤가 답을 넣기 전보다 짧아야 한다. 안 그러면 접기가 손해다.
  expect(filledHeight).toBeLessThan(emptyHeight)
  expect(filledHeight).toBeLessThanOrEqual(limit)
})

test("경기 일지는 나빠지지 않는다", async ({ page }, testInfo) => {
  const { before, limit } = limitsFor(testInfo.project.name)
  await openEntry(page, /경기 직전\/직후/u)
  const height = await scrollHeightPx(page)
  console.log(`[SCROLL] ${testInfo.project.name} race before=${before.race} after=${height} limit=${limit.race}`)
  // 손대지 않은 화면이다. 회귀만 막는다.
  expect(height).toBeLessThanOrEqual(limit.race)
})

test("접어도 값은 사라지지 않는다 — 객관 기록을 펼쳤다 접었다 해도 입력이 남는다", async ({ page }, testInfo) => {
  limitsFor(testInfo.project.name)
  await openEntry(page, /훈련 후/u)
  const section = page.getByRole("button", { name: /객관 기록 · \d+개/u })

  await section.click()
  await page.getByRole("spinbutton", { name: "반복 횟수" }).fill("6")
  await section.click()
  await expect(section).toHaveAttribute("aria-expanded", "false")
  await section.click()
  // 접기는 보기 방식일 뿐이다. 값을 지우지 않는다.
  await expect(page.getByRole("spinbutton", { name: "반복 횟수" })).toHaveValue("6")
})

test("몸 그림을 접어도 부위 버튼 10개는 늘 눌린다", async ({ page }, testInfo) => {
  limitsFor(testInfo.project.name)
  await openEntry(page, /하루 마무리/u)
  const selector = page.locator(".body-pain-selector")
  const bodyButtons = page.getByRole("button", { name: /통증/u })

  // 그림이 닫힌 상태에서도 선택은 버튼에서 그대로 된다.
  await expect(selector).toHaveAttribute("data-diagram-open", "false")
  await expect(bodyButtons).toHaveCount(10)
  await page.getByRole("button", { name: /^오른 무릎.*통증/u }).click()
  await expect(page.getByRole("button", { name: /^오른 무릎.*통증 1단계/u })).toBeVisible()
  // 고르면 그림이 저절로 펼쳐진다.
  await expect(selector).toHaveAttribute("data-diagram-open", "true")
})

test("사람이 접은 구획을 코드가 다시 펼치지 않는다", async ({ page }, testInfo) => {
  limitsFor(testInfo.project.name)
  await openEntry(page, /하루 마무리/u)
  const selector = page.locator(".body-pain-selector")

  // 통증을 고르면 자동으로 펼쳐진다. 거기서 사람이 접는다.
  await page.getByRole("button", { name: /^오른 무릎.*통증/u }).click()
  await expect(selector).toHaveAttribute("data-diagram-open", "true")
  await page.getByRole("button", { name: /몸 그림 접기/u }).click()
  await expect(selector).toHaveAttribute("data-diagram-open", "false")

  // 통증을 더 골라도 접힌 채로 둔다. 사람이 접은 것을 코드가 되돌리면
  // 조작을 빼앗긴 느낌이 된다 (작업지시서 §4-3 (나)).
  await page.getByRole("button", { name: /^왼 무릎.*통증/u }).click()
  await expect(selector).toHaveAttribute("data-diagram-open", "false")
})
