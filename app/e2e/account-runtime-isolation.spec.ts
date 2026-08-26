import { expect, test } from "@playwright/test"
import { createClient } from "@supabase/supabase-js"
import type { BrowserContext } from "@playwright/test"
import type { Session } from "@supabase/supabase-js"
import { createSelfReportedAthleteRecord } from "../src/domain/athlete-records"
import { createEmptyDecorationState } from "../src/domain/decoration-schema"
import { stateFixture } from "../src/domain/plan-beta-store.test-fixture"

const runtime = {
  approved: process.env.TRAINORACLE_AB_RUNTIME_APPROVED === "I_ACKNOWLEDGE_STAGING_ACCOUNT_MUTATION",
  url: process.env.TRAINORACLE_AB_SUPABASE_URL ?? "",
  key: process.env.TRAINORACLE_AB_SUPABASE_KEY ?? "",
  emailA: process.env.TRAINORACLE_AB_EMAIL_A ?? "",
  passwordA: process.env.TRAINORACLE_AB_PASSWORD_A ?? "",
  emailB: process.env.TRAINORACLE_AB_EMAIL_B ?? "",
  passwordB: process.env.TRAINORACLE_AB_PASSWORD_B ?? "",
}

const runtimeReady = runtime.approved
  && Object.entries(runtime)
    .filter(([key]) => key !== "approved")
    .every(([, value]) => value !== "")
const AUTH_STORAGE_KEY = "trainoracle.auth.v1"
const JOURNAL_KEY = "trainoracle.journal.v1"
const OWNERSHIP_KEY = "trainoracle.journal.ownership.v1"
const PLAN_KEY = "trainoracle.plan-beta.v1"
const RECORDS_KEY = "trainoracle.athlete-records.v1"
const DECORATION_KEY = "trainoracle.decorations.v2"

const journalA = {
  id: "ab-ui-journal-a",
  kind: "post-session",
  date: "2026-08-26",
  savedAt: "2026-08-26T01:00:00.000Z",
  syncState: "local",
  system: "base",
  title: "A 계정 전용 이지런",
  distanceKm: "8",
  durationMin: "45",
  avgPace: "5:37",
  rpe: 4,
  memo: "",
  fieldProvenance: {
    distanceKm: { provenance: "EXPLICIT" },
    durationMin: { provenance: "EXPLICIT" },
    avgPace: { provenance: "EXPLICIT" },
    rpe: { provenance: "EXPLICIT" },
  },
}

const journalB = {
  ...journalA,
  id: "ab-ui-journal-b",
  savedAt: "2026-08-26T02:00:00.000Z",
  title: "B 계정 전용 회복런",
  distanceKm: "5",
  durationMin: "32",
  avgPace: "6:24",
  rpe: 2,
}

function accountKey(base: string, userId: string): string {
  return `${base}.account.${encodeURIComponent(userId)}`
}

