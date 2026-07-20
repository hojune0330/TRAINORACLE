import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const defaultPaths = [
  resolve(root, "specs/test-packages/FORMATION_COACH_RULESET_FIXTURES.md"),
  resolve(root, "reports/review/WO012_COACH_OWNER_WALKTHROUGH.md"),
  resolve(root, "reports/review/WO012_COACH_DECISION_RESPONSE_TEMPLATE.md"),
];
const suppliedPaths = process.argv.slice(2);

if (suppliedPaths.length !== 0 && suppliedPaths.length !== 3) {
  throw new Error("expected zero paths or fixture, walkthrough, and response paths");
}

const [fixturePath, walkthroughPath, responsePath] = suppliedPaths.length === 3 ? suppliedPaths : defaultPaths;
const fixtures = readFileSync(fixturePath, "utf8");
const walkthrough = readFileSync(walkthroughPath, "utf8");
const response = readFileSync(responsePath, "utf8");
const sources = { fixtures, walkthrough, response };
const casePattern = /\bCR-(?:0[1-9]|[12][0-9]|30)\b/gu;
const failures = [];

const caseIds = (text) => [...text.matchAll(casePattern)].map((match) => match[0]);
const unique = (values) => new Set(values);
const tableRows = (text) => text.split("\n").filter((line) => /^\| CR-/.test(line));
const failUnless = (condition, message) => {
  if (!condition) failures.push(message);
};
const contains = (source, marker, label = marker) =>
  failUnless(sources[source].includes(marker), `${source} missing marker: ${label}`);

for (const [source, content] of Object.entries(sources)) {
  contains(source, "status: OWNER_RESPONSES_RECORDED_PENDING_INDEPENDENT_REVIEW");
  contains(source, "ruleset_accepted: false");
  contains(source, "runtime_authority: false");
  failUnless(!/ruleset_accepted\s*:\s*true/iu.test(content), `${source} must not accept the ruleset`);
  failUnless(!/runtime_authority\s*:\s*true/iu.test(content), `${source} must not create runtime authority`);
}

contains("response", "owner_answers_recorded: true");
contains("response", "owner_source_transcribed: true");
contains("response", "independent_review_status: PENDING");
contains("walkthrough", "owner_answers_recorded: true");
contains("fixtures", "owner_direction_recorded: true");

const fixtureIds = caseIds(fixtures.split("## Trace")[0]);
const walkthroughRows = tableRows(walkthrough);
const responseRows = tableRows(response);
failUnless(fixtureIds.length === 30 && unique(fixtureIds).size === 30, "fixture source must define 30 unique cases");
failUnless(walkthroughRows.length === 30 && unique(caseIds(walkthroughRows.join("\n"))).size === 30, "walkthrough must map 30 unique cases");
failUnless(responseRows.length === 30 && unique(caseIds(responseRows.join("\n"))).size === 30, "response must provide 30 unique answer rows");

for (const row of responseRows) {
  failUnless(
    /^\| CR-(?:0[1-9]|[12][0-9]|30) \| (?:APPROVE(?:_WITH_[A-Z_]+)?|REVISE)_RECORDED_PENDING_INDEPENDENT_REVIEW \| [^|]+ \|$/u.test(row),
    `response row must record a pending-review decision with a rule sentence: ${row}`,
  );
}

const alignedMarkers = [
  ["response", "exception_window: CURRENT_PLUS_IMMEDIATE_PRIOR_AND_NEXT_MAX_THREE"],
  ["walkthrough", "현재 + 바로 앞 + 바로 뒤, 최대 3개 프레임"],
  ["fixtures", "current + immediate prior + next; maximum 3 frames"],
  ["response", "strong_plyometric_trigger: EXPLICIT_CLASSIFICATION_STRONG_OR_HIGH_ONLY"],
  ["walkthrough", "RPE·자유 서술에서 추정하지 않습니다"],
  ["fixtures", "explicit strong or high classification only; no RPE or free-text inference"],
  ["response", "confirmation_step_one: SHOW_RATIONALE_AND_CONSERVATIVE_ALTERNATIVE"],
  ["response", "confirmation_step_two: SEPARATE_SURFACE_CREATES_REVIEW_REQUEST_OR_ADJUSTMENT_DRAFT_ONLY"],
  ["walkthrough", "첫 화면에서 이유와 보수적 대안을 보여주고, 둘째 별도 화면에서 검토 요청·조정 초안만"],
  ["fixtures", "first show rationale and a conservative alternative; second, separate surface creates a request or draft only"],
  ["response", "marker_text_or_visual_semantics: PENDING_OWNER_RECONCILIATION"],
  ["walkthrough", "marker_text_or_visual_semantics: PENDING_OWNER_RECONCILIATION"],
  ["fixtures", "marker_text_or_visual_semantics: PENDING_OWNER_RECONCILIATION"],
  ["fixtures", "private memo remains excluded; one-tap acknowledgement creates no signal and cannot change exclusion"],
  ["fixtures", "priority: safety > fixed competition > recovery/high-plyo > coach > macro 2-3-frame > user convenience"],
  ["walkthrough", "easy guided re-anchor selector; never an accidental one-click schedule mutation"],
];
for (const [source, marker] of alignedMarkers) contains(source, marker);

for (const marker of [
  "자동 실행",
  "change the actual plan",
  "bypass safety",
  "no threshold inferred",
  "double count",
  "classification check recommended",
  "distinct same-day sessions protected",
  "conservative rest",
]) contains("response", marker);

for (const [source, content] of Object.entries(sources)) {
  failUnless(
    !content.includes("visible text marker; not a star-only marker"),
    `${source} must not infer a text-only competition marker`,
  );
  failUnless(
    !content.includes("A canonical day-boundary definition remains open"),
    `${source} must not reopen the merged competition direction`,
  );
}

for (const [label, text, marker] of [
  ["fixture competition direction", fixtures, "competition_direction_state: OWNER_DIRECTION_RECORDED_PENDING_NAMED_REVIEW"],
  ["fixture completed bout identity", fixtures, "completed_bout_records: SEPARATE"],
  ["fixture calendar anchor", fixtures, "calendar_anchor_exposure: 0"],
  ["fixture same-date MAIN cap", fixtures, "same_competition_day_main_placement: ZERO_OR_ONE"],
  ["fixture canonical boundary", fixtures, "canonical_counting_changed: false"],
  ["walkthrough direction source", walkthrough, "FORMATION_COMPETITION_RECORD_IDENTITY_OWNER_DECISION.md"],
  ["walkthrough CA-02 boundary", walkthrough, "ca_02_formal_decision: NOT_REVIEWED"],
  ["walkthrough CA-03 boundary", walkthrough, "ca_03_formal_decision: NOT_REVIEWED"],
  ["response CA-02 boundary", response, "ca_02_formal_decision: NOT_REVIEWED"],
  ["response CA-03 boundary", response, "ca_03_formal_decision: NOT_REVIEWED"],
]) {
  if (!text.includes(marker)) failures.push(`missing ${label}: ${marker}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log("WO012 coach owner-response validation passed: 30/30 rows, pending independent review, no runtime authority");
}
