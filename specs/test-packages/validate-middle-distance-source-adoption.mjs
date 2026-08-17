import { readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
const packetPath = process.argv[2] ?? resolve(
  root,
  "reports/review/MIDDLE_DISTANCE_SOURCE_ADOPTION_PACKET_2026-08-17.md",
)
const packet = readFileSync(packetPath, "utf8")
const failures = []
const failUnless = (condition, message) => {
  if (!condition) failures.push(message)
}
const blocks = packet
  .split(/\n(?=- templateId: )/u)
  .filter((block) => block.startsWith("- templateId: "))

const expected = new Map([
  ["MD-800-01", {
    eventDistanceM: 800,
    notation: "10×200m @800m RP · r60″ STAND",
    repetitions: 10,
    qualityDistanceM: 2000,
    recoveryOccurrences: 9,
    recoveryTotalSeconds: 540,
    source: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8363530/",
  }],
  ["MD-1500-01", {
    eventDistanceM: 1500,
    notation: "3×500m @1500m RP · r180″ STAND",
    repetitions: 3,
    qualityDistanceM: 1500,
    recoveryOccurrences: 2,
    recoveryTotalSeconds: 360,
    source: "https://worldathletics.org/personal-best/performance/speed-training-endurance-runners-benefits-limits",
  }],
  ["MD-3000-01", {
    eventDistanceM: 3000,
    notation: "4×800m @3000m RP · r180″ WALK",
    repetitions: 4,
    qualityDistanceM: 3200,
    recoveryOccurrences: 3,
    recoveryTotalSeconds: 540,
    source: "https://pmc.ncbi.nlm.nih.gov/articles/PMC8363530/",
  }],
])
const populationMarkers = packet.match(
  /populationApplicability: YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH/g,
) ?? []
failUnless(populationMarkers.length === 4,
  `populationApplicability must match in shared contract and all three templates, got ${populationMarkers.length}`)

failUnless(blocks.length === 3, `packet must contain exactly three templates, got ${blocks.length}`)
const seenEvents = new Set()
for (const block of blocks) {
  const id = block.match(/^- templateId: ([^\r\n]+)/mu)?.[1] ?? "MISSING"
  const record = expected.get(id)
  failUnless(record !== undefined, `unexpected templateId ${id}`)
  if (record === undefined) continue
  seenEvents.add(record.eventDistanceM)
  for (const marker of [
    "lifecycleStatus: DRAFT",
    "eligibilityStatus: REVIEW_REQUIRED",
    "sourceAdoptionStatus: ACCEPTED_AS_WORKING_SOURCE",
    "runtimeActivationAuthorized: false",
    "candidateEventGroup: MIDDLE_DISTANCE",
    `targetEventDistanceM: ${record.eventDistanceM}`,
    `machineNotation: "${record.notation}"`,
    `totalRepetitions: ${record.repetitions}`,
    `qualityDistanceM: ${record.qualityDistanceM}`,
    `repetitionRecoveryOccurrences: ${record.recoveryOccurrences}`,
    `repetitionRecoveryTotalSeconds: ${record.recoveryTotalSeconds}`,
    `sourceUrl: "${record.source}"`,
    "allowedExperienceBands: [EXPERIENCED]",
    "populationApplicability: YOUTH_AND_ADULT_SAME_CRITERIA_NO_AGE_DOSE_BRANCH",
    "anchorRequirements: [CURRENT, SAME_EVENT, CURRENT_CAPABILITY, EXPLICIT_SELECTION]",
    "warmupComponent: WU-MD-01@1.0.0",
    "cooldownComponent: CD-MD-01@1.0.0",
    "fallbackComponent: RPE-ONLY-CONTROLLED-01@1.0.0",
    "stopConditionComponent: STOP-MD-01@1.0.0",
    "numericReducedRepetitionVariant: null",
    "observedSourceProtocol:",
    "trainOracleOperationalAdaptation:",
    "transferLimitations:",
  ]) failUnless(block.includes(marker), `${id} missing ${marker}`)
}
failUnless(seenEvents.size === 3, "packet must select exactly one template for each 800/1500/3000 event")
failUnless(!packet.includes("lifecycleStatus: ACTIVE"), "source adoption must not activate runtime templates")
failUnless(!packet.includes("targetEventDistanceM: 100\n")
  && !packet.includes("targetEventDistanceM: 200\n")
  && !packet.includes("targetEventDistanceM: 400\n"), "100-400 m event prescription must remain deferred")
const markers = packet.match(/^\[DRAFT_COMPLETE\]$/gmu) ?? []
failUnless(markers.length === 1, "packet must contain exactly one final marker")
failUnless(packet.trimEnd().endsWith("[DRAFT_COMPLETE]"), "final marker must be last")

if (failures.length > 0) {
  for (const failure of failures) console.error(failure)
  process.exitCode = 1
} else {
  console.log("middle-distance source adoption validation passed: 3 source-accepted drafts, 0 runtime-active")
}
