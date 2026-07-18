import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../..");
const rawPath = resolve(root, ".omo/evidence/formation-research-v2/existing-citation-audit.md");
const raw = readFileSync(rawPath, "utf8");
const outputDir = resolve(root, ".omo/evidence/formation-research-v2");
const firstLine = (text) => text.split(/\r?\n/, 1)[0].replace(/^\uFEFF/, "");
const sourceHeader = firstLine(readFileSync(resolve(root, "reports/research/evidence/FORMATION_SOURCE_LEDGER.csv"), "utf8")).split(",");
const auditHeader = firstLine(readFileSync(resolve(root, "reports/research/evidence/FORMATION_CITATION_AUDIT.csv"), "utf8")).split(",");

const csvCell = (value) => {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
const toCsv = (headers, rows) => `${headers.join(",")}\n${rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`;
const clean = (value) => String(value ?? "").trim();
const stripTicks = (value) => clean(value).replaceAll("`", "");

const sourceLines = raw
  .split(/\r?\n/)
  .filter((line) => /^\| `SRC-/.test(line));

function sourceType(citation) {
  const lowered = citation.toLowerCase();
  if (lowered.includes("systematic review") || lowered.includes("sr/ma") || lowered.includes("review/ma")) return "SYSTEMATIC_REVIEW_OR_META_ANALYSIS";
  if (lowered.includes("consensus")) return "CONSENSUS_STATEMENT";
  if (lowered.includes("guidance") || lowered.includes("guideline")) return "METHOD_GUIDANCE";
  if (lowered.includes("rct") || lowered.includes("random")) return "RANDOMIZED_OR_COMPARATIVE_PRIMARY";
  if (lowered.includes("cohort") || lowered.includes("cross-sectional")) return "OBSERVATIONAL_PRIMARY";
  if (lowered.includes("case")) return "CASE_OR_SINGLE_CASE";
  if (lowered.includes("review")) return "REVIEW";
  if (lowered.includes("methods")) return "METHODS_PAPER";
  return "PRIMARY_OR_OFFICIAL_SOURCE";
}

function webUrl(sourceId) {
  const known = new Map([
    ["SRC-WEB-HHS-HIPAA-DEID", "https://www.hhs.gov/hipaa/for-professionals/special-topics/de-identification/index.html"],
    ["SRC-WEB-PRISMA-2020", "https://www.prisma-statement.org/prisma-2020-statement"],
    ["SRC-WEB-COCHRANE-HB-CH14", "https://www.cochrane.org/authors/handbooks-and-manuals/handbook/current/chapter-14"],
  ]);
  return known.get(sourceId) ?? "";
}

const sourceRows = [];
const sourceAudit = new Map();
const identifierMap = new Map();
for (const line of sourceLines) {
  const [sourceCell, citation, population, rq, fundingOverlap, assessment] = line.split("|").slice(1, -1).map(clean);
  const sourceId = stripTicks(sourceCell);
  const title = citation.match(/\*([^*]+)\*/)?.[1] ?? citation.split(";")[0];
  const year = citation.match(/\((20\d{2}|19\d{2})(?:\/\d{4})?\)/)?.[1] ?? "NOT_REPORTED";
  const doi = citation.match(/DOI `([^`]+)`/i)?.[1] ?? "NOT_ASSIGNED";
  const pmid = sourceId.match(/^SRC-PMID-(\d+)$/)?.[1] ?? "NOT_ASSIGNED";
  const pmcid = citation.match(/PMCID `([^`]+)`/i)?.[1] ?? "NOT_ASSIGNED";
  const url = pmcid !== "NOT_ASSIGNED"
    ? `https://pmc.ncbi.nlm.nih.gov/articles/${pmcid}/`
    : pmid !== "NOT_ASSIGNED"
      ? `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`
      : webUrl(sourceId) || (doi !== "NOT_ASSIGNED" ? `https://doi.org/${doi}` : "UNRESOLVED");
  const corrected = /erratum|correction/i.test(citation);
  const fullTextState = corrected
    ? "RETRACTED_OR_CORRECTED"
    : /`PMC`|`WEB`|`PUB`/.test(citation)
      ? "FULL_TEXT_VERIFIED"
      : /`ABS`/.test(citation)
        ? "ABSTRACT_ONLY"
        : "METADATA_ONLY";
  const overlap = fundingOverlap.match(/`(OV-[^`]+)`/)?.[1] ?? "NONE_IDENTIFIED";
  const row = {
    source_id: sourceId,
    title,
    year,
    source_type: sourceType(citation),
    doi,
    pmid,
    pmcid,
    url,
    full_text_state: fullTextState,
    correction_state: corrected ? "CORRECTION_LINKED_AND_RECORDED" : "NO_LINKED_CORRECTION_OR_RETRACTION_FOUND",
    population,
    event: population,
    age_range: "NOT_REPORTED",
    sex: "NOT_REPORTED",
    maturity: "NOT_REPORTED",
    training_status: "NOT_REPORTED",
    rq_tags: stripTicks(rq).replaceAll(",", ";"),
    funding: fundingOverlap,
    conflicts: fundingOverlap,
    overlap_group: overlap,
    notes: assessment,
  };
  sourceRows.push(row);
  sourceAudit.set(sourceId, assessment);
  if (pmid !== "NOT_ASSIGNED") identifierMap.set(`PMID ${pmid}`.toLowerCase(), sourceId);
  if (pmcid !== "NOT_ASSIGNED") identifierMap.set(`PMCID ${pmcid}`.toLowerCase(), sourceId);
  if (doi !== "NOT_ASSIGNED") identifierMap.set(`DOI ${doi}`.toLowerCase(), sourceId);
}

const manualAliases = new Map([
  ["doi 10.1080/02640414.2023.2263522", "SRC-PMID-37776346"],
  ["bmj h1738", "SRC-PMID-25976398"],
  ["bmj h1793", "SRC-DOI-10.1136-BMJ.H1793"],
  ["hhs de-identification url", "SRC-WEB-HHS-HIPAA-DEID"],
  ["prisma 2020 official page", "SRC-WEB-PRISMA-2020"],
  ["bjsm 58/17/946", "SRC-PMID-39197945"],
  ["bjsm 57/17/1073", "SRC-PMID-37752011"],
  ["bjsm 55/6/305", "SRC-PMID-33122252"],
  ["cochrane handbook ch. 14", "SRC-WEB-COCHRANE-HB-CH14"],
]);
for (const [key, value] of manualAliases) identifierMap.set(key, value);

const fileMap = new Map([
  ["R", "reports/research/FORMATION_SPORTS_SCIENCE_EVIDENCE_REVIEW.md"],
  ["C", "specs/reconstruct/FORMATION_LOAD_AND_STATISTICAL_RULES_CONTRACT.md"],
  ["D", ".omo/drafts/formation-followup-deep-research.md"],
  ["M", ".omo/drafts/formation-followup-source-map.md"],
]);
const occurrenceLines = raw
  .split(/\r?\n/)
  .filter((line) => /^\| (?:DOI|PMID|PMCID|HHS|BMJ|PRISMA|BJSM|Cochrane)/.test(line));
const auditRows = [];
for (const line of occurrenceLines) {
  const [keyCell, countCell, occurrencesCell] = line.split("|").slice(1, -1).map(clean);
  const rawKey = stripTicks(keyCell);
  const sourceId = identifierMap.get(rawKey.toLowerCase());
  if (!sourceId) throw new Error(`Unmapped citation key: ${rawKey}`);
  const assessment = sourceAudit.get(sourceId) ?? "UNRESOLVED";
  const auditState = /INCORRECT|BAD_LINK/.test(assessment) ? "INCORRECT" : /OVERSTATED|QUALIFY/.test(assessment) ? "OVERSTATED" : "VERIFIED";
  const occurrences = occurrencesCell.split(";").map(clean);
  if (occurrences.length !== Number(countCell)) throw new Error(`Count mismatch: ${rawKey}`);
  for (const occurrence of occurrences) {
    const [code, lineNumber] = occurrence.split(":");
    auditRows.push({
      occurrence_id: `EXISTING-${String(auditRows.length + 1).padStart(3, "0")}`,
      source_file: fileMap.get(code),
      source_line: lineNumber,
      raw_citation: rawKey,
      normalized_identity: sourceId,
      source_id: sourceId,
      audit_state: auditState,
      claim_assessment: assessment,
      notes: `Occurrence ${occurrence}; normalized by DOI/PMID/PMCID or official-page identity`,
    });
  }
}

if (sourceRows.length !== 53 || auditRows.length !== 75) {
  throw new Error(`Expected 53 sources/75 occurrences, found ${sourceRows.length}/${auditRows.length}`);
}
writeFileSync(resolve(outputDir, "existing-source-fragment.csv"), toCsv(sourceHeader, sourceRows));
writeFileSync(resolve(outputDir, "citation-audit-fragment.csv"), toCsv(auditHeader, auditRows));
console.log(`EXISTING_CITATION_FRAGMENTS_BUILT sources=${sourceRows.length} occurrences=${auditRows.length}`);
