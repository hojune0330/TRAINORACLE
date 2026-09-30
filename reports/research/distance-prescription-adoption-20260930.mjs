export const decisionRef = "reports/review/DISTANCE_PRESCRIPTION_ADOPTION_2026-09-30.md"
export const decisionId = "TO-DISTANCE-ADOPTION-2026-09-30"
export const sourceRefs = [
  "https://vdoto2.com/learn-more/training-definitions",
  "https://pubmed.ncbi.nlm.nih.gov/16177614/",
  "https://pubmed.ncbi.nlm.nih.gov/29842843/",
]

// Exact product adaptations, not a claim that a publication prescribed these doses.
export const definitions = [
  { id: "RP5K-800-05", count: 5, distance: 800, sets: 1, rest: 120, setRest: null,
    family: "race-pace-distance-repetitions", draftRefs: ["X-VO2-02"],
    work: "현재 5000m 기록의 평균 속도로 800m를 5번 달려요. 1000m 반복보다 한 구간을 짧게 나눠 목표 속도를 다시 맞추는 구성이에요. 본운동은 총 4km이며, 5km 연속 달리기와 같은 부담이나 효과는 아니에요.",
    recovery: "반복 사이 120초 천천히 조깅해요. 다음 반복을 같은 목표 속도로 시작하기 위한 간격이며, 완전히 회복됐다고 판정하는 시간은 아니에요." },
  { id: "RP5K-400-08", count: 8, distance: 400, sets: 1, rest: 90, setRest: null,
    family: "race-pace-distance-repetitions", draftRefs: ["X-VO2-01"],
    work: "현재 5000m 기록의 평균 속도로 트랙 한 바퀴인 400m를 8번 달려요. 본운동은 총 3.2km예요. 짧은 구간을 반복하므로 800m나 1000m 반복보다 속도를 자주 다시 맞추지만, 높은 산소 이용 상태를 같은 시간 유지한다고 단정하지 않아요.",
    recovery: "반복 사이 90초 천천히 조깅해요. 구간이 짧아도 더 빠르게 달리라는 뜻은 아니며, 목표 속도는 현재 5000m 기록을 그대로 사용해요." },
  { id: "RP5K-800-SPLIT", count: 3, distance: 800, sets: 2, rest: 120, setRest: 240,
    family: "race-pace-set-repetitions", draftRefs: ["X-VO2-02", "X-VO2-05"],
    work: "800m를 3번 달린 묶음을 2세트 진행해요. 총 6회·4.8km이고, 한 세트 안에서는 5000m 기록을 기준으로 같은 목표 시간을 반복해요. 세트 사이 긴 회복이 추가되므로 한 번에 6회 이어가는 구성과 다르게 취급해요.",
    recovery: "세트 안의 반복 사이에는 120초 조깅, 첫 세트가 끝나면 240초 조깅해요. 세트 경계에서는 120초를 더하지 않고 240초로 대체해요. 긴 회복은 다음 세트의 재시작을 돕지만 같은 자극이나 완전 회복을 보장하지 않아요." },
  { id: "RP5K-1000-REST", count: 4, distance: 1000, sets: 1, rest: 180, setRest: null,
    family: "race-pace-distance-repetitions", draftRefs: ["X-VO2-03"],
    work: "현재 5000m 기록의 평균 속도로 1000m를 4번 달려요. 기존 5×1000m보다 본운동 거리를 1km 줄이고 반복 사이 회복을 늘린 대안이에요. 회복이 늘었다고 더 빠른 목표 시간을 요구하지 않아요.",
    recovery: "반복 사이 180초 천천히 조깅해요. 기존 150초보다 30초 더 주는 별도 구성이며, 연속적인 부담은 달라져요. 늘어난 회복으로도 몸 상태가 나쁘거나 통증이 있으면 훈련을 강행하지 않아요." },
]
