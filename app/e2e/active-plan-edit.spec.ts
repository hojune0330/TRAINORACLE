import { expect, test } from "@playwright/test"
import { build } from "esbuild"
import type { PlanBetaStateV3 } from "../src/domain/plan-beta-schema"

test.use({ serviceWorkers: "block" })

for (const viewport of [
  { name: "mobile", width: 390, height: 844 },
  { name: "desktop", width: 1280, height: 800 },
] as const) {
  test(`active plan edit applies, persists, and cancels a new-plan draft at ${viewport.width}px`, async ({ page, baseURL }) => {
    const appOrigin = new URL(baseURL ?? "").origin
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.clock.install({ time: new Date("2026-10-01T03:00:00.000Z") })
    await page.route("**/*", route => {
      const url = new URL(route.request().url())
      return url.origin === appOrigin ? route.continue() : route.abort()
    })

    const fixture = await activePlanFixture()
    await page.addInitScript(seed => {
      if (window.localStorage.getItem("trainoracle.plan-beta.v1") === null) {
        window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(seed.state))
      }
      if (window.localStorage.getItem("trainoracle.journal.v1") === null) {
        window.localStorage.setItem("trainoracle.journal.v1", "[]")
      }
    }, fixture)

    const pageErrors: string[] = []
    page.on("pageerror", error => pageErrors.push(error.message))
    await page.goto("/?app=1&uitest=1")
    const planTab = page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" })
    await planTab.click()
    await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()

    await page.locator("[data-plan-edit-button]").click()
    await expect(page.getByRole("heading", { name: "계획 수정" })).toBeVisible()
    await assertFits(page, ".active-plan-edit-hub")
    await page.getByRole("button", { name: "훈련 내용 바꾸기" }).click()
    const editor = page.getByRole("region", { name: "이 훈련 수정" })
    await expect(editor).toBeVisible()
    await assertFits(page, ".active-plan-session-editor")

    // The Node test runner cannot directly load the app's JSON-importing catalog
    // graph, so bundle only the synthetic fixture factory in memory.
    const sessionPicker = editor.getByLabel("수정할 훈련")
    await sessionPicker.selectOption("3:AM")
    await editor.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }).check()
    await expect(editor.getByLabel("훈련 구성")).toBeVisible()
    await expect(editor.getByRole("button", { name: "이 구성으로 바꾸기" })).toBeVisible()

    // Exercise the supported non-catalog duration path through prepare and apply.
    await sessionPicker.selectOption("1:AM")
    await editor.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }).check()
    await editor.getByLabel("새 최대 시간 · 분").fill("25")
    await editor.getByRole("button", { name: "변경안 미리보기" }).click()
    const preview = editor.locator(".active-plan-session-editor__preview")
    await expect(preview.getByRole("heading", { name: "변경안 미리보기" })).toBeVisible()
    await expect(preview.locator(".active-plan-session-editor__comparison").getByText("20–30분")).toBeVisible()
    await expect(preview.locator(".active-plan-session-editor__comparison").getByText("20–25분")).toBeVisible()
    await editor.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요." }).check()
    await editor.getByRole("button", { name: "변경안 적용하기" }).click()
    await expect(editor).toHaveCount(0)
    await expect(page.getByText("수정한 계획이에요. 이전 계획과 일지는 보관되어 있어요.")).toBeVisible()

    const appliedBytes = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))
    expect(appliedBytes).not.toBeNull()
    const applied = JSON.parse(appliedBytes!) as PlanBetaStateV3
    expect(applied.activePlanEdit?.action).toBe("DURATION")
    expect(applied.activePlan.sessions.find(session => session.day === 1 && session.slot === "AM")?.prescription)
      .toMatchObject({ kind: "RPE_TIME_RANGE", durationMinutes: { minimum: 20, maximum: 25 } })
    expect(applied.progress).toEqual(fixture.state.progress)
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.journal.v1"))).toBe("[]")

    await page.reload()
    await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()
    await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(appliedBytes)

    // Opening and cancelling a successor draft must leave the accepted active plan byte-for-byte intact.
    await page.locator("[data-plan-edit-button]").click()
    await assertFits(page, ".active-plan-edit-hub")
    await page.getByRole("button", { name: "새 계획 만들기" }).click()
    await expect(page.getByRole("heading", { name: "새 계획 만들기" })).toBeVisible()
    await page.getByLabel("시작 날짜").fill("2026-10-02")
    await page.getByRole("button", { name: "취소" }).click()
    await expect(page.getByRole("heading", { name: "9일 훈련 계획" })).toBeVisible()
    expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(appliedBytes)
    expect(pageErrors).toEqual([])
  })
}

