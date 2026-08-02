export type MinjiJournalPage = {
  readonly id: "DAY_ONE" | "WEEK_THREE" | "MONTH_TWO" | "MONTH_SIX" | "MONTH_TEN" | "MONTH_FOURTEEN"
  readonly when: string
  readonly title: string
  readonly preview: string
  readonly situation: string
  readonly quote: string
  readonly facts: readonly string[]
  readonly discovery: string
  readonly caution?: string
  readonly question?: {
    readonly label: string
    readonly answer: string
  }
  readonly notation?: {
    readonly raw: string
    readonly lines: readonly string[]
  }
}

export const MINJI_JOURNAL_PAGES: readonly MinjiJournalPage[] = [
  {
    id: "DAY_ONE",
    when: "첫날",
    title: "처음 적은 한 줄",
    preview: "잘 쓰지 않아도 기록은 시작돼요.",
    situation: "오늘은 가볍게 뛰려고 나갔어요.",
    quote: "40분 뛰었다. 처음엔 가벼웠는데 끝에는 꽤 힘들었다.",
    facts: ["거리 8km", "시간 40분", "힘든 정도(RPE) 7/10"],
    discovery: "짧은 한 줄도 나중에 다시 볼 수 있는 첫 페이지가 됐어요.",
    question: {
      label: "이 정도만 적어도 될까?",
      answer: "괜찮아요. 기억하고 싶은 사실 한두 개만 남겨도 충분해요.",
    },
  },
  {
    id: "WEEK_THREE",
    when: "3주",
    title: "이번 주가 보이기 시작했다",
    preview: "운동한 날과 쉰 날이 함께 쌓였어요.",
    situation: "민지는 운동한 날뿐 아니라 쉰 날도 짧게 적었어요.",
    quote: "이번 주는 네 번 운동했다. 쉬는 날도 한 번 적었다.",
    facts: ["훈련 4회", "기록한 날 5일", "거리 32.4km"],
    discovery: "많이 뛴 주보다 어떤 날을 보냈는지가 먼저 보이기 시작했어요.",
    question: {
      label: "쉰 날도 기록일까?",
      answer: "네. 쉬기로 한 선택도 다음에 내 흐름을 돌아볼 때 필요한 기록이에요.",
    },
  },
  {
    id: "MONTH_TWO",
    when: "2개월",
    title: "힘든 날에 함께 보인 것",
    preview: "잠과 힘든 느낌이 함께 보인 날이 있었어요.",
    situation: "잠을 적게 잔 다음 날, 같은 훈련도 더 힘들게 적은 날이 몇 번 있었어요.",
    quote: "새벽까지 폰을 봤다. 오늘 훈련은 정말 힘들었다.",
    facts: ["수면 5시간 12분", "힘든 정도(RPE) 9/10", "비슷한 기록 여러 날"],
    discovery: "두 기록이 자주 함께 보였다는 사실을 다음 훈련 전에 다시 확인할 수 있었어요.",
    caution: "잠 때문이라고 확정할 수는 없어요. 함께 보인 기록일 뿐이에요.",
    question: {
      label: "잠을 적게 자서 더 힘들었을까?",
      answer: "그럴 수도 있지만 이 기록만으로는 정답을 낼 수 없어요. 다음 기록과 함께 살펴봐요.",
    },
  },
  {
    id: "MONTH_SIX",
    when: "6개월",
    title: "몸의 신호를 알아챘다",
    preview: "조금 불편했던 무릎 기록이 달라졌어요.",
    situation: "오른쪽 무릎이 조금 불편했고, 사흘 뒤에는 더 신경 쓰였어요.",
    quote: "계단에서 무릎이 신경 쓰인다. 오늘은 쉬기로 했다.",
    facts: ["통증 1 → 1 → 2 → 3", "3일 쉬기로 선택", "다음 기록에서 다시 확인"],
    discovery: "민지는 며칠 쉬고 다음 기록을 확인하며 천천히 돌아왔어요.",
    caution: "이 기록은 진단이나 운동 허가가 아니에요. 계속 불편하면 어른이나 전문가와 상의해요.",
    question: {
      label: "조금 아픈 것도 적어야 할까?",
      answer: "작은 변화도 적어 두면 나중에 언제부터 달라졌는지 돌아보기 쉬워요.",
    },
  },
  {
    id: "MONTH_TEN",
    when: "10개월",
    title: "같은 훈련, 달라진 느낌",
    preview: "같은 훈련을 예전보다 덜 힘들게 적었어요.",
    situation: "민지는 예전에 했던 것과 같은 훈련을 다시 기록했어요.",
    quote: "마지막까지 여유가 조금 남았다. 예전과 느낌이 다르다.",
    facts: ["예전 힘든 정도 9/10", "오늘 힘든 정도 6/10", "같은 훈련 표시"],
    discovery: "예전보다 덜 힘들게 느꼈다는 기록이에요. 다른 이유도 있을 수 있어요.",
    notation: {
      raw: "6×1000m @3'20\"",
      lines: [
        "1000m를 여섯 번 뛰는 예시예요.",
        "각 1000m의 표시 기준은 3분 20초예요.",
        "민지의 가상 기록이며 따라 하라는 계획이 아니에요.",
      ],
    },
  },
  {
    id: "MONTH_FOURTEEN",
    when: "14개월",
    title: "경기 전에 다시 볼 기록",
    preview: "잘 뛰었던 날들 앞의 기록을 다시 봤어요.",
    situation: "잘 뛰었다고 느낀 세 경기 앞에는 비슷하게 적힌 기록이 몇 가지 있었어요.",
    quote: "다음 경기 전에도 이 기록을 다시 보기로 했다.",
    facts: ["개인 최고 기록(PB) 16:10.44", "이전 기록 16:42.18", "잘 뛰었던 경기 3개 비교"],
    discovery: "성공의 원인이라고 정하지 않고 다음 경기 전에 다시 볼 힌트로 남겼어요.",
    question: {
      label: "이대로 하면 다음에도 잘 뛸까?",
      answer: "장담할 수는 없어요. 다만 내 기록을 다시 확인할 좋은 출발점은 될 수 있어요.",
    },
  },
] as const
