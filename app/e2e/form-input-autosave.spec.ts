import { expect, test } from "@playwright/test"
import type {} from "./fixtures/form-input-autosave"

test.beforeEach(async ({ context }) => {
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin !== "http://127.0.0.1:4396") return route.abort()
    // No real account, credentials, gateway, or network traffic in this harness.
    if (url.pathname.endsWith("/domain/account/supabase-client.ts")) return route.fulfill({
      contentType: "application/javascript", body: "export async function supabase() { return null }",
    })
    if (url.pathname === "/__form_input__") return route.fulfill({ contentType: "text/html", body: `<!doctype html>
      <meta name="viewport" content="width=device-width, initial-scale=1"><title>Form input fixture</title><div id="root"></div>
      <script type="module">import RefreshRuntime from '/@react-refresh';
      RefreshRuntime.injectIntoGlobalHook(window); window.$RefreshReg$ = () => {}; window.$RefreshSig$ = () => type => type;
      window.__vite_plugin_react_preamble_installed__ = true;
      await import('/e2e/fixtures/form-input-autosave.tsx');</script>` })
    return route.continue()
  })
})

test("native encrypted form input survives reload, protects account switch, and fits mobile and desktop", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 375, height: 667 })
  await page.goto("/__form_input__")
  await page.getByRole("textbox", { name: "오늘의 메모" }).fill("SYNTHETIC_FORM_MEMO")
  await page.getByRole("textbox", { name: "체중 (kg)" }).fill("62.")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ kind: "evening", memo: "SYNTHETIC_FORM_MEMO", purpose: null, weight: "62." })
  expect(await page.evaluate(() => window.formInputHarness.encryptedAtRest()))
    .toEqual({ noPlaintext: true, nativeKey: true, nonextractable: true })
  await page.reload()
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_FORM_MEMO")
  await expect(page.getByRole("textbox", { name: "체중 (kg)" })).toHaveValue("62.")
  await page.evaluate(() => window.formInputHarness.switchOwner("22222222-2222-4222-8222-222222222222"))
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
  await page.evaluate(() => window.formInputHarness.switchOwner("11111111-1111-4111-8111-111111111111"))
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_FORM_MEMO")
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("mobile.png"), fullPage: true })
  await page.setViewportSize({ width: 1280, height: 800 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("desktop.png"), fullPage: true })
})

test("quick skipped answer survives a closed tab without a completion screen", async ({ page, context }) => {
  await page.goto("/__form_input__?kind=quick")
  await page.getByRole("button", { name: "운동을 마쳤어요" }).click()
  await page.getByRole("button", { name: "오전", exact: true }).click()
  await page.getByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요" }).click()
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ kind: "quick", effortAnswered: true, rpe: 0, painStatus: "UNANSWERED" })
  await page.close()
  const next = await context.newPage()
  await next.goto("/__form_input__?kind=quick")
  await expect(next.getByRole("button", { name: "모르겠어요 · RPE는 비워 둘게요" })).toHaveAttribute("aria-pressed", "true")
  await expect(next.getByRole("button", { name: "완료", exact: true })).toHaveCount(0)
})

test("two tabs durably preserve losing CAS input and require explicit recovery after close", async ({ page, context }, testInfo) => {
  await page.goto("/__form_input__")
  const other = await context.newPage()
  await other.goto("/__form_input__")
  await expect(other.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
  await page.getByRole("textbox", { name: "오늘의 메모" }).fill("SYNTHETIC_WINNER")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ memo: "SYNTHETIC_WINNER" })
  await other.getByRole("textbox", { name: "오늘의 메모" }).fill("SYNTHETIC_LOSER")
  await expect(other.getByRole("button", { name: "이 복구본으로 계속", exact: true })).toBeVisible()
  await expect(other.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_LOSER")
  expect(await other.evaluate(() => window.formInputHarness.encryptedAtRest(true)))
    .toEqual({ noPlaintext: true, nativeKey: true, nonextractable: true })
  await page.getByRole("textbox", { name: "오늘의 메모" }).fill("SYNTHETIC_WINNER_NEWER")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ memo: "SYNTHETIC_WINNER_NEWER" })
  await other.getByRole("button", { name: "이 복구본으로 계속", exact: true }).click()
  await expect(other.getByText(/내용이 바뀌었거나 처리를 완료하지 못했어요/)).toBeVisible()
  await expect(other.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_LOSER")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ memo: "SYNTHETIC_WINNER_NEWER" })
  await other.close()
  await page.reload()
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_WINNER_NEWER")
  await expect(page.getByRole("button", { name: "이 복구본으로 계속", exact: true })).toBeVisible()
  await page.setViewportSize({ width: 375, height: 667 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath("recovery-mobile.png"), fullPage: true })
  await page.evaluate(() => window.formInputHarness.switchOwner("22222222-2222-4222-8222-222222222222"))
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("")
  await expect(page.getByRole("button", { name: "이 복구본으로 계속", exact: true })).toHaveCount(0)
  await page.evaluate(() => window.formInputHarness.switchOwner("11111111-1111-4111-8111-111111111111"))
  await page.getByRole("button", { name: "이 복구본으로 계속", exact: true }).click()
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_LOSER")
  await page.getByText(/보관한 수정본 \d+건/).click()
  await expect(page.getByText("SYNTHETIC_WINNER_NEWER", { exact: true })).toHaveCount(1)
  await page.getByRole("textbox", { name: "오늘의 메모" }).fill("SYNTHETIC_AFTER_CHOICE")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ memo: "SYNTHETIC_AFTER_CHOICE" })
  await page.reload()
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_AFTER_CHOICE")
})

