import { createServer } from "vite"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { readFile, writeFile } from "node:fs/promises"
import { createHash } from "node:crypto"

const root = fileURLToPath(new URL("../../", import.meta.url))
const check = process.argv.includes("--check")
const server = await createServer({ configFile: false, root,
  cacheDir: resolve(root, "app/node_modules/.vite-expanded-workout-catalog"),
  optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" })
const cell = s => String(s).replaceAll("|", "\\|").replaceAll("\n", " ")
const duration = n => n === null ? "미산출" : `${n}s (${Number((n / 60).toFixed(2))}min)`
const modalityNames = { RUN: "달리기", WALK: "걷기", BIKE: "자전거", ELLIPTICAL: "일립티컬", DEEP_WATER_RUN: "수중 달리기", SWIM: "수영" }
const terrainNames = { FLAT: "평지", UPHILL: "오르막", ROLLING: "오르내리는 코스", INDOOR: "실내 장비", POOL: "수영장" }
try {
  const { buildExpandedWorkoutCatalog, EXPANDED_FAMILIES, EXPANDED_SOURCES, reviewExpandedPool } = await server.ssrLoadModule("/reports/research/expanded-workout-catalog-v3.ts")
  const { buildPurposeSupplyCatalog } = await server.ssrLoadModule("/reports/research/method-purpose-supply-v3.ts")
  const added = buildExpandedWorkoutCatalog(), existing = buildPurposeSupplyCatalog()
  const families = [...EXPANDED_FAMILIES, "OFF"]
  const counts = Object.fromEntries(families.map(f => [f, { existing: existing.filter(c => c.family === f).length,
    added: added.filter(c => c.family === f).length, total: existing.filter(c => c.family === f).length + added.filter(c => c.family === f).length,
    addedMethodGroups: new Set(added.filter(c => c.family === f).map(c => c.methodGroup)).size }]))
  const groups = [...new Set(added.map(c => `${c.family}:${c.methodGroup}`))]
  const sourcePaths = ["reports/research/expanded-workout-catalog-v3.ts", "reports/research/method-adoption-protocols.mjs",
    "reports/research/method-purpose-supply-v3.ts", "app/src/domain/workout-notation.ts", "app/src/domain/training-explanation-profiles.ts",
    "impl/src/prescription/sequence-v3.ts", "app/scripts/build-expanded-workout-catalog.mjs"]
  const sourceHashes = {}
  for (const path of sourcePaths) sourceHashes[path] = createHash("sha256").update(await readFile(resolve(root, path))).digest("hex")
  const context = { family: "LT", eventDistanceM: 5000, experience: "EXPERIENCED", terrain: "FLAT", availableModalities: ["RUN", "WALK"],
    safety: "NO_KNOWN_RISK", hasAccelerationSpace: true, hardTimeLimitSeconds: 3600 }
  const cases = [
    ["5km 경험자 · 평지 LT", {}], ["마라톤 · 평지 VO2", { family: "VO2", eventDistanceM: 42195 }],
    ["800m · 짧은 고출력", { family: "ATP-PC", eventDistanceM: 800 }],
    ["가속 공간 없음", { family: "ATP-PC", hasAccelerationSpace: false }],
    ["언덕 LT", { terrain: "UPHILL" }], ["지형 미확인", { terrain: "UNKNOWN" }],
    ["입문자 · 고강도 기존 개방으로 오인 금지", { family: "GLY", experience: "NEW_TO_RUNNING" }],
    ["회복 자전거", { family: "REC", terrain: "INDOOR", availableModalities: ["BIKE"] }],
    ["수영장 회복", { family: "REC", terrain: "POOL", availableModalities: ["SWIM", "DEEP_WATER_RUN"] }],
    ["통증 확인 필요", { safety: "REVIEW_REQUIRED" }], ["상태 미확인", { safety: "UNKNOWN" }],
    ["전체 가능시간 20분", { hardTimeLimitSeconds: 1200 }],
  ]
  const scenarios = cases.map(([name, patch]) => ({ name, synthetic: true, context: { ...context, ...patch }, ...reviewExpandedPool({ ...context, ...patch }) }))
  const bundle = { version: "1.0.0", status: "DRAFT_CATALOG_NOT_RUNTIME", reviewedOn: "2026-09-30", executionAuthority: "NONE",
    previousConfigurationCount: existing.length, addedConfigurationCount: added.length, combinedConfigurationCount: existing.length + added.length,
    addedMethodGroupCount: groups.length, newRuntimeActivationCount: 0, counts, sourceHashes, sources: EXPANDED_SOURCES,
    existingReferences: existing.map(c => ({ id: c.id, family: c.family, method: c.method, name: c.name, notation: c.notation, fingerprint: c.contentFingerprint })),
    added, scenarios }
  const json = JSON.stringify(bundle, null, 2) + "\n"
  const lines = ["# 트레인오라클 상세 훈련 확장 카탈로그", "", "```yaml", "status: DRAFT_CATALOG_NOT_RUNTIME",
    "execution_authority: NONE", "reviewed_on: 2026-09-30", `existing_configurations: ${existing.length}`, `added_configurations: ${added.length}`,
    `combined_configurations: ${existing.length + added.length}`, `added_method_groups: ${groups.length}`, "new_runtime_activations: 0", "```", "",
    "## 숫자의 의미", "",
    `기존 ${existing.length}개 구성에 ${added.length}개를 추가했다. 합계 ${existing.length + added.length}개는 수치 변형을 포함한 **구성 수**이지 독립된 훈련법 수가 아니다.`,
    `새 구성은 목적과 방법을 함께 묶은 ${groups.length}개 방법군으로 분류했다. 같은 방법군의 다른 수치·순서는 동등한 부담이나 효과를 뜻하지 않는다.`,
    "새 항목은 정확한 반복·세트·회복을 계산할 수 있는 본운동 데이터다. 공개 앱 자동 처방에 연결된 새 항목은 아직 0개다.",
    "기존 LT 파일럿 승인은 그대로 유지한다. 원본 37개 제안이나 과거 채택 지문을 덮어쓰지 않았다.",
    "개인 기록·메모를 포함하지 않는다. 외부 전문가 승인, 청소년별 용량 검증, 독립 에이전트 검수라고 주장하지 않는다.", "",
    "## 목적별 전체 수", "", "| 목적 | 기존 | 추가 | 합계 | 추가분 방법군 |", "|---|---:|---:|---:|---:|",
    ...families.map(f => `| ${f} | ${counts[f].existing} | ${counts[f].added} | ${counts[f].total} | ${counts[f].addedMethodGroups} |`), "",
    "## 사용하는 방식", "",
    "- 사용자에게 117개 목록을 고르게 하지 않는다. 채택 후에는 목적·기록·경험·장소·가능 시간·주기 맥락으로 고른 한 안을 제시한다.",
    "- `다른 훈련`은 같은 목적의 적합한 풀에서 다른 방법을 우선하고, 충분한 안이 없으면 없다고 알린다. 고정 짝을 만들지 않는다.",
    "- ± 조절은 향후 채택된 수치 범위 안에서만 허용한다. 새 구성이 많아져도 강도·양·빈도를 자동으로 늘리지 않는다.",
    "- 새 세트의 RPE는 의도한 노력 범위이며 실제 LT·VO2·ATP-PC 측정값이 아니다. 개인 초/페이스는 기존 검토 모델과 연결해야 한다.",
    "- 100~400m 전문선수 계획 개방은 아니다. 청소년·혼자 훈련하는 사용자는 검토 대상에 포함하며 일괄 배제하지 않는다.", "",
    "## 읽는 법과 시간", "",
    "`r`은 반복 사이, `R`은 세트 사이 회복이다. `종료 뒤`는 바로 앞 구간/묶음이 끝난 뒤의 명시적 회복이다.",
    "Walk/Jog/Stand는 걷기/조깅/서서 쉬기다. HIGH_OUTPUT_CONTROLLED는 자세와 출력을 유지하는 짧은 고출력이며 개인 속도 미지정이다.",
    "표의 시간은 본운동과 그 안의 회복만 포함한다. 준비·정리와 연결하지 않았으므로 전체 운동 가능시간에 맞는다고 확정할 수 없다.",
    "거리형·플로트·언덕 복귀 시간이 미정이면 합계를 추정하지 않는다. 언덕의 마지막 복귀·정리는 별도 명시된 경우 외에는 지원 구성에서 추가 확인한다.",
    "자전거·걷기·수영 등은 방식별로 보존한다. 러닝 거리나 동일한 부하로 바꾸지 않는다.", "",
    "## 추가 구성 전체", "", "| ID | 훈련 | 본운동 표기 | 운동 방식 / 지형 | 본운동+내부 회복 시간 |", "|---|---|---|---|---|",
    ...added.map(c => `| ${c.id} | ${cell(c.name)} | ${cell(c.notation)} | ${[...new Set(c.segmentContexts.map(s => modalityNames[s.modality]))].join(" + ")} / ${[...new Set(c.segmentContexts.map(s => terrainNames[s.terrain]))].join(" + ")} | ${duration(c.totals.totalSeconds)} |`), "",
    "## 같은 방법의 변형을 따로 집계", "", "| 목적 / 방법군 | 구성 ID |", "|---|---|",
    ...groups.map(g => `| ${g} | ${added.filter(c => `${c.family}:${c.methodGroup}` === g).map(c => c.id).join(", ")} |`), "",
    "## 구성별 이유와 확인 사항", "",
    ...added.flatMap(c => [`### ${c.id} ${c.name}`, "", `- 방법: ${c.notation}`, `- 목적: ${c.explanation.purpose}`,
      `- 구성 이유: ${c.explanation.configurationReason}`, `- 부담·한계: ${c.explanation.tradeoff}`,
      `- 회복 이유: ${[...new Set(c.recoveryContexts.map(r => r.reason))].join(" / ") || "별도 회복 구간 없이 이어가는 구성이다. 구간 안의 강도·운동 방식 전환은 원본에 남긴다."}`,
      `- 구간 목적: ${c.segmentContexts.map(s => `${s.segmentId}: ${s.intent} / ${modalityNames[s.modality]} / ${terrainNames[s.terrain]}`).join("; ")}`,
      `- 제안 경험 범위: ${c.proposedScope.experience.join(", ")} (개별 적합성 입증 아님).`,
      `- 근거: ${c.explanation.sourceIds.map(id => `[${id}](${EXPANDED_SOURCES[id].url})`).join(", ")}. 새 숫자 전체는 제품 코칭 초안이다.`,
      `- 다음 검토: ${c.requiredReview.join(", ")}`, ""]),
    "## 출처가 말하는 범위", "",
    ...Object.entries(EXPANDED_SOURCES).flatMap(([id, s]) => [`### ${id}`, "", `[${s.title}](${s.url})`, "", `- 종류: ${s.kind} / 확인: ${s.access}`,
      `- 사용한 내용: ${s.supports}`, `- 적용 한계: ${s.limitation}`, ""]),
    "## 상황별 검사", "", "실제 선수 시험이 아니라 선언한 제약을 확인하는 합성 조건이다. 미제외도 실행 승인이 아니다.", "",
    "| 상황 | 해당 목적 구성 | 조건상 제외 | 검토 대상으로 남음 |", "|---|---:|---:|---:|",
    ...scenarios.map(s => `| ${s.name} | ${s.rows.length} | ${s.rows.filter(r => r.excluded.length).length} | ${s.rows.filter(r => !r.excluded.length).length} |`), "",
    "## 공개 적용으로 이어갈 작업", "",
    "1. 경험·최근 훈련량별 적용 범위, 구간별 개인 페이스/노력 기준, 정확한 수치와 회복을 채택한다.",
    "2. 준비·정리·언덕 복귀·장비 전환까지 연결해 전체 시간을 검토한다.",
    "3. 기존 주기와 앞뒤 훈련, 같은 날 오전·오후 관계를 확인한다. 목적별 풀로 연결하고 고정 짝을 두지 않는다.",
    "4. 새 구조를 홈·달력·수행 설명·수치 조절·연결 일지에 동일하게 표시한다. 검수 후 실제 공개 범위를 갱신한다.", "",
    "## 재현", "", "`cd app` 후 `node scripts/build-expanded-workout-catalog.mjs`로 재생성한다. `--check`는 원본과 보고서의 일치를 검사한다.",
    `동반 JSON SHA-256: \`${createHash("sha256").update(json).digest("hex")}\`.`,
    "[기존 37개 검토](METHOD_PURPOSE_SUPPLY_REVIEW_V3.md) / [구조화 데이터](EXPANDED_WORKOUT_CATALOG_V3.json)", "", "[DRAFT_COMPLETE]", ""]
  const outputs = [["reports/review/EXPANDED_WORKOUT_CATALOG_V3.json", json], ["reports/review/EXPANDED_WORKOUT_CATALOG_V3.md", lines.join("\n")]]
  for (const [path, content] of outputs) {
    if (check) {
      if (await readFile(resolve(root, path), "utf8") !== content) throw Error(`GENERATED_FILE_STALE: ${path}`)
    } else await writeFile(resolve(root, path), content, "utf8")
  }
  console.log(JSON.stringify({ check, existing: existing.length, added: added.length, combined: existing.length + added.length,
    addedMethodGroups: groups.length, counts, scenarios: scenarios.length, runtimeActivations: 0 }, null, 2))
} finally {
  await server.close()
}