test("catalog edit prepares, previews, applies, and persists at 390px", async ({ page, baseURL }) => {
  const appOrigin = new URL(baseURL ?? "").origin
  await page.setViewportSize({ width: 390, height: 844 })
  await page.clock.install({ time: new Date("2026-10-01T03:00:00.000Z") })
  await page.route("**/*", route => {
    const url = new URL(route.request().url())
    return url.origin === appOrigin ? route.continue() : route.abort()
  })
  const fixture = await activePlanFixture()
  await page.addInitScript(seed => {
    if (window.localStorage.getItem("trainoracle.plan-beta.v1") === null) {
      window.localStorage.setItem("trainoracle.plan-beta.v1", JSON.stringify(seed.state))
    }
    if (window.localStorage.getItem("trainoracle.journal.v1") === null) {
      window.localStorage.setItem("trainoracle.journal.v1", "[]")
    }
  }, fixture)
  const pageErrors: string[] = []
  page.on("pageerror", error => pageErrors.push(error.message))
  await page.goto("/?app=1&uitest=1")
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()
  await page.locator("[data-plan-edit-button]").click()
  await page.getByRole("button", { name: "훈련 내용 바꾸기" }).click()
  const editor = page.getByRole("region", { name: "이 훈련 수정" })
  await editor.getByLabel("수정할 훈련").selectOption("3:AM")
  await editor.getByRole("checkbox", { name: "이 훈련은 아직 시작하지 않았어요." }).check()
  await editor.getByLabel("훈련 구성").selectOption(fixture.alternateCatalogId)
  await editor.getByRole("button", { name: "이 구성으로 바꾸기" }).click()
  await editor.getByRole("button", { name: "변경안 미리보기" }).click()
  const preview = editor.locator(".active-plan-session-editor__preview")
  await expect(preview.getByRole("heading", { name: "변경안 미리보기" })).toBeVisible()
  await expect(preview.locator(".active-plan-session-editor__comparison")).toContainText(fixture.catalogBeforeDuration)
  await expect(preview.locator(".active-plan-session-editor__comparison")).toContainText(fixture.catalogAfterDuration)
  await editor.getByRole("checkbox", { name: "지금 통증이나 몸 상태 이상이 없어요." }).check()
  await editor.getByRole("button", { name: "변경안 적용하기" }).click()
  await expect(editor).toHaveCount(0)
  const appliedBytes = await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))
  expect(appliedBytes).not.toBeNull()
  const applied = JSON.parse(appliedBytes!) as PlanBetaStateV3
  expect(applied.activePlanEdit?.action).toBe("CATALOG")
  expect(applied.activePlan.sessions.find(session => session.day === 3 && session.slot === "AM")?.prescription)
    .toMatchObject({ kind: "RPE_TIME_RANGE", catalogWorkout: { catalogId: fixture.alternateCatalogId } })
  await page.reload()
  await page.getByRole("navigation", { name: "주 탭" }).getByRole("button", { name: "훈련" }).click()
  expect(await page.evaluate(() => window.localStorage.getItem("trainoracle.plan-beta.v1"))).toBe(appliedBytes)
  expect(pageErrors).toEqual([])
})

type ActivePlanFixture = {
  readonly state: PlanBetaStateV3
  readonly alternateCatalogId: string
  readonly catalogBeforeDuration: string
  readonly catalogAfterDuration: string
}