for (const choice of ["LOCAL", "REMOTE", "DELETE"] as const) test(`server conflict ${choice} choice archives inputs through the native buffer`, async ({ page, context }, testInfo) => {
  // Synthetic transport only: the real scoped adapter, CAS, encryption and archive are unchanged.
  await context.route("**/domain/account/account-journal-api.ts", route => route.fulfill({
    contentType: "application/javascript", body: `
      export function accountJournalPreviewEnabled() { return true }
      export async function requestAccountDocument() { return {ok:false,code:'UNAVAILABLE'} }
      let remote = null, revision = 0;
      export async function requestAccountJournal(owner, request, current) {
        if (!current()) return {ok:false,code:'AUTH_REQUIRED'};
        if (request.action === 'read' && remote && ${choice === "DELETE"}) return {ok:true,data:{kind:'deleted',documentId:request.documentId,revision}};
        if (request.action === 'read') return remote
          ? {ok:true,data:{kind:'document',documentId:request.documentId,revision,document:remote}}
          : {ok:false,code:'NOT_FOUND'};
        if (request.action !== 'save') return {ok:false,code:'UNAVAILABLE'};
        if (!remote) {
          remote = structuredClone(request.document);
          const body = JSON.parse(remote.body); body.input.memo = 'SYNTHETIC_REMOTE';
          remote.body = JSON.stringify(body); revision = 1;
        }
        if (request.expectedRevision !== revision) return {ok:true,data:{kind:'conflict',
          documentId:request.documentId,operationId:request.operationId,currentRevision:revision}};
        remote = structuredClone(request.document); revision++;
        return {ok:true,data:{kind:'saved',documentId:request.documentId,operationId:request.operationId,revision}};
      }`,
  }))
  await page.goto("/__form_input__")
  await page.getByRole("textbox", { name: "오늘의 메모" }).fill("SYNTHETIC_LOCAL")
  if (choice === "REMOTE") {
    await expect(page.getByRole("button", { name: "계정 입력 사용", exact: true })).toBeVisible()
    await expect(page.getByRole("heading", { name: "계정 입력 · 수정 버전 1", exact: true })).toBeVisible()
    await expect(page.getByRole("button", { name: "저장", exact: true })).toBeDisabled()
    await expect(page.locator(".entry-sticky-bar")).toHaveCount(0)
    await page.setViewportSize({ width: 375, height: 667 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("conflict-mobile.png"), fullPage: true })
    await page.getByRole("region", { name: "입력 초안 충돌 및 복구" }).screenshot({ path: testInfo.outputPath("conflict-preview-mobile.png") })
    await page.setViewportSize({ width: 1280, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath("conflict-desktop.png"), fullPage: true })
  }
  await page.getByRole("button", { name: choice === "LOCAL" ? "이 기기 입력 사용" : choice === "REMOTE" ? "계정 입력 사용" : "계정 삭제 반영 · 입력은 보관", exact: true }).click()
  if (choice === "DELETE") {
    await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveCount(0)
    await page.reload()
    await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveCount(0)
    await page.getByText(/보관한 수정본 \d+건/).click()
    await page.getByText(/충돌 보관본 1/).click()
    await expect(page.getByText("SYNTHETIC_LOCAL", { exact: true }).first()).toBeVisible()
    await expect(page.getByRole("button", { name: "당시 기기 입력으로 계속", exact: true }).first()).toBeDisabled()
    return
  }
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue(`SYNTHETIC_${choice}`)
  await expect(page.getByRole("button", { name: "이 기기 입력 사용", exact: true })).toHaveCount(0)
  await page.reload()
  await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue(`SYNTHETIC_${choice}`)
  await page.getByText(/보관한 수정본 \d+건/).click()
  await page.getByText(/충돌 보관본 1/).click()
  await expect(page.getByText("SYNTHETIC_LOCAL", { exact: true }).first()).toBeVisible()
  await expect(page.getByText("SYNTHETIC_REMOTE", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("button", { name: "완료", exact: true })).toHaveCount(0)
  if (choice === "REMOTE") {
    await page.getByRole("button", { name: "당시 기기 입력으로 계속", exact: true }).first().click()
    await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_LOCAL")
    await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
      .toMatchObject({ memo: "SYNTHETIC_LOCAL" })
    await page.reload()
    await expect(page.getByRole("textbox", { name: "오늘의 메모" })).toHaveValue("SYNTHETIC_LOCAL")
  }
})

test("race restores partial pace, maximum tension and post-race stage from native storage", async ({ page }) => {
  await page.goto("/__form_input__?kind=race")
  await page.getByRole("spinbutton", { name: "목표 페이스 분" }).fill("3")
  await page.getByRole("button", { name: "긴장도 10", exact: true }).click()
  await page.getByRole("button", { name: "경기 직후", exact: true }).click()
  await page.getByRole("textbox", { name: "경기 기록" }).fill("16:")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ kind: "race", tension: 10, paceMinutes: "3", paceSeconds: "", record: "16:", stage: "post" })
  await page.reload()
  await expect(page.getByRole("textbox", { name: "경기 기록" })).toHaveValue("16:")
  await page.getByRole("button", { name: "경기 직전", exact: true }).click()
  await expect(page.getByRole("spinbutton", { name: "목표 페이스 분" })).toHaveValue("3")
  await expect(page.getByRole("spinbutton", { name: "목표 페이스 초" })).toHaveValue("")
})

