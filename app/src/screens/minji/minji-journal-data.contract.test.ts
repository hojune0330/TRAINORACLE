import { describe, expect, it } from "vitest"
import { MINJI_JOURNAL_PAGES } from "./minji-journal-data"

describe("Minji journal showcase data", () => {
  it("provides six dated read-only pages with complete, distinct decoration presets", () => {
    expect(MINJI_JOURNAL_PAGES).toHaveLength(6)
    expect(new Set(MINJI_JOURNAL_PAGES.map((page) => page.date)).size).toBe(6)

    const decorationSignatures = MINJI_JOURNAL_PAGES.map((page) => JSON.stringify({
      themeId: page.decorationPreset.themeId,
      inkId: page.decorationPreset.inkId,
      avatarId: page.decorationPreset.avatarId,
      placements: page.decorationPreset.placements,
    }))
    expect(new Set(decorationSignatures).size).toBe(MINJI_JOURNAL_PAGES.length)

    for (const page of MINJI_JOURNAL_PAGES) {
      expect(page.date).toMatch(/^\d{4}-\d{2}-\d{2}$/u)
      expect(page.mood).not.toHaveLength(0)
      expect(page.bodyCondition).not.toHaveLength(0)
      expect(page.weather).not.toHaveLength(0)
      expect(page.decorationPreset.name).not.toHaveLength(0)
      expect(page.decorationPreset.placements).not.toHaveLength(0)
      expect(new Set(page.decorationPreset.placements.map((placement) => placement.slot)).size)
        .toBe(page.decorationPreset.placements.length)
    }
  })

  it("starts with a gentle thirty-minute example, never the old forty-minute session", () => {
    const firstPage = MINJI_JOURNAL_PAGES[0]

    expect(firstPage?.facts).toContain("시간 30분")
    expect(firstPage?.facts).not.toContain("시간 40분")
  })

  it("uses concrete observations for every title, mood, and diary note", () => {
    expect(MINJI_JOURNAL_PAGES.map((page) => page.title)).toEqual([
      "4.6km를 달린 첫 기록",
      "훈련 4일과 휴식 3일",
      "5시간 잔 다음 날, RPE 8",
      "오른쪽 무릎이 불편해 쉰 날",
      "같은 1000m 반복, RPE 9에서 6",
      "경기 전 확인한 세 경기 기록",
    ])
    expect(MINJI_JOURNAL_PAGES.map((page) => page.mood)).toEqual([
      "첫 기록을 남겨 뿌듯함",
      "쉬기로 정해서 마음이 편함",
      "집중이 안 돼 답답함",
      "무릎이 더 아플까 걱정됨",
      "마지막 반복까지 마쳐 뿌듯함",
      "경기가 기다려지고 조금 긴장됨",
    ])
    expect(MINJI_JOURNAL_PAGES.map((page) => page.quote)).toEqual([
      "처음 10분은 다리가 뻣뻣했지만, 뒤에는 편하게 달렸다.",
      "다리에 피로가 남아 오늘은 쉬었다. 내일 아침 상태를 다시 적겠다.",
      "두 번째 반복부터 다리가 무거웠고, 코치의 설명을 한 번 놓쳤다.",
      "계단을 내려갈 때 오른쪽 무릎이 불편했다. 통증은 2/5였다.",
      "여섯 번째 1000m까지 목표 시간을 지켰고, 오늘 RPE는 6이었다.",
      "지난 경기 전에는 잠을 7시간 잤고 통증이 없었다. 이번에도 전날 일찍 자려고 한다.",
    ])
  })
})
