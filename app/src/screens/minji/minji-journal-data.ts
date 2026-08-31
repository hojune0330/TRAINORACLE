import { createEmptyDecorationState } from "../../domain/decoration-schema"
import type { DecorationPageItem, DecorationState } from "../../domain/decoration-schema"
import { V2_SLOT_DEFAULT_TRANSFORMS } from "../../domain/decoration-schema"
import type { DecorationSlot } from "../../domain/decoration-catalog"
import type { AvatarDecorationId, InkDecorationId, PlacementDecorationId, ThemeDecorationId } from "../../domain/decoration-catalog"

export type MinjiDecorationPreset = { readonly name: string; readonly themeId: ThemeDecorationId; readonly inkId: InkDecorationId; readonly avatarId: AvatarDecorationId | null; readonly placements: readonly DecorationPageItem[] }
export type MinjiJournalPage = {
  readonly id: "DAY_ONE" | "WEEK_THREE" | "MONTH_TWO" | "MONTH_SIX" | "MONTH_TEN" | "MONTH_FOURTEEN"
  readonly when: string
  readonly date: string
  readonly title: string
  readonly preview: string
  readonly mood: string
  readonly bodyCondition: string
  readonly weather: string
  readonly situation: string
  readonly quote: string
  readonly facts: readonly string[]
  readonly discovery: string
  readonly decorationPreset: MinjiDecorationPreset
  readonly supportingText?: string
  readonly caution?: string
  readonly question?: { readonly label: string; readonly answer: string }
  readonly notation?: { readonly raw: string; readonly lines: readonly string[] }
}

