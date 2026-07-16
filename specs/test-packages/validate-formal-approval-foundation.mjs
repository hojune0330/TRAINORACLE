#!/usr/bin/env node

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const SOURCE_SHA = "a6857bcdcd9f2989799c505f52773256ce492e14";
const EXPECTED_MANIFEST_SHA =
  "ee59d262f1efdaa39a251203d27c42cc0426fcbdc8593c69a9e985699059c800";
const EVIDENCE = Object.freeze([
  [
    ".omo/evidence/work-order-010/verification.md",
    "8aae4275665eab893308a390d360235a524878d76b74a1d8ae345fe8363d7563",
  ],
  [
    "FORMATION_RESEARCH_ACCEPTANCE_DECISION.md",
    "72fb2d09fe628338749c03c54b0a40abbb5fa1b1f9c5da8ff0186e8ae9747483",
  ],
  [
    "reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md",
    "92407b992b216b354498f8602d9e09a50382119ee9dbdc70a8e55901ea5d8603",
  ],
  [
    "reports/research/RACE_DESCRIPTIVE_ANALYSIS_REVIEW.md",
    "1a58bb37d8c5f2c9c6facea12754bbcd750f04cb97b2cf5eaf4c22f666bcf8fc",
  ],
  [
    "reports/review/QUICK_LOG_PRESET_RESEARCH.md",
    "d4cc8d62649db7e70996e21a1924e7bfd56963c59f4f7b4f8e59171a3ac433f2",
  ],
  [
    "specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md",
    "bb7a8a0783b8ce437da9907b6eca64b3e93b210657380b92bf08d3c2ed205008",
  ],
  [
    "specs/reconstruct/METRIC_ALGORITHM_CONTRACT.md",
    "5f8e695d62ca3225fe5795d4093bb6c655382253fcc806d0fbede5b2269e4fc7",
  ],
  [
    "specs/test-packages/FORMATION_RESEARCH_CALCULATION_FIXTURES.md",
    "1e92dae1bf0f9e287438d50a841fce4c890812b931ec0035019136a53d7dd2f7",
  ],
]);

const REQUIRED_DOCUMENTS = Object.freeze({
  "reports/review/FORMATION_FORMAL_APPROVAL_ROSTER.md": [
    "actual_approver_count: 0",
    "enrolled_key_count: 0",
    "all_authority: false",
    "policy_acceptance: false",
    "`NOT_REVIEWED` | `UNASSIGNED` | `NOT_ENROLLED`",
    "AI/persona review is not an independent human review",
  ],
  "reports/review/WO010_STRICT_REACCEPTANCE_HANDOFF.md": [
    "current_decision: NOT_ACCEPTED",
    "owner_response: NOT_REVIEWED",
    "independent_human_response: NOT_REVIEWED",
    "actual_approval_count: 0",
    "runtime_authority: false",
    `source_main_sha: ${SOURCE_SHA}`,
    `evidence_manifest_sha256: ${EXPECTED_MANIFEST_SHA}`,
  ],
  "specs/reconstruct/EVIDENCE_MANIFEST_AND_SIGNATURE_CONTRACT.md": [
    "trusted_key_count: 0",
    "all_authority: false",
    "normalize to NFC",
    "ASCII TAB",
    "MUST NOT appear in that same manifest",
    "proof-of-possession challenge signature",
    "supersedesRecordSha256",
    "APPROVE_WITH_REQUIRED_CHANGES` cannot be promoted automatically",
  ],
});

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function fail(message) {
  throw new Error(`FORMAL_APPROVAL_FOUNDATION_INVALID: ${message}`);
}

function readNfc(path) {
  const bytes = readFileSync(path);
  const text = bytes.toString("utf8");
  if (Buffer.from(text, "utf8").compare(bytes) !== 0) fail(`${path}: invalid UTF-8`);
  if (text !== text.normalize("NFC")) fail(`${path}: content is not NFC`);
  return { bytes, text };
}

