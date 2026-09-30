import { createServer } from "vite"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"

const root = fileURLToPath(new URL("../../", import.meta.url))
const check = process.argv.includes("--check")
const server = await createServer({ configFile: false, root,
  cacheDir: resolve(root, "app/node_modules/.vite-purpose-supply-review"),
  optimizeDeps: { noDiscovery: true, include: [] },
  server: { middlewareMode: true }, appType: "custom" })
const text = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ")
const duration = value => value === null ? "미산출" : `${Math.floor(value / 60)}분${value % 60 ? ` ${value % 60}초` : ""}`
const experienceNames = { NEW_TO_RUNNING: "입문", DEVELOPING: "훈련 경험 있음", EXPERIENCED: "훈련 경험 많음" }
const qualificationNames = { CONTENT_REVIEW_CANDIDATE: "내용 채택 검토", MODIFY_BEFORE_ADOPTION: "적용 설명 수정·검토", HOLD_FIRST_RELEASE: "첫 공개 보류" }
const reasonNames = {
  EVENT_OUTSIDE_PROPOSAL: "해당 종목의 제안 아님", EXPERIENCE_OUTSIDE_PROPOSAL: "다른 경험 수준용 구성",
  POPULATION_OUTSIDE_PROPOSAL: "대상 범위 밖", ACTOR_OUTSIDE_PROPOSAL: "선택 권한 범위 밖", ROLE_MISMATCH: "해당 날짜의 훈련 역할과 다름",
  SAFETY_REVIEW_REQUIRED: "몸 상태 확인 우선", SAFETY_UNKNOWN: "몸 상태 미확인", HILL_SPECIFIC_PROTOCOL_REQUIRED: "언덕용 별도 구성 필요",
  TERRAIN_UNCONFIRMED: "지형 미확인", MEASURED_DISTANCE_UNAVAILABLE: "거리 측정 불가", MEASURED_DISTANCE_UNCONFIRMED: "거리 측정 여부 미확인",
  TIMER_UNAVAILABLE: "타이머 없음", TIMER_UNCONFIRMED: "타이머 미확인", ACCELERATION_SPACE_UNAVAILABLE: "가속 공간 없음",
  ACCELERATION_SPACE_UNCONFIRMED: "가속 공간 미확인", SUPPORT_SCOPE_MISMATCH: "지원 대안의 대상 범위와 다름",
  SUPPORT_UNSELECTED: "준비·정리 미정", WHOLE_SESSION_EXCEEDS_HARD_LIMIT: "준비·회복 포함 시간이 상한 초과",
  WHOLE_SESSION_DURATION_UNKNOWN: "전체 소요시간 미산출", HELD_FROM_FIRST_RELEASE: "기존 첫 공개 보류",
  CONTENT_MODIFICATION_REVIEW: "적용 설명 수정·검토 필요", TAPER_PLACEMENT_REVIEW: "테이퍼 배치 검토 필요",
  RETURN_PLACEMENT_REVIEW: "복귀기 배치 검토 필요", UNKNOWN_PLACEMENT_REVIEW: "주기 단계 미확인",
  SAME_DAY_QUALITY_CONTEXT_REVIEW: "같은 날 주요 훈련 간 관계 검토", PERSONAL_PACE_MODEL_NOT_ADOPTED: "이 제안 범위의 개인 페이스 연결 미완",
  ASSIGNED_COACH_SELECTION_REQUIRED: "지정된 코치의 선택 필요", EXACT_OWNER_CONTENT_ADOPTION: "정확한 내용의 오너 채택",
  EXACT_FRAME_PLACEMENT: "실제 주기 배치", SUPPORT_BINDING: "준비·정리 연결", CURRENT_SAFETY_AND_AUTHORITY: "현재 안전·권한 확인",
  INDIVIDUAL_OUTPUT_AND_RECOVERY_REVIEW: "개별 출력·회복 검토", INTRO_WORK_AND_SUPPORT_APPLICABILITY: "입문 본운동·준비·정리 적용 검토",
}
const reasonText = code => {
  if (!reasonNames[code]) throw Error(`MISSING_REVIEW_REASON_LABEL: ${code}`)
  return reasonNames[code]
}
const base = {
  family: "LT", eventDistanceM: 5000, experience: "EXPERIENCED", population: "ADULT", actor: "SELF", role: "MAIN",
  safety: "NO_KNOWN_RISK", phase: "BUILD", terrain: "FLAT", measuredDistance: true, repetitionTimer: true,
  accelerationSpace: true, hardTimeLimitSeconds: 3600, support: "EXISTING", otherQualitySameDay: false, wantsPersonalPace: false,
}