test("detailed form restores the unadded objective editor without converting it into performance", async ({ page }) => {
  await page.goto("/__form_input__?kind=post-session")
  await page.getByRole("textbox", { name: "세션 제목" }).fill("SYNTHETIC_SESSION")
  await page.getByRole("button", { name: "예상 강도 7", exact: true }).click()
  await page.getByRole("button", { name: /객관 기록 · 0개/ }).click()
  await page.getByRole("spinbutton", { name: "운동 시간 (초)" }).fill("42")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ kind: "post-session", plannedRpe: 7, objectiveComponents: [],
      objectiveEditor: { kind: "INTERVALS", fields: { workSeconds: "42" } } })
  await page.reload()
  await expect(page.getByRole("textbox", { name: "세션 제목" })).toHaveValue("SYNTHETIC_SESSION")
  await page.getByRole("button", { name: /객관 기록 · 0개/ }).click()
  await expect(page.getByRole("spinbutton", { name: "운동 시간 (초)" })).toHaveValue("42")
  await expect(page.getByRole("button", { name: "예상 강도 7", exact: true })).toHaveAttribute("aria-pressed", "true")
})

test("detailed recovery preview uses readable energy, body and objective labels on mobile", async ({ page, context }, testInfo) => {
  await page.goto("/__form_input__?kind=post-session")
  const other = await context.newPage()
  await other.goto("/__form_input__?kind=post-session")
  await expect(other.getByRole("textbox", { name: "세션 제목" })).toBeVisible()
  await page.getByRole("textbox", { name: "세션 제목" }).fill("SYNTHETIC_CURRENT")
  await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
    .toMatchObject({ title: "SYNTHETIC_CURRENT" })
  await other.getByRole("button", { name: "ATP-PC 스피드·가속", exact: true }).click()
  await other.getByRole("textbox", { name: "훈련 메모 내용" }).fill("SYNTHETIC_RECOVERY")
  await other.getByRole("button", { name: /객관 기록 · 0개/ }).click()
  await other.getByRole("spinbutton", { name: "운동 시간 (초)" }).fill("42")
  await other.getByRole("button", { name: "불편한 곳 있음", exact: true }).click()
  await other.getByRole("button", { name: /오른 무릎/ }).click()
  const preview = other.getByRole("region", { name: "입력 초안 충돌 및 복구" })
  await expect(preview).toContainText("스피드·가속")
  await expect(preview).toContainText("인터벌")
  await expect(preview).toContainText("운동 시간 (초): 42")
  await expect(preview).toContainText("오른 무릎: 1")
  await expect(preview).not.toContainText(/ATP_PC|\batp\b|INTERVALS|workSeconds|rKnee|revision/)
  await other.setViewportSize({ width: 375, height: 667 })
  expect(await other.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await other.screenshot({ path: testInfo.outputPath("detailed-recovery-mobile.png"), fullPage: true })
  await preview.screenshot({ path: testInfo.outputPath("detailed-preview-mobile.png") })
})

for (const response of ["ACK_LOST", "EDITED_PENDING", "PLANNED_SESSION_ALREADY_RECORDED", "INSUFFICIENT_POINTS", "OPERATION_REPLAY_UNAVAILABLE"] as const) {
  test(`finalized ${response} retains the durable operation across reload without bypass`, async ({ page, context }, testInfo) => {
    const requests: unknown[] = []
    await context.route("**/__finalized_transport__", async route => {
      const request = route.request().postDataJSON()
      if (request.action !== "save") return route.fulfill({ json: { ok: false, code: "NOT_FOUND" } })
      requests.push(request)
      if (response !== "ACK_LOST" && response !== "EDITED_PENDING") return route.fulfill({ json: { ok: false, code: response } })
      // The synthetic server accepted request #1, but its ACK was lost.
      if (requests.length === 1) return route.fulfill({ json: { ok: false, code: "UNAVAILABLE" } })
      if (requests.length === 2) expect(request).toEqual(requests[0])
      else {
        expect(response).toBe("EDITED_PENDING")
        expect(request.expectedRevision).toBe(1)
        expect(request.document.entry.record).toBe("17:")
        expect(request.operationId).not.toBe((requests[0] as { operationId: string }).operationId)
      }
      return route.fulfill({ json: { ok: true, data: { kind: "saved", documentId: request.documentId,
        operationId: request.operationId, revision: request.expectedRevision + 1 } } })
    })
    await context.route("**/domain/account/account-journal-api.ts", route => route.fulfill({
      contentType: "application/javascript", body: `
        export function accountJournalPreviewEnabled() { return true }
        export async function requestAccountDocument(owner, request, current) {
          const response = await fetch('/__finalized_transport__', {method:'POST',body:JSON.stringify(request)});
          const result = await response.json(); return current() ? result : {ok:false,code:'AUTH_REQUIRED'};
        }
        export async function requestAccountJournal(owner, request, current) {
          if (!current()) return {ok:false,code:'AUTH_REQUIRED'};
          if (request.action !== 'save') return {ok:false,code:'NOT_FOUND'};
          return {ok:true,data:{kind:'saved',documentId:request.documentId,operationId:request.operationId,revision:request.expectedRevision+1}};
        }`,
    }))
    await page.goto("/__form_input__?kind=race")
    await page.getByRole("button", { name: "경기 직후", exact: true }).click()
    await page.getByRole("textbox", { name: "경기 기록" }).fill("16:")
    await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
      .toMatchObject({ record: "16:", stage: "post" })
    await page.getByRole("button", { name: /^저장/ }).click()
    await expect.poll(() => requests.length).toBe(1)
    await expect(page.getByRole("button", { name: /^저장/ })).toBeEnabled()
    if (response !== "ACK_LOST") {
      if (response !== "EDITED_PENDING") await expect(page.getByRole("region", { name: "최종 저장 요청 확인" })).toContainText("새 요청을 자동으로 만들거나 다시 전송하지 않습니다")
      await page.getByRole("textbox", { name: "경기 기록" }).fill("17:")
      await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.input)
        .toMatchObject({ record: "17:" })
    }
    await page.reload()
    await expect(page.getByRole("textbox", { name: "경기 기록" })).toHaveValue(response === "ACK_LOST" ? "16:" : "17:")
    await page.getByRole("button", { name: /^저장/ }).click()
    if (response === "EDITED_PENDING") {
      await expect(page.getByRole("region", { name: "최종 저장 요청 확인" })).toContainText("변경한 내용을 전송하지 않았어요")
      expect(requests).toHaveLength(1)
      await page.getByRole("button", { name: "이전 요청 그대로 확인" }).click()
      await expect.poll(() => requests.length).toBe(2)
      await expect(page.getByRole("region", { name: "최종 저장 요청 확인" })).toContainText("이전 요청의 계정 저장을 확인했어요")
      await expect(page.getByRole("textbox", { name: "경기 기록" })).toHaveValue("17:")
      expect((await page.evaluate(() => window.formInputHarness.input()))[0]?.completed).toBe(false)
      await page.setViewportSize({ width: 375, height: 667 })
      await page.screenshot({ path: testInfo.outputPath("edited-pending-mobile.png"), fullPage: true })
      await page.getByRole("button", { name: /^저장/ }).click()
      await expect.poll(() => requests.length).toBe(3)
      await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.completed).toBe(true)
    } else if (response === "ACK_LOST") {
      await expect.poll(() => requests.length).toBe(2)
      await expect.poll(async () => (await page.evaluate(() => window.formInputHarness.input()))[0]?.completed).toBe(true)
      expect(requests[1]).toEqual(requests[0])
    } else {
      await page.getByRole("button", { name: "보관된 거절 상태 확인" }).click()
      await expect(page.getByRole("button", { name: "보관된 거절 상태 확인" })).toBeEnabled()
      expect(requests).toHaveLength(1)
      expect((await page.evaluate(() => window.formInputHarness.input()))[0]?.completed).toBe(false)
      await page.setViewportSize({ width: 375, height: 667 })
      await page.screenshot({ path: testInfo.outputPath("rejected-finalization-mobile.png"), fullPage: true })
    }
  })
}
