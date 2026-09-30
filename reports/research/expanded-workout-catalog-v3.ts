import { canonicalJsonFingerprint } from "../../impl/src/plan-generator/candidate-identity"
import { deriveSequenceV3Totals, parsePrescriptionSequenceV3 } from "../../impl/src/prescription/sequence-v3"
import type { PrescriptionSequenceV3, SequenceNodeV3, RecoveryStepV3 } from "../../impl/src/prescription/sequence-v3"
import { sequenceNotation } from "../../app/src/domain/workout-notation"
import { TRAINING_EXPLANATION_PROFILES } from "../../app/src/domain/training-explanation-profiles"

export const EXPANDED_FAMILIES = ["BASE", "LT", "VO2", "ATP-PC", "GLY", "MIX", "REC"] as const
export type ExpandedFamily = typeof EXPANDED_FAMILIES[number]
export type Modality = "RUN" | "WALK" | "BIKE" | "ELLIPTICAL" | "DEEP_WATER_RUN" | "SWIM"
export type Terrain = "FLAT" | "UPHILL" | "ROLLING" | "INDOOR" | "POOL"
type Intent = ExpandedFamily | "TECHNIQUE" | "STEADY"
type Rest = { mode: RecoveryStepV3["mode"]; seconds: number | null; distanceM?: number; reason: string }
type Part = {
  unit: "m" | "s"; amount: number; cue: string; intent: Intent;
  modality: Modality; terrain: Terrain; role: "WORK" | "BUILDUP" | "PREPARATION";
  after: Rest[];
}
type Block = { unit: "group"; repeat: number; repeatUnit: "SET" | "REPETITION" | "SEQUENCE"; parts: DraftNode[]; rest: Rest[]; after: Rest[] }
type DraftNode = Part | Block
type SourceId = keyof typeof EXPANDED_SOURCES
type Definition = {
  id: string; family: ExpandedFamily; name: string; methodGroup: string; main: DraftNode[];
  rationale: string; tradeoff: string; sources: SourceId[];
  experience: "DEVELOPING" | "EXPERIENCED"; flags: string[];
}

// These sources support design principles, not approval of the new numerical recipes.
export const EXPANDED_SOURCES = {
  DISTANCE_REVIEW: { title: "Haugen et al., The Training Characteristics of World-Class Distance Runners (2022)",
    url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8975965/", kind: "REVIEW",
    supports: "세계 정상급 장거리 선수의 지속 달리기와 강도 배분을 다루는 종설.",
    limitation: "엘리트의 관행을 개인의 권장 주간량·장거리 상한으로 복사하지 않는다.", access: "SEARCH_EXCERPT_REVIEWED" },
  THRESHOLD: { title: "VDOT, What's Threshold Pace?",
    url: "https://support.vdoto2.com/2017/12/whats-threshold-pace/", kind: "COACHING",
    supports: "템포런과 회복을 둔 크루즈 인터벌의 구분.",
    limitation: "여기의 새 사다리·세트·거리 조합이나 RPE를 원문의 검증 수치로 보지 않는다.", access: "PRIOR_REVIEW_REFERENCE" },
  REPEATING_SETS: { title: "VDOT, Repeating Sets of Work (2022)",
    url: "https://support.vdoto2.com/2022/02/repeating-sets-of-work/", kind: "COACHING",
    supports: "길이가 다른 반복 구간을 세트로 묶는 실제 코칭 예시.",
    limitation: "VDOT R pace는 RPE 또는 ATP-PC 단독 자극과 같은 말이 아니다. 새 조합의 용량 승인이 아니다.", access: "PAGE_REVIEWED" },
  SHORT_INTERVALS: { title: "Billat et al. (2000), Intermittent runs at vVO2max",
    url: "https://pubmed.ncbi.nlm.nih.gov/10638376/", kind: "ACUTE_STUDY",
    supports: "달리기 선수 8명의 30초 운동/30초 저강도 반복과 연속 운동의 급성 산소섭취 반응 비교.",
    limitation: "연구의 vVO2max를 RPE로 대체 검증하지 않는다. 새 15초·30초 세트의 장기 효과나 청소년 용량을 입증하지 않는다.", access: "ABSTRACT_REVIEWED" },
  INTERVAL_LENGTH: { title: "Seiler and Sjursen (2004), Work duration in self-paced interval training",
    url: "https://pubmed.ncbi.nlm.nih.gov/15387806/", kind: "ACUTE_STUDY",
    supports: "구간 길이와 자기조절 속도에 따른 급성 반응 차이.",
    limitation: "시간형을 거리형으로 자동 환산하거나 짧으면 반드시 더 빠르게 달려야 한다고 정하지 않는다.", access: "PRIOR_REVIEW_REFERENCE" },
  SPEED_QUALITY: { title: "NSCA, Designing Speed Training Sessions (2019)",
    url: "https://www.nsca.com/education/articles/kinetic-select/designing-speed-training-sessions/", kind: "COACHING",
    supports: "고출력 수행의 질과 회복을 중시하는 스피드 훈련 설계.",
    limitation: "종목·연령별 개인 속도, 완전 회복 시간, 이번 구성의 고정 훈련량을 입증하지 않는다.", access: "PAGE_EXCERPT_REVIEWED" },
  SPRINT_RECOVERY: { title: "Saraslanidis et al. (2011), Sprint running with different rest intervals",
    url: "https://pubmed.ncbi.nlm.nih.gov/21777153/", kind: "TRAINING_STUDY",
    supports: "달리기의 회복 간격 차이가 수행과 대사 반응에 영향을 줄 수 있다는 근거.",
    limitation: "모든 해당계 세션에 충분한 회복을 약속하지 않는다. 새 반복·세트의 효과나 인구 범위를 그대로 승인하지 않는다.", access: "PRIOR_REVIEW_REFERENCE" },
  HILLS: { title: "World Athletics / Mara Yamauchi, Hill running training variety",
    url: "https://worldathletics.org/personal-best/performance/hill-running-training-variety-speed-sessions", kind: "COACHING",
    supports: "짧고 긴 오르막 반복, 언덕 코스·변속·지속 오르막 등 방식의 다양성.",
    limitation: "경사·노면·하산 시간과 개별 부담은 따로 확인한다. 재접속 403으로 검색 본문을 참고했고 새 수치의 승인 자료가 아니다.", access: "SEARCH_EXCERPT_REVIEWED" },
  WATER_REVIEW: { title: "Deep-water running systematic review (2022)",
    url: "https://pubmed.ncbi.nlm.nih.gov/35954790/", kind: "SYSTEMATIC_REVIEW",
    supports: "11개 시험, 287명에 대한 수중 달리기 관련 체력·기능 결과 종합.",
    limitation: "연구가 이질적이다. 통증 치료·부상 회복 완료나 육상 달리기와 동등한 부하를 뜻하지 않는다.", access: "ABSTRACT_REVIEWED" },
  CROSS_TRAINING: { title: "Effects of swim versus run training on performance in runners (1995)",
    url: "https://pubmed.ncbi.nlm.nih.gov/7649149/", kind: "TRAINING_STUDY",
    supports: "달리기 선수의 다른 운동 방식 병행과 종목 특이적 적응을 구분하는 근거.",
    limitation: "자전거·일립티컬의 정확한 시간이나 회복 효과를 검증한 자료가 아니다. 새 저강도 대안은 제품 코칭 초안이다.", access: "ABSTRACT_REVIEWED" },
} as const

