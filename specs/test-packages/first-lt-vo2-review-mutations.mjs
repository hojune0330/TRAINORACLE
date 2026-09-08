import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { root } from "./first-lt-vo2-review.mjs"

const name = "FIRST-LV full packet validator accepts only current reproduced review material"
for (const defect of ["FIXED_PAIR", "DOSE", "SUPPORT", "UNKNOWN_ZERO", "BOUNDARY", "CONTEXT", "SOURCE", "AUTHORITY"]) {
  const result = spawnSync(process.execPath, ["--test", "--test-reporter=tap", `--test-name-pattern=${name}`,
    "specs/test-packages/first-lt-vo2-review.test.mjs"], {
    cwd: root, env: { ...process.env, FIRST_LV_MUTATION: defect }, encoding: "utf8", windowsHide: true,
  })
  assert.equal(result.status, 1, `${defect}: expected failing process`)
  assert.ok(result.stdout.includes(`not ok 1 - ${name}`), `${defect}: expected named failure, not loader error\n${result.stderr}`)
  console.log(`KILLED ${defect}: ${name}`)
}
