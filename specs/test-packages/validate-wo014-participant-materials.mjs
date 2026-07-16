#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourcePath = resolve(root, "specs/test-packages/SHADOW_PROTOCOL_SCENARIO_PACKAGE.md");
const participantPath = resolve(root, "reports/review/WO014_ATHLETE_PARTICIPANT_MATERIALS.md");
const reviewPath = resolve(root, "reports/review/WO014_INDEPENDENT_REVIEW_FORMS.md");

const read = (path) => readFileSync(path, "utf8").replaceAll("\r\n", "\n");
const scenarioIds = (text) => [...text.matchAll(/\b(?:SP-(?:0[1-9]|1[0-8])|SH-(?:0[1-9]|10)|HR-0[1-9])\b/g)].map((match) => match[0]);
const failures = [];

const source = read(sourcePath);
const participant = read(participantPath);
const review = read(reviewPath);
const sourceIds = scenarioIds(source.split("Trace:")[0]);
const materialIds = scenarioIds(`${participant}\n${review}`);
const sourceSet = new Set(sourceIds);
const materialSet = new Set(materialIds);

if (sourceIds.length !== 37 || sourceSet.size !== 37) failures.push("source package must define exactly 37 unique scenarios");
if (materialIds.length !== 37 || materialSet.size !== 37) failures.push("materials must trace exactly 37 IDs once each");
for (const id of sourceSet) if (!materialSet.has(id)) failures.push(`materials missing ${id}`);
for (const id of materialSet) if (!sourceSet.has(id)) failures.push(`materials contain unknown ${id}`);

for (const [label, document] of [["participant", participant], ["review", review]]) {
  const pages = document.split(/<!-- PAGE: [^>]+ -->/).slice(1);
  if (pages.length === 0) failures.push(`${label} document needs explicit pages`);
  for (const [index, page] of pages.entries()) {
    if (!page.trimStart().startsWith("> **NOT_VALID_FOR_ENROLLMENT**")) failures.push(`${label} page ${index + 1} lacks watermark`);
  }
}

const participantMarkers = [
  "participant_enrollment: false",
  "protocol_authority: false",
  "runtime_authority: false",
  "합성 자료로 연습하는 비교 시뮬레이션",
  "실제 훈련 계획에는 아무 변화도 생기지 않습니다",
  "4/4",
  "거절해도 불이익이 없습니다",
  "잠시 멈추기",
  "참여 철회",
  "삭제 요청",
  "새 선택 처리 중단",
  "받는 사람",
  "보낼 항목",
  "보내는 목적",
  "한 번만 또는 만료 시각",
  "미리보기",
  "자동 알림은 없습니다",
  "스티커는 참여 보상이 아닙니다",
  "좋지 않은 일이 생기면",
  "자동 재개되지 않습니다",
];
for (const marker of participantMarkers) if (!participant.includes(marker)) failures.push(`participant material missing: ${marker}`);

const reviewMarkers = [
  "participant_evidence: false",
  "protocol_acceptance: false",
  "runtime_authority: false",
  "이해충돌",
  "4/4 체크포인트 전수 검토",
  "유리한 사례만 골라 검토하지 않습니다",
  "서로의 판정을 보기 전에 잠금",
  "불일치",
  "제3 독립 조정자",
  "UNRESOLVED",
  "파일럿 종료 뒤",
  "안전성·효과·정확성이 입증되었다는 뜻이 아닙니다",
];
for (const marker of reviewMarkers) if (!review.includes(marker)) failures.push(`review form missing: ${marker}`);

for (const [label, document] of [["participant", participant], ["review", review]]) {
  for (const forbidden of ["participant_enrollment: true", "protocol_authority: true", "protocol_acceptance: true", "runtime_authority: true"]) {
    if (document.includes(forbidden)) failures.push(`${label} material enables forbidden authority: ${forbidden}`);
  }
}

if (failures.length > 0) {
  console.error(`WO014 participant-material validation failed (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log("WO014 participant-material validation passed: 37/37 scenarios once, all pages watermarked, no participant/protocol/runtime authority");
}
