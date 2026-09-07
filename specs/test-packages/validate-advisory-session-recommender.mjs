import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const suppliedPaths = process.argv.slice(2);

if (suppliedPaths.length !== 0 && suppliedPaths.length !== 2) {
  throw new Error("expected zero paths or catalog and recommender contract paths");
}

const [catalogPath, contractPath] = suppliedPaths.length === 2
  ? suppliedPaths
  : [
      resolve(root, "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"),
      resolve(root, "specs/reconstruct/ADVISORY_SESSION_EXAMPLE_RECOMMENDER_CONTRACT.md"),
    ];
const catalog = readFileSync(catalogPath, "utf8");
const contract = readFileSync(contractPath, "utf8");
const failures = [];
const failUnless = (condition, message) => {
  if (!condition) failures.push(message);
};
const allowedSourceTiers = new Set(["DIRECT_SOURCE_EXAMPLE", "SOURCE_ADAPTED"]);
const eventGroups = new Set(["SPRINT", "MIDDLE_DISTANCE", "LONG_DISTANCE", "ROAD_RUNNING"]);
const performanceUnits = new Set(["MILLISECONDS", "SECONDS", "DISTANCE_METERS"]);
const identifierPattern = /^[A-Z0-9][A-Z0-9._-]*$/u;
const expectedSourceCounts = new Map([
  ["DIRECT_SOURCE_EXAMPLE", 5],
  ["SOURCE_ADAPTED", 10],
  ["POPULATION_INDIRECT", 6],
  ["PRODUCT_VARIANT", 4],
  ["REJECTED_OR_UNUSABLE", 5],
]);
const requiredStates = [
  "BLOCKED_BY_D9_ACTIVE",
  "BLOCKED_BY_D9_UNKNOWN",
  "INSUFFICIENT_ELIGIBLE_CANDIDATES",
  "ADVISORY_CANDIDATES_READY",
  "PERSONAL_DRAFT_CREATED",
];

function requireFinalMarker(text, documentName) {
  const matches = text.match(/^\[DRAFT_COMPLETE\]$/gmu) ?? [];
  failUnless(matches.length === 1, `${documentName} must contain exactly one final marker`);
  failUnless(
    text.trimEnd().endsWith("[DRAFT_COMPLETE]"),
    `${documentName} final marker must be the last non-whitespace content`,
  );
}

function getField(block, field) {
  return block.match(new RegExp(`^\\s+${field}: ([^\\r\\n]+)`, "mu"))?.[1] ?? "MISSING";
}

function isNormalizedEventIdentity(value) {
  const distance = value?.eventDistanceM;
  return eventGroups.has(value?.eventGroup)
    && typeof value.eventCode === "string" && identifierPattern.test(value.eventCode)
    && (distance === null || (Number.isInteger(distance) && distance > 0));
}

function isNormalizedPerformance(value) {
  return Number.isFinite(value?.value) && value.value > 0
    && performanceUnits.has(value.unit)
    && typeof value.canonicalText === "string" && value.canonicalText.trim().length > 0;
}

function isValidDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/u.test(value)
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}

function isSameEvent(left, right) {
  return isNormalizedEventIdentity(left) && isNormalizedEventIdentity(right)
    && left.eventGroup === right.eventGroup && left.eventCode === right.eventCode
    && left.eventDistanceM === right.eventDistanceM;
}

function isValidSourceRef(value) {
  return typeof value?.sourceId === "string" && identifierPattern.test(value.sourceId)
    && (value.sourceVersion === null || typeof value.sourceVersion === "string");
}

