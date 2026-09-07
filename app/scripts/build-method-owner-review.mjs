import { createServer } from "vite"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { writeFile } from "node:fs/promises"

const root = fileURLToPath(new URL("../../", import.meta.url))
const server = await createServer({ configFile: false, root, cacheDir: resolve(root, "app/node_modules/.vite-owner-review"), server: { middlewareMode: true }, appType: "custom" })
try {
  const { METHOD_ADOPTION_PROTOCOLS, METHOD_ADOPTION_VARIANTS } = await server.ssrLoadModule("/reports/research/method-adoption-protocols.mjs")
  const { previewPendingMethodExplanation } = await server.ssrLoadModule("/reports/research/method-explanation-preview-v3.ts")
  const { auditAllPendingMainChoices } = await server.ssrLoadModule("/reports/research/method-choice-coverage-v3.ts")
  const { previewMethodDurationFit } = await server.ssrLoadModule("/reports/research/method-duration-fit-v3.ts")
  const { proposeMethodExecutionGuidance } = await server.ssrLoadModule("/reports/research/method-execution-guidance-proposal.mjs")
  const { previewPendingMethodCombinations } = await server.ssrLoadModule("/reports/research/method-combination-review.mjs")
  const protocols = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]
  const text = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ")
  const amount = p => p ? `${p.value}${p.unit === "SECONDS" ? "초" : "m"} ${p.role}` : "없음"
  const number = value => value === null ? "미산출" : String(value)
  const lines = ["# METHOD_CONFIGURATION_REVIEW_CARDS_V3.md", "", "```yaml",
    'version: "0.1"', "status: GENERATED_OWNER_REVIEW_DRAFT", "owner_approval: NOT_GRANTED",
    "runtime_activation: false", `configuration_count: ${protocols.length}`, "```", "",
    "## 읽는 기준", "",
    "이 문서는 코드의 검토 초안을 모은 자료입니다. 실제 제공 승인이나 완성된 개인 처방이 아닙니다.",
    "공통 에너지 설명은 정확한 용량의 입증과 다릅니다. 본운동 노력 제안은 구간과 연결되지만 아직 수행 대상으로 채택된 값이 아닙니다.",
    "시간형의 미산출 거리를 0으로 읽지 않습니다. 서로 다른 후보의 총부담이나 효과가 같다는 뜻도 아닙니다.",
    "재생성: app에서 node scripts/build-method-owner-review.mjs. 생성 문서를 직접 고치지 않고 원본을 수정합니다.", ""]
  for (const p of protocols) {
    const e = previewPendingMethodExplanation(p)
    const guidance = proposeMethodExecutionGuidance(p)
    const main = e.exactStructure.totals?.main
    lines.push(`## ${p.id}`, "", `- 목적 분류: ${p.family} / 방법: ${p.method}`,
      `- 본운동 단위: ${p.work.map(amount).join(" + ") || "계획된 운동 없음"}`,
      `- 반복: 세트당 ${p.reps}회 / 세트 ${p.sets}개`,
      `- 반복 사이: ${amount(p.between)}`,
      `- 매 반복 뒤: ${amount(p.afterEvery)}${p.afterEvery ? " (마지막 반복 포함)" : ""}`,
      `- 세트 사이 추가 회복: ${amount(p.setRest)}`,
      `- 원본 구성 지문: \`${e.contentFingerprint}\``, "",
      "### 목적과 에너지 공급", "", text(e.generalExplanation.profile.purpose), "", text(e.generalExplanation.profile.energyContext), "",
      "### 기존 강도 기준과 적용 한계", "",
      e.intensityReview.range ? `현재 엔진 안내: RPE ${e.intensityReview.range.minimum}~${e.intensityReview.range.maximum}` : "RPE 목표: 해당 없음",
      "", text(e.intensityReview.explanation), "",
      "### 구성과 회복 이유", "", text(e.methodDesign.work), "", text(e.methodDesign.recovery), "",
      "### 장단점과 한계", "", text(e.methodDesign.tradeoff), "",
      ...e.generalExplanation.profile.limitations.map(l => `- ${text(l)}`), "")
    lines.push("### 구간별 수행 안내 채택 제안", "",
      "아래 문구는 제품 코칭 제안입니다. 연구에서 입증된 개인 속도나 승인된 운영 강도가 아닙니다.",
      ...(guidance.methodCue ? [guidance.methodCue] : []), ...(guidance.offReason ? [guidance.offReason] : []),
      ...[...new Map(guidance.segments.map(s => [s.role, s.instruction])).entries()].map(([role, instruction]) => `- ${role}: ${instruction}`), "")
    const effort = guidance.effortProposal
    if (effort.work) lines.push("### 본운동 노력 채택안", "",
      effort.work.rpe ? `본운동 체감 노력 제안: RPE ${effort.work.rpe.join("~")}` : "고출력·동작의 질 기준: 세션 RPE를 목표 속도로 바꾸지 않음",
      "", effort.work.cue, "", effort.work.adjustment, "", effort.recovery.cue, "", effort.boundary, "",
      "이 수치는 원문에서 복사한 생리학적 경계가 아니라 오너 채택을 요청할 제품 코칭 선택입니다. 개인 초·페이스와 세션 전체 RPE는 별도이며, 아직 운영에 적용하지 않았습니다.", "")
    if (main) lines.push("### 수량 확인", "", "| 구분 | 값 |", "|---|---|",
      `| 본운동 거리(m) | ${number(main.workDistanceM)} |`, `| 본운동 시간(초) | ${number(main.workSeconds)} |`,
      `| 확인된 회복 거리(m) | ${main.knownRecoveryDistanceM} |`, `| 확인된 회복 시간(초) | ${main.knownRecoverySeconds} |`,
      `| 본운동 블록 전체 시간(초) | ${number(main.totalSeconds)} |`,
      `| 준비 구간 시간(초) | ${number(e.exactStructure.totals.warmup.totalSeconds)} |`,
      `| 정리 구간 시간(초) | ${number(e.exactStructure.totals.cooldown.totalSeconds)} |`, "",
      "확인된 회복량은 부분합입니다. 거리·시간이 섞이면 전체 회복량과 다를 수 있습니다.", "")
    const fitLabels = { NOT_APPLICABLE: "해당 없음", EXCEEDS_EXISTING_RANGE: "기존 상한 초과", DURATION_UNRESOLVED: "전체 시간 미산출", BELOW_EXISTING_RANGE: "기존 하한 미만", WITHIN_EXISTING_RANGE: "기존 시간 범위 안" }
    const experiences = [["NEW_TO_RUNNING", "처음 시작"], ["DEVELOPING", "훈련 경험 있음"], ["EXPERIENCED", "훈련 경험 많음"]]
    lines.push("### 기존 일정 시간과 비교", "", "| 경험 | 기존 범위(분) | 시간 비교 | 최소 초과(초) |", "|---|---|---|---|",
      ...experiences.map(([experience, label]) => {
        const fit = previewMethodDurationFit(p, experience)
        const range = fit.existingRangeSeconds
        return `| ${label} | ${range ? `${range.minimum / 60}~${range.maximum / 60}` : "해당 없음"} | ${fitLabels[fit.status]} | ${fit.excessAtLeastSeconds ?? "해당 없음"} |`
      }), "", "기본 후보의 기존 시간 범위와 비교한 값입니다. 개인의 가능한 시간, 보수적 후보, 앞뒤 훈련 적합성은 별도입니다. 범위 안이어도 제공 승인이 아니며, 범위 밖이라고 운동을 자동 추가하거나 삭제하지 않습니다.", "",
      "### 공통 설명 근거", "", ...e.generalExplanation.sources.map(s =>
      `- ${text(s.title)}${s.url ? `: ${s.url}` : ""} / ${text(s.population)} / ${text(s.applicability)}`), "",
      "### 적용되지 않는 항목", "", ...(e.notApplicable.length ? e.notApplicable.map(item => `- ${item.item}: ${item.reason}`) : ["없음. 해당 훈련의 구성과 회복 근거를 검토해야 합니다."]), "",
      "### 채택 전 남은 검토", "", ...e.pending.map(item => `- ${item}`), "")
  }
  const gaps = auditAllPendingMainChoices().filter(r => r.coverage === "MISSING_DISTINCT_MAIN_OPTIONS")
  lines.push("## 조합 검토량", "", "아래는 목적이 같은 MAIN 2개 또는 3개를 가진 가상 배치의 구성 조합 수입니다.",
    "기존 구성 유지, 일부만 변경, 같은 방법 반복 선택, 수치 변형을 포함하고 전부 기존 구성인 경우는 제외합니다.",
    "종목7개에서의 최솟값~최댓값입니다. 예시 날짜1·4·7은 개수 계산용 주소이지 승인된 주기 배치가 아닙니다.",
    "이 수치는 생성 가능한 운영 계획 수나 승인된 조합 수가 아닙니다.", "",
    "| 경험 | 목적 | MAIN 2개 | MAIN 3개 |", "|---|---|---|---|")
  for (const experience of ["NEW_TO_RUNNING", "DEVELOPING", "EXPERIENCED"]) {
    for (const family of ["LT", "VO2", "ATP-PC", "GLY", "MIX"]) {
      const counts = [2, 3].map(n => {
        const values = [800, 1500, 3000, 5000, 10000, 21097, 42195].map(eventDistanceM =>
          BigInt(previewPendingMethodCombinations({ eventDistanceM, experience, population: "YOUTH", actor: "SELF" },
            [1, 4, 7].slice(0, n).map(day => ({ day, slot: "AM", family })), { materializeLimit: 0 }).combinationCount))
        const min = values.reduce((a, b) => a < b ? a : b), max = values.reduce((a, b) => a > b ? a : b)
        return min === max ? String(min) : `${min}~${max}`
      })
      lines.push(`| ${experience} | ${family} | ${counts[0]} | ${counts[1]} |`)
    }
  }
  lines.push("", "0은 적합한 훈련이 없다는 생리학적 판단이 아니라, 현재 제안 목록에 해당 경험의 상세 구성이 없다는 뜻입니다.",
    "전체 정책은 실제 원본 범위·배치·상호작용까지 별도로 검토해야 합니다. 이 목록은 정책 지문이나 승인을 만들지 않습니다.", "")
  lines.push("## 전체 미완 범위", "", `구조상 두 방법 미확보: ${gaps.length}행(연령군·선택권한 포함).`,
    "개별 강도, 정확한 용량 근거, 현재 주기 배치, 오너 최종 승인, 운영 연결과 전체 사용자 흐름 검증은 별도입니다.",
    "검토 카드 수를 완료된 처방 수로 계산하지 않습니다.", "", "[DRAFT_COMPLETE]", "")
  await writeFile(resolve(root, "reports/review/METHOD_CONFIGURATION_REVIEW_CARDS_V3.md"), lines.join("\n"), "utf8")
  console.log(JSON.stringify({ configurationCount: protocols.length, unresolvedScopeRows: gaps.length, runtimeActivation: false }))
} finally { await server.close() }
