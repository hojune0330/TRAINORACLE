import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"

const workflow = readFileSync(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8")

test("cancels an older Pages deployment when a newer deployment is ready", () => {
  assert.match(workflow, /group: trainoracle-pages\s+cancel-in-progress: true/u)
})

test("publishes only when the workflow source is still current main", () => {
  assert.match(workflow, /id: deployment-source[\s\S]*git fetch origin main/u)
  assert.match(workflow, /CURRENT_MAIN_SHA="\$\(git rev-parse origin\/main\)"/u)
  assert.match(workflow, /if: steps\.deployment-source\.outputs\.current == 'true'[\s\S]*name: Publish verified build to gh-pages/u)
})
