import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../..")
const sourceGatePath = ".omo/reports/personalized-prescription-source-gate-2026-08-23.md"
const catalogPath = "specs/reconstruct/ENERGY_SYSTEM_SESSION_TEMPLATE_CATALOG.md"
const sourceGateBytes = readFileSync(resolve(root, sourceGatePath))
const sourceGate = sourceGateBytes.toString("utf8").replace(/\r\n?/gu, "\n")
const catalog = readFileSync(resolve(root, catalogPath), "utf8").replace(/\r\n?/gu, "\n")

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function sourceRow(label) {
  const row = sourceGate.split("\n").find((line) => line.includes(label))
  if (row === undefined) throw new TypeError(`Source-gate row is missing: ${label}`)
  const bytes = Buffer.from(`${row}\n`, "utf8")
  return { extractionKind: "LF_NORMALIZED_EXACT_MARKDOWN_TABLE_ROW_WITH_FINAL_LF", sha256: sha256(bytes) }
}

function templateBlock(templateId) {
  const lines = catalog.split("\n")
  const start = lines.indexOf(`- templateId: ${templateId}`)
  if (start < 0) throw new TypeError(`Catalog template block is missing: ${templateId}`)
  const next = lines.findIndex((line, index) => index > start && (
    line.startsWith("- templateId: ") || line === "[DRAFT_COMPLETE]"
  ))
  const end = next < 0 ? lines.length : next
  const blockLines = lines.slice(start, end)
  while (blockLines.at(-1) === "") blockLines.pop()
  const bytes = Buffer.from(`${blockLines.join("\n")}\n`, "utf8")
  return { extractionKind: "LF_NORMALIZED_TEMPLATE_BLOCK_WITH_TRAILING_BLANKS_REMOVED_AND_FINAL_LF", sha256: sha256(bytes) }
}

const localDigests = {
  boullosa800Lead: sourceRow("Boullosa et al., 2021: 800 m race-pace workout response"),
  fentaw5000Lead: sourceRow("Fentaw et al., 2026: 5000 m HIIT randomized trial"),
  "V2-SEED-03": templateBlock("V2-SEED-03"),
  "V2-SEED-04": templateBlock("V2-SEED-04"),
  "GL-SEED-02": templateBlock("GL-SEED-02"),
}

const output = `${JSON.stringify({
  schemaVersion: 1,
  sourceGate: {
    path: sourceGatePath,
    rawBytesSha256: sha256(sourceGateBytes),
  },
  localDigests,
  reviews: [
    {
      lane: "COACHING_APPLICABILITY",
      reviewerId: "01a00a34-088f-75a0-95d0-3b7813f38e8e",
      verdict: "DO_NOT_APPROVE",
      additionsAuthorized: 0,
      strongestCandidates: [
        { eventDistanceM: 800, candidate: "BOULLOSA_800_LEAD", registeredTemplate: false, localDigest: localDigests.boullosa800Lead.sha256 },
        { eventDistanceM: 1500, candidate: "GL-SEED-02", registeredTemplate: true, localDigest: localDigests["GL-SEED-02"].sha256 },
        { eventDistanceM: 3000, candidate: "V2-SEED-03", registeredTemplate: true, localDigest: localDigests["V2-SEED-03"].sha256 },
        { eventDistanceM: 5000, candidate: "FENTAW_5000_LEAD", registeredTemplate: false, localDigest: localDigests.fentaw5000Lead.sha256 },
      ],
    },
    {
      lane: "SPORTS_SCIENCE_TRANSFER",
      reviewerId: "01a00a34-0f37-7d43-bcc5-4b2c0cb3dd2e",
      verdict: "DO_NOT_APPROVE",
      additionsAuthorized: 0,
      youthTransfer: "DO_NOT_APPROVE",
      femaleSexTransfer: "DO_NOT_APPROVE",
      strongestCandidates: [
        { eventDistanceM: 800, candidate: "V2-SEED-04", registeredTemplate: true, localDigest: localDigests["V2-SEED-04"].sha256 },
        { eventDistanceM: 1500, candidate: "GL-SEED-02", registeredTemplate: true, localDigest: localDigests["GL-SEED-02"].sha256 },
        { eventDistanceM: 3000, candidate: null, registeredTemplate: false, localDigest: null },
        { eventDistanceM: 5000, candidate: "V2-SEED-03", registeredTemplate: true, localDigest: localDigests["V2-SEED-03"].sha256 },
      ],
    },
  ],
  receiptComparison: {
    sameCandidateIdentityByEvent: { "800": false, "1500": true, "3000": false, "5000": false },
    independentReceiptDigestMatch: false,
    note: "The independent receipt digests were non-matching, including the 1500m catalog selection. No truncated or untrusted receipt digest was copied; local full digests above are independently recomputed by this script.",
  },
  outcome: {
    status: "DO_NOT_APPROVE",
    additionsAuthorized: 0,
    retainedTemplateIds: ["V2-SEED-05", "MD-800-01", "MD-1500-01", "MD-3000-01"],
    openGaps: [
      "NO_DUAL_MATCHING_UNCONDITIONAL_RECEIPTS",
      "YOUTH_TRANSFER_NOT_APPROVED_FOR_ADDITIONS",
      "FEMALE_SEX_TRANSFER_NOT_APPROVED_FOR_ADDITIONS",
      "UNREGISTERED_CANDIDATE_SOURCE_FOR_800_OR_5000_COACHING_LEADS",
      "NO_REGISTERED_3000_SPORTS_SCIENCE_CANDIDATE",
    ],
  },
}, null, 2)}\n`

if (process.argv[2] === undefined) {
  process.stdout.write(output)
} else {
  writeFileSync(resolve(root, process.argv[2]), output, "utf8")
}
