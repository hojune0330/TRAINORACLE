import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { planBetaStateV3Schema } from "../plan-beta-schema"
import { publicPlanCardFromState } from "./public-profile"
import { createExplanationReceipt } from "../training-explanation-receipt"

const migration = readFileSync(
  resolve(process.cwd(), "../supabase/migrations/0029_plan_backup_public_profiles.sql"),
  "utf8",
)

describe("plan backup and public sharing contract", () => {
  it("preserves every previously deployed server feature key", () => {
    for (const key of [
      "ACCOUNT", "SYNC", "SHARING", "PLAN_PROPOSALS", "PRODUCT_ANALYTICS", "FEEDBACK_BOARD",
    ]) {
      expect(migration).toContain(`'${key}'`)
    }
  })

  it("keeps plan backup private and account-scoped", () => {
    expect(migration).toContain("create table if not exists public.saved_training_plans")
    expect(migration).toContain("public.account_network_access_allowed(user_id)")
    expect(migration).toContain("public.enforce_service_feature_write('PLAN_BACKUP')")
    expect(migration).not.toMatch(/grant select[^;]+saved_training_plans[^;]+anon/iu)
  })

  it("keeps public profile and cards behind the server sharing switch", () => {
    expect(migration).toContain("create or replace function public.public_profile_sharing_enabled()")
    expect(migration).toContain("grant execute on function public.public_profile_sharing_enabled() to anon")
    expect(migration).toContain("is_public and public.public_profile_sharing_enabled()")
    expect(migration).toContain("public.enforce_service_feature_write('PUBLIC_PROFILE')")
    expect(migration).toContain("auth.uid() = user_id")
  })

  it("hides every shared card when its owner makes the profile private", () => {
    expect(migration).toContain("where profile.user_id = public_plan_share_cards.user_id")
    expect(migration).toContain("and profile.is_public")
  })

  it("allows only the bounded summary-card keys", () => {
    const card = publicPlanCardFromState(planBetaStateV3Schema.parse(stateFixture()))

    expect(Object.keys(card).sort()).toEqual([
      "badgeLabel",
      "completedSessionCount",
      "eventLabel",
      "frameLengthDays",
      "qualitySessionCount",
      "title",
      "totalSessionCount",
    ])
    expect(JSON.stringify(card)).not.toMatch(/memo|pain|symptom|prescription|sessionDay|rpe/iu)
  })

  it("does not expose detailed plan payload through the public tables", () => {
    const publicTableSection = migration.slice(
      migration.indexOf("create table if not exists public.public_athlete_profiles"),
    )
    expect(publicTableSection).not.toContain("plan_payload jsonb")
    expect(publicTableSection).not.toContain("journal_entries")
    expect(publicTableSection).not.toContain("encrypted_private_notes")
  })

  it("never adds private explanation references to public cards", () => {
    const state = stateFixture()
    const withReceipt = planBetaStateV3Schema.parse({ ...state, explanationReceipt: createExplanationReceipt(state.activePlan, state.generatedAt) })
    expect(publicPlanCardFromState(withReceipt)).toEqual(publicPlanCardFromState(planBetaStateV3Schema.parse(state)))
    expect(JSON.stringify(publicPlanCardFromState(withReceipt))).not.toMatch(/Fingerprint|Receipt|capturedAt|athlete-record/u)
  })
})
