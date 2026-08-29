import { describe, expect, it } from "vitest"
import { GLOSSARY, GLOSSARY_ENTRIES, glossarySearchText } from "./glossary"

describe("training terminology contract", () => {
  it("uses Korean-first public names while preserving secondary codes", () => {
    expect(GLOSSARY.base).toMatchObject({ label: "기초 지구력", code: "BASE" })
    expect(GLOSSARY.lt).toMatchObject({ label: "지속 페이스", code: "LT" })
    expect(GLOSSARY.vo2).toMatchObject({ label: "강한 유산소 반복", code: "VO₂" })
    expect(GLOSSARY.gly).toMatchObject({ label: "짧은 고강도 반복", code: "GLY" })
    expect(GLOSSARY.atp).toMatchObject({ label: "스피드·가속", code: "ATP-PC" })
    expect(GLOSSARY.mix).toMatchObject({ label: "여러 강도 조합", code: "MIX" })
  })

  it("keeps pathways, lactate and fuel context as separate terms", () => {
    expect(GLOSSARY.phosphagen.category).toBe("ENERGY_METABOLISM")
    expect(GLOSSARY.glycolytic.category).toBe("ENERGY_METABOLISM")
    expect(GLOSSARY.oxidative.category).toBe("ENERGY_METABOLISM")
    expect(GLOSSARY.lactate.category).toBe("FUEL_AND_RESPONSE")
    expect(GLOSSARY["fat-metabolism"].category).toBe("FUEL_AND_RESPONSE")
    expect(GLOSSARY["fat-metabolism"].notMeaning).toContain("별도 에너지 시스템")
  })

  it("finds Korean, English, code and legacy aliases without promoting them to labels", () => {
    expect(glossarySearchText("gly", GLOSSARY.gly)).toContain("무산소 젖산")
    expect(glossarySearchText("atp", GLOSSARY.atp)).toContain("phosphagen".toLocaleLowerCase("ko-KR"))
    expect(glossarySearchText("vo2", GLOSSARY.vo2)).toContain("vo2")
    expect(GLOSSARY.gly.label).not.toContain("무산소 젖산")
  })

  it("gives every entry a category, review date and short explanation", () => {
    expect(GLOSSARY_ENTRIES.length).toBeGreaterThanOrEqual(40)
    for (const entry of GLOSSARY_ENTRIES) {
      expect(entry.category).toBeTruthy()
      expect(entry.reviewedAt).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
      expect(entry.short.length).toBeGreaterThan(8)
    }
  })
})