async function signIn(email: string, password: string): Promise<Session> {
  const client = createClient(runtime.url, runtime.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  expect(error).toBeNull()
  expect(data.session).not.toBeNull()
  return data.session as Session
}

async function installSession(context: BrowserContext, session: Session): Promise<void> {
  await context.addInitScript(({ key, value }) => {
    window.localStorage.setItem(key, value)
  }, { key: AUTH_STORAGE_KEY, value: JSON.stringify(session) })
}

async function replaceSession(page: import("@playwright/test").Page, session: Session): Promise<void> {
  await page.evaluate(({ key, value }) => {
    window.localStorage.setItem(key, value)
  }, { key: AUTH_STORAGE_KEY, value: JSON.stringify(session) })
  await page.reload()
}

test.describe("staging account runtime isolation", () => {
  test.skip(!runtimeReady, "requires owner-approved temporary staging accounts")

  test("isolates two browser stores and survives A-B-A switching without automatic upload", async ({ browser }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop-chromium", "staging mutation runs once per approval")
    const [sessionA, sessionB] = await Promise.all([
      signIn(runtime.emailA, runtime.passwordA),
      signIn(runtime.emailB, runtime.passwordB),
    ])
    expect(sessionA.user.id).not.toBe(sessionB.user.id)

    const contextA = await browser.newContext()
    const contextB = await browser.newContext()
    await installSession(contextA, sessionA)
    await installSession(contextB, sessionB)

    const record = createSelfReportedAthleteRecord({
      id: "ab-ui-pb-5000",
      purpose: "PERSONAL_BEST",
      eventDistanceM: 5000,
      performanceSeconds: 1110,
      achievedOn: "2026-08-01",
      seasonId: null,
    }, new Date("2026-08-26T12:00:00.000Z"))
    expect(record).not.toBeNull()
    const decoration = {
      ...createEmptyDecorationState(),
      library: { favoriteItemIds: ["STICKER_WEATHER_SUN"], recentItemIds: [] },
    }
    await contextA.addInitScript((seed) => {
      window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([seed.journal]))
      window.localStorage.setItem("trainoracle.plan-beta.v1", seed.plan)
      window.localStorage.setItem("trainoracle.athlete-records.v1", seed.records)
      window.localStorage.setItem("trainoracle.decorations.v2", seed.decoration)
    }, {
      journal: journalA,
      plan: JSON.stringify(stateFixture()),
      records: JSON.stringify([record]),
      decoration: JSON.stringify(decoration),
    })

    const pageA = await contextA.newPage()
    const pageB = await contextB.newPage()
    await Promise.all([pageA.goto("/?account=1"), pageB.goto("/?account=1")])
    await Promise.all([
      expect(pageA.getByRole("heading", { name: "내 계정" })).toBeVisible(),
      expect(pageB.getByRole("heading", { name: "내 계정" })).toBeVisible(),
    ])

    await pageA.getByTestId("connect-device-journals-start").click()
    await pageA.getByTestId("connect-device-journals-confirm").click()
    await expect(pageA.getByTestId("device-journal-ownership-result")).toContainText("1개")
    await pageA.getByTestId("connect-device-training-start").click()
    await pageA.getByTestId("connect-device-training-confirm").click()
    await expect(pageA.getByTestId("device-training-data-result")).toContainText("연결했어요")

    const connectedA = await pageA.evaluate(({ userId, keys }) => ({
      journal: window.localStorage.getItem(keys.ownership),
      plan: window.localStorage.getItem(`${keys.plan}.account.${encodeURIComponent(userId)}`),
      records: window.localStorage.getItem(`${keys.records}.account.${encodeURIComponent(userId)}`),
      decorations: window.localStorage.getItem(`${keys.decorations}.account.${encodeURIComponent(userId)}`),
    }), {
      userId: sessionA.user.id,
      keys: { ownership: OWNERSHIP_KEY, plan: PLAN_KEY, records: RECORDS_KEY, decorations: DECORATION_KEY },
    })
    expect(connectedA.journal).toContain(journalA.id)
    expect(connectedA.plan).not.toBeNull()
    expect(connectedA.records).not.toBeNull()
    expect(connectedA.decorations).not.toBeNull()

    await pageA.getByRole("button", { name: "뒤로" }).click()
    await expect(pageA.getByText(journalA.title, { exact: true })).toBeVisible()
    await pageB.getByRole("button", { name: "뒤로" }).click()
    await expect(pageB.getByText(journalA.title, { exact: true })).toHaveCount(0)

    await pageA.goto("/?account=1")
    await pageA.getByRole("button", { name: "로그아웃", exact: true }).click()
    await expect(pageA.getByRole("heading", { name: "로그인 또는 가입" })).toBeVisible()
    await replaceSession(pageA, sessionB)
    await expect(pageA.getByRole("heading", { name: "내 계정" })).toBeVisible()
    await pageA.getByRole("button", { name: "뒤로" }).click()
    await expect(pageA.getByText(journalA.title, { exact: true })).toHaveCount(0)

    await pageA.evaluate((entry) => {
      const current = JSON.parse(window.localStorage.getItem("trainoracle.journal.v1") ?? "[]")
      window.localStorage.setItem("trainoracle.journal.v1", JSON.stringify([...current, entry]))
    }, journalB)
    await pageA.goto("/?account=1")
    await pageA.getByTestId("connect-device-journals-start").click()
    await pageA.getByTestId("connect-device-journals-confirm").click()
    await pageA.getByRole("button", { name: "뒤로" }).click()
    await expect(pageA.getByText(journalB.title, { exact: true })).toBeVisible()
    await expect(pageA.getByText(journalA.title, { exact: true })).toHaveCount(0)

    await replaceSession(pageA, sessionA)
    await expect(pageA.getByText(journalA.title, { exact: true })).toBeVisible()
    await expect(pageA.getByText(journalB.title, { exact: true })).toHaveCount(0)

    const aPlan = await pageA.evaluate((key) => window.localStorage.getItem(key), accountKey(PLAN_KEY, sessionA.user.id))
    const bPlan = await pageA.evaluate((key) => window.localStorage.getItem(key), accountKey(PLAN_KEY, sessionB.user.id))
    expect(aPlan).not.toBeNull()
    expect(bPlan).toBeNull()

    const serverA = createClient(runtime.url, runtime.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${sessionA.access_token}` } },
    })
    const serverB = createClient(runtime.url, runtime.key, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: { headers: { Authorization: `Bearer ${sessionB.access_token}` } },
    })
    const [rowsA, rowsB] = await Promise.all([
      serverA.from("journal_entries").select("entry_id"),
      serverB.from("journal_entries").select("entry_id"),
    ])
    expect(rowsA.error).toBeNull()
    expect(rowsB.error).toBeNull()
    expect(rowsA.data).toEqual([])
    expect(rowsB.data).toEqual([])

    await Promise.all([contextA.close(), contextB.close()])
  })
})