/* 쇼케이스 프리셋은 v2 슬롯 기본 좌표를 그대로 v3 transform으로 쓴다 — 시각 결과 동일. */
const placement = (slot: DecorationSlot, itemId: PlacementDecorationId): DecorationPageItem => ({ itemId, transform: V2_SLOT_DEFAULT_TRANSFORMS[slot] })
const preset = (name: string, themeId: ThemeDecorationId, placements: readonly DecorationPageItem[], avatarId: AvatarDecorationId | null = null): MinjiDecorationPreset => ({ name, themeId, inkId: "INK_NAVY", avatarId, placements })
const pages = [
  { id: "DAY_ONE", when: "첫날", date: "2025-03-02", title: "4.6km를 달린 첫 기록", preview: "거리 4.6km, 시간 30분, RPE 4를 적었어요.", mood: "첫 기록을 남겨 뿌듯함", bodyCondition: "다리에 불편함 없음", weather: "맑음 · 약한 바람", situation: "동네 코스에서 4.6km를 30분 동안 천천히 달리고 거리·시간·RPE를 적었어요.", quote: "처음 10분은 다리가 뻣뻣했지만, 뒤에는 편하게 달렸다.", facts: ["거리 4.6km", "시간 30분", "힘든 정도(RPE) 4/10"], discovery: "첫 기록에 거리 4.6km, 시간 30분, RPE 4가 남았어요.", question: { label: "거리와 시간만 적어도 될까?", answer: "네. 오늘 확인한 사실만 적고 모르는 항목은 비워도 돼요." }, decorationPreset: preset("햇살 스티커", "THEME_TRACK_NOTEBOOK", [placement("TOP_CORNER", "STICKER_WEATHER_SUN")]) },
  { id: "WEEK_THREE", when: "3주", date: "2025-03-23", title: "훈련 4일과 휴식 3일", preview: "7일 동안 달린 날과 쉰 날을 모두 적었어요.", mood: "쉬기로 정해서 마음이 편함", bodyCondition: "다리에 피로가 조금 남음", weather: "흐림 · 약한 바람", situation: "월·화·목·토요일에는 훈련했고, 나머지 3일은 쉬었다고 적었어요.", quote: "다리에 피로가 남아 오늘은 쉬었다. 내일 아침 상태를 다시 적겠다.", facts: ["훈련 4일", "휴식 3일", "기록한 날 7일"], discovery: "7일 중 훈련 4일과 휴식 3일을 바로 확인할 수 있어요.", question: { label: "쉬는 날도 적어야 할까?", answer: "쉬었다고 적어 두면 일주일 동안 훈련한 날과 쉰 날을 정확히 셀 수 있어요." }, decorationPreset: preset("체크 테이프와 휴식 도장", "THEME_TRACK_NOTEBOOK", [placement("HEADER_TAPE", "TAPE_CHECKER"), placement("PAGE_FOOTER", "STAMP_REST_DAY")]) },
  { id: "MONTH_TWO", when: "2개월", date: "2025-05-04", title: "5시간 잔 다음 날, RPE 8", preview: "수면 5시간 12분과 RPE 8을 함께 적었어요.", mood: "집중이 안 돼 답답함", bodyCondition: "다리가 평소보다 무거움", weather: "흐림", situation: "5시간 12분 잔 날에 평소 하던 훈련을 했고, RPE를 8로 적었어요.", quote: "두 번째 반복부터 다리가 무거웠고, 코치의 설명을 한 번 놓쳤다.", facts: ["수면 5시간 12분", "힘든 정도(RPE) 8/10", "집중이 흐트러짐"], discovery: "수면이 짧았던 날과 RPE가 높았던 날이 같은 날짜에 기록됐어요. 이것만으로 원인을 정할 수는 없어요.", caution: "잠 때문이라고 확정할 수는 없어요. 같은 날 기록된 두 정보예요.", question: { label: "잠을 적게 자서 더 힘들었을까?", answer: "그럴 수 있지만 이 기록 하나로는 정할 수 없어요. 다음 훈련의 수면과 RPE를 함께 비교해 봐요." }, decorationPreset: preset("하늘 속지와 햇살 스티커", "THEME_SKY_JOURNAL", [placement("TOP_CORNER", "STICKER_WEATHER_SUN")]) },
  { id: "MONTH_SIX", when: "6개월", date: "2025-09-07", title: "오른쪽 무릎이 불편해 쉰 날", preview: "통증 2/5와 달리기 대신 걷기를 적었어요.", mood: "무릎이 더 아플까 걱정됨", bodyCondition: "오른쪽 무릎 통증 2/5", weather: "약한 비", situation: "걸을 때 오른쪽 무릎이 불편해 달리기는 하지 않고 30분만 걸었어요.", quote: "계단을 내려갈 때 오른쪽 무릎이 불편했다. 통증은 2/5였다.", facts: ["통증 2/5", "30분 걷기로 선택", "다음 기록에서 다시 확인"], discovery: "오른쪽 무릎 불편함이 2025-09-07에 시작됐고 통증을 2/5로 적었다는 사실이 남았어요.", supportingText: "걷기와 계단에서 느낀 오른쪽 무릎 불편함을 적었어요.", caution: "이 기록은 진단이나 운동 허가가 아니에요. 계속 불편하면 어른이나 전문가와 상의해요.", question: { label: "통증 2/5도 적어야 할까?", answer: "적어 두면 불편함이 시작된 날짜와 다음 기록에서 달라진 정도를 비교할 수 있어요." }, decorationPreset: preset("하늘 속지와 휴식 도장", "THEME_SKY_JOURNAL", [placement("PAGE_FOOTER", "STAMP_REST_DAY"), placement("BODY_MARGIN", "STICKER_WEATHER_SUN")]) },
  { id: "MONTH_TEN", when: "10개월", date: "2026-01-11", title: "같은 1000m 반복, RPE 9에서 6", preview: "같은 6×1000m 기록 두 개를 비교했어요.", mood: "마지막 반복까지 마쳐 뿌듯함", bodyCondition: "마지막 반복 뒤 숨이 찼음", weather: "맑음 · 추움", situation: "예전에 했던 6×1000m 훈련과 오늘 기록을 나란히 비교했어요.", quote: "여섯 번째 1000m까지 목표 시간을 지켰고, 오늘 RPE는 6이었다.", facts: ["예전 힘든 정도 9/10", "오늘 힘든 정도 6/10", "같은 훈련 표시"], discovery: "같은 6×1000m 훈련에서 RPE가 9에서 6으로 달랐어요. 이 기록만으로 경기력이 좋아졌다고 단정하지는 않아요.", notation: { raw: "6×1000m @3'20\"", lines: ["1000m를 여섯 번 뛰는 예시예요.", "각 1000m 목표 시간은 3분 20초예요.", "민지의 가상 기록이며 따라 하라는 계획이 아니에요."] }, decorationPreset: preset("체크 테이프와 결승선 스티커", "THEME_TRACK_NOTEBOOK", [placement("HEADER_TAPE", "TAPE_CHECKER"), placement("TOP_CORNER", "STICKER_FINISH_LINE")]) },
  { id: "MONTH_FOURTEEN", when: "14개월", date: "2026-05-03", title: "경기 전 확인한 세 경기 기록", preview: "이전 세 경기 기록과 경기 전 몸 상태를 확인했어요.", mood: "경기가 기다려지고 조금 긴장됨", bodyCondition: "통증 없음 · 몸이 가벼움", weather: "맑음 · 바람 적음", situation: "다음 경기를 앞두고 이전 세 경기의 기록, 통증, 경기 전 기분을 다시 확인했어요.", quote: "지난 경기 전에는 잠을 7시간 잤고 통증이 없었다. 이번에도 전날 일찍 자려고 한다.", facts: ["개인 최고 기록(PB) 16:10.44", "이전 기록 16:42.18", "경기 3개 비교"], discovery: "세 경기의 기록과 경기 전 몸 상태를 한 화면에서 비교할 수 있어요.", question: { label: "지난 경기 기록대로 준비하면 될까?", answer: "같은 결과를 보장하지 않아요. 수면·통증·기분처럼 이번 준비와 비교할 항목을 확인하는 데 써요." }, decorationPreset: preset("출발선 아바타와 결승선 스티커", "THEME_SKY_JOURNAL", [placement("HEADER_TAPE", "TAPE_CHECKER"), placement("BODY_MARGIN", "STICKER_FINISH_LINE")], "AVATAR_START_LINE") },
] as const satisfies readonly MinjiJournalPage[]
export const MINJI_JOURNAL_PAGES: readonly MinjiJournalPage[] = pages
export function minjiDecorationState(page: MinjiJournalPage): DecorationState { const base = createEmptyDecorationState(); return { ...base, ownedItemIds: [...base.ownedItemIds, "THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"], equipped: { themeId: page.decorationPreset.themeId, inkId: page.decorationPreset.inkId, avatarId: page.decorationPreset.avatarId }, pages: page.decorationPreset.placements.length === 0 ? [] : [{ date: page.date, items: page.decorationPreset.placements }] } }
