import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { PLANNED_ENERGY_INTENTS } from "@impl/plan-generator/types"
import { GLOSSARY, isTermId, type TermId } from "./glossary"
import {
  EXPLANATION_SOURCES,
  EXPLANATION_VERSION,
  TRAINING_EXPLANATION_PROFILES,
  type TrainingExplanationKey,
  type TrainingExplanationProfile,
} from "./training-explanation-profiles"

const COMPONENT_KEYS = ["REST", "WARMUP", "COOLDOWN", "TECHNICAL", "STRENGTH"] as const
const REQUIRED_SECTIONS = [
  "purpose", "energyContext", "workRationale", "recoveryRationale",
  "expectedAdaptation", "observationGuide",
] as const
const EXPECTED_TERMS: Record<TrainingExplanationKey, TermId> = {
  RECOVERY_INTENT: "rec",
  BASE_INTENT: "base",
  LT_INTENT: "lt",
  VO2_INTENT: "vo2",
  GLY_INTENT: "gly",
  ATP_PC_INTENT: "atp",
  MIXED_INTENT: "mix",
  REST: "off",
  WARMUP: "training-notation",
  COOLDOWN: "training-notation",
  TECHNICAL: "training-notation",
  STRENGTH: "training-notation",
}
const repositoryRoot = resolve(process.cwd(), "..")

function prose(profile: TrainingExplanationProfile): string {
  return [...REQUIRED_SECTIONS.map((section) => profile[section]), ...profile.limitations].join(" ")
}

