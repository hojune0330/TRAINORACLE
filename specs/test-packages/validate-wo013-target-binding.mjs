import assert from "node:assert/strict"
import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"

const root = resolve(import.meta.dirname, "../..")
const fixturePath = resolve(root, "specs/test-packages/CALENDAR_SYNC_CONCURRENCY_FIXTURE_PLAN.md")
const planPath = resolve(root, "reports/review/WO013_REPOSITORY_TARGET_BINDING_PLAN.md")

const fixtureText = readFileSync(fixturePath, "utf8")
const planText = readFileSync(planPath, "utf8")

const yamlFixtureIds = [...fixtureText.matchAll(/^\s*(?:- )?id:\s*([A-Z]+-\d{2})\s*$/gm)].map((match) => match[1])
const headingFixtureIds = [...fixtureText.matchAll(/^### ([A-Z]+-\d{2})\b/gm)].map((match) => match[1])
const fixtureIds = [...headingFixtureIds, ...yamlFixtureIds]
const mappingRows = [...planText.matchAll(/^\| `([A-Z]+-\d{2})` \| `([^`]+)` \| `([^`]+)` \| `([^`]+)` \|$/gm)]
const mappedIds = mappingRows.map((match) => match[1])

assert.equal(fixtureIds.length, 36, "source fixture pack must contain exactly 36 fixture IDs")
assert.equal(new Set(fixtureIds).size, 36, "source fixture IDs must be unique")
assert.equal(mappedIds.length, 36, "target plan must contain exactly 36 mapping rows")
assert.equal(new Set(mappedIds).size, 36, "target plan mapping IDs must be unique")
assert.deepEqual([...mappedIds].sort(), [...fixtureIds].sort(), "every fixture must map exactly once")

const allowedStatuses = new Set(["CURRENT_LOCAL", "FUTURE_EXISTING_SEAM", "NO_TARGET_YET"])
for (const row of mappingRows) {
  const [, fixtureId, target, status, patchStage] = row
  assert.ok(allowedStatuses.has(status), `${fixtureId}: invalid target status ${status}`)
  assert.match(patchStage, /^P[1-8]$/, `${fixtureId}: patch stage must be P1 through P8`)
  if (status === "NO_TARGET_YET") {
    assert.equal(target, "NO_TARGET_YET", `${fixtureId}: absent implementation must be explicit`)
  } else {
    assert.notEqual(target, "NO_TARGET_YET", `${fixtureId}: existing target status needs a path`)
    assert.ok(existsSync(resolve(root, target)), `${fixtureId}: target path does not exist: ${target}`)
  }
}

const requiredSections = [
  "## Boundary And Authority",
  "## Typed Target Shapes",
  "## Patch Order",
  "## Fixture Target Matrix",
  "## Current Seams",
  "## Deferred Decisions",
]
for (const heading of requiredSections) {
  assert.ok(planText.includes(heading), `missing section: ${heading}`)
}

const requiredCoverage = [
  "typed identity", "RFC 8785", "compare-and-swap", "subscription", "offline conflict",
  "tombstone", "key erasure", "DST", "DOUBLE", "FLEX", "outbox", "rollback", "tenant boundary",
]
for (const phrase of requiredCoverage) {
  assert.ok(planText.toLowerCase().includes(phrase.toLowerCase()), `missing required coverage: ${phrase}`)
}

const forbiddenAuthority = [
  /backend:\s*(postgres|firebase|supabase|sqlite)/i,
  /database:\s*(postgres|mysql|sqlite)/i,
  /migration:\s*(approved|authorized|execute)/i,
  /schema_authority:\s*true/i,
  /runtime_authority:\s*true/i,
]
for (const pattern of forbiddenAuthority) {
  assert.doesNotMatch(planText, pattern, `target plan must not create implementation authority: ${pattern}`)
}

const currentCount = mappingRows.filter((row) => row[3] === "CURRENT_LOCAL").length
const futureCount = mappingRows.filter((row) => row[3] === "FUTURE_EXISTING_SEAM").length
const absentCount = mappingRows.filter((row) => row[3] === "NO_TARGET_YET").length

console.log(`WO013 target binding PASS fixtures=${mappedIds.length} current=${currentCount} future=${futureCount} noTarget=${absentCount}`)
