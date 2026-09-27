import assert from "node:assert/strict"
import { readFile, mkdir, writeFile } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import { resolve } from "node:path"
import { build } from "esbuild"

const app = fileURLToPath(new URL("../", import.meta.url))
async function api(mutation) {
  let replacements = 0
  const result = await build({ stdin: { contents: `export * from './src/domain/workout-preview-history'; export * from './src/domain/workout-tuning-v3';`, resolveDir: app, loader: "ts" },
    bundle: true, write: false, format: "esm", platform: "node", tsconfig: resolve(app, "tsconfig.json"), logLevel: "silent",
    plugins: mutation ? [{ name: "in-memory-defect", setup(b) {
      b.onLoad({ filter: /workout-(?:preview-history|tuning-v3)\.ts$/ }, async ({ path }) => {
        const original = await readFile(path, "utf8")
        if (!original.includes(mutation.from)) return null
        assert.equal(original.split(mutation.from).length - 1, 1, "mutation target must occur exactly once")
        replacements++
        return { contents: original.replace(mutation.from, mutation.to), loader: "ts", resolveDir: resolve(path, "..") }
      })
    } }] : [] })
  if (mutation) assert.equal(replacements, 1, "a missing mutation is not a passing rejection test")
  return import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString("base64")}`)
}
function snapshot(id, count, seconds = 60) {
  return { configuration: { familyId: "TEST_ONLY", configurationId: id, version: "1", contentIdentity: id },
    sequence: { kind: "PRESCRIPTION_SEQUENCE", version: 3, id, label: null, warmup: [], cooldown: [], main: [
      { kind: "segment", role: "WORK", id: "work", label: null, repeatCount: count,
        work: { kind: "duration", durationSeconds: 20, distanceM: null }, target: { kind: "EFFORT_GUIDANCE", cue: "TEST_ONLY" },
        recoveryBetweenRepeats: [{ mode: "WALK", seconds }], recoveryAfter: [] },
    ] } }
}
const checks = [
  { id: "history-cap", from: "WORKOUT_PREVIEW_HISTORY_LIMIT = 20", to: "WORKOUT_PREVIEW_HISTORY_LIMIT = 21", check(a) {
    let h = a.createWorkoutPreviewHistory(0)
    for (let i = 1; i <= 25; i++) h = a.pushWorkoutPreview(h, i)
    assert.equal(h.past.length, 20)
  } },
  { id: "rep-only-fake-variety", from: 'if (!result.some(existing => sameWorkoutMethodV3(existing.sequence, candidate.sequence)))', to: "if (true)", check(a) {
    assert.equal(a.distinctWorkoutMethodsV3([snapshot("A", 6), snapshot("B", 4)]).length, 1)
  } },
  { id: "numeric-direction", from: ".sort((a, b) => b.values[dimension]! - a.values[dimension]!)[0]", to: ".sort((a, b) => a.values[dimension]! - b.values[dimension]!)[0]", check(a) {
    assert.equal(a.buildWorkoutTuningStepsV3(snapshot("A", 6), [snapshot("B", 2), snapshot("C", 4)])[0].decrease.value, 4)
  } },
  { id: "unknown-not-zero", from: 'steps.every(s => !("distanceM" in s) && s.seconds !== null)', to: 'steps.every(s => !("distanceM" in s))', check(a) {
    assert.equal(a.workoutTuningValuesV3(snapshot("A", 6, null)).repeatRecovery, null)
  } },
  { id: "compound-repetition-unit", from: 'node.repeatUnit === "REPETITION" ? [measure(node)] : repetitionMeasures(node.children, unit)',
    to: 'node.repeatUnit === "REPETITION" ? repetitionMeasures(node.children, unit) : repetitionMeasures(node.children, unit)', check(a) {
    const s = snapshot("A", 4), leaf = { ...s.sequence.main[0], repeatCount: 1, recoveryBetweenRepeats: [] }
    s.sequence.main = [{ kind: "group", repeatUnit: "REPETITION", id: "group", label: null, repeatCount: 4,
      recoveryBetweenRepeats: [{ mode: "WALK", seconds: 60 }], recoveryAfter: [], children: [leaf, { ...leaf, id: "second" }] }]
    assert.equal(a.workoutTuningValuesV3(s).workTime, 40)
  } },
  { id: "single-repetition-not-new-method", from: ' || countReductionOnly(a.main, b.main)', to: '', check(a) {
    const single = snapshot("A", 1); single.sequence.main[0].recoveryBetweenRepeats = []
    assert.equal(a.distinctWorkoutMethodsV3([single, snapshot("B", 6)]).length, 1)
  } },
  { id: "method-exhaustion", from: ' && !seenIndices.has(nextIndex)', to: '', check(a) {
    const first = snapshot("A", 4), second = snapshot("B", 4)
    second.sequence.main[0].work.durationSeconds = 40
    assert.equal(a.nextWorkoutMethodV3(second, [first, second], [first, second]), null)
  } },
  { id: "nested-single-set-bridge", from: 'activeLevels(b) - activeLevels(a)', to: '0', check(a) {
    const set = (id, count, rest) => {
      const s = snapshot(id, 6)
      s.sequence.main = [{ kind: "group", repeatUnit: "SET", id: `${id}-set`, label: null, repeatCount: count,
        recoveryBetweenRepeats: count > 1 ? [{ mode: "WALK", seconds: rest }] : [], recoveryAfter: [], children: s.sequence.main }]
      return s
    }
    assert.equal(a.distinctWorkoutMethodsV3([set("0", 1, 0), set("A", 2, 60), set("B", 2, 120)]).length, 2)
  } },
]
const original = await api()
const results = []
for (const mutation of checks) {
  mutation.check(original)
  const changed = await api(mutation)
  assert.throws(() => mutation.check(changed), undefined, mutation.id)
  results.push({ id: mutation.id, baseline: "PASS", injectedDefect: "DETECTED" })
}
const out = resolve(app, "../reports/implementation/evidence/workout-choice-20260928")
await mkdir(out, { recursive: true })
const evidence = { status: "PASS", sourceFilesModified: false, results }
await writeFile(resolve(out, "mutations.json"), `${JSON.stringify(evidence, null, 2)}\n`)
console.log(JSON.stringify(evidence))