describe("bounded Korean training explanation profiles", () => {
  it("covers every canonical planned intent and component without adding enum values", () => {
    expect(Object.keys(TRAINING_EXPLANATION_PROFILES).sort()).toEqual(
      [...PLANNED_ENERGY_INTENTS, ...COMPONENT_KEYS].sort(),
    )
  })

  it("has a stable explanation version and unique profile identities", () => {
    expect(EXPLANATION_VERSION).toBe("1.0.0")
    const ids = Object.values(TRAINING_EXPLANATION_PROFILES).map((profile) => profile.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const profile of Object.values(TRAINING_EXPLANATION_PROFILES)) {
      expect(profile.id).toMatch(/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u)
      expect(profile.version).toBe(EXPLANATION_VERSION)
    }
  })

  it.each([...PLANNED_ENERGY_INTENTS, ...COMPONENT_KEYS])("%s has complete Korean sections and resolvable terms and sources", (key) => {
    const profile = TRAINING_EXPLANATION_PROFILES[key]
    expect(profile.termId).toBe(EXPECTED_TERMS[key])
    expect(isTermId(profile.termId)).toBe(true)
    for (const section of REQUIRED_SECTIONS) {
      expect(profile[section].trim(), `${key}.${section}`).not.toBe("")
      expect(profile[section], `${key}.${section}`).toMatch(/[가-힣]/u)
    }
    expect(profile.limitations.length).toBeGreaterThan(0)
    for (const limitation of profile.limitations) {
      expect(limitation.trim()).not.toBe("")
      expect(limitation).toMatch(/[가-힣]/u)
    }
    expect(profile.sourceIds.length).toBeGreaterThan(0)
    expect(new Set(profile.sourceIds).size).toBe(profile.sourceIds.length)
    for (const sourceId of profile.sourceIds) {
      expect(EXPLANATION_SOURCES[sourceId], `${key}: ${sourceId}`).toBeDefined()
      expect(EXPLANATION_SOURCES[sourceId]?.id).toBe(sourceId)
    }
    expect(Object.keys(profile).sort()).toEqual([
      "id", "version", "termId", ...REQUIRED_SECTIONS, "limitations", "sourceIds",
    ].sort())
  })

  it("keeps authored prose free of numeric doses and energy contribution percentages", () => {
    for (const [key, profile] of Object.entries(TRAINING_EXPLANATION_PROFILES)) {
      const text = prose(profile).replace(/VO[2₂]/gu, "VO")
      expect(text, key).not.toMatch(/[\p{N}%％]/u)
      expect(text, key).not.toMatch(/(?:한|두|세|네|다섯|여섯|일|이|삼|사|오|육|칠|팔|구|십)\s*(?:초|분|시간|미터|킬로미터|킬로그램|세트|회)(?:씩|간|를|는|로|만|의|\s|[.,])/u)
      expect(text, key).not.toMatch(/퍼센트|일대일|일대육|절반씩|반반/iu)
    }
  })

  it("separates general intent from personal efficacy and retrospective selection evidence", () => {
    for (const profile of Object.values(TRAINING_EXPLANATION_PROFILES)) {
      expect(profile.expectedAdaptation).toMatch(/의도/u)
      expect(profile.expectedAdaptation).toMatch(/개인/u)
      expect(profile.expectedAdaptation).toMatch(/보장(?:하지(?:는)? 않|되지는 않|은 없)/u)
      expect(profile.observationGuide).toMatch(/아니|않/u)
      expect(prose(profile)).not.toMatch(/당신의 일지|메모를 분석|증상을 분석|맞춤 효과|검토 완료|전문가 승인|과학적 승인|의학적으로 안전/u)
    }
  })

  it("explains metabolic purposes rather than substituting technique or entertainment", () => {
    for (const key of ["BASE_INTENT", "LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT"] as const) {
      const profile = TRAINING_EXPLANATION_PROFILES[key]
      expect(profile.purpose, key).toMatch(/에너지 공급|ATP|산소 이용/u)
      expect(profile.workRationale, key).toMatch(/지속|노력|출력|자극|에너지/u)
      expect(profile.purpose, key).not.toMatch(/재미|즐거움|기술 연습|자세 교정/u)
      expect(profile.sourceIds.some((id) => EXPLANATION_SOURCES[id]?.kind !== "COACHING_DESIGN")).toBe(true)
    }
  })

  it("does not isolate ATP-PC, glycolysis, LT, VO2 or fuel into independent systems", () => {
    expect(TRAINING_EXPLANATION_PROFILES.ATP_PC_INTENT.energyContext).toMatch(/첫.*해당과정.*기여/u)
    expect(TRAINING_EXPLANATION_PROFILES.ATP_PC_INTENT.energyContext).toContain("산화 대사도 작동")
    expect(TRAINING_EXPLANATION_PROFILES.GLY_INTENT.energyContext).toContain("인원질과 산화 대사도 함께")
    expect(TRAINING_EXPLANATION_PROFILES.GLY_INTENT.energyContext).toContain("젖산은 다시 연료로")
    expect(TRAINING_EXPLANATION_PROFILES.LT_INTENT.energyContext).toContain("별도 에너지 시스템이 아니")
    expect(TRAINING_EXPLANATION_PROFILES.VO2_INTENT.energyContext).toContain("별도 에너지 시스템 이름이 아니")
    expect(TRAINING_EXPLANATION_PROFILES.BASE_INTENT.energyContext).toContain("탄수화물과 지방을 함께")
    expect(TRAINING_EXPLANATION_PROFILES.BASE_INTENT.energyContext).toContain("지방만 쓰는 훈련은 아니")
    for (const profile of Object.values(TRAINING_EXPLANATION_PROFILES)) {
      expect(prose(profile)).not.toMatch(/노폐물|젖산 제거|젖산 청소|고산소 시스템/u)
    }
  })

  it("binds GLY recovery to actual prescription without universal full recovery", () => {
    const recovery = TRAINING_EXPLANATION_PROFILES.GLY_INTENT.recoveryRationale
    expect(recovery).toContain("언제나 완전 회복을 뜻하지는 않")
    expect(recovery).toContain("실제 처방")
    expect(recovery).toContain("반복 사이·세트 사이 회복 시간과 방식")
    expect(recovery).toContain("짧을수록 좋다는 뜻도 아니")
    expect(TRAINING_EXPLANATION_PROFILES.ATP_PC_INTENT.recoveryRationale).toContain("모든 사람의 완전 회복을 보장하지 않")
  })

  it("keeps generic glossary GLY wording conditional on actual recovery", () => {
    expect(GLOSSARY.gly.short).toContain("실제 처방")
    expect(GLOSSARY.gly.short).toContain("회복 시간과 방식")
    expect(GLOSSARY.gly.short).not.toMatch(/충분한 회복|완전 회복/u)
    expect(GLOSSARY.gly.notMeaning).toContain("모든 GLY 훈련이 완전 회복을 요구하는 것도 아니")
    expect(GLOSSARY.gly).toMatchObject({ label: "짧은 고강도 반복", code: "GLY" })
  })

  it("does not fabricate mixed-work structure or force non-metabolic roles into energy buckets", () => {
    const mixed = TRAINING_EXPLANATION_PROFILES.MIXED_INTENT
    expect(mixed.workRationale).toContain("구성 정보가 없으면")
    expect(mixed.limitations.join(" ")).toContain("미배분")
    for (const key of ["RECOVERY_INTENT", ...COMPONENT_KEYS] as const) {
      const profile = TRAINING_EXPLANATION_PROFILES[key]
      expect(profile.energyContext, key).toMatch(/아니|고정하지 않/u)
      expect(["TRAINING_STRUCTURE", "SCHEDULE_ROLE"]).toContain(GLOSSARY[profile.termId].category)
    }
    expect(TRAINING_EXPLANATION_PROFILES.REST.workRationale).toContain("계획된 운동 구간이 없으므로")
    expect(TRAINING_EXPLANATION_PROFILES.BASE_INTENT.recoveryRationale).toContain("연속 운동이라면 반복 사이 회복은 해당하지 않")
  })
})

