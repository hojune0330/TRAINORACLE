import { readFile } from "node:fs/promises";

const expectedPrs = [
  93, 98, 99, 101, 102, 103, 104, 105, 107, 108, 110, 111, 114, 115, 121, 122, 126, 130,
];
const terminalStatuses = new Set([
  "CLOSED_SUPERSEDED",
  "CLOSED_REPLACED",
  "CLOSED_DUPLICATE_IMPLEMENTATION",
  "MERGED_AS_RECONCILED",
]);
const pendingStatuses = new Set(["PENDING_REBUILD_WITH_SUCCESSOR_TASK"]);

function fail(message) {
  process.stderr.write(message + "\n");
  process.exitCode = 1;
}

function tableRows(text) {
  return [...text.matchAll(/^\| #(\d+) \| ([A-Z_]+) \| (.*?) \|/gmu)].map((match) => ({
    pr: Number(match[1]),
    status: match[2],
    successor: match[3],
  }));
}

const reportPath = process.argv[2] ?? new URL("../../reports/review/REMAINING_OPEN_PR_RECONCILIATION_2026-07-29.md", import.meta.url);
const text = await readFile(reportPath, "utf8");
const nonEmptyLines = text.split(/\r?\n/u).filter((line) => line.trim() !== "");

if (nonEmptyLines.at(-1) !== "[DRAFT_COMPLETE]") {
  fail("final marker must be the final non-empty line");
} else if (!/^\s*backend_code_harvested: false$/mu.test(text)) {
  fail("backend code harvest is forbidden");
} else {
  const rows = tableRows(text);
  const counts = new Map();
  for (const row of rows) counts.set(row.pr, (counts.get(row.pr) ?? 0) + 1);

  let valid = true;
  for (const pr of expectedPrs) {
    const count = counts.get(pr) ?? 0;
    if (count === 0) {
      fail("missing legacy PR #" + pr);
      valid = false;
    } else if (count > 1) {
      fail("duplicate legacy PR #" + pr);
      valid = false;
    }
  }

  for (const row of rows) {
    if (!expectedPrs.includes(row.pr)) {
      fail("unexpected legacy PR #" + row.pr);
      valid = false;
    }
    if (terminalStatuses.has(row.status)) {
      if (!/^successor: (PR #\d+|main@|this reconciliation PR)/u.test(row.successor)) {
        fail("terminal disposition for PR #" + row.pr + " must record a successor");
        valid = false;
      }
    } else if (pendingStatuses.has(row.status)) {
      if (!/^successorTask: Task (4|9)$/u.test(row.successor)) {
        fail("pending rebuild for PR #" + row.pr + " must record a successor task");
        valid = false;
      }
    } else {
      fail("invalid disposition for PR #" + row.pr);
      valid = false;
    }
  }

  const terminalCount = rows.filter((row) => terminalStatuses.has(row.status)).length;
  const pendingCount = rows.filter((row) => pendingStatuses.has(row.status)).length;
  if (valid && rows.length === expectedPrs.length && terminalCount === 16 && pendingCount === 2) {
    process.stdout.write(
      "legacyPrCount=" + rows.length +
      " terminalDispositionCount=" + terminalCount +
      " pendingRebuildCount=" + pendingCount + "\n",
    );
  } else if (valid) {
    fail("legacy PR disposition counts are invalid");
  }
}