function validateFixture(fixture, fixtureIndex) {
  const label = `fixture ${fixtureIndex + 1}`;
  const candidates = Array.isArray(fixture.candidates) ? fixture.candidates : [];
  const eligiblePoolCount = fixture.eligiblePoolCount;
  const isD9Blocked = fixture.d9Status === "ACTIVE" || fixture.d9Status === "UNKNOWN";
  const expectedVisibleCount = isD9Blocked || eligiblePoolCount < 2
    ? 0
    : eligiblePoolCount === 2
      ? 2
      : 3;

  failUnless(Number.isInteger(eligiblePoolCount) && eligiblePoolCount >= 0, `${label} eligible pool count is invalid`);
  failUnless(["ACTIVE", "UNKNOWN", "CLEARED"].includes(fixture.d9Status), `${label} D9 status is invalid`);
  failUnless(candidates.length === expectedVisibleCount, `${label} visible candidate count must be ${expectedVisibleCount}`);
  failUnless(fixture.rangeNarrowed === false, `${label} must not narrow a ranged example`);
  failUnless(fixture.catalogActivation === false, `${label} must not activate the catalog`);

  if (fixture.d9Status === "ACTIVE" || fixture.d9Status === "UNKNOWN") {
    const expectedState = fixture.d9Status === "ACTIVE"
      ? "BLOCKED_BY_D9_ACTIVE"
      : "BLOCKED_BY_D9_UNKNOWN";
    failUnless(fixture.state === expectedState, `${label} D9 state must short-circuit`);
    failUnless(candidates.length === 0, `${label} D9 block must contain zero candidates`);
    failUnless(fixture.personalDraft == null, `${label} D9 block must not create a personal draft`);
    failUnless(fixture.confirmations == null, `${label} D9 block must not record draft confirmations`);
  } else if (eligiblePoolCount < 2) {
    failUnless(
      fixture.state === "INSUFFICIENT_ELIGIBLE_CANDIDATES",
      `${label} insufficient pool must fail closed`,
    );
    failUnless(candidates.length === 0, `${label} insufficient result must not pad candidates`);
  } else {
    failUnless(
      fixture.state === "ADVISORY_CANDIDATES_READY" || fixture.state === "PERSONAL_DRAFT_CREATED",
      `${label} eligible pool must use a successful advisory state`,
    );
  }

  for (const candidate of candidates) {
    failUnless(allowedSourceTiers.has(candidate.sourceTier), `${label} contains a forbidden source tier`);
    failUnless(typeof candidate.candidateId === "string"
      && identifierPattern.test(candidate.candidateId), `${label} candidate id is invalid`);
    failUnless(candidate.nonExecutable === true, `${label} candidate must be non-executable`);
    failUnless(candidate.authority === false, `${label} candidate must have no authority`);
    failUnless(Array.isArray(candidate.sourceRefs) && candidate.sourceRefs.length > 0
      && candidate.sourceRefs.every(isValidSourceRef), `${label} structured source refs required`);
  }
  failUnless(
    new Set(candidates.map((candidate) => candidate.candidateId)).size === candidates.length,
    `${label} candidate ids must be unique`,
  );

  if (fixture.usesJournal === true) {
    const projection = fixture.journalProjection ?? {};
    failUnless(projection.confirmed === true, `${label} journal projection must be confirmed`);
    failUnless(isNormalizedEventIdentity(projection.eventIdentity), `${label} normalized event identity required`);
    failUnless(isValidDate(projection.eventDate), `${label} valid event date required`);
    failUnless(isNormalizedPerformance(projection.performance), `${label} normalized performance required`);
    failUnless(projection.rawTextUsed === false, `${label} raw journal text must not be used`);
    failUnless(isSameEvent(projection.eventIdentity, fixture.targetEventIdentity), `${label} journal comparison must be same-event`);
  }

  if (fixture.state === "PERSONAL_DRAFT_CREATED") {
    const confirmations = Array.isArray(fixture.confirmations) ? fixture.confirmations : [];
    const eventTypes = new Set(confirmations.map((entry) => entry.eventType));
    const eventIds = new Set(confirmations.map((entry) => entry.confirmationEventId));
    failUnless(confirmations.length === 2, `${label} requires exactly two confirmation records`);
    failUnless(confirmations.every((entry) => typeof entry.confirmationEventId === "string"
      && identifierPattern.test(entry.confirmationEventId)),
      `${label} confirmation event ids must be valid`);
    failUnless(eventTypes.has("ADVISORY_CANDIDATE_ACKNOWLEDGED"), `${label} acknowledgement confirmation missing`);
    failUnless(eventTypes.has("PERSONAL_DRAFT_CREATION_CONFIRMED"), `${label} draft confirmation missing`);
    failUnless(eventIds.size === 2, `${label} confirmation event ids must be distinct`);
    const draft = fixture.personalDraft ?? {};
    failUnless(candidates.some((entry) => entry.candidateId === draft.sourceCandidateId), `${label} draft candidate must be visible`);
    const acknowledgement = confirmations.find(
      (entry) => entry.eventType === "ADVISORY_CANDIDATE_ACKNOWLEDGED",
    );
    const creation = confirmations.find(
      (entry) => entry.eventType === "PERSONAL_DRAFT_CREATION_CONFIRMED",
    );
    failUnless(
      acknowledgement?.candidateId === draft.sourceCandidateId,
      `${label} acknowledgement candidate must match the draft source`,
    );
    failUnless(
      creation?.selectedCandidateId === draft.sourceCandidateId,
      `${label} selected candidate must match the draft source`,
    );
    failUnless(draft.nonExecutable === true && draft.authority === false, `${label} personal draft must be inert`);
    for (const field of ["maySubmitValidation", "mayWriteCalendar", "mayExecuteSession", "mayApplyPlan"]) {
      failUnless(draft[field] === false, `${label} personal draft ${field} must be false`);
    }
  } else {
    failUnless(fixture.personalDraft == null, `${label} non-draft state must not create a personal draft`);
    failUnless(fixture.confirmations == null, `${label} non-draft state must not record draft confirmations`);
  }
}

