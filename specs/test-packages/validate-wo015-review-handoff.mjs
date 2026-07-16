import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const handoff = readFileSync(resolve("reports/review/WO015_PROJECTION_REVIEW_HANDOFF.md"), "utf8");
const roles = [
  "TOTAL_RESPONSIBILITY_HOLDER",
  "ATHLETE_REVIEW_PARTICIPANT",
  "COACH_OWNER",
  "QUALIFIED_PRIVACY_REVIEWER",
  "ACCESSIBILITY_REVIEWER",
];
for (const role of roles) assert.ok(handoff.includes(role), `missing review role ${role}`);
for (const marker of [
  "status: HANDOFF_READY_NOT_REVIEWED",
  "projection_accepted: false",
  "runtime_authority: false",
  "HANDOFF_ONLY_NO_ACCEPTANCE",
]) assert.ok(handoff.includes(marker), `missing marker ${marker}`);

for (const image of ["mobile-320.png", "mobile-375.png", "desktop.png", "zoom-200-reduced-motion.png"]) {
  assert.ok(existsSync(resolve("runtime-evidence/formation-projection", image)), `missing render ${image}`);
}

console.log("WO015 review handoff validation passed: roles=5 approvals=0 renders=4");
