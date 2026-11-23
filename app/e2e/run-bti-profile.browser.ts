import { expect, test, type BrowserContext } from "@playwright/test"
import type { AccountRunBtiProfileDocument } from "../src/domain/account/account-run-bti-profile-schema"

// Keep the real app, profile panel, quiz and cross-tab channel. Substitute only
// the signed-in account and its document transport; no real account is written.
async function fixture(context: BrowserContext, eligible = true, initial?: AccountRunBtiProfileDocument) {
  let saved = initial
  let rejectSave = true
  await context.route("**/src/screens/RunBtiAccountPanel.tsx*", async route => {
    const original = await route.fetch()
    const source = (await original.text()).replace(/from "[^"]*\/domain\/account\/account-journal-api\.ts[^"]*"/g,
      'from "/__run_bti_api.js"')
    await route.fulfill({response: original, body: source})
  })
  await context.route("**/__run_bti_api.js", route => route.fulfill({contentType: "text/javascript", body: `
    export const accountJournalPreviewEnabled = () => true
    export const requestAccountDocument = async (_owner, request) =>
      (await fetch('/__run_bti_document', {method: 'POST', body: JSON.stringify(request)})).json()
  `}))
  await context.route("**/__run_bti_document", async route => {
    const request = route.request().postDataJSON()
    const identity = {documentId: request.documentId, operationId: request.operationId, revision: 1}
    let reply
    if (request.action === "runBtiProfileSupport") {
      reply = {ok: true, data: {kind: "run-bti-profile-support", version: 1, eligible}}
    } else if (!eligible) throw Error("Ineligible account attempted to read or save")
    else if (request.action === "read") {
      reply = saved ? {ok: true, data: {kind: "document", ...identity, document: saved}} : {ok: false, code: "NOT_FOUND"}
    } else if (request.action === "save") {
      if (rejectSave) reply = {ok: false, code: "UNAVAILABLE"}
      else {
        saved = request.document
        reply = {ok: true, data: {kind: "saved", ...identity}}
      }
    } else throw Error(`Unexpected request: ${request.action}`)
    await route.fulfill({json: reply})
  })
  return {allowSave: () => { rejectSave = false }, stored: () => saved}
}

async function signInForFixture(page: import("@playwright/test").Page) {
  await page.evaluate(async () => {
    const path = "/src/domain/account/local-journal-ownership.ts"
    const {setActiveLocalAccount} = await import(path)
    setActiveLocalAccount("a1111111-1111-4111-8111-111111111111")
  })
}

test("a runner goes from More to the quiz and previews a coach question only after saving their chosen goal", async ({page, context}) => {
  const account = await fixture(context)
  await page.goto("/?app=1")
  await page.getByRole("button", {name: "더보기", exact: true}).click()
  const opened = context.waitForEvent("page")
  await page.getByRole("link", {name: "런비티아이 해보기 (새 창)"}).click()
  const quiz = await opened
  await quiz.getByRole("button", {name: "내 러닝 성향 알아보기"}).click()
  for (let screen = 0; screen < 11; screen++) {
    for (const field of await quiz.locator(".fp-question").all()) {
      const goal = field.locator('label.fp-option:has(input[name="goal"][value="speed"])')
      await (await goal.count() ? goal : field.locator("label.fp-option").first()).click()
    }
    await quiz.locator('[data-fp="next"]').click()
  }
  await quiz.getByText("내 계정에 담을 항목 고르기").click()
  await quiz.getByRole("checkbox", {name: /다음 목표/}).check()
  const receiver = context.waitForEvent("page")
  await quiz.getByRole("button", {name: "트레인오라클에서 확인"}).click()
  const profile = await receiver
  await profile.getByRole("button", {name: "로그인", exact: true}).waitFor()
  await signInForFixture(profile)
  await expect(profile.getByRole("heading", {name: "이번에 담을 항목"})).toBeVisible()
  const save = profile.getByRole("button", {name: "내 프로필에 저장"})
  const coach = profile.getByText("코치의 첫 질문 미리보기", {exact: true})
  await expect(coach).toHaveCount(0)
  await save.click()
  await expect(profile.getByText("변경을 확인하지 못했어요.", {exact: false})).toBeVisible()
  await expect(coach).toHaveCount(0)
  await expect(quiz.getByText("선택한 항목을 내 프로필에 저장했어요.")).toHaveCount(0)
  account.allowSave()
  await save.click()
  await expect(quiz.getByText("선택한 항목을 내 프로필에 저장했어요.")).toBeVisible()
  expect(account.stored()?.data).toEqual({version: "pairs-1", source: "self-report", answeredAt: expect.any(String), goal: "speed"})
  await coach.click()
  await expect(profile.getByText("어느 때 속도를 더 내고 싶어요?")).toBeVisible()
  expect([...new URL(profile.url()).searchParams.keys()]).toEqual(["run-bti-profile"])
})

for (const goal of [undefined, "unknown", "other"] as const) {
  test(`a saved profile with goal ${goal} does not invent a coach question from speed strength`, async ({page, context}) => {
    await fixture(context, true, {version: 3, state: "ACCOUNT_STATE", kind: "RUN_BTI_PROFILE", data: {
      version: "pairs-1", source: "self-report", answeredAt: "2026-11-23T00:00:00.000Z", strength: "speed", ...(goal ? {goal} : {}),
    }})
    await page.goto("/?run-bti-profile=saved")
    await page.getByRole("button", {name: "로그인", exact: true}).waitFor()
    await signInForFixture(page)
    await expect(page.getByRole("heading", {name: "저장한 결과"})).toBeVisible()
    await expect(page.getByText("코치의 첫 질문 미리보기", {exact: true})).toHaveCount(0)
  })
}

test("an ineligible account cannot read a saved result or open a goal question", async ({page, context}) => {
  await fixture(context, false)
  await page.goto("/?run-bti-profile=saved")
  await page.getByRole("button", {name: "로그인", exact: true}).waitFor()
  await signInForFixture(page)
  await expect(page.getByText(/만 19세 이상/)).toBeVisible()
  await expect(page.getByText("코치의 첫 질문 미리보기", {exact: true})).toHaveCount(0)
})
