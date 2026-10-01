export const RECORD_READING_VERSION = "RECORD_READING_V1" as const

export const READING_EVENTS = [
  { id: "800", label: "800m", meters: 800, example: "2:15.5" },
  { id: "1500", label: "1500m", meters: 1500, example: "4:40" },
  { id: "3000", label: "3000m", meters: 3000, example: "10:30" },
  { id: "5000", label: "5000m", meters: 5000, example: "20:30" },
  { id: "10000", label: "10km", meters: 10000, example: "45:30" },
  { id: "half", label: "하프", meters: 21097.5, example: "1:45:30" },
  { id: "marathon", label: "마라톤", meters: 42195, example: "3:45:30" },
] as const
export type ReadingEventId = typeof READING_EVENTS[number]["id"]
export const READING_STAGES = ["own-event", "own-time", "self-result", "friend-event", "friend-time", "pair-result"] as const
export type ReadingStage = typeof READING_STAGES[number]
export function isReadingStage(value: unknown): value is ReadingStage {
  return typeof value === "string" && READING_STAGES.some(stage => stage === value)
}

export type ReadingRecord = {
  readonly eventId: ReadingEventId
  readonly seconds: number
  readonly achievedOn: string | null
}

export function parseReadingTime(text: string): number | null {
  if (!/^\d{1,3}:[0-5]\d(?:\.\d{1,2})?$/u.test(text.trim())
    && !/^\d{1,2}:[0-5]\d:[0-5]\d(?:\.\d{1,2})?$/u.test(text.trim())) return null
  const seconds = text.trim().split(":").reduce((sum, part) => sum * 60 + Number(part), 0)
  return Number.isFinite(seconds) && seconds > 0 ? seconds : null
}

export function validReadingDate(value: string, today: string): boolean {
  if (value === "") return true
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value) || value > today) return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

export function readingTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "확인 필요"
  const hundredths = Math.round(seconds * 100)
  const hours = Math.floor(hundredths / 360000)
  const minutes = Math.floor(hundredths / 6000) % 60
  const remainder = (hundredths % 6000) / 100
  const s = Number(remainder.toFixed(2)).toString()
  return [hours ? `${hours}시간` : "", hours || minutes ? `${minutes}분` : "", `${s}초`].filter(Boolean).join(" ")
}

export function readPersonalRecord(record: ReadingRecord) {
  const event = READING_EVENTS.find(item => item.id === record.eventId)
  if (!event || !Number.isFinite(record.seconds) || record.seconds <= 0) return null
  const paceSeconds = record.seconds * 1000 / event.meters
  const lapSeconds = record.seconds * 400 / event.meters
  const distanceKm = event.meters / 1000
  return {
    version: RECORD_READING_VERSION,
    event,
    recordSeconds: record.seconds,
    recordTime: readingTime(record.seconds),
    paceSeconds,
    lapSeconds,
    pace: readingTime(paceSeconds),
    lap: readingTime(lapSeconds),
    distanceKm,
    laps: event.meters / 400,
    headline: `${event.label}에 담긴 나의 리듬`,
    story: `${event.label}를 ${readingTime(record.seconds)}에 달린 기록이에요. 거리를 같은 속도로 나누면 1km마다 ${readingTime(paceSeconds)}. 이것이 이 최고기록에 담긴 평균 리듬이에요.`,
    rhythm: `400m로 나눠 보면 ${readingTime(lapSeconds)}씩이에요. ${event.label} 전체를 한 숫자로 볼 때보다, 익숙한 한 바퀴 길이로 기록의 속도를 떠올릴 수 있어요.`,
    perspective: `이 기록에는 ${distanceKm.toLocaleString("ko-KR", { maximumFractionDigits: 4 })}km를 달린 결과가 담겨 있어요. 출발부터 일정했는지, 끝에서 속도를 높였는지는 구간 기록이 더해지면 알 수 있어요.`,
    dateLabel: record.achievedOn ?? "달성일 미입력",
  }
}

export function readTogetherRecords(own: ReadingRecord, friend: ReadingRecord, comparisonConsent: boolean) {
  if (!comparisonConsent) return null
  const a = readPersonalRecord(own)
  const b = readPersonalRecord(friend)
  if (!a || !b) return null
  const sameEvent = own.eventId === friend.eventId
  const gapSeconds = sameEvent ? Math.abs(own.seconds - friend.seconds) : null
  const paceGapSeconds = sameEvent ? Math.abs(a.paceSeconds - b.paceSeconds) : null
  const equal = sameEvent && own.seconds === friend.seconds
  return {
    version: RECORD_READING_VERSION,
    own: a,
    friend: b,
    sameEvent,
    gapSeconds,
    paceGapSeconds,
    headline: equal ? "같은 기록, 함께 맞출 리듬" : sameEvent ? "같은 거리, 서로 다른 리듬" : "다른 무대, 함께 달릴 시간",
    story: equal
      ? `${a.event.label} 최고기록은 같아요. 함께 출발하는 그림을 그려볼 수 있지만, 기록을 세운 시기와 오늘의 몸 상태까지 같은 것은 아니에요.`
      : sameEvent
        ? `${a.event.label}에서 두 기록의 차이는 ${readingTime(gapSeconds!)}예요. 1km 평균으로는 ${readingTime(paceGapSeconds!)} 차이. 같은 속도로 달려도 각자 느끼는 강도는 다를 수 있어요.`
        : `나는 ${a.event.label}, 친구는 ${b.event.label} 기록이에요. 서로 다른 거리의 기록이라 누가 더 빠른지 환산하지 않았어요. 대신 함께 시작하고 다시 만나는 방식은 만들 수 있어요.`,
    ways: [
      { title: "시작과 마무리는 함께", body: "둘 다 대화가 가능한 속도로 준비·정리 운동을 함께해요. 한 사람에게만 편한 속도라면 각자 조절해요." },
      { title: "본운동은 각자의 리듬", body: "같은 장소에서 각자의 훈련 목표와 페이스를 따라요. 친구의 최고기록 속도를 그대로 내 목표로 쓰지는 않아요." },
      { title: "쉬는 구간에 다시 만나기", body: "각자 정한 운동·회복을 지키면서 쉬는 구간이나 마무리에서 다시 만나요. 같이 끝내려고 회복 시간을 줄일 필요는 없어요." },
    ],
  }
}