const blocks = catalog
  .split(/\n(?=- templateId: )/u)
  .filter((block) => block.startsWith("- templateId: "));
failUnless(blocks.length === 30, `catalog must contain exactly 30 entries, got ${blocks.length}`);

const sourceCounts = new Map([...expectedSourceCounts.keys()].map((tier) => [tier, 0]));
const recordsById = new Map();
let runtimeCandidateCount = 0;
for (const block of blocks) {
  const templateId = block.match(/^- templateId: ([^\r\n]+)/mu)?.[1] ?? "MISSING";
  const sourceTier = getField(block, "sourceVerificationStatus");
  if (templateId === "LT-SEED-03") {
    failUnless(sourceTier === "SOURCE_ADAPTED", "LT-SEED-03 must remain SOURCE_ADAPTED: miles are not 1600m");
    failUnless(getField(block, "transferLimitations").includes("4 x 1 mile, not 4 x 1600m"), "LT-SEED-03 must disclose the source distance adaptation");
  }
  failUnless(expectedSourceCounts.has(sourceTier), `${templateId} has unknown source tier ${sourceTier}`);
  if (sourceCounts.has(sourceTier)) sourceCounts.set(sourceTier, sourceCounts.get(sourceTier) + 1);
  if (templateId === "V2-SEED-05") {
    failUnless(getField(block, "version") === '"1.0.0"', `${templateId} version must remain 1.0.0`);
    failUnless(getField(block, "lifecycleStatus") === "ACTIVE", `${templateId} must remain ACTIVE`);
    failUnless(getField(block, "eligibilityStatus") === "ELIGIBLE", `${templateId} must remain ELIGIBLE`);
    failUnless(block.includes("allowedEventGroups: [FIVE_K]"), `${templateId} event eligibility must remain FIVE_K`);
    failUnless(block.includes("allowedExperienceBands: [EXPERIENCED]"), `${templateId} experience eligibility must remain EXPERIENCED`);
    runtimeCandidateCount += 1;
  } else {
    failUnless(getField(block, "lifecycleStatus") === "DRAFT", `${templateId} must remain DRAFT`);
    failUnless(getField(block, "eligibilityStatus") === "REVIEW_REQUIRED", `${templateId} must require review`);
    failUnless(block.includes("allowedEventGroups: []"), `${templateId} event eligibility must remain empty`);
    failUnless(block.includes("allowedExperienceBands: []"), `${templateId} experience eligibility must remain empty`);
  }
  const notation = getField(block, "notationPattern");
  if (notation.includes("~")) {
    failUnless(getField(block, "machineNotation") === "null", `${templateId} ranged notation must remain unresolved`);
  }
  recordsById.set(templateId, { sourceTier });
}

