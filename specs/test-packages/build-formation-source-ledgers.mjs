import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { parseCsv } from "./formation-csv.mjs";

const root = resolve(import.meta.dirname, "../..");
const evidenceDir = resolve(root, ".omo/evidence/formation-research-v2");
const outputDir = resolve(root, "reports/research/evidence");
const sourceHeader = parseCsv(
  readFileSync(resolve(outputDir, "FORMATION_SOURCE_LEDGER.csv"), "utf8"),
  "FORMATION_SOURCE_LEDGER.csv",
).headers;
const auditHeader = parseCsv(
  readFileSync(resolve(outputDir, "FORMATION_CITATION_AUDIT.csv"), "utf8"),
  "FORMATION_CITATION_AUDIT.csv",
).headers;

function csvCell(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(headers, rows) {
  return `${headers.join(",")}\n${rows.map((row) => headers.map((key) => csvCell(row[key])).join(",")).join("\n")}\n`;
}

const placeholders = new Set(["", "NOT_ASSIGNED", "NOT_APPLICABLE", "NOT_REPORTED", "NOT_VERIFIED", "UNRESOLVED"]);
const clean = (value) => String(value ?? "").trim();
const usable = (value) => !placeholders.has(clean(value).toUpperCase());
const normalized = (value) => clean(value).toLowerCase().replaceAll(/[^a-z0-9]+/g, "");

function identifiers(row) {
  const ids = [];
  if (usable(row.doi)) ids.push(`doi:${clean(row.doi).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "")}`);
  if (usable(row.pmid)) ids.push(`pmid:${normalized(row.pmid)}`);
  if (usable(row.pmcid)) ids.push(`pmcid:${normalized(row.pmcid)}`);
  if (usable(row.url)) ids.push(`url:${clean(row.url).toLowerCase().replace(/\/$/, "")}`);
  if (usable(row.title) && usable(row.year)) ids.push(`title:${normalized(row.title)}:${clean(row.year)}`);
  return ids;
}

const fragmentNames = readdirSync(evidenceDir)
  .filter((name) => name.endsWith("-source-fragment.csv"))
  .sort((left, right) => Number(!left.startsWith("existing-")) - Number(!right.startsWith("existing-")) || left.localeCompare(right));
const fragmentRows = fragmentNames.flatMap((name) =>
  parseCsv(readFileSync(resolve(evidenceDir, name), "utf8"), name).rows
    .map((row) => ({ ...row, _fragment: name })),
);

const parent = fragmentRows.map((_, index) => index);
const find = (index) => (parent[index] === index ? index : (parent[index] = find(parent[index])));
const union = (left, right) => {
  const leftRoot = find(left);
  const rightRoot = find(right);
  if (leftRoot !== rightRoot) parent[rightRoot] = leftRoot;
};
const identityIndex = new Map();
fragmentRows.forEach((row, index) => {
  for (const id of identifiers(row)) {
    if (identityIndex.has(id)) union(index, identityIndex.get(id));
    else identityIndex.set(id, index);
  }
});

const groups = new Map();
fragmentRows.forEach((row, index) => {
  const key = find(index);
  groups.set(key, [...(groups.get(key) ?? []), row]);
});

const stateRank = new Map([
  ["UNRESOLVED", 0],
  ["METADATA_ONLY", 1],
  ["ABSTRACT_ONLY", 2],
  ["FULL_TEXT_VERIFIED", 3],
  ["RETRACTED_OR_CORRECTED", 4],
]);
function normalizeState(value) {
  const state = clean(value).toUpperCase();
  if (stateRank.has(state)) return state;
  if (state.includes("CORRECT") || state.includes("RETRACT")) return "RETRACTED_OR_CORRECTED";
  if (state.includes("FULL_TEXT") || state.includes("PUBLIC_GUIDANCE")) return "FULL_TEXT_VERIFIED";
  if (state.includes("ABSTRACT")) return "ABSTRACT_ONLY";
  if (state.includes("METADATA")) return "METADATA_ONLY";
  return "UNRESOLVED";
}
const combinedFields = new Set(["rq_tags", "correction_state", "funding", "conflicts", "overlap_group", "notes"]);
const aliasMap = new Map();

function combineValues(rows, field) {
  return [...new Set(rows.map((row) => clean(row[field])).filter(Boolean))].join(" | ");
}

const sourceRows = [...groups.values()].map((rows) => {
  const preferred = rows.find((row) => row._fragment.startsWith("existing-")) ?? rows.toSorted((a, b) => a.source_id.localeCompare(b.source_id))[0];
  const output = {};
  for (const field of sourceHeader) {
    if (field === "source_id") output[field] = preferred.source_id;
    else if (field === "full_text_state") {
      output[field] = rows.map((row) => normalizeState(row[field])).toSorted((a, b) => stateRank.get(b) - stateRank.get(a))[0];
    } else if (combinedFields.has(field)) output[field] = combineValues(rows, field);
    else output[field] = rows.map((row) => clean(row[field])).find(usable) ?? rows.map((row) => clean(row[field])).find(Boolean) ?? "NOT_REPORTED";
  }
  for (const row of rows) aliasMap.set(row.source_id, output.source_id);
  return output;
}).toSorted((a, b) => a.source_id.localeCompare(b.source_id));

const auditNames = readdirSync(evidenceDir).filter((name) => name.endsWith("citation-audit-fragment.csv"));
const auditRows = auditNames.flatMap((name) =>
  parseCsv(readFileSync(resolve(evidenceDir, name), "utf8"), name).rows,
).map((row) => ({
  ...row,
  source_id: aliasMap.get(row.source_id) ?? row.source_id,
})).toSorted((a, b) => a.occurrence_id.localeCompare(b.occurrence_id));

const searchRows = readdirSync(evidenceDir)
  .filter((name) => name.endsWith("-search-rows.md"))
  .flatMap((name) => readFileSync(resolve(evidenceDir, name), "utf8").split(/\r?\n/))
  .filter((line) => /^\|\s*`?[^-]/.test(line) && !line.includes("Search ID") && !line.includes("Exact syntax"));
const accessRows = [
  "| `ACCESS-SPORTDISCUS` | RQ-A-G | SPORTDiscus | Authenticated database interface unavailable | 2026-07-17 | NOT_RUN | No export | ACCESS_RESTRICTED |",
  "| `ACCESS-SCOPUS` | RQ-A-G | Scopus | Authenticated database interface unavailable | 2026-07-17 | NOT_RUN | No export | ACCESS_RESTRICTED |",
  "| `ACCESS-WOS` | RQ-A-G | Web of Science | Authenticated database interface unavailable | 2026-07-17 | NOT_RUN | No export | ACCESS_RESTRICTED |",
  "| `ACCESS-COCHRANE` | RQ-A-G | Cochrane Library | No authenticated advanced-search export in this environment | 2026-07-17 | NOT_RUN | No export | ACCESS_RESTRICTED |",
];
const searchLog = `# Formation Search Log

\`\`\`yaml
protocol: TO-FORMATION-RESEARCH-V2-2026-07-17
status: SOURCE_AUDIT_COMPLETE
search_through: 2026-07-17
review_label: PRISMA-informed structured review
runtime_authority: false
\`\`\`

| Search ID | RQ | Database | Exact syntax | Run date | Results | Export/dedup | Access state |
|---|---|---|---|---|---:|---|---|
${[...new Set(searchRows), ...accessRows].join("\n")}

Search results are candidate evidence only until eligibility, extraction, and appraisal are complete.
Unavailable databases are recorded explicitly and are not silently replaced by web search.
`;

writeFileSync(resolve(outputDir, "FORMATION_SOURCE_LEDGER.csv"), toCsv(sourceHeader, sourceRows));
writeFileSync(resolve(outputDir, "FORMATION_CITATION_AUDIT.csv"), toCsv(auditHeader, auditRows));
writeFileSync(resolve(outputDir, "FORMATION_SEARCH_LOG.md"), searchLog);
console.log(`FORMATION_SOURCE_LEDGERS_BUILT fragments=${fragmentNames.length} sources=${sourceRows.length} occurrences=${auditRows.length} searches=${searchRows.length}`);