const effort: Record<ExpandedFamily, string> = {
  BASE: "RPE 3-4", LT: "RPE 6-7", VO2: "RPE 7-8", "ATP-PC": "HIGH_OUTPUT_CONTROLLED",
  GLY: "RPE 8-9", MIX: "구간별 강도", REC: "RPE 1-2",
}
function part(unit: "m" | "s", amount: number, intent: Intent, extra: Partial<Part> = {}): Part {
  return { unit, amount, intent, cue: intent === "TECHNIQUE" ? "PROGRESSIVE_NOT_ALL_OUT" : intent === "STEADY" ? "RPE 5" : effort[intent],
    modality: "RUN", terrain: "FLAT", role: "WORK", after: [], ...extra }
}
const m = (n: number, f: Intent, extra: Partial<Part> = {}) => part("m", n, f, extra)
const s = (n: number, f: Intent, extra: Partial<Part> = {}) => part("s", n, f, extra)
const rest = (seconds: number, mode: "JOG" | "WALK" | "STAND" | "WALK_OR_STAND" = "JOG"): Rest => ({ mode, seconds,
  reason: mode === "JOG" ? "낮은 노력으로 움직이면서 다음 운동 구간으로 연결한다." : "출력을 낮춰 다음 반복을 준비한다. 완전 회복을 보장하지 않는다." })
const down = (): Rest => ({ mode: "WALK", seconds: null, reason: "걸어서 출발점으로 안전하게 돌아간다. 내리막을 빠르게 달리지 않는다. 지형에 따라 걸리는 시간은 미산출이다." })
const roll = (distanceM: number): Rest => ({ mode: "ACTIVE_ROLL_ON", seconds: null, distanceM, reason: "거리로 구분한 저강도 연결 구간이다. 시간이나 동등한 부하는 추정하지 않는다." })
function rep(n: number, parts: DraftNode[], recovery: Rest[] = [], repeatUnit: Block["repeatUnit"] = "REPETITION"): Block {
  return { unit: "group", repeat: n, repeatUnit, parts, rest: recovery, after: [] }
}
const sets = (n: number, parts: DraftNode[], seconds: number) => rep(n, parts, [rest(seconds, "WALK_OR_STAND")], "SET")
const after = <T extends DraftNode>(node: T, ...recovery: Rest[]): T => ({ ...node, after: recovery })
function ladder(values: number[], unit: "m" | "s", f: ExpandedFamily, recovery: number): DraftNode[] {
  return values.map((n, i) => ({ ...part(unit, n, f), after: i < values.length - 1 ? [rest(recovery)] : [] }))
}
function d(id: string, family: ExpandedFamily, name: string, methodGroup: string, main: DraftNode[],
  rationale: string, tradeoff: string, sources: SourceId[], flags: string[] = [], experience: Definition["experience"] = "EXPERIENCED"): Definition {
  return { id, family, name, methodGroup, main, rationale, tradeoff, sources, flags, experience }
}
const hill = { terrain: "UPHILL" as const }
const walk = { modality: "WALK" as const }

