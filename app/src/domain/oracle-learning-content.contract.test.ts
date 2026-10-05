import { describe, expect, it } from "vitest"
import { GLOSSARY, TERM_CATEGORY_LABELS } from "./glossary"
import { TRAINING_CONTENT_CATALOG } from "./training-content-catalog"
import { ORACLE_CONTENT_CATALOG } from "./oracle-content-catalog"
import { isOracleLearningDestination, ORACLE_EVIDENCE_PAGES, ORACLE_EXAMPLE_PAGES, ORACLE_GLOSSARY_PAGES,
  ORACLE_LEARNING_QUIZ, ORACLE_LEARNING_TERM_IDS } from "./oracle-learning-content"

describe("Oracle learning content provenance", () => {
  it("accepts only the four owned destinations and leaves H04 METHODS unchanged", () => {
    for (const id of ["H01", "H02", "H03", "H05", "H06", "B07"]) {
      expect(isOracleLearningDestination(ORACLE_CONTENT_CATALOG.find(topic => topic.id === id)!.destination)).toBe(true)
    }
    expect(ORACLE_CONTENT_CATALOG.find(topic => topic.id === "H04")!.destination).toBe("METHODS")
    expect(isOracleLearningDestination("METHODS")).toBe(false)
    expect(isOracleLearningDestination("PROFILE")).toBe(false)
  })
  it("reuses reviewed glossary wording, category, limitation, source links and dates verbatim", () => {
    expect(ORACLE_GLOSSARY_PAGES).toHaveLength(ORACLE_LEARNING_TERM_IDS.length)
    ORACLE_LEARNING_TERM_IDS.forEach((id, index) => {
      const page = ORACLE_GLOSSARY_PAGES[index]!, original = GLOSSARY[id]
      expect(page.paragraphs[0]).toBe(original.short)
      expect(page.category).toBe(TERM_CATEGORY_LABELS[original.category])
      expect(page.limitation).toBe(original.notMeaning)
      expect(page.sources).toBe(original.sourceRefs)
      expect(page.reviewedAt).toBe(original.reviewedAt)
    })
  })
  it("keeps the exact existing training source grades, review states and use boundaries", () => {
    for (const article of TRAINING_CONTENT_CATALOG) {
      const page = ORACLE_EVIDENCE_PAGES.find(candidate => candidate.id === article.id)!
      expect(page.sources).toEqual([{ label: article.sourceLabel, url: article.sourceUrl, grade: article.sourceGrade, state: article.sourceState }])
      expect(page.paragraphs).toContain(article.summary)
      expect(page.paragraphs).toContain(article.whatItTrains)
      expect(page.limitation).toBe(article.useBoundary)
    }
  })
  it("does not promote partially accessed watch documentation into graded validation", () => {
    const watch = ORACLE_EVIDENCE_PAGES.find(page => page.id === "watch")!
    expect(watch.sources?.[0]?.url).toBe("https://support.garmin.com/en-GB/?faq=VxKazDQ2mkAmDoQbJriEBA")
    expect(watch.sources?.[0]?.scope).toContain("본문 없이 푸터만 표시")
    expect(watch.sources?.[0]?.grade).toBeUndefined()
    expect(watch.sources?.[0]?.state).toBeUndefined()
    expect(watch.limitation).toContain("개인 기기의 정확도 검증이 아니에요")
  })
  it("has distinct questions with valid choices and source-bounded feedback", () => {
    expect(new Set(ORACLE_LEARNING_QUIZ.map(quiz => quiz.id)).size).toBe(3)
    for (const quiz of ORACLE_LEARNING_QUIZ) {
      expect(quiz.choices.length).toBeGreaterThanOrEqual(2)
      expect(quiz.choices[quiz.correctIndex]).toBeTruthy()
      expect(quiz.explanation.length).toBeGreaterThan(15)
      expect(quiz.basis).toBeTruthy()
    }
    expect(ORACLE_LEARNING_QUIZ[0]!.choices[ORACLE_LEARNING_QUIZ[0]!.correctIndex]).toBe("날짜 1일 · 세션 2회 · 8km")
    expect(ORACLE_LEARNING_QUIZ[1]!.choices[ORACLE_LEARNING_QUIZ[1]!.correctIndex]).toBe("5회")
    expect(ORACLE_LEARNING_QUIZ[2]!.explanation).toContain(GLOSSARY.main.notMeaning)
  })
  it("preserves synthetic repetition boundaries and unknown recovery", () => {
    const page = ORACLE_EXAMPLE_PAGES.find(page => page.id === "repetitions")!
    expect(page.table?.rows.map(row => row[1])).toEqual(["92초", "91초", "93초", "94초", "92초", "95초"])
    expect(page.table?.rows.filter(row => row[2] === "범위 안")).toHaveLength(5)
    expect(page.limitation).toContain("회복 준수 여부는 미확인")
    expect(ORACLE_EXAMPLE_PAGES.every(page => page.category === "합성 예시")).toBe(true)
  })
})
