/**
 * "러닝 투어" — the minigame's expandable world. Fictional game content only:
 * no training, health, reward-point or location data. A city is three stages
 * (day track, sunset slow ground, night hazard run) on the same treadmill rules.
 *
 * Adding a city later = one entry in TOUR_CITIES (and art in screens/treadmill/city-art.ts).
 * Ids are stable storage keys: never rename or reuse one.
 */
import { TREADMILL_STAGES } from "./treadmill"
import type { TreadmillHazardKind, TreadmillStage, TreadmillSurface } from "./treadmill"

export type TourSeasonId = "korea" | "world"
export type TourWeather = "clear" | "rain" | "petals" | "sea" | "heat" | "snow"
export type TourLandmark = "namsan" | "hanbit" | "tower83" | "gwangan" | "tokyoTower" | "osakaCastle" | "eiffel" | "bigBen"

export type TourCity = {
  readonly id: string
  readonly season: TourSeasonId
  readonly name: string
  readonly country: string
  /** One line of flavour for the map card. */
  readonly tagline: string
  readonly landmark: TourLandmark
  /** Weather per stage (day, sunset, night). Visual only. */
  readonly weather: readonly [TourWeather, TourWeather, TourWeather]
  /** Stage names, in surface order track → mud → spikes. */
  readonly stageNames: readonly [string, string, string]
  readonly stageHints: readonly [string, string, string]
  /** 0 = easiest. Raises belt speed a little and adds hazards; see tourStages. */
  readonly level: number
}

export const TOUR_SEASONS: readonly { id: TourSeasonId; name: string; subtitle: string }[] = [
  { id: "korea", name: "시즌 1 · 코리아 투어", subtitle: "서울에서 부산까지" },
  { id: "world", name: "시즌 2 · 월드 투어", subtitle: "도쿄에서 런던까지" },
]

export const TOUR_CITIES: readonly TourCity[] = [
  { id: "seoul", season: "korea", name: "서울", country: "대한민국", tagline: "한강을 따라 남산타워까지", landmark: "namsan",
    weather: ["clear", "rain", "clear"], stageNames: ["한강 러닝트랙", "비 오는 자전거길", "남산 야간 공사길"],
    stageHints: ["기본 속도. 달리고 쉬는 박자를 익혀요", "젖은 길은 덜 나아가요. 앞쪽 공간을 벌어 두세요", "공사 못판은 한 번만 닿아도 끝"], level: 0 },
  { id: "daejeon", season: "korea", name: "대전", country: "대한민국", tagline: "엑스포 다리와 한빛탑", landmark: "hanbit",
    weather: ["clear", "clear", "clear"], stageNames: ["엑스포 다리", "과학관 잔디밭", "한빛탑 야간 광장"],
    stageHints: ["장애물이 조금 더 촘촘해요", "잔디는 미끄러워요. 미리 앞으로", "불빛 사이 못판을 조심"], level: 1 },
  { id: "daegu", season: "korea", name: "대구", country: "대한민국", tagline: "한여름 수성못과 83타워", landmark: "tower83",
    weather: ["heat", "heat", "clear"], stageNames: ["수성못 둘레길", "한여름 아스팔트", "83타워 야경길"],
    stageHints: ["더운 날, 쉬는 박자가 중요해요", "녹은 아스팔트는 끈적여요", "밤에도 못판은 그대로예요"], level: 2 },
  { id: "busan", season: "korea", name: "부산", country: "대한민국", tagline: "해운대 모래와 광안대교", landmark: "gwangan",
    weather: ["sea", "sea", "sea"], stageNames: ["광안리 해변로", "해운대 모래사장", "광안대교 불빛길"],
    stageHints: ["바닷바람과 함께 박자를 익혀요", "모래는 깊어요. 앞쪽 여유를 크게", "시즌 1 마지막 구간"], level: 3 },
  { id: "tokyo", season: "world", name: "도쿄", country: "일본", tagline: "시부야 교차로와 도쿄타워", landmark: "tokyoTower",
    weather: ["clear", "petals", "clear"], stageNames: ["시부야 교차로", "벚꽃 산책길", "도쿄타워 야경길"],
    stageHints: ["사람 많은 교차로처럼 장애물이 잦아요", "꽃잎 깔린 길은 덜 나아가요", "타워 불빛 아래 못판"], level: 4 },
  { id: "osaka", season: "world", name: "오사카", country: "일본", tagline: "도톤보리와 오사카성", landmark: "osakaCastle",
    weather: ["clear", "petals", "clear"], stageNames: ["오사카성 공원", "도톤보리 강변", "네온 골목"],
    stageHints: ["성 앞 넓은 길에서 몸 풀기", "강변 돌길은 미끄러워요", "네온 사이 못판을 조심"], level: 5 },
  { id: "paris", season: "world", name: "파리", country: "프랑스", tagline: "센강과 에펠탑", landmark: "eiffel",
    weather: ["clear", "rain", "clear"], stageNames: ["센강 둑길", "비 오는 샹젤리제", "에펠탑 야경길"],
    stageHints: ["강바람 맞으며 빠른 박자", "젖은 돌길은 덜 나아가요", "반짝이는 탑 아래 못판"], level: 6 },
  { id: "london", season: "world", name: "런던", country: "영국", tagline: "하이드파크에서 빅벤까지", landmark: "bigBen",
    weather: ["rain", "rain", "snow"], stageNames: ["하이드파크", "비 오는 템스 강변", "빅벤 겨울밤"],
    stageHints: ["비가 와도 박자는 그대로", "젖은 강변길은 끈적여요", "월드 투어 마지막 구간"], level: 7 },
]

const SURFACES: readonly TreadmillSurface[] = ["track", "mud", "spikes"]

/** Extra hazards by level, appended to the practice course and kept 1.2s+ apart. */
const EXTRA: Record<TreadmillSurface, readonly (readonly [number, number, TreadmillHazardKind])[]> = {
  // [minimum level, second, kind]
  track: [[1, 8.8, "barrier"], [4, 3.1, "barrier"], [6, 5.9, "spike"]],
  mud: [[2, 9.0, "barrier"], [5, 2.4, "barrier"]],
  spikes: [[3, 8.9, "barrier"]],
}
/** From this level the night stage's middle hurdle becomes a spike row (no room left for more hazards). */
const SPIKE_HURDLE_LEVEL = 7

/** Per-level belt speed-up, capped so every city stays clearable (see the balance guard). */
export const TOUR_BELT_STEP = 0.022

export function tourStages(city: TourCity): TreadmillStage[] {
  return SURFACES.map((surface, index) => {
    const base = TREADMILL_STAGES.find(stage => stage.surface === surface)!
    const extra = EXTRA[surface].filter(([min]) => city.level >= min).map(([, at, kind]) => ({ at, kind }))
    const course = [...base.course, ...extra].sort((a, b) => a.at - b.at)
      .map(item => surface === "spikes" && city.level >= SPIKE_HURDLE_LEVEL && item.at === 4.6 ? { ...item, kind: "spike" as const } : item)
    return {
      id: `${city.id}-${surface}`, surface, name: city.stageNames[index]!, hint: city.stageHints[index]!,
      belt: Number((base.belt * (1 + city.level * TOUR_BELT_STEP)).toFixed(4)), movement: base.movement, course,
    }
  })
}

export function tourCity(id: string): TourCity | undefined {
  return TOUR_CITIES.find(city => city.id === id)
}

export function citiesOf(season: TourSeasonId): TourCity[] {
  return TOUR_CITIES.filter(city => city.season === season)
}
