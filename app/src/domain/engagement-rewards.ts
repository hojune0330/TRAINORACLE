import { DECORATION_CATALOG } from "./decoration-catalog"
import type { DecorationId } from "./decoration-catalog"

export type EngagementBadge = {
  readonly id: "FIRST_RECORD" | "SEVEN_DAYS" | "FOURTEEN_DAYS" | "THIRTY_DAYS"
  readonly name: string
  readonly requiredJournalDays: 1 | 7 | 14 | 30
}

const ENGAGEMENT_BADGES = [
  { id: "FIRST_RECORD", name: "첫 기록", requiredJournalDays: 1 },
  { id: "SEVEN_DAYS", name: "기록한 날 7일", requiredJournalDays: 7 },
  { id: "FOURTEEN_DAYS", name: "기록한 날 14일", requiredJournalDays: 14 },
  { id: "THIRTY_DAYS", name: "기록한 날 30일", requiredJournalDays: 30 },
] as const satisfies readonly EngagementBadge[]

export type EngagementMilestone = EngagementBadge & {
  readonly remainingJournalDays: number
}

export type EngagementShareInput = {
  readonly journalDays: number
  readonly availablePoints: number
  readonly ownedDecorationIds: readonly DecorationId[]
  readonly appUrl: string
}

export type EngagementSharePayload = {
  readonly title: string
  readonly text: string
  readonly url: string
}

export type EngagementGarden = {
  readonly icon: "SPROUT" | "LEAF" | "TREE"
  readonly label: string
  readonly name: string
}

export function engagementGarden(journalDays: number): EngagementGarden {
  if (journalDays === 0) return { icon: "SPROUT", label: "기록을 남기면 새싹이 생겨요", name: "기다리는 중" }
  if (journalDays <= 6) return { icon: "SPROUT", label: "새싹이 자라고 있어요", name: "새싹" }
  if (journalDays <= 13) return { icon: "LEAF", label: "잎이 더해지고 있어요", name: "잎이 난 새싹" }
  if (journalDays <= 29) return { icon: "TREE", label: "작은 나무로 자랐어요", name: "작은 나무" }
  return { icon: "TREE", label: "튼튼한 나무로 자랐어요", name: "튼튼한 나무" }
}

export function engagementBadges(journalDays: number): readonly EngagementBadge[] {
  return ENGAGEMENT_BADGES.filter((badge) => badge.requiredJournalDays <= journalDays)
}

export function nextEngagementMilestone(journalDays: number): EngagementMilestone | null {
  const badge = ENGAGEMENT_BADGES.find((candidate) => candidate.requiredJournalDays > journalDays)
  return badge === undefined
    ? null
    : { ...badge, remainingJournalDays: badge.requiredJournalDays - journalDays }
}

export function buildEngagementSharePayload(input: EngagementShareInput): EngagementSharePayload {
  const journalDays = Number.isFinite(input.journalDays) ? Math.max(0, Math.floor(input.journalDays)) : 0
  const availablePoints = Number.isFinite(input.availablePoints) ? Math.max(0, Math.floor(input.availablePoints)) : 0
  const badgeNames = engagementBadges(journalDays).map((badge) => badge.name)
  const badges = badgeNames.length === 0 ? "첫 배지를 준비하고 있어요" : badgeNames.join(" · ")
  const decorationNames = DECORATION_CATALOG
    .filter((item) => !item.starterOwned && input.ownedDecorationIds.includes(item.id))
    .map((item) => item.name)
  const decorations = decorationNames.length === 0 ? "첫 꾸미기를 준비하고 있어요" : decorationNames.join(" · ")
  const url = new URL(input.appUrl)
  if (url.protocol !== "https:" && url.protocol !== "http:") throw new Error("invalid application URL")
  url.search = ""
  url.hash = ""
  return {
    title: "TrainOracle 러닝 기록",
    text: [
      `기록한 날 ${journalDays}일 · ${engagementGarden(journalDays).name}`,
      `사용 가능 ${availablePoints}P`,
      `배지 ${badges}`,
      `꾸미기 ${decorations}`,
      "거리나 훈련 강도가 아니라 기록한 습관으로 모았어요.",
    ].join("\n"),
    url: url.toString(),
  }
}