try {
  const { buildPurposeSupplyCatalog, reviewPurposeSupply, comparePurposeCards } = await server.ssrLoadModule("/reports/research/method-purpose-supply-v3.ts")
  const { METHOD_SOURCE_ASSESSMENTS } = await server.ssrLoadModule("/reports/research/method-source-assessments-v3.ts")
  const { assembleProposalSession } = await server.ssrLoadModule("/reports/research/method-adoption-protocols.mjs")
  const catalog = buildPurposeSupplyCatalog()
  const families = ["BASE", "LT", "VO2", "ATP-PC", "GLY", "MIX", "REC", "OFF"]
  const cases = [
    ["5km 경험자 · LT · 60분", {}],
    ["5km 경험자 · LT · 50분", { hardTimeLimitSeconds: 3000 }],
    ["5km 경험자 · LT · 40분", { hardTimeLimitSeconds: 2400 }],
    ["마라톤 · VO2 · 트랙 없음", { family: "VO2", eventDistanceM: 42195, measuredDistance: false }],
    ["중학생 가정 · VO2 입문 · 기존 지원", { family: "VO2", experience: "NEW_TO_RUNNING", population: "YOUTH", hardTimeLimitSeconds: 1500 }],
    ["중학생 가정 · VO2 입문 · 지원 대안 명시", { family: "VO2", experience: "NEW_TO_RUNNING", population: "YOUTH", hardTimeLimitSeconds: 1500, support: "INTRO_COMPARISON" }],
    ["고등학생 가정 · 800m · 가속", { family: "ATP-PC", eventDistanceM: 800, population: "YOUTH" }],
    ["성인 · 가속할 공간 없음", { family: "ATP-PC", accelerationSpace: false }],
    ["거리 표시 없음 · ATP-PC", { family: "ATP-PC", measuredDistance: false }],
    ["타이머 없음 · VO2", { family: "VO2", repetitionTimer: false }],
    ["언덕에서 하고 싶음 · VO2", { family: "VO2", terrain: "HILL" }],
    ["경기 전 테이퍼 · LT", { phase: "TAPER" }],
    ["복귀기 · LT", { phase: "RETURN" }],
    ["같은 날 주요 훈련이 있음 · LT", { otherQualitySameDay: true }],
    ["통증 등 안전 확인 필요", { safety: "REVIEW_REQUIRED" }],
    ["몸 상태 확인 안 됨", { safety: "UNKNOWN" }],
    ["코치 선택이 지정된 선수", { actor: "COACH_REQUIRED" }],
    ["개인 페이스까지 요청 · LT", { wantsPersonalPace: true }],
    ["입문 해당계 구성", { family: "GLY", experience: "NEW_TO_RUNNING" }],
    ["기초 달리기 · 25분", { family: "BASE", role: "BASE", hardTimeLimitSeconds: 1500 }],
    ["회복 걷기", { family: "REC", role: "REC" }],
    ["휴식 · 시간/장소 해당 없음", { family: "OFF", role: "OFF", hardTimeLimitSeconds: null, terrain: "UNKNOWN", repetitionTimer: null, measuredDistance: null, accelerationSpace: null }],
    ["하프마라톤 경험자 · MIX", { family: "MIX", eventDistanceM: 21097 }],
    ["마라톤 · 해당계 · 38분", { family: "GLY", eventDistanceM: 42195, hardTimeLimitSeconds: 2280 }],
  ]
  const scenarios = cases.map(([name, patch]) => {
    const context = { ...base, ...patch }
    const result = reviewPurposeSupply(context)
    if (result.kind !== "review") throw Error("INVALID_SYNTHETIC_CASE")
    return { name, synthetic: true, context, rows: result.rows.map(r => ({ id: r.card.id, contextFit: r.contextFit,
      excluded: r.excluded, checks: r.checks, time: r.time, runtimeReady: r.runtimeReady,
      executionAuthority: r.executionAuthority, supportRef: r.wholeSession?.supportRef ?? null })) }
  })
  const pairs = catalog.flatMap((left, i) => catalog.slice(i + 1).filter(right => right.family === left.family)
    .map(right => ({ left: left.id, right: right.id, ...comparePurposeCards(left, right) })))
  const sourcePaths = [
    "reports/research/method-purpose-supply-v3.ts", "reports/research/method-source-assessments-v3.ts",
    "reports/research/method-adoption-protocols.mjs", "reports/research/method-adoption-applicability.mjs",
    "reports/research/method-explanation-preview-v3.ts", "reports/research/method-design-rationales-v3.ts",
    "reports/research/method-proposal-sequence-v3.ts", "reports/research/method-execution-guidance-proposal.mjs",
    "app/src/domain/training-explanation-profiles.ts", "app/src/domain/workout-notation.ts",
    "impl/src/prescription/sequence-v3.ts", "impl/src/prescription/sequence-v3-comparison.ts",
    "impl/src/plan-generator/session-builder.ts", "impl/src/plan-generator/candidate-identity.ts",
    "app/scripts/build-purpose-supply-review.mjs",
  ]
  const sourceHashes = {}
  for (const path of sourcePaths) sourceHashes[path] = createHash("sha256").update(await readFile(resolve(root, path))).digest("hex")
  const counts = Object.fromEntries(families.map(f => [f, catalog.filter(c => c.family === f).length]))
  const bundle = { version: "1.0.0", status: "CONTEXTUAL_SUPPLY_REVIEW_NOT_RUNTIME", reviewedOn: "2026-09-30",
    executionAuthority: "NONE", runtimeActivation: false, configurationCount: catalog.length,
    counts, sourceHashes, catalog, scenarios, comparisons: pairs }
  const json = JSON.stringify(bundle, null, 2) + "\n"
  const digest = createHash("sha256").update(json).digest("hex")
  const lines = ["# 목적에 맞는 상세 훈련 공급 검토", "", "```yaml", "status: CONTEXTUAL_SUPPLY_REVIEW_NOT_RUNTIME",
    "reviewed_on: 2026-09-30", "execution_authority: NONE", "new_runtime_activation: false",
    `configuration_count: ${catalog.length}`, `synthetic_context_count: ${scenarios.length}`, "```", "",
    "## 먼저 알아둘 점", "",
    "현재 제안 원본을 다시 읽어 만든 검토 자료다. 새 훈련 37종을 공개했다는 보고가 아니다.",
    "시간·반복 수 변형이 포함되므로 구성 수와 서로 다른 방법 수를 구분한다. 특정 A/B 짝을 만들지 않는다.",
    "같은 목적 안에서 조건에 맞는 구성 풀을 검토한다. 조건 일치도 개인에게 적합하다는 최종 판정은 아니다.",
    "기존 LT 파일럿의 별도 승인은 유지한다. 여기의 과거 제안 상태로 파일럿을 취소하거나 새 범위를 승인하지 않는다.",
    "[기존 LT 파일럿 범위](LT_PILOT_OWNER_ADOPTION_DECISION_2026-09-28.md)와 [기존 전체 검토 원본](METHOD_CONFIGURATION_REVIEW_CARDS_V3.md)을 함께 읽는다.", "",
    "재생성: `cd app` 후 `node scripts/build-purpose-supply-review.mjs`; 동일성 검사: 끝에 `--check`.",
    `동반 JSON: [METHOD_PURPOSE_SUPPLY_REVIEW_V3.json](METHOD_PURPOSE_SUPPLY_REVIEW_V3.json), SHA-256 \`${digest}\`.`,
    "JSON은 공개 구성과 합성 조건만 포함한다. 개인 일지·메모·실제 선수 입력을 포함하지 않는다.", "",
    "## 전체 구성", "", "| 목적 | 검토 구성 수 |", "|---|---:|",
    ...families.map(f => `| ${f} | ${counts[f]} |`), "",
    "| ID | 훈련 | 실제 본운동 표기 | 기존 지원 포함 시간 | 상태 |", "|---|---|---|---|---|",
    ...catalog.map(c => `| ${c.id} | ${text(c.name)} | ${text(c.notation)} | ${c.family === "OFF" ? "해당 없음" : duration(assembleProposalSession(c.exactStructure).totalSeconds)} | ${qualificationNames[c.qualification]} |`), "",
    "전체 시간에는 본운동 사이 회복과 준비·정리가 포함된다. 거리형은 개인 속도 없이는 전체 시간을 확정하지 않는다.",
    "입문 지원 대안은 아래 조건 표에서 별도로 비교한다. 위 표의 기존 지원을 몰래 교체하지 않는다.", "",
    "## 실제로 어떤 차이인가", "",
    "- LT 20min과 2×10min/r60s는 중간 회복 유무가 다르다. 2×8min은 2×10min의 시간 조정안이지 별도 훈련법이 아니다.",
    "- VO2 6×2min/r60s와 5×3min/r2min, 4×4min/r3min은 한 번의 노력과 회복 길이가 다르다. 짧은 구간을 더 빠르게 달리라는 뜻이 아니다.",
    "- GLY 6×200m/r2min과 2sets×(3×200m/r2min)/R5min은 반복 회복 횟수와 세트 회복이 다르다. 총거리만 같다고 부담이 같지는 않다.",
    "- MIX의 매회 roll-on은 마지막 반복에도 남는다. 세트형은 마지막 roll-on 뒤에 추가 세트 회복이 생긴다.",
    "- ATP-PC는 시간형, 정지 출발 가속, 접근 가속 후 빠른 구간을 구분한다. 총거리가 짧다는 이유로 가벼운 운동이라고 설명하지 않는다.", "",
    "## 24가지 합성 상황", "",
    "실사용자 관찰이나 독립 모델 리뷰가 아니라 같은 검사기를 실행한 재현 가능한 가상 조건이다.",
    "조건 일치 = 선언된 조건에 충돌 없음. 검토 필요 = 빠진 정보/배치/내용 검토가 남음. 제외 = 해당 제안을 이 조건에 넣지 않음.",
    "세 열 모두 새 실행 승인은 0건이다. 초보자·청소년·혼자 훈련을 일괄 금지하지 않는다.", "",
    "| 상황 | 조건 일치 | 검토 필요 | 제외 | 주요 이유 |", "|---|---:|---:|---:|---|",
    ...scenarios.map(s => {
      const count = fit => s.rows.filter(r => r.contextFit === fit).length
      const reasons = [...new Set(s.rows.flatMap(r => [...r.excluded, ...r.checks]))]
      return `| ${s.name} | ${count("DECLARED_CONSTRAINTS_MATCH")} | ${count("REQUIRES_CONTEXT_REVIEW")} | ${count("EXCLUDED")} | ${reasons.map(reasonText).join(", ") || "공통 채택·배치 검토는 별도"} |`
    }), "",
    "## 훈련별 이유와 근거", "",
  ]
  for (const c of catalog) {
    const e = c.explanation
    lines.push(`### ${c.id} · ${c.name}`, "", `**${c.notation}**`, "",
      `- 제안 대상: ${c.scope.eventDistances.join(" / ")}m; ${c.scope.experience.map(x => experienceNames[x]).join(" / ")}; 청소년·성인. 효과 입증 범위와는 다르다.`,
      `- 목적: ${e.purpose}`, `- 에너지 공급: ${e.energySupply}`, `- 구성 이유: ${e.work}`, `- 회복 이유: ${e.recovery}`,
      `- 장점·부담: ${e.tradeoff}`, `- 기대하는 변화: ${e.expected}`, `- 확인 방법: ${e.observation}`,
      `- 한계: ${e.limitations.join(" ")}`, `- 주기: ${e.cycleRole}`, `- 출처 범위: ${e.sources.note}`,
      `- 근거 참조: ${e.sources.links.map(s => `[${s.id}](${s.url.startsWith("reports/") ? `../../${s.url}` : s.url})`).join(", ")}`,
      `- 공통 생리 설명의 기존 출처: ${e.generalSources.map(s => s.url ? `[${s.id}](${s.url.startsWith("specs/") ? `../../${s.url}` : s.url})` : `${s.id} (${s.title})`).join(", ")}. 이번에 모두 재확인했다는 뜻은 아니다.`,
      `- 개인 기록 근거: 없음. 종목·성향만으로 개인 능력이나 부족한 시스템을 진단하지 않음.`,
      `- 채택 전 항목: ${c.unresolved.map(reasonText).join(", ")}`, "")
  }
  lines.push("## 출처가 실제로 보여주는 것", "")
  for (const [id, s] of Object.entries(METHOD_SOURCE_ASSESSMENTS)) lines.push(`### ${id}`, "",
    `[${s.title}](${s.url.startsWith("reports/") ? `../../${s.url}` : s.url})`, "",
    `- 종류/확인: ${s.level} / ${s.checked}`, `- 뒷받침: ${s.supports}`, `- 확정하지 못하는 것: ${s.doesNotEstablish}`, "")
  lines.push("## 남은 공급 공백과 적용 순서", "",
    "1. 현재 파일럿의 정확한 배치와 저장 경로를 유지하며 검토 묶음을 준비한다. 일반적인 구현 승인을 신규 수치 채택으로 해석하지 않는다.",
    "2. LT/VO2 시간형부터 정확한 강도 안내·전체 시간·인구/경험 조건·앞뒤 훈련을 묶어 채택안을 만든다. 코칭 자료 원문의 조건도 함께 적용 검토한다.",
    "3. BASE의 장거리·중간 강도 지구력, REC의 자전거·컨디셔닝은 현 목록의 걷기/쉬운 달리기만으로 충족됐다고 하지 않는다. 개별 구조·근거를 추가한다.",
    "4. ATP-PC/GLY는 높은 출력의 기준과 공간, 회복·개인 적용을 별도로 검토한다. 특히 입문 GLY는 기존 첫 공개 보류를 유지한다.",
    "5. 언덕은 경사·노면·회복 이동을 포함한 새 구성으로 만든다. 연구 초록만으로 임의의 경사와 반복 수를 발명하지 않는다.",
    "6. 테이퍼·복귀기·하루 두 주요 훈련·9~10일/7일 연결은 전체 일정 검사와 별도 채택이 필요하다. 선언 조건 일치만으로 빈도·양·강도를 늘리지 않는다.",
    "7. 정확한 내용 채택 뒤 런타임 레지스트리·무작위 풀·숫자 전이·저장·재조회·일지 연결 순으로 구현한다. 과거 계획에 새 이유를 소급하지 않는다.", "",
    "[DRAFT_COMPLETE]", "")
  for (const [path, content] of [["reports/review/METHOD_PURPOSE_SUPPLY_REVIEW_V3.json", json],
    ["reports/review/METHOD_PURPOSE_SUPPLY_REVIEW_V3.md", lines.join("\n")]]) {
    if (check) {
      if (await readFile(resolve(root, path), "utf8") !== content) throw Error(`STALE_GENERATED_REVIEW: ${path}`)
    } else await writeFile(resolve(root, path), content, "utf8")
  }
  console.log(JSON.stringify({ mode: check ? "check" : "generate", configurations: catalog.length,
    counts, syntheticContexts: scenarios.length, withinPurposeComparisons: pairs.length, runtimeActivation: false, sha256: digest }))
} finally { await server.close() }
