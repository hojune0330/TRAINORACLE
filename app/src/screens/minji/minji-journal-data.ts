import { createEmptyDecorationState } from "../../domain/decoration-schema"
import type { DecorationPagePlacement, DecorationState } from "../../domain/decoration-schema"
import type { AvatarDecorationId, InkDecorationId, PlacementDecorationId, ThemeDecorationId } from "../../domain/decoration-catalog"

export type MinjiDecorationPreset = { readonly name: string; readonly themeId: ThemeDecorationId; readonly inkId: InkDecorationId; readonly avatarId: AvatarDecorationId | null; readonly placements: readonly Omit<DecorationPagePlacement, "date">[] }
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

const placement = (slot: DecorationPagePlacement["slot"], itemId: PlacementDecorationId): Omit<DecorationPagePlacement, "date"> => ({ slot, itemId })
const preset = (name: string, themeId: ThemeDecorationId, placements: readonly Omit<DecorationPagePlacement, "date">[], avatarId: AvatarDecorationId | null = null): MinjiDecorationPreset => ({ name, themeId, inkId: "INK_NAVY", avatarId, placements })
const pages = [
  { id: "DAY_ONE", when: "첫날", date: "2025-03-02", title: "처음 적은 한 줄", preview: "가볍게 달린 날도 첫 페이지가 돼요.", mood: "조금 설렘", bodyCondition: "다리가 가벼움", weather: "맑고 선선함", situation: "동네를 가볍게 달리고, 기억하고 싶은 세 가지만 적었어요.", quote: "30분만 천천히 뛰었는데, 다음 날도 적어 보고 싶어졌어요.", facts: ["거리 4.6km", "시간 30분", "힘든 정도(RPE) 4/10"], discovery: "완벽한 하루가 아니어도 첫 기록은 시작이 될 수 있어요.", question: { label: "이 정도만 적어도 될까?", answer: "괜찮아요. 기억하고 싶은 사실 한두 개만 남겨도 충분해요." }, decorationPreset: preset("가벼운 첫날", "THEME_TRACK_NOTEBOOK", [placement("TOP_CORNER", "STICKER_WEATHER_SUN")]) },
  { id: "WEEK_THREE", when: "3주", date: "2025-03-23", title: "이번 주가 보이기 시작했다", preview: "달린 날과 쉰 날을 함께 적었어요.", mood: "편안함", bodyCondition: "회복 중", weather: "바람이 부드러움", situation: "달린 날과 쉬는 날을 함께 적으니 한 주가 또렷해 보였어요.", quote: "오늘은 쉬었다. 그래도 기록을 닫지 않으니 마음이 편하다.", facts: ["훈련 4일", "휴식 3일", "기록한 날 7일"], discovery: "휴식도 같은 무게의 기록이라서 흐름을 더 다정하게 볼 수 있어요.", question: { label: "쉰 날도 기록일까?", answer: "네. 쉬기로 한 선택도 내 흐름을 돌아볼 때 필요한 기록이에요." }, decorationPreset: preset("편안한 쉼", "THEME_TRACK_NOTEBOOK", [placement("HEADER_TAPE", "TAPE_CHECKER"), placement("PAGE_FOOTER", "STAMP_REST_DAY")]) },
  { id: "MONTH_TWO", when: "2개월", date: "2025-05-04", title: "힘든 날에 함께 보인 것", preview: "잠과 힘든 느낌이 함께 보인 날이 있었어요.", mood: "조용함", bodyCondition: "조금 무거움", weather: "구름이 많음", situation: "잠을 적게 잔 다음 날, 같은 훈련도 더 힘들게 적은 날이 몇 번 있었어요.", quote: "오늘은 천천히 돌아왔다. 몸이 평소보다 무거웠다.", facts: ["수면 5시간 12분", "힘든 정도(RPE) 8/10", "집중이 흐트러짐"], discovery: "기록은 답을 정하지 않고 다음에 다시 살필 자리를 남겨 줘요.", caution: "잠 때문이라고 확정할 수는 없어요. 함께 보인 기록일 뿐이에요.", question: { label: "잠을 적게 자서 더 힘들었을까?", answer: "그럴 수도 있지만 이 기록만으로는 정답을 낼 수 없어요. 다음 기록과 함께 살펴봐요." }, decorationPreset: preset("하늘 아래 메모", "THEME_SKY_JOURNAL", [placement("TOP_CORNER", "STICKER_WEATHER_SUN")]) },
  { id: "MONTH_SIX", when: "6개월", date: "2025-09-07", title: "몸의 신호를 알아챘다", preview: "회복 페이지도 분명한 한 페이지예요.", mood: "안도", bodyCondition: "오른쪽 무릎이 불편함", weather: "비가 조금 옴", situation: "무릎이 불편해서 오늘은 달리지 않고 쉬기로 했어요.", quote: "괜찮아질 때를 기다리는 것도 오늘의 기록이다.", facts: ["통증 2/5", "30분 걷기로 선택", "다음 기록에서 다시 확인"], discovery: "조금 불편한 신호도 적으면 나중에 몸의 리듬을 돌아볼 수 있어요.", supportingText: "무릎이 신경 쓰이는 날도 한 페이지예요.", caution: "이 기록은 진단이나 운동 허가가 아니에요. 계속 불편하면 어른이나 전문가와 상의해요.", question: { label: "조금 아픈 것도 적어야 할까?", answer: "작은 변화도 적어 두면 언제부터 달라졌는지 돌아보기 쉬워요." }, decorationPreset: preset("회복의 여백", "THEME_SKY_JOURNAL", [placement("PAGE_FOOTER", "STAMP_REST_DAY"), placement("BODY_MARGIN", "STICKER_WEATHER_SUN")]) },
  { id: "MONTH_TEN", when: "10개월", date: "2026-01-11", title: "같은 훈련, 달라진 느낌", preview: "비슷한 날씨를 나란히 적어 봤어요.", mood: "차분한 자신감", bodyCondition: "호흡이 안정됨", weather: "차갑고 맑음", situation: "민지는 예전에 했던 것과 같은 훈련을 다시 기록했어요.", quote: "마지막 반복도 숨이 조금 편해서 기분이 좋았다.", facts: ["예전 힘든 정도 9/10", "오늘 힘든 정도 6/10", "같은 훈련 표시"], discovery: "달라진 느낌을 알아차린 데에는 예전의 기록이 있어요.", notation: { raw: "6×1000m @3'20\"", lines: ["1000m를 여섯 번 뛰는 예시예요.", "각 1000m의 표시 기준은 3분 20초예요.", "민지의 가상 기록이며 따라 하라는 계획이 아니에요."] }, decorationPreset: preset("결승선의 기억", "THEME_TRACK_NOTEBOOK", [placement("HEADER_TAPE", "TAPE_CHECKER"), placement("TOP_CORNER", "STICKER_FINISH_LINE")]) },
  { id: "MONTH_FOURTEEN", when: "14개월", date: "2026-05-03", title: "경기 전에 다시 볼 기록", preview: "기억하고 싶은 하루를 한곳에 모아 두었어요.", mood: "기대", bodyCondition: "가볍고 집중됨", weather: "맑은 출발", situation: "경기를 앞두고 예전의 페이지를 다시 읽어 보았어요.", quote: "결과보다 오늘의 출발선을 기억하고 싶다.", facts: ["개인 최고 기록(PB) 16:10.44", "이전 기록 16:42.18", "경기 3개 비교"], discovery: "기록은 성과표가 아니라 다음 출발선에서 다시 읽는 나의 말이 될 수 있어요.", question: { label: "이대로 하면 다음에도 잘 뛸까?", answer: "장담할 수는 없어요. 다만 내 기록을 다시 확인할 좋은 출발점은 될 수 있어요." }, decorationPreset: preset("다시 선 출발선", "THEME_SKY_JOURNAL", [placement("HEADER_TAPE", "TAPE_CHECKER"), placement("BODY_MARGIN", "STICKER_FINISH_LINE")], "AVATAR_START_LINE") },
] as const satisfies readonly MinjiJournalPage[]
export const MINJI_JOURNAL_PAGES: readonly MinjiJournalPage[] = pages
export function minjiDecorationState(page: MinjiJournalPage): DecorationState { const base = createEmptyDecorationState(); return { ...base, ownedItemIds: [...base.ownedItemIds, "THEME_SKY_JOURNAL", "STICKER_FINISH_LINE", "AVATAR_START_LINE"], equipped: { themeId: page.decorationPreset.themeId, inkId: page.decorationPreset.inkId, avatarId: page.decorationPreset.avatarId }, pagePlacements: page.decorationPreset.placements.map((item) => ({ ...item, date: page.date })) } }