export function expandedDefinitions(): Definition[] {
  return [
    d("X-BASE-01", "BASE", "저강도 조깅 · Easy Run", "EASY_CONTINUOUS", [s(2700, "BASE")], "낮은 강도로 쉬지 않고 달리는 시간을 확보한다.", "45분 자체가 모든 선수의 적정량은 아니다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),
    d("X-BASE-02", "BASE", "거리형 조깅 · Easy Run", "EASY_CONTINUOUS", [m(8000, "BASE")], "익숙한 코스의 거리로 저강도 지속 달리기를 관리한다.", "거리만으로 걸리는 시간이나 부담을 정할 수 없다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),
    d("X-BASE-03", "BASE", "시간형 롱런 · Long Run", "EASY_CONTINUOUS", [s(3600, "BASE")], "최근 장거리 경험 안에서 저강도 지속 시간을 늘려 경험하는 안이다.", "기존 최장 거리·최근 주간량 없이 기본 배치하지 않는다.", ["DISTANCE_REVIEW"], ["RECENT_LONG_RUN_BASELINE"]),
    d("X-BASE-04", "BASE", "거리형 롱런 · Long Run", "EASY_CONTINUOUS", [m(12000, "BASE")], "거리 기준으로 긴 저강도 달리기를 구성한다.", "느린 선수에게 더 긴 시간이 될 수 있어 60분 안과 동등하지 않다.", ["DISTANCE_REVIEW"], ["RECENT_LONG_RUN_BASELINE"]),
    d("X-BASE-05", "BASE", "걷기를 섞는 조깅 · Run/Walk", "WALK_BREAKS", [rep(3, [s(720, "BASE")], [rest(60, "WALK")])], "짧은 걷기로 연속 달리기의 부담을 끊는다.", "걷기가 들어가도 총 36분 달리기이므로 초보 기본량으로 단정하지 않는다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),
    d("X-BASE-06", "BASE", "거리형 런워크 · Run/Walk", "WALK_BREAKS", [rep(3, [m(2000, "BASE")], [rest(60, "WALK")])], "2km마다 걷는 구간을 두어 코스 단위로 조절한다.", "구간 속도 없이 전체 소요시간은 알 수 없다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),
    d("X-BASE-07", "BASE", "점진 조깅 · Progressive Easy", "PROGRESSIVE_EASY", [s(1200, "BASE", { cue: "RPE 3" }), s(900, "BASE", { cue: "RPE 4" })], "쉬운 강도 안에서 뒤 구간의 노력을 조금 바꾼다.", "마지막을 역치나 전력 달리기로 올리는 훈련이 아니다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),
    d("X-BASE-08", "BASE", "리듬 조깅 · Easy Waves", "EASY_WAVES", [rep(3, [s(600, "BASE", { cue: "RPE 3" }), s(300, "BASE", { cue: "RPE 4" })])], "쉬운 두 수준을 번갈아 지속하며 리듬을 바꾼다.", "45분 모두 움직이므로 짧은 회복 운동으로 취급하지 않는다.", ["DISTANCE_REVIEW"]),
    d("X-BASE-09", "BASE", "중간 걷기 조깅 · Split Easy", "WALK_BREAKS", [after(s(1320, "BASE"), rest(120, "WALK")), s(1380, "BASE")], "긴 달리기의 중간에 한 번 걷는 지점을 둔다.", "3회 분할보다 연속 부담이 길다. 같은 총시간이어도 같지 않다.", ["DISTANCE_REVIEW"]),
    d("X-BASE-10", "BASE", "올렸다 내리는 조깅 · Easy Wave", "EASY_WAVES", [s(600, "BASE", { cue: "RPE 3" }), s(900, "BASE", { cue: "RPE 4" }), s(600, "BASE", { cue: "RPE 3" })], "쉬운 범위에서 중간 노력만 높이고 다시 낮춘다.", "강도 차이가 작으며 심박 Zone 2를 측정했다는 뜻은 아니다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),

    d("X-LT-01", "LT", "1km 크루즈 인터벌", "CRUISE_INTERVALS", [rep(5, [m(1000, "LT")], [rest(60)])], "1km 단위와 짧은 조깅 회복으로 역치 부근의 노력을 나눈다.", "1km를 레이스처럼 달리면 의도와 다르다.", ["THRESHOLD"]),
    d("X-LT-02", "LT", "2km 크루즈 인터벌", "CRUISE_INTERVALS", [rep(3, [m(2000, "LT")], [rest(120)])], "한 구간의 지속 시간을 길게 가져가는 거리형 안이다.", "기록에 따라 구간 시간이 크게 달라진다.", ["THRESHOLD"]),
    d("X-LT-03", "LT", "3km 크루즈 인터벌", "CRUISE_INTERVALS", [rep(2, [m(3000, "LT")], [rest(180)])], "긴 노력 두 번을 조깅으로 구분한다.", "6km 역치성 달리기는 충분한 선행 경험을 요구한다.", ["THRESHOLD"], ["RECENT_THRESHOLD_VOLUME"]),
    d("X-LT-04", "LT", "시간 피라미드 · Tempo Pyramid", "PYRAMID", ladder([360, 480, 360], "s", "LT", 60), "가운데 구간을 길게 두되 같은 강도 목표를 유지한다.", "짧아지는 마지막을 더 빠르게 달릴 이유는 없다.", ["THRESHOLD"]),
    d("X-LT-05", "LT", "늘려가는 템포 · Ascending Ladder", "ASCENDING_LADDER", ladder([240, 360, 480], "s", "LT", 60), "반복할수록 한 구간을 버티는 시간을 늘린다.", "누적 피로가 큰 뒤 구간의 품질을 관찰해야 한다.", ["THRESHOLD"]),
    d("X-LT-06", "LT", "줄여가는 템포 · Descending Ladder", "DESCENDING_LADDER", ladder([480, 360, 240], "s", "LT", 60), "긴 구간을 먼저 하고 뒤의 지속 부담을 줄인다.", "오름형과 총시간이 같아도 수행 순서와 피로 경험이 다르다.", ["THRESHOLD"]),
    d("X-LT-07", "LT", "세트형 크루즈 인터벌", "CLUSTERED_CRUISE", [sets(2, [rep(3, [s(240, "LT")], [rest(45)])], 180)], "짧은 회복 세 번 묶음 사이에 더 긴 세트 회복을 둔다.", "24분 역치성 운동이다. 세트 회복이 있다고 총량을 더하지 않는다.", ["THRESHOLD", "REPEATING_SETS"]),
    d("X-LT-08", "LT", "1km + 200m 플로트 · Cruise Float", "CRUISE_FLOAT", [rep(4, [after(m(1000, "LT"), roll(200))])], "달리기를 멈추지 않고 200m를 낮은 강도로 연결한다.", "마지막 200m도 포함한다. 빠른 플로트로 바꾸면 전체 부담이 달라진다.", ["THRESHOLD"]),
    d("X-LT-09", "LT", "6분 + 2분 플로트 · Cruise Float", "CRUISE_FLOAT", [rep(3, [after(s(360, "LT"), rest(120))])], "각 6분 뒤에 2분 쉬운 조깅을 명시적으로 둔다.", "마지막 조깅도 본 구성에 포함하며 정리운동과 이중 계산하지 않는다.", ["THRESHOLD"]),
    d("X-LT-10", "LT", "강도 교대 템포 · Tempo Alternations", "TEMPO_ALTERNATIONS", [rep(3, [s(300, "LT", { cue: "RPE 6" }), s(120, "LT", { cue: "RPE 7" })])], "멈추지 않고 역치 관련 노력 범위의 두 수준을 교대한다.", "개인의 실제 역치가 확인된 것이 아니며 높은 쪽으로 계속 밀면 안 된다.", ["THRESHOLD"]),
    d("X-LT-11", "LT", "10 + 5 + 5분 템포", "DESCENDING_LADDER", ladder([600, 300, 300], "s", "LT", 60), "긴 첫 구간 뒤에는 짧게 나누어 같은 목표 노력을 이어간다.", "20분 연속 안과 같은 효과나 부담이라고 단정하지 않는다.", ["THRESHOLD"]),
    d("X-LT-12", "LT", "1200 + 800m 세트", "CLUSTERED_CRUISE", [sets(2, ladder([1200, 800], "m", "LT", 60), 180)], "서로 다른 거리 두 개를 한 묶음으로 반복한다.", "800m는 짧아도 강도를 추가로 높이지 않는다.", ["THRESHOLD", "REPEATING_SETS"]),

    d("X-VO2-01", "VO2", "400m 인터벌", "AEROBIC_INTERVALS", [rep(8, [m(400, "VO2")], [rest(90)])], "짧은 거리 반복을 조깅 회복으로 연결한다.", "기록에 따라 400m 지속 시간이 달라져 별도 페이스 연결이 필요하다.", ["INTERVAL_LENGTH"]),
    d("X-VO2-02", "VO2", "800m 인터벌", "AEROBIC_INTERVALS", [rep(5, [m(800, "VO2")], [rest(120)])], "400m보다 긴 한 번의 노력으로 높은 산소 이용을 겨냥한다.", "모든 선수에게 같은 분량의 자극이 아니다.", ["INTERVAL_LENGTH"]),
    d("X-VO2-03", "VO2", "1km 인터벌", "AEROBIC_INTERVALS", [rep(4, [m(1000, "VO2")], [rest(150)])], "익숙한 1km 단위의 긴 반복이다.", "입문자에게 매우 긴 고강도 구간이 될 수 있다.", ["INTERVAL_LENGTH"]),
    d("X-VO2-04", "VO2", "200–800m 피라미드", "PYRAMID", ladder([200, 400, 600, 800, 600, 400, 200], "m", "VO2", 90), "구간 길이를 늘렸다 줄이며 높은 유산소 노력을 경험한다.", "동일 회복을 둔 초안으로 각 구간 속도와 회복 적합성 검토가 필요하다.", ["INTERVAL_LENGTH"]),
    d("X-VO2-05", "VO2", "400 + 600m 세트", "CLUSTERED_INTERVALS", [sets(3, ladder([400, 600], "m", "VO2", 90), 180)], "짧고 긴 구간 한 쌍을 세트 회복으로 분리한다.", "세트가 많다는 이유로 마지막에 속도를 올리지 않는다.", ["INTERVAL_LENGTH", "REPEATING_SETS"]),
    d("X-VO2-06", "VO2", "1분 반복 세트", "CLUSTERED_INTERVALS", [sets(2, [rep(4, [s(60, "VO2")], [rest(60)])], 180)], "1분 노력과 1분 조깅을 네 번 묶어 두 세트로 진행한다.", "짧은 반복을 전력질주로 바꾸면 목적이 달라진다.", ["INTERVAL_LENGTH"]),
    d("X-VO2-07", "VO2", "30/30 인터벌", "SHORT_ON_OFF", [sets(2, [rep(8, [s(30, "VO2")], [rest(30)])], 180)], "짧은 운동과 짧은 저강도 회복을 연속시켜 산소 이용 자극을 구성한다.", "연구의 vVO2max 속도를 확인한 처방이 아니며 이 세트 수는 제품 초안이다.", ["SHORT_INTERVALS"]),
    d("X-VO2-08", "VO2", "15/15 인터벌", "SHORT_ON_OFF", [sets(3, [rep(6, [s(15, "VO2")], [rest(15)])], 180)], "더 짧은 전환으로 짧은 운동·회복 리듬을 만든다.", "30초 연구를 15초 구성의 직접 검증으로 쓰지 않는다. 잦은 가감속 부담도 있다.", ["SHORT_INTERVALS"]),
    d("X-VO2-09", "VO2", "2–4분 피라미드", "PYRAMID", ladder([120, 180, 240, 180, 120], "s", "VO2", 120), "가운데 긴 반복을 중심으로 앞뒤 지속 시간을 조절한다.", "시간이 짧은 반복을 과속하면 전체 목적이 바뀐다.", ["INTERVAL_LENGTH"]),
    d("X-VO2-10", "VO2", "4–1분 사다리", "DESCENDING_LADDER", ladder([240, 180, 120, 60], "s", "VO2", 120), "긴 구간을 먼저 수행하고 뒤로 갈수록 구간 시간을 줄인다.", "마지막 1분을 전력 테스트로 사용하지 않는다.", ["INTERVAL_LENGTH"]),
    d("X-VO2-11", "VO2", "90–30초 사다리 세트", "CLUSTERED_LADDER", [sets(2, ladder([90, 60, 30], "s", "VO2", 60), 180)], "세트 안에서 세 가지 지속 시간을 경험한다.", "동일 목적이지만 일정 길이 반복과 부담이 같지는 않다.", ["INTERVAL_LENGTH", "REPEATING_SETS"]),
    d("X-VO2-12", "VO2", "분할 2분 인터벌 · Broken Intervals", "BROKEN_INTERVALS", [rep(6, [after(s(60, "VO2"), rest(30)), s(60, "VO2")], [rest(120)])], "한 번의 2분 노력을 중간 30초 조깅으로 나눈다.", "연속 2분과 다른 구조이며 내부 회복과 반복 사이 회복을 혼동하지 않는다.", ["INTERVAL_LENGTH"]),

    d("X-ATP-01", "ATP-PC", "30m 가속 · Accelerations", "STANDING_ACCELERATION", [rep(6, [m(30, "ATP-PC")], [rest(180, "WALK_OR_STAND")])], "짧은 구간의 빠른 ATP 공급이 필요한 고출력을 반복한다.", "짧은 거리도 높은 기계적 부담이 있다. 다른 대사 경로도 함께 관여한다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-ATP-02", "ATP-PC", "50m 가속 · Accelerations", "STANDING_ACCELERATION", [rep(4, [m(50, "ATP-PC")], [rest(240, "WALK_OR_STAND")])], "출발 후 가속이 이어지는 거리를 늘린 구성이다.", "30m 안의 단순 동등 대체가 아니며 장거리 기록으로 초를 환산하지 않는다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-ATP-03", "ATP-PC", "60m 가속 · Accelerations", "STANDING_ACCELERATION", [rep(4, [m(60, "ATP-PC")], [rest(300, "WALK_OR_STAND")])], "짧은 고출력 주행을 더 긴 회복으로 분리한다.", "선수별 지속 시간이 달라 ATP-PC만 쓰는 구간이라고 단정하지 않는다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-ATP-04", "ATP-PC", "플라잉 20m · Flying Sprint", "FLYING_SEGMENT", [rep(4, [m(30, "TECHNIQUE", { role: "BUILDUP" }), m(20, "ATP-PC")], [rest(300, "WALK_OR_STAND")])], "접근 가속 뒤 빠른 20m를 별도로 구분한다.", "접근 30m를 목표 고출력 20m와 합쳐 같은 구간으로 표시하지 않는다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-ATP-05", "ATP-PC", "20m 가속 세트", "CLUSTERED_ACCELERATION", [sets(3, [rep(2, [m(20, "ATP-PC")], [rest(120, "WALK_OR_STAND")])], 300)], "두 번의 짧은 가속을 더 긴 세트 회복으로 분리한다.", "품질 저하가 있으면 세트 수를 채우는 것이 우선이 아니다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-ATP-06", "ATP-PC", "5–7–5초 가속", "ACCELERATION_PYRAMID", [after(s(5, "ATP-PC"), rest(180, "WALK_OR_STAND")), after(s(7, "ATP-PC"), rest(240, "WALK_OR_STAND")), s(5, "ATP-PC")], "거리 대신 짧은 운동 시간을 달리해 고출력 구간을 구성한다.", "시간이 끝나는 지점 이후에도 안전한 감속 공간이 필요하다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-ATP-07", "ATP-PC", "가속–빠른 구간–감속", "FLYING_SEGMENT", [rep(4, [m(10, "TECHNIQUE", { role: "BUILDUP" }), m(20, "ATP-PC"), m(10, "TECHNIQUE", { role: "PREPARATION", cue: "CONTROLLED_DECELERATION" })], [rest(240, "WALK_OR_STAND")])], "가속·고출력·감속을 구조 안에서 따로 표시한다.", "표시한 감속 10m 밖의 여유 공간도 필요할 수 있다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-ATP-08", "ATP-PC", "10 + 30m 가속 세트", "CLUSTERED_ACCELERATION", [sets(3, [after(m(10, "ATP-PC"), rest(180, "WALK_OR_STAND")), m(30, "ATP-PC")], 300)], "초기 가속과 더 긴 가속을 세트 안에서 구분한다.", "두 거리의 목표 초를 하나의 장거리 페이스로 계산하지 않는다.", ["SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),

    d("X-GLY-01", "GLY", "150m 고강도 반복", "HIGH_OUTPUT_REPEATS", [rep(5, [m(150, "GLY")], [rest(180, "WALK_OR_STAND")])], "높은 에너지 요구에 해당과정이 함께 대응하는 반복을 구성한다.", "거리만으로 해당계 기여율이나 최적 속도를 정할 수 없다.", ["SPRINT_RECOVERY"]),
    d("X-GLY-02", "GLY", "300m 고강도 반복", "HIGH_OUTPUT_REPEATS", [rep(4, [m(300, "GLY")], [rest(240, "WALK_OR_STAND")])], "긴 고출력 구간과 회복을 분리한다.", "종목 기록·직전 훈련과 최근 고강도 경험을 확인해야 한다.", ["SPRINT_RECOVERY"]),
    d("X-GLY-03", "GLY", "400m 고강도 반복", "HIGH_OUTPUT_REPEATS", [rep(3, [m(400, "GLY")], [rest(300, "WALK_OR_STAND")])], "각 구간의 높은 출력 지속 요구를 길게 둔다.", "400m 선수 전용 계획을 개방하는 것이 아니다. 산화 대사도 상당히 관여할 수 있다.", ["SPRINT_RECOVERY"]),
    d("X-GLY-04", "GLY", "150 + 150m 분할 세트", "SPLIT_HIGH_OUTPUT", [sets(3, [after(m(150, "GLY"), rest(45, "WALK_OR_STAND")), m(150, "GLY")], 300)], "짧은 내부 회복으로 불완전한 회복 상태의 두 번째 구간을 만든다.", "세트 안에서 완전 회복이라고 설명하면 안 된다.", ["SPRINT_RECOVERY"]),
    d("X-GLY-05", "GLY", "200 + 100m 분할 세트", "SPLIT_HIGH_OUTPUT", [sets(2, [after(m(200, "GLY"), rest(60, "WALK_OR_STAND")), m(100, "GLY")], 360)], "긴 첫 노력과 짧은 두 번째 노력을 세트로 묶는다.", "100m를 전력 스프린트로 추가하는 허가가 아니다.", ["SPRINT_RECOVERY", "REPEATING_SETS"]),
    d("X-GLY-06", "GLY", "300–150m 사다리", "DESCENDING_LADDER", [after(m(300, "GLY"), rest(240, "WALK_OR_STAND")), after(m(200, "GLY"), rest(240, "WALK_OR_STAND")), m(150, "GLY")], "누적 피로 뒤의 운동 구간을 짧게 바꾼다.", "짧아진 거리만큼 무조건 더 빠르게 달리지 않는다.", ["SPRINT_RECOVERY"]),
    d("X-GLY-07", "GLY", "40초 고강도 반복", "HIGH_OUTPUT_REPEATS", [rep(5, [s(40, "GLY")], [rest(180, "WALK_OR_STAND")])], "측정 거리가 없는 곳에서 높은 노력의 지속 시간을 기준으로 반복한다.", "전력 테스트가 아니다. RPE가 개별 출력 검증을 대신하지 않는다.", ["SPRINT_RECOVERY"]),
    d("X-GLY-08", "GLY", "20 + 20초 분할 세트", "SPLIT_HIGH_OUTPUT", [sets(3, [after(s(20, "GLY"), rest(40, "WALK_OR_STAND")), s(20, "GLY")], 240)], "짧은 고출력 구간 사이에 짧은 회복, 세트 사이에 긴 회복을 둔다.", "총 운동시간이 짧아도 피로와 근육 부담이 작다고 볼 수 없다.", ["SPRINT_RECOVERY"]),

    d("X-MIX-01", "MIX", "1–3분 파틀렉 · Fartlek Pyramid", "FARTLEK_PYRAMID", [after(s(60, "LT"), rest(60)), after(s(120, "VO2"), rest(120)), after(s(180, "VO2"), rest(180)), after(s(120, "VO2"), rest(120)), s(60, "LT")], "지속 시간과 목표 노력을 바꾸고 길이에 맞춘 낮은 노력 구간으로 연결한다.", "모든 빠른 구간을 같은 속도로 달리는 처방이 아니다.", ["INTERVAL_LENGTH", "THRESHOLD"]),
    d("X-MIX-02", "MIX", "템포 + 인터벌 세트", "LT_VO2_COMPOUND", [sets(3, [after(s(180, "LT"), rest(60)), s(60, "VO2")], 120)], "LT 노력 뒤에 짧은 높은 유산소 노력을 연결한다.", "두 목적의 누적 부담을 따로 읽으며 단일 에너지 비율로 표시하지 않는다.", ["THRESHOLD", "INTERVAL_LENGTH"]),
    d("X-MIX-03", "MIX", "1km 템포 + 200m 반복", "LT_GLY_COMPOUND", [sets(3, [after(m(1000, "LT"), rest(60)), m(200, "GLY")], 180)], "긴 역치성 구간 뒤에 짧은 고강도 구간을 구분해 배치한다.", "고강도 구간을 덤으로 추가하지 않는다. 이것 전체가 하나의 주요 훈련이다.", ["THRESHOLD", "SPRINT_RECOVERY"]),
    d("X-MIX-04", "MIX", "800m 인터벌 + 400m 템포", "VO2_LT_COMPOUND", [rep(3, [after(m(800, "VO2"), rest(90)), m(400, "LT")], [rest(60)])], "강한 구간 뒤에 낮춘 목표 노력의 달리기를 이어간다.", "400m는 완전 휴식이 아니며 전체 품질 거리로 보존한다.", ["INTERVAL_LENGTH", "THRESHOLD"]),
    d("X-MIX-05", "MIX", "2km 스테디 + 400m 인터벌", "STEADY_VO2_COMPOUND", [sets(2, [after(m(2000, "STEADY"), rest(120)), m(400, "VO2")], 240)], "중간 노력의 지속 구간과 높은 유산소 반복을 세트로 분리한다.", "RPE 5 구간은 쉬운 BASE 처방과 구분해야 하며 중강도 구간으로 별도 설명한다.", ["DISTANCE_REVIEW", "INTERVAL_LENGTH"]),
    d("X-MIX-06", "MIX", "조깅 + 10초 고출력", "EASY_ACCELERATION", [s(1200, "BASE"), rep(6, [s(10, "ATP-PC")], [rest(90, "WALK")])], "저강도 달리기와 짧은 고출력 자극을 한 세션 안에서 별도로 구성한다.", "조깅 뒤 고출력 회복 90초가 충분한지 검토해야 한다.", ["DISTANCE_REVIEW", "SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-MIX-07", "MIX", "템포 + 점진 가속", "LT_TECHNIQUE_COMPOUND", [after(s(720, "LT"), rest(180)), rep(4, [s(20, "TECHNIQUE", { role: "BUILDUP" })], [rest(120, "WALK")], "SEQUENCE")], "템포와 전력이 아닌 점진 가속 기술 구간을 분리한다.", "피로 후 자세 품질을 확인해야 하며 기술 구간을 ATP-PC 처방으로 부풀리지 않는다.", ["THRESHOLD", "SPEED_QUALITY"], ["ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-MIX-08", "MIX", "200m 교대 · Alternating 200s", "FAST_STEADY_ALTERNATION", [rep(4, [m(200, "VO2"), m(200, "STEADY")])], "강한 200m와 중간 노력 200m를 멈추지 않고 교대한다.", "낮은 쪽도 중강도 운동이며 회복 조깅과 같지 않다.", ["INTERVAL_LENGTH"]),
    d("X-MIX-09", "MIX", "템포–인터벌–고강도 세트", "THREE_INTENT_COMPOUND", [sets(3, [after(s(240, "LT"), rest(60)), after(s(120, "VO2"), rest(120)), s(20, "GLY")], 240)], "서로 다른 지속 시간과 출력 요구를 순서대로 배치한다.", "복잡하고 피로가 겹친다. 첫 공개 우선 구성으로 삼지 않는다.", ["THRESHOLD", "INTERVAL_LENGTH", "SPRINT_RECOVERY"], ["COMPLEX_SESSION_REVIEW"]),
    d("X-MIX-10", "MIX", "1km–800m–400m 복합", "THREE_INTENT_COMPOUND", [after(m(1000, "LT"), rest(120)), after(m(800, "VO2"), rest(150)), m(400, "GLY")], "거리를 줄이면서 구간별 목적을 바꾸는 복합 안이다.", "빠른 마지막 구간의 피로를 별도로 확인하며 세 구간을 같은 RP로 처방하지 않는다.", ["THRESHOLD", "INTERVAL_LENGTH", "SPRINT_RECOVERY"], ["COMPLEX_SESSION_REVIEW"]),

    d("X-REC-01", "REC", "회복 조깅 · Recovery Jog", "RECOVERY_JOG", [s(900, "REC")], "아주 낮은 노력으로 짧게 움직이는 선택지다.", "회복 완료나 통증 없는 수행을 보장하지 않는다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),
    d("X-REC-02", "REC", "걷기 중심 런워크", "RECOVERY_RUN_WALK", [rep(8, [s(60, "REC"), s(120, "REC", walk)])], "짧은 조깅과 더 긴 걷기를 교대한다.", "24분 활동이며 8분짜리 회복이라고 표시하지 않는다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),
    d("X-REC-03", "REC", "가벼운 자전거 · Easy Bike", "RECOVERY_BIKE", [s(1200, "REC", { modality: "BIKE", terrain: "INDOOR" })], "달리기 외 방식으로 낮은 노력의 활동을 선택한다.", "달리기 거리로 환산하지 않는다. 회복 효과를 보장하지 않는다.", ["CROSS_TRAINING"], ["BIKE_AVAILABLE"], "DEVELOPING"),
    d("X-REC-04", "REC", "가벼운 일립티컬", "RECOVERY_ELLIPTICAL", [s(900, "REC", { modality: "ELLIPTICAL", terrain: "INDOOR" })], "장비에서 낮은 노력으로 움직이는 대안이다.", "수영 연구가 이 시간과 기구의 효과를 입증한 것은 아니다.", ["CROSS_TRAINING"], ["ELLIPTICAL_AVAILABLE"], "DEVELOPING"),
    d("X-REC-05", "REC", "수중 달리기 · Aqua Jog", "RECOVERY_DEEP_WATER", [s(900, "REC", { modality: "DEEP_WATER_RUN", terrain: "POOL" })], "지상 달리기와 다른 방식으로 낮은 노력을 유지한다.", "수중 적응과 안전 장비·시설 조건이 필요하다. 부상 치료 지시가 아니다.", ["WATER_REVIEW"], ["WATER_SAFETY_AND_EQUIPMENT"], "DEVELOPING"),
    d("X-REC-06", "REC", "가벼운 수영 · Easy Swim", "RECOVERY_SWIM", [s(600, "REC", { modality: "SWIM", terrain: "POOL" })], "수영에 익숙한 사람의 낮은 노력 활동 대안이다.", "수영 기술이 부족하면 낮은 노력이 아닐 수 있다.", ["CROSS_TRAINING"], ["SWIMMING_ABILITY_AND_WATER_SAFETY"], "DEVELOPING"),
    d("X-REC-07", "REC", "자전거 + 걷기", "RECOVERY_MULTIMODAL", [s(600, "REC", { modality: "BIKE", terrain: "INDOOR" }), s(600, "REC", walk)], "두 운동 방식을 짧게 나누어 낮은 노력으로 연결한다.", "두 부분 모두 보존하며 달리기 20분으로 저장하지 않는다.", ["CROSS_TRAINING"], ["BIKE_AVAILABLE"], "DEVELOPING"),
    d("X-REC-08", "REC", "걷기–조깅–걷기", "RECOVERY_RUN_WALK", [s(300, "REC", walk), s(600, "REC"), s(300, "REC", walk)], "조깅 전후에 걷기를 명시적으로 배치한다.", "걷기를 포함한 20분 구성이다. 준비·정리와 중복 합산하지 않는다.", ["DISTANCE_REVIEW"], [], "DEVELOPING"),

    d("X-HILL-01", "ATP-PC", "8초 언덕 가속 · Hill Sprint", "HILL_ACCELERATION", [rep(6, [s(8, "ATP-PC", hill)], [down()])], "짧은 오르막 고출력 구간으로 평지와 다른 저항 조건을 준다.", "경사와 접지에 따라 부담이 달라지고 하산 완료가 충분한 회복을 뜻하지 않는다.", ["HILLS", "SPEED_QUALITY"], ["HILL_SURFACE_GRADE_RETURN", "ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-HILL-02", "ATP-PC", "40m 언덕 가속", "HILL_ACCELERATION", [rep(4, [m(40, "ATP-PC", hill)], [down()])], "오르막 길이를 기준으로 짧은 가속을 반복한다.", "평지 40m 속도나 소요시간을 복사하지 않는다.", ["HILLS", "SPEED_QUALITY"], ["HILL_SURFACE_GRADE_RETURN", "ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-HILL-03", "ATP-PC", "6초 언덕 세트", "CLUSTERED_HILL_ACCELERATION", [sets(2, [after(rep(3, [s(6, "ATP-PC", hill)], [down()]), down())], 180)], "짧은 오르막 반복을 세트로 나누어 둔다.", "각 세트 마지막에도 걷기 복귀가 있고, 그 뒤 세트 사이에만 3분을 더 쉰다. 고정 3분을 전체 회복으로 표시하지 않는다.", ["HILLS", "SPEED_QUALITY"], ["HILL_SURFACE_GRADE_RETURN", "ACCELERATION_AND_DECELERATION_SPACE"]),
    d("X-HILL-04", "GLY", "30초 언덕 반복", "HILL_HIGH_OUTPUT", [rep(6, [s(30, "GLY", hill)], [down(), rest(60, "STAND")])], "오르막의 높은 에너지 요구를 일정 시간 유지하고 복귀 뒤 추가로 쉰다.", "짧은 언덕 가속과 같은 훈련이 아니다. 지형과 누적 출력 저하를 확인한다.", ["HILLS", "SPRINT_RECOVERY"], ["HILL_SURFACE_GRADE_RETURN"]),
    d("X-HILL-05", "VO2", "90초 언덕 인터벌", "HILL_AEROBIC_INTERVALS", [rep(6, [s(90, "VO2", hill)], [down()])], "오르막에서 긴 유산소 반복 노력을 구성한다.", "하산 시간이 길거나 짧아질 때 같은 자극이 유지된다고 단정하지 않는다.", ["HILLS", "INTERVAL_LENGTH"], ["HILL_SURFACE_GRADE_RETURN"]),
    d("X-HILL-06", "VO2", "3분 언덕 인터벌", "HILL_AEROBIC_INTERVALS", [rep(4, [s(180, "VO2", hill)], [down(), rest(60, "STAND")])], "긴 오르막 반복 뒤 걷기 복귀와 추가 회복을 구분한다.", "충분한 길이의 코스와 안전한 복귀 경로가 필요하다.", ["HILLS", "INTERVAL_LENGTH"], ["HILL_SURFACE_GRADE_RETURN"]),
    d("X-HILL-07", "LT", "6분 언덕 템포", "HILL_CRUISE", [rep(3, [s(360, "LT", hill)], [down()])], "역치 관련 노력을 오르막에서 길게 유지하는 안이다.", "하산 회복이 길어질 수 있어 평지 크루즈와 동등하지 않다.", ["HILLS", "THRESHOLD"], ["HILL_SURFACE_GRADE_RETURN"]),
    d("X-HILL-08", "LT", "10분 지속 언덕 템포", "HILL_CONTINUOUS", [after(s(600, "LT", hill), down())], "연속 오르막 노력과 종료 후 복귀를 구분한다.", "복귀 시간이 미정이라 전체 시간을 10분으로 제시하지 않는다.", ["HILLS", "THRESHOLD"], ["HILL_SURFACE_GRADE_RETURN"]),
    d("X-HILL-09", "BASE", "완만한 언덕 조깅 · Rolling Easy", "ROLLING_EASY", [s(1800, "BASE", { terrain: "ROLLING" })], "오르내리는 코스에서도 낮은 노력을 유지한다.", "오르막에서 평지 페이스를 강제하거나 내리막을 질주하지 않는다.", ["HILLS", "DISTANCE_REVIEW"], ["HILL_SURFACE_GRADE_RETURN"], "DEVELOPING"),
    d("X-HILL-10", "BASE", "오르막 걷기 반복", "UPHILL_WALK", [rep(4, [s(300, "BASE", { ...hill, ...walk, cue: "RPE 3" })], [down()])], "달리기 대신 낮은 노력의 오르막 걷기로 지속 활동을 만든다.", "경사가 높으면 같은 속도에서도 강도가 높아진다. 회복일과 자동 동치가 아니다.", ["HILLS"], ["HILL_SURFACE_GRADE_RETURN"], "DEVELOPING"),
    d("X-HILL-11", "MIX", "언덕 + 평지 변속", "HILL_FLAT_COMPOUND", [rep(6, [s(30, "GLY", hill), s(30, "STEADY")], [down()])], "언덕 뒤 연결된 평지 구간에서 낮춘 목표 노력으로 이어간다.", "이어지는 평지 구간이 실제 있는 코스여야 한다. 평지는 휴식이 아니다.", ["HILLS", "SPRINT_RECOVERY"], ["HILL_SURFACE_GRADE_RETURN", "CONNECTED_HILL_FLAT_ROUTE"]),
    d("X-HILL-12", "MIX", "언덕 인터벌 + 평지 템포", "HILL_FLAT_COMPOUND", [sets(2, [after(s(60, "VO2", hill), down()), s(120, "LT")], 180)], "오르막 자극 뒤 복귀하여 평지 역치성 노력을 별도로 수행한다.", "하산 시간이 변하면 연결 자극도 달라지므로 고정 회복 세션처럼 취급하지 않는다.", ["HILLS", "INTERVAL_LENGTH", "THRESHOLD"], ["HILL_SURFACE_GRADE_RETURN"]),
  ]
}

const profileKeys = { BASE: "BASE_INTENT", LT: "LT_INTENT", VO2: "VO2_INTENT", "ATP-PC": "ATP_PC_INTENT", GLY: "GLY_INTENT", MIX: "MIXED_INTENT", REC: "RECOVERY_INTENT" } as const
type SegmentContext = { segmentId: string; intent: Intent; modality: Modality; terrain: Terrain }
type RecoveryContext = { ownerId: string; position: "BETWEEN" | "AFTER"; step: number; reason: string }
export function compileExpandedDefinition(def: Definition) {
  const segments: SegmentContext[] = [], recoveries: RecoveryContext[] = []
  function compileRests(items: Rest[], ownerId: string, position: RecoveryContext["position"]): RecoveryStepV3[] {
    return items.map((r, step) => {
      recoveries.push({ ownerId, position, step, reason: r.reason })
      return r.mode === "ACTIVE_ROLL_ON" ? { mode: r.mode, seconds: null, distanceM: r.distanceM! } : { mode: r.mode, seconds: r.seconds } as RecoveryStepV3
    })
  }
  function compile(node: DraftNode, id: string): SequenceNodeV3 {
    const base = { id, label: null, repeatCount: node.unit === "group" ? node.repeat : 1,
      recoveryBetweenRepeats: compileRests(node.unit === "group" ? node.rest : [], id, "BETWEEN"),
      recoveryAfter: compileRests(node.after, id, "AFTER") }
    if (node.unit === "group") return { ...base, kind: "group", repeatUnit: node.repeatUnit, children: node.parts.map((p, i) => compile(p, `${id}-${i + 1}`)) }
    segments.push({ segmentId: id, intent: node.intent, modality: node.modality, terrain: node.terrain })
    return { ...base, kind: "segment", role: node.role,
      work: node.unit === "m" ? { kind: "distance", distanceM: node.amount, durationSeconds: null } : { kind: "duration", durationSeconds: node.amount, distanceM: null },
      target: { kind: "EFFORT_GUIDANCE", cue: node.cue } }
  }
  const raw: PrescriptionSequenceV3 = { kind: "PRESCRIPTION_SEQUENCE", version: 3, id: def.id, label: null, warmup: [],
    main: def.main.map((p, i) => compile(p, `${def.id}-${i + 1}`)), cooldown: [] }
  const parsed = parsePrescriptionSequenceV3(raw)
  if (parsed.kind !== "parsed") throw Error(`INVALID_EXPANDED_SEQUENCE: ${def.id}`)
  const profile = TRAINING_EXPLANATION_PROFILES[profileKeys[def.family]]
  const content = {
    id: def.id, version: "1.0.0", name: def.name, family: def.family, methodGroup: def.methodGroup,
    status: "DRAFT_CATALOG_NOT_RUNTIME" as const, executionAuthority: "NONE" as const, runtimeReady: false as const,
    sequenceScope: "MAIN_ONLY_REQUIRES_SUPPORT" as const, wholeSessionComplete: false as const,
    sequence: parsed.sequence, segmentContexts: segments, recoveryContexts: recoveries,
    notation: sequenceNotation(parsed.sequence), totals: deriveSequenceV3Totals(parsed.sequence).main,
    proposedScope: { eventDistancesM: [800, 1500, 3000, 5000, 10000, 21097, 42195],
      experience: def.experience === "DEVELOPING" ? ["DEVELOPING", "EXPERIENCED"] : ["EXPERIENCED"],
      population: ["YOUTH", "ADULT"], actor: ["SELF", "COACH"], applicabilityProven: false },
    explanation: { profileRef: { id: profile.id, version: profile.version }, purpose: profile.purpose, energySupply: profile.energyContext,
      configurationReason: def.rationale, tradeoff: def.tradeoff, expectations: profile.expectedAdaptation,
      limitations: profile.limitations, observation: profile.observationGuide,
      cycleRole: "앞뒤 주요 훈련·같은 날 다른 세션·주기 목적을 확인한 뒤 배치한다. 아직 특정 날짜와 연결하지 않았다.",
      personalEvidence: [] as never[], sourceIds: def.sources, evidenceNature: "PRODUCT_COACHING_DRAFT_NOT_PUBLISHED_DOSE" as const },
    requiredReview: ["EXACT_DOSE_AND_POPULATION", "OWNER_FINAL_ADOPTION", "WARMUP_COOLDOWN_BINDING", "CURRENT_SAFETY_AND_AUTHORITY",
      "FRAME_AND_NEIGHBOUR_SESSIONS", "PERSONAL_PACE_OR_EFFORT_BINDING", ...def.flags],
    automaticProgressionAllowed: false as const, pairedAlternativeId: null,
  }
  return { ...content, fingerprint: canonicalJsonFingerprint("trainoracle.expanded-catalog.v1", content) }
}
export type ExpandedWorkoutCard = ReturnType<typeof compileExpandedDefinition>

export function validateExpandedWorkoutCard(card: ExpandedWorkoutCard): string[] {
  const errors: string[] = []
  const { fingerprint, ...content } = card
  if (fingerprint !== canonicalJsonFingerprint("trainoracle.expanded-catalog.v1", content)) errors.push("CONTENT_CHANGED")
  if (card.status !== "DRAFT_CATALOG_NOT_RUNTIME" || card.executionAuthority !== "NONE" || card.runtimeReady !== false
    || card.wholeSessionComplete !== false || card.automaticProgressionAllowed !== false || card.pairedAlternativeId !== null) errors.push("AUTHORITY_CHANGED")
  const parsed = parsePrescriptionSequenceV3(card.sequence)
  if (parsed.kind !== "parsed") return [...errors, "INVALID_SEQUENCE"]
  if (JSON.stringify(card.totals) !== JSON.stringify(deriveSequenceV3Totals(parsed.sequence).main)) errors.push("STALE_TOTALS")
  if (card.notation !== sequenceNotation(parsed.sequence)) errors.push("STALE_NOTATION")
  const ids: string[] = [], expectedRecoveryKeys: string[] = []
  const inspect = (nodes: readonly SequenceNodeV3[]) => nodes.forEach(node => {
    if (node.kind === "segment") ids.push(node.id)
    else inspect(node.children)
    node.recoveryBetweenRepeats.forEach((_, i) => expectedRecoveryKeys.push(`${node.id}:BETWEEN:${i}`))
    node.recoveryAfter.forEach((_, i) => expectedRecoveryKeys.push(`${node.id}:AFTER:${i}`))
  })
  inspect(parsed.sequence.main)
  if (JSON.stringify([...ids].sort()) !== JSON.stringify(card.segmentContexts.map(c => c.segmentId).sort())) errors.push("SEGMENT_CONTEXT_MISMATCH")
  const profileKey = profileKeys[card.family]
  const expectedProfile = profileKey && TRAINING_EXPLANATION_PROFILES[profileKey]
  if (!expectedProfile || card.explanation.profileRef.id !== expectedProfile.id
    || card.explanation.profileRef.version !== expectedProfile.version) errors.push("FAMILY_PROFILE_MISMATCH")
  const intents = card.segmentContexts.map(c => c.intent)
  if (intents.some(i => ![...EXPANDED_FAMILIES, "TECHNIQUE", "STEADY"].includes(i))
    || (card.family === "MIX" ? new Set(intents).size < 2
      : intents.some(i => i !== card.family && !(card.family === "ATP-PC" && i === "TECHNIQUE")))) errors.push("FAMILY_SEGMENT_MISMATCH")
  if (JSON.stringify(expectedRecoveryKeys.sort()) !== JSON.stringify(card.recoveryContexts.map(c => `${c.ownerId}:${c.position}:${c.step}`).sort())
    || card.recoveryContexts.some(c => !c.reason.trim())) errors.push("RECOVERY_CONTEXT_MISMATCH")
  if (card.explanation.personalEvidence.length || card.explanation.evidenceNature !== "PRODUCT_COACHING_DRAFT_NOT_PUBLISHED_DOSE"
    || !card.explanation.sourceIds.length || card.explanation.sourceIds.some(id => !EXPANDED_SOURCES[id])) errors.push("UNSUPPORTED_EVIDENCE")
  if (card.sequenceScope !== "MAIN_ONLY_REQUIRES_SUPPORT" || card.sequence.warmup.length || card.sequence.cooldown.length
    || !["OWNER_FINAL_ADOPTION", "WARMUP_COOLDOWN_BINDING", "CURRENT_SAFETY_AND_AUTHORITY", "FRAME_AND_NEIGHBOUR_SESSIONS"].every(r => card.requiredReview.includes(r))) errors.push("REVIEW_BOUNDARY_MISSING")
  return errors
}

export function expandedStructureKey(card: ExpandedWorkoutCard): string {
  const clean = (nodes: readonly SequenceNodeV3[]): unknown[] => nodes.map(node => {
    const { id: _id, label: _label, ...restNode } = node
    return node.kind === "group" ? { ...restNode, children: clean(node.children) }
      : { ...restNode, context: card.segmentContexts.find(c => c.segmentId === node.id) &&
        (({ segmentId: _segmentId, ...context }) => context)(card.segmentContexts.find(c => c.segmentId === node.id)!) }
  })
  return canonicalJsonFingerprint("trainoracle.expanded-structure.v1", { family: card.family, main: clean(card.sequence.main) })
}
export function buildExpandedWorkoutCatalog(): ExpandedWorkoutCard[] {
  const cards = expandedDefinitions().map(compileExpandedDefinition)
  if (new Set(cards.map(c => c.id)).size !== cards.length) throw Error("DUPLICATE_EXPANDED_ID")
  if (new Set(cards.map(expandedStructureKey)).size !== cards.length) throw Error("DUPLICATE_EXPANDED_STRUCTURE")
  for (const card of cards) {
    if (!card.explanation.configurationReason || !card.explanation.tradeoff || !card.explanation.sourceIds.length
      || card.explanation.sourceIds.some(id => !EXPANDED_SOURCES[id])) throw Error("INCOMPLETE_EXPANDED_EVIDENCE")
    if (validateExpandedWorkoutCard(card).length) throw Error(`INVALID_EXPANDED_CARD: ${card.id}`)
  }
  return cards
}

export type ExpandedReviewContext = {
  family: ExpandedFamily; eventDistanceM: number; experience: "NEW_TO_RUNNING" | "DEVELOPING" | "EXPERIENCED";
  terrain: Terrain | "UNKNOWN"; availableModalities: readonly Modality[];
  connectedTerrains?: readonly Terrain[];
  safety: "NO_KNOWN_RISK" | "UNKNOWN" | "REVIEW_REQUIRED";
  hasAccelerationSpace: boolean | null; hardTimeLimitSeconds: number | null;
}
/** Review inventory only; no draw, schedule placement, pace binding or execution authority. */
export function reviewExpandedPool(context: ExpandedReviewContext) {
  const terrains = ["FLAT", "UPHILL", "ROLLING", "INDOOR", "POOL", "UNKNOWN"]
  const modalities = ["RUN", "WALK", "BIKE", "ELLIPTICAL", "DEEP_WATER_RUN", "SWIM"]
  if (!context || !EXPANDED_FAMILIES.includes(context.family) || ![800, 1500, 3000, 5000, 10000, 21097, 42195].includes(context.eventDistanceM)
    || !["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"].includes(context.experience) || !terrains.includes(context.terrain)
    || !Array.isArray(context.availableModalities) || !context.availableModalities.every(m => modalities.includes(m))
    || (context.connectedTerrains !== undefined && (!Array.isArray(context.connectedTerrains)
      || context.connectedTerrains.some(t => !["FLAT", "UPHILL", "ROLLING", "INDOOR", "POOL"].includes(t))))
    || !["NO_KNOWN_RISK", "UNKNOWN", "REVIEW_REQUIRED"].includes(context.safety)
    || ![true, false, null].includes(context.hasAccelerationSpace)
    || !(context.hardTimeLimitSeconds === null || Number.isSafeInteger(context.hardTimeLimitSeconds) && context.hardTimeLimitSeconds > 0)) {
    return { kind: "invalid_context" as const, executionAuthority: "NONE" as const, rows: [] }
  }
  const rows = buildExpandedWorkoutCatalog().filter(c => c.family === context.family).map(card => {
    const excluded: string[] = [], checks = [...card.requiredReview]
    if (!card.proposedScope.experience.includes(context.experience)) excluded.push("EXPERIENCE_OUTSIDE_DRAFT")
    if (context.safety === "REVIEW_REQUIRED") excluded.push("SAFETY_REVIEW_REQUIRED")
    if (context.safety === "UNKNOWN") checks.push("SAFETY_UNKNOWN")
    if (context.terrain === "UNKNOWN") checks.push("TERRAIN_UNKNOWN")
    else if (card.segmentContexts.some(c => ![context.terrain, ...(context.connectedTerrains ?? [])].includes(c.terrain))) excluded.push("TERRAIN_OR_CONNECTED_ROUTE_REQUIRED")
    if (card.segmentContexts.some(c => !context.availableModalities.includes(c.modality))) excluded.push("MODALITY_UNAVAILABLE")
    if (card.requiredReview.includes("ACCELERATION_AND_DECELERATION_SPACE")) {
      if (context.hasAccelerationSpace === false) excluded.push("ACCELERATION_SPACE_UNAVAILABLE")
      if (context.hasAccelerationSpace === null) checks.push("ACCELERATION_SPACE_UNKNOWN")
    }
    if (context.hardTimeLimitSeconds !== null) {
      if (card.totals.totalSeconds !== null && card.totals.totalSeconds > context.hardTimeLimitSeconds) excluded.push("MAIN_ALREADY_EXCEEDS_LIMIT")
      else if (card.totals.knownRecoverySeconds + (card.totals.workSeconds ?? 0) > context.hardTimeLimitSeconds) excluded.push("KNOWN_PART_ALREADY_EXCEEDS_LIMIT")
      checks.push("WHOLE_SESSION_TIME_NOT_BOUND")
    }
    return { id: card.id, methodGroup: card.methodGroup, excluded, checks, runtimeReady: false as const, executionAuthority: "NONE" as const }
  })
  return { kind: "review" as const, executionAuthority: "NONE" as const, rows }
}