function readSourceBlob(path) {
  const result = spawnSync("git", ["show", `${SOURCE_SHA}:${path}`], {
    encoding: "buffer",
    maxBuffer: 4 * 1024 * 1024,
  });
  if (result.status !== 0) fail(`${path}: missing from source SHA`);
  const text = result.stdout.toString("utf8");
  if (Buffer.from(text, "utf8").compare(result.stdout) !== 0) {
    fail(`${path}: source blob is invalid UTF-8`);
  }
  if (text !== text.normalize("NFC")) fail(`${path}: source blob is not NFC`);
  return result.stdout;
}

function verifyDocuments() {
  for (const [path, markers] of Object.entries(REQUIRED_DOCUMENTS)) {
    const { text } = readNfc(path);
    for (const marker of markers) {
      if (!text.includes(marker)) fail(`${path}: missing ${marker}`);
    }
  }
}

function verifySourceIsMergedMain() {
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", SOURCE_SHA, "origin/main"],
    { encoding: "utf8" },
  );
  if (result.status !== 0) fail("source SHA is not reachable from origin/main");
}

function verifyManifest() {
  const paths = EVIDENCE.map(([path]) => path);
  const sorted = [...paths].sort((left, right) =>
    left < right ? -1 : left > right ? 1 : 0,
  );
  if (paths.join("\n") !== sorted.join("\n")) fail("manifest paths are not sorted");
  if (new Set(paths).size !== paths.length) fail("manifest has duplicate paths");

  const handoff = readNfc("reports/review/WO010_STRICT_REACCEPTANCE_HANDOFF.md").text;

  for (const [path, expectedHash] of EVIDENCE) {
    if (path !== path.normalize("NFC") || path.includes("\\") || path.startsWith("/")) {
      fail(`${path}: noncanonical path`);
    }
    const sourceBlob = readSourceBlob(path);
    if (sha256(sourceBlob) !== expectedHash) fail(`${path}: evidence hash mismatch`);
    if (!handoff.includes(`| \`${path}\` | \`${expectedHash}\` |`)) {
      fail(`${path}: handoff manifest row mismatch`);
    }
  }

  const canonical = `${EVIDENCE.map(([path, hash]) => `${path}\t${hash}`).join("\n")}\n`;
  if (sha256(Buffer.from(canonical, "utf8")) !== EXPECTED_MANIFEST_SHA) {
    fail("canonical manifest digest mismatch");
  }
}

function verifyNonCircularity() {
  const forbidden = [
    "WO010_STRICT_REACCEPTANCE_HANDOFF.md",
    "ACCEPTANCE_RECORD",
    "SIGNATURE",
    "TRUSTED_KEY",
    "QUALIFICATION",
    "CONFLICT",
  ];
  for (const [path] of EVIDENCE) {
    if (forbidden.some((token) => path.toUpperCase().includes(token))) {
      fail(`${path}: circular evidence class`);
    }
  }
}

function verifyNoApprovalMaterialized() {
  const roster = readNfc("reports/review/FORMATION_FORMAL_APPROVAL_ROSTER.md").text;
  const handoff = readNfc("reports/review/WO010_STRICT_REACCEPTANCE_HANDOFF.md").text;
  if ((roster.match(/\| `NOT_REVIEWED` \|/g) ?? []).length !== 6) {
    fail("every WO010-015 roster row must remain NOT_REVIEWED");
  }
  if (!handoff.includes("Until then WO010 remains `NOT_ACCEPTED`")) {
    fail("WO010 fail-closed statement missing");
  }
  if (/signatureBase64:\s*[A-Za-z0-9+/=]+/.test(`${roster}\n${handoff}`)) {
    fail("a signature was materialized in the handoff packet");
  }
  const allFoundationText = Object.keys(REQUIRED_DOCUMENTS)
    .map((path) => readNfc(path).text)
    .join("\n");
  if (/\b(?:all|runtime|policy|prescription)_authority:\s*true\b/.test(allFoundationText)) {
    fail("foundation materialized authority=true");
  }
}

verifyDocuments();
verifySourceIsMergedMain();
verifyManifest();
verifyNonCircularity();
verifyNoApprovalMaterialized();
console.log(
  `PASS formal approval foundation: evidence=${EVIDENCE.length} ` +
    "approvals=0 keys=0 authority=false wo010=NOT_ACCEPTED",
);
