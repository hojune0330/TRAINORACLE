import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const fixtures = readFileSync(resolve("specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md"), "utf8");
const walkthrough = readFileSync(resolve("reports/review/WO012_COACH_OWNER_WALKTHROUGH.md"), "utf8");
const response = readFileSync(resolve("reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md"), "utf8");
const pattern = /\bCR-(?:0[1-9]|[12][0-9]|30)\b/gu;
const failures = [];
const ids = (text) => [...text.matchAll(pattern)].map((match) => match[0]);
const unique = (values) => new Set(values);
const fixtureIds = ids(fixtures.split("Trace:")[0]);
const walkthroughRows = walkthrough.split("\n").filter((line) => /^\| CR-/.test(line));
const responseRows = response.split("\n").filter((line) => /^\| CR-/.test(line));

if (fixtureIds.length !== 30 || unique(fixtureIds).size !== 30) failures.push("fixture source must define 30 unique cases");
if (walkthroughRows.length !== 30 || unique(ids(walkthroughRows.join("\n"))).size !== 30) failures.push("walkthrough must map 30 unique cases");
if (responseRows.length !== 30 || unique(ids(responseRows.join("\n"))).size !== 30) failures.push("response must provide 30 unique answer rows");

const groups = [
  "프레임·횟수",
  "경기",
  "놓친 훈련·몰아넣기 금지",
  "테이퍼·진행·회복",
  "복합 훈련",
  "기준점·이동·경계",
  "개인정보·권한",
];
for (const group of groups) if (!walkthrough.includes(`## ${group}`)) failures.push(`missing group: ${group}`);

for (const marker of [
  "9.5일과 약",
  "72시간",
  "owner_answers_recorded: false",
  "ruleset_accepted: false",
  "runtime_authority: false",
  "아직 코치의 답이 기록되어 있지 않습니다",
  "빈칸은 `NOT_REVIEWED`",
]) {
  if (!`${walkthrough}\n${response}`.includes(marker)) failures.push(`missing marker: ${marker}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("WO012 coach walkthrough validation passed: 30/30 cases, 30/30 response rows, 7/7 groups");
}
