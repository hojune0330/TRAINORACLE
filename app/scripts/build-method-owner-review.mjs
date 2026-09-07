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
  const protocols = [...METHOD_ADOPTION_PROTOCOLS, ...METHOD_ADOPTION_VARIANTS]
  const text = value => String(value).replaceAll("|", "\\|").replaceAll("\n", " ")
  const amount = p => p ? `${p.value}${p.unit === "SECONDS" ? "초" : "m"} ${p.role}` : "없음"
  const number = value => value === null ? "미산출" : String(value)
  const lines = ["# METHOD_CONFIGURATION_REVIEW_CARDS_V3.md", "", "```yaml",
    'version: "0.1"', "status: GENERATED_OWNER_REVIEW_DRAFT", "owner_approval: NOT_GRANTED",
    "runtime_activation: false", `configuration_count: ${protocols.length}`, "```", "",
    "## 읽는 기준", "",
    "이 문서는 코드의 검토 초안을 모은 자료입니다. 실제 제공 승인이나 완성된 개인 처방이 아닙니다.",
    "공통 에너지 설명은 정확한 용량의 입증과 다릅니다. 강도 미결정은 아래 숫자만으로 수행 강도를 정하지 않았다는 뜻입니다.",
    "시간형의 미산출 거리를 0으로 읽지 않습니다. 서로 다른 후보의 총부담이나 효과가 같다는 뜻도 아닙니다.",
    "재생성: app에서 node scripts/build-method-owner-review.mjs. 생성 문서를 직접 고치지 않고 원본을 수정합니다.", ""]
  for (const p of protocols) {
    const e = previewPendingMethodExplanation(p)
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
    if (main) lines.push("### 수량 확인", "", "| 구분 | 값 |", "|---|---|",
      `| 본운동 거리(m) | ${number(main.workDistanceM)} |`, `| 본운동 시간(초) | ${number(main.workSeconds)} |`,
      `| 확인된 회복 거리(m) | ${main.knownRecoveryDistanceM} |`, `| 확인된 회복 시간(초) | ${main.knownRecoverySeconds} |`,
      `| 본운동 블록 전체 시간(초) | ${number(main.totalSeconds)} |`,
      `| 준비 구간 시간(초) | ${number(e.exactStructure.totals.warmup.totalSeconds)} |`,
      `| 정리 구간 시간(초) | ${number(e.exactStructure.totals.cooldown.totalSeconds)} |`, "",
      "확인된 회복량은 부분합입니다. 거리·시간이 섞이면 전체 회복량과 다를 수 있습니다.", "")
    lines.push("### 공통 설명 근거", "", ...e.generalExplanation.sources.map(s =>
      `- ${text(s.title)}${s.url ? `: ${s.url}` : ""} / ${text(s.population)} / ${text(s.applicability)}`), "",
      "### 적용되지 않는 항목", "", ...(e.notApplicable.length ? e.notApplicable.map(item => `- ${item.item}: ${item.reason}`) : ["없음. 해당 훈련의 구성과 회복 근거를 검토해야 합니다."]), "",
      "### 채택 전 남은 검토", "", ...e.pending.map(item => `- ${item}`), "")
  }
  const gaps = auditAllPendingMainChoices().filter(r => r.coverage === "MISSING_DISTINCT_MAIN_OPTIONS")
  lines.push("## 전체 미완 범위", "", `구조상 두 방법 미확보: ${gaps.length}행(연령군·선택권한 포함).`,
    "개별 강도, 정확한 용량 근거, 현재 주기 배치, 오너 최종 승인, 운영 연결과 전체 사용자 흐름 검증은 별도입니다.",
    "검토 카드 수를 완료된 처방 수로 계산하지 않습니다.", "", "[DRAFT_COMPLETE]", "")
  await writeFile(resolve(root, "reports/review/METHOD_CONFIGURATION_REVIEW_CARDS_V3.md"), lines.join("\n"), "utf8")
  console.log(JSON.stringify({ configurationCount: protocols.length, unresolvedScopeRows: gaps.length, runtimeActivation: false }))
} finally { await server.close() }