describe("training explanation source provenance", () => {
  it("requires source population, applicability limits and source-check-only status", () => {
    for (const [id, source] of Object.entries(EXPLANATION_SOURCES)) {
      expect(source.id).toBe(id)
      expect(source.title.trim()).not.toBe("")
      expect(source.population.trim(), `${id}.population`).not.toBe("")
      expect(source.applicability.trim(), `${id}.applicability`).not.toBe("")
      expect(source.population).toMatch(/[가-힣]/u)
      expect(source.applicability).toMatch(/아니|않|없/u)
      expect(source.reviewStatus).toBe("SOURCE_CHECKED_NOT_DOSE_APPROVAL")
      expect(["MECHANISM_STUDY", "TRAINING_STUDY", "COACHING_DESIGN"]).toContain(source.kind)
      if (source.kind !== "COACHING_DESIGN") {
        expect(source.population).toMatch(/성인|초록은 나이/u)
        expect(source.applicability).toContain("청소년")
      }
    }
  })

  it.each([
    ["8226473", "MECHANISM_STUDY"],
    ["9241025", "MECHANISM_STUDY"],
    ["21777153", "TRAINING_STUDY"],
    ["15387806", "MECHANISM_STUDY"],
    ["10233114", "TRAINING_STUDY"],
    ["8214047", "MECHANISM_STUDY"],
    ["10562610", "TRAINING_STUDY"],
  ])("retains the checked primary original %s and its study type", (pmid, kind) => {
    expect(EXPLANATION_SOURCES[`PMID_${pmid}`]).toMatchObject({
      id: `PMID_${pmid}`,
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      kind,
    })
  })

  it("retains adult cycling transfer limits and distinguishes acute response from adaptation", () => {
    for (const id of ["PMID_8226473", "PMID_9241025", "PMID_10562610"]) {
      const source = EXPLANATION_SOURCES[id]!
      expect(source.population).toMatch(/성인.*사이클/u)
      expect(source.applicability).toContain("달리기")
      expect(source.applicability).toContain("청소년")
    }
    expect(EXPLANATION_SOURCES.PMID_15387806!.applicability).toContain("급성 관찰")
    expect(EXPLANATION_SOURCES.PMID_15387806!.applicability).toContain("장기 적응 연구가 아니")
    expect(EXPLANATION_SOURCES.PMID_21777153!.population).toContain("초록은 나이와 훈련 경력의 범위를 제시하지 않")
    expect(TRAINING_EXPLANATION_PROFILES.STRENGTH.limitations.join(" ")).toMatch(/성인.*청소년/u)
  })

  it("uses existing repo contracts for coaching design rather than invented research URLs", () => {
    for (const source of Object.values(EXPLANATION_SOURCES)) {
      if (source.kind === "COACHING_DESIGN") {
        expect(source.url).toMatch(/^specs\/reconstruct\/[A-Z_]+\.md$/u)
        const sourcePath = resolve(repositoryRoot, source.url!)
        expect(existsSync(sourcePath), source.url).toBe(true)
        expect(readFileSync(sourcePath, "utf8")).toContain("COACH_HOJUNE")
        expect(source.population).toContain("연구 참가자 없음")
      } else {
        expect(source.url).toMatch(/^https:\/\/pubmed\.ncbi\.nlm\.nih\.gov\/\d+\/$/u)
      }
    }
    for (const key of ["RECOVERY_INTENT", "REST", "WARMUP", "COOLDOWN", "TECHNICAL"] as const) {
      expect(TRAINING_EXPLANATION_PROFILES[key].sourceIds.every((id) => EXPLANATION_SOURCES[id]?.kind === "COACHING_DESIGN")).toBe(true)
    }
    for (const key of ["WARMUP", "COOLDOWN"] as const) {
      expect(TRAINING_EXPLANATION_PROFILES[key].sourceIds).toContain("COACHING_PRESCRIPTION")
    }
  })

  it("links every source from content and keeps public provenance separate from athlete data", () => {
    const usedSources = new Set(Object.values(TRAINING_EXPLANATION_PROFILES).flatMap((profile) => profile.sourceIds))
    expect([...usedSources].sort()).toEqual(Object.keys(EXPLANATION_SOURCES).sort())
    for (const source of Object.values(EXPLANATION_SOURCES)) {
      expect(Object.keys(source).sort()).toEqual([
        "id", "title", "url", "kind", "population", "applicability", "reviewStatus",
      ].sort())
      expect(source.url).not.toMatch(/[?#]|athleteId|sessionId|memo|token/iu)
    }
  })
})
