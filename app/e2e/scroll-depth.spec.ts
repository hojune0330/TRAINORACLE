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

/**
 * 홈 화면. 지금까지 이 검사에는 홈이 **한 줄도 없었다** — 기록 작성 화면만 재고
 * 있었다. 그런데 실측해 보니 첫 화면인 홈이 내가 이미 줄여 둔 기록 화면보다
 * 더 길었다: 1727px = 2.58 화면.
 *
 * 원인의 절반은 `engagement-strip` 하나였다(688px). 기록이 0건인 첫 실행에서
 * `0P` / `0일` / `0일` / `사용 가능 0P` 를 성취 점수판 레이아웃에 채워 넣고,
 * 그 아래 꾸미기 상점(439px)까지 펼쳐 놨다.
 *
 * 그건 길이 문제이기 전에 계약 위반이다 —
 * ANALYSIS_AND_VISUALIZATION_DATA_CONTRACT §17 L546-557:
 * "Empty and error states should be useful and honest.
 *  They must not be styled as success."
 *
 * 그래서 빈 상태에서는 점수판을 접고 규칙 한 줄만 남겼다. 86px 이 됐다.
 * 재촉 문구로 채우지 않은 것은 JOURNAL_DELIGHT_AND_DECORATION_SPEC L460
 * `missed_day_shame_copy: forbidden` 때문이다.
 *
 * 아래 before 값은 짐작이 아니다. 이 커밋 직전 상태를 따로 빌드해서 같은
 * 두 뷰포트로 실측했다. 처음엔 touch-narrow 를 2109 로 어림잡아 적었는데
 * 실측은 1838 이었다. 틀린 값을 남기면 상한이 헐거워지므로 실측으로 바꿨다.
 *
 * mobile-chromium 1727 → 1129px (−598px, 2.58 → 1.68 화면)
 * touch-narrow    1838 → 1154px (−684px, 3.60 → 2.26 화면)
 * engagement-strip 단독: 688 → 86px (mobile), 771 → 86px (narrow)
 */
const HOME_BEFORE = {
  "mobile-chromium": 1727,
  "touch-narrow": 1838,
} as const

const HOME_LIMIT = {
  "mobile-chromium": 1200,
  "touch-narrow": 1250,
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

test("WELCOME은 빈 꾸미기·성취 점수판을 숨기고 유용한 기록 습관 규칙은 남긴다", async ({ page }, testInfo) => {
  limitsFor(testInfo.project.name)
  const project = testInfo.project.name as TouchProject
  await page.goto("/?app=1")

  const strip = page.getByLabel("기록 습관")
  await expect(strip).toBeVisible()

  // 0 을 성취 UI 에 채워 넣지 않는다 (ANALYSIS §17).
  await expect(strip.getByText("누적 획득 · BETA")).toHaveCount(0)
  await expect(strip.getByText("기록 연속")).toHaveCount(0)
  await expect(strip.getByText("함께한 날")).toHaveCount(0)
  await expect(page.getByRole("heading", { name: "일지 꾸미기 · 사용 가능 0P" })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "꾸미기 열기" })).toHaveCount(0)

  // 그렇다고 아무 말도 없으면 "useful" 이 아니다. 규칙은 남는다.
  await expect(strip.getByText(/몸 상태·회복 체크/u)).toBeVisible()

  const height = await scrollHeightPx(page)
  console.log(`[SCROLL] ${project} home-empty before=${HOME_BEFORE[project]} after=${height} limit=${HOME_LIMIT[project]}`)
  expect(height).toBeLessThanOrEqual(HOME_LIMIT[project])
  expect(height).toBeLessThan(HOME_BEFORE[project])
})

test("기록이 하나 생기면 홈 일지 정원과 꾸미기 포인트가 보인다", async ({ page }, testInfo) => {
  limitsFor(testInfo.project.name)
  await page.addInitScript(() => {
    const day = new Date()
    const date = [
      day.getFullYear(),
      String(day.getMonth() + 1).padStart(2, "0"),
      String(day.getDate()).padStart(2, "0"),
    ].join("-")
    window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([{
      id: "home-strip-1",
      kind: "post-session",
      date,
      savedAt: `${date}T09:00:00.000Z`,
      syncState: "local",
      system: "base",
      title: "strip",
      distanceKm: "5",
      durationMin: "30",
      avgPace: "6:00",
      rpe: 4,
      memo: "",
      fieldProvenance: {
        distanceKm: { provenance: "EXPLICIT" },
        durationMin: { provenance: "EXPLICIT" },
        avgPace: { provenance: "EXPLICIT" },
        rpe: { provenance: "EXPLICIT" },
      },
    }]))
  })
  await page.goto("/?app=1")

  const strip = page.getByLabel("기록 습관")
  await expect(strip.getByText(/이 기기에 1건 저장됨/u)).toBeVisible()
  await expect(strip.getByLabel("식물 상태: 새싹이 자라고 있어요")).toBeVisible()
  await expect(strip.getByText("기록한 날", { exact: true })).toBeVisible()
  await expect(strip.getByText("1일", { exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: "꾸미기 보관함 · 사용 가능 4P" })).toBeVisible()
  await expect(page.getByRole("button", { name: "꾸미기 열기" })).toBeVisible()
})

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