async function activePlanFixture(): Promise<ActivePlanFixture> {
  const fixtureSource = `
    import { ALL_WORKOUT_CATALOG, calculateCatalogWorkout } from "@impl/prescription/all-workout-calculator";
    import { bindCatalogSession, bindDefaultCatalogSessions, catalogFamilyForIntent, catalogRpe } from "@impl/prescription/catalog-session-binding";
    import { deriveCandidateId } from "@impl/plan-generator/candidate-identity";
    import { planBetaStateV3Schema } from "./src/domain/plan-beta-schema";
    import { stateFixture } from "./src/domain/plan-beta-store.test-fixture";
    export function makeFixture() {
      const state = stateFixture();
      state.intake.startDate = "2026-10-01";
      state.intake.secondSessionMode = "RECOVERY_PM_ALLOWED";
      const nonCatalog = state.activePlan.sessions[0];
      const catalog = bindDefaultCatalogSessions([{ ...nonCatalog, day: 3 }], 5000, "DEVELOPING", 20261001)[0];
      if (catalog.prescription.kind !== "RPE_TIME_RANGE" || !catalog.prescription.catalogWorkout) {
        throw new Error("The synthetic fixture could not bind a catalog workout");
      }
      const binding = catalog.prescription.catalogWorkout;
      const inputs = {
        eventDistanceM: 5000,
        experience: "DEVELOPING",
        availableSeconds: binding.originalEnvelope.durationMinutes.maximum * 60,
        confirmedRequirements: [],
        fiveK: null,
        segmentPaces: [],
        segmentSeconds: [],
        recoverySeconds: [],
      };
      const alternate = ALL_WORKOUT_CATALOG.find(entry => {
        if (entry.id === binding.catalogId || entry.family !== catalogFamilyForIntent(catalog.plannedEnergyIntent)
          || !entry.eventDistances.includes(5000) || !entry.experience.includes("DEVELOPING") || entry.hold
          || entry.requirements.length) return false;
        const calculated = calculateCatalogWorkout(entry.id, inputs);
        return calculated !== null && calculated.unavailable.length === 0 && calculated.totals.seconds !== null
          && calculated.steps.every(step => step.seconds !== null)
          && calculated.totals.seconds.maximum < catalog.prescription.durationMinutes.maximum * 60
          && catalogRpe(calculated).maximum <= catalog.prescription.rpe.maximum
          && bindCatalogSession(catalog, entry.id, inputs) !== null;
      });
      if (!alternate) throw new Error("No shorter, no-extra-requirement catalog alternative is available");
      const replacement = bindCatalogSession(catalog, alternate.id, inputs);
      if (!replacement || replacement.prescription.kind !== "RPE_TIME_RANGE") throw new Error("Catalog alternative could not be rebound");
      const sessions = [nonCatalog, catalog];
      state.activePlan.sessions = sessions;
      const plan = state.activePlan;
      if (!("formationKind" in plan.frame)) throw new Error("V3 frame required");
      plan.candidateId = deriveCandidateId(plan.candidateId, {
        kind: plan.candidateKind,
        eventDistanceM: plan.eventDistanceM,
        selectedDetailedTemplateRef: plan.selectedDetailedTemplateRef,
        selectedEnergyIntent: plan.selectedEnergyIntent,
        sourceMode: plan.sourceMode,
        selectionAuthority: "SELF",
        frame: plan.frame,
        sessions,
      });
      const parsed = planBetaStateV3Schema.safeParse(state);
      if (!parsed.success) throw new Error("The synthetic active-plan fixture did not pass the current schema");
      return {
        state: parsed.data,
        alternateCatalogId: alternate.id,
        catalogBeforeDuration: catalog.prescription.durationMinutes.minimum + "–" + catalog.prescription.durationMinutes.maximum + "분",
        catalogAfterDuration: replacement.prescription.durationMinutes.minimum + "–" + replacement.prescription.durationMinutes.maximum + "분",
      };
    }
  `
  const result = await build({
    stdin: { contents: fixtureSource, resolveDir: process.cwd(), sourcefile: "active-plan-edit-fixture.ts", loader: "ts" },
    bundle: true,
    write: false,
    platform: "node",
    format: "esm",
    tsconfig: "tsconfig.json",
  })
  const source = Buffer.from(result.outputFiles[0]!.contents).toString("base64")
  const module = await import(`data:text/javascript;base64,${source}`) as { makeFixture: () => ActivePlanFixture }
  return module.makeFixture()
}

async function assertFits(page: import("@playwright/test").Page, selector: string): Promise<void> {
  expect(await page.locator(selector).evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
}