for (const [tier, expectedCount] of expectedSourceCounts) {
  failUnless(sourceCounts.get(tier) === expectedCount, `${tier} must contain exactly ${expectedCount} entries`);
}
failUnless(runtimeCandidateCount === 1, `catalog must contain exactly one runtime candidate, got ${runtimeCandidateCount}`);
failUnless(catalog.includes("activation: ACTIVE_ONLY_WITH_TRUSTED_MANIFEST"), "V2-SEED-05 trusted manifest boundary is missing");
failUnless(catalog.includes("automatic_plan_binding: V2_SEED_05_REQUIRES_TRUSTED_MANIFEST_AND_ALL_GATES"), "V2-SEED-05 runtime gate boundary is missing");

const previewSection = catalog.match(/research_preview_groups:\r?\n([\s\S]*?)research_preview_group_invariants:/u)?.[1] ?? "";
const previewIds = [...previewSection.matchAll(/templateIds: \[([^\]]+)\]/gu)]
  .flatMap((match) => match[1].split(",").map((value) => value.trim()));
failUnless(previewIds.length === 6, "catalog must define exactly six preview ids");
failUnless(new Set(previewIds).size === 6, "catalog preview ids must be unique");
for (const previewId of previewIds) {
  failUnless(recordsById.has(previewId), `preview id ${previewId} must exist`);
  failUnless(allowedSourceTiers.has(recordsById.get(previewId)?.sourceTier), `preview id ${previewId} has forbidden source tier`);
}
for (const marker of ["RESEARCH-PREVIEW-LT-001", "RESEARCH-PREVIEW-VO2-001", "RESEARCH-PREVIEW-GLY-001"]) {
  failUnless(catalog.includes(marker), `catalog missing preview group ${marker}`);
}

for (const marker of [
  "source_visible_research_records: 15",
  "current_catalog_runtime_candidates: 1",
  "catalog_eligibility_bypass: forbidden",
  "runtime_candidates_from_preview_groups: 0",
]) {
  failUnless(catalog.includes(marker), `catalog missing advisory boundary ${marker}`);
}
for (const state of requiredStates) failUnless(contract.includes(state), `contract missing state ${state}`);
for (const marker of [
  "success_candidate_count: exactly_2_or_3",
  "blocked_candidate_count: exactly_0",
  "insufficient_candidate_count: exactly_0",
  "source_filter_before_count_ranking_explanation: true",
  "raw_free_text_to_external_llm: forbidden",
  "cross_event_conversion: forbidden",
  "current_capability_inference: forbidden",
  "distinct_confirmation_event_types: 2",
  "personal_draft_nonExecutable: true",
  "runtime_authority: false",
  "UserConfirmedJournalProjection",
  "selectedCandidateId: string",
]) {
  failUnless(contract.includes(marker), `contract missing advisory boundary ${marker}`);
}

const fixtureMatches = [...contract.matchAll(
  /<!-- ADVISORY_TEST_FIXTURE\r?\n([\s\S]*?)\r?\nADVISORY_TEST_FIXTURE_END -->/gu,
)];
for (const [index, match] of fixtureMatches.entries()) {
  try {
    validateFixture(JSON.parse(match[1]), index);
  } catch (error) {
    failures.push(`fixture ${index + 1} is not valid JSON: ${error.message}`);
  }
}

requireFinalMarker(catalog, "catalog");
requireFinalMarker(contract, "contract");

if (failures.length > 0) {
  for (const failure of failures) console.error(`FAIL ${failure}`);
  process.exitCode = 1;
} else {
  console.log(
    "advisory recommender validation passed: "
      + "currentCatalogRuntimeCandidates=1 advisoryCandidates=0 "
      + "sourceVisible=15 runtimeAuthority=false",
  );
}
