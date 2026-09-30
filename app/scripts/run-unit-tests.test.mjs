import assert from "node:assert/strict"
import { EventEmitter } from "node:events"
import path from "node:path"
import { test } from "node:test"
import { HEAVY_FILES, parseArgs, parseInventory, runChild, runUnitTests, validatePartition } from "./run-unit-tests.mjs"

const NORMAL = ["src/domain/ordinary.test.ts", "src/screens/ordinary.test.tsx"]
const ALL = [...NORMAL, ...HEAVY_FILES]
const ok = files => ({ code: 0, signal: null, stdout: JSON.stringify(files.map(file => ({ file }))) })
function fakeChild(inventories = [ALL, NORMAL, HEAVY_FILES], results = []) {
  const calls = []
  const child = async (args, options) => {
    calls.push({ args, options })
    return args[0] === "list" ? ok(inventories.shift()) : (results.shift() ?? { code: 0, signal: null })
  }
  return { child, calls }
}

test("validates exact union, disjoint groups and all three heavy files", () => {
  assert.deepEqual(validatePartition(ALL, NORMAL, HEAVY_FILES), { total: 5, normal: 2, heavy: 3 })
})
test("rejects overlap instead of running a heavy file twice", () => {
  assert.throws(() => validatePartition(ALL, [...NORMAL, HEAVY_FILES[0]], HEAVY_FILES), /overlap/u)
})
test("rejects a lost ordinary file or an unconfigured replacement", () => {
  assert.throws(() => validatePartition(ALL, NORMAL.slice(1), HEAVY_FILES), /does not cover/u)
  assert.throws(() => validatePartition(ALL, [NORMAL[0], "src/foreign.test.ts"], HEAVY_FILES), /does not cover/u)
})
test("rejects missing heavy files, duplicate inventories and empty groups", () => {
  assert.throws(() => validatePartition(ALL, NORMAL, HEAVY_FILES.slice(1)), /exactly the three/u)
  assert.throws(() => validatePartition(ALL, [...NORMAL, NORMAL[0]], HEAVY_FILES), /duplicate/u)
  assert.throws(() => validatePartition([], NORMAL, HEAVY_FILES), /Empty/u)
})
test("fails closed on empty, malformed, duplicate or foreign actual CLI JSON", () => {
  for (const raw of ["[]", "{}", "not-json", '[{}]', '[{"file":"../foreign.test.ts"}]',
    '[{"file":"src/x.test.ts"},{"file":"src/x.test.ts"}]', '[{"file":"src/x.test.ts","projectName":"other"}]']) {
    assert.throws(() => parseInventory(raw))
  }
  const cwd = path.resolve("app")
  assert.deepEqual(parseInventory(JSON.stringify([{ file: path.join(cwd, NORMAL[0]) }]), cwd), [NORMAL[0]])
})
test("keeps supported config and refuses arguments that narrow or weaken the full gate", () => {
  assert.deepEqual(parseArgs(["-c", "vitest.config.kst.ts"]), { configArgs: ["--config", "vitest.config.kst.ts"], inventoryOnly: false })
  for (const argv of [["--config"], ["--config", "other.ts"], ["--testTimeout", "20000"], ["--testNamePattern", "one"], [HEAVY_FILES[0]]]) {
    assert.throws(() => parseArgs(argv))
  }
})
test("runs all actual inventory checks before normal then exactly three serial heavy files", async () => {
  const fixture = fakeChild()
  assert.deepEqual(await runUnitTests({ ...fixture, argv: ["--config", "vitest.config.kst.ts"], log: () => {} }), { code: 0, signal: null })
  assert.deepEqual(fixture.calls.map(call => call.args[0]), ["list", "list", "list", "run", "run"])
  assert(fixture.calls.every(call => call.args.slice(1, 3).join(" ") === "--config vitest.config.kst.ts"))
  assert.deepEqual(fixture.calls[3].args.slice(3), HEAVY_FILES.flatMap(file => ["--exclude", file]))
  assert.deepEqual(fixture.calls[4].args.slice(3), [...HEAVY_FILES, "--maxWorkers=1", "--no-file-parallelism"])
  assert(fixture.calls.slice(0, 3).every(call => call.options.capture === true))
})
test("inventory-only proves coverage without claiming to execute tests", async () => {
  const fixture = fakeChild(), messages = []
  const result = await runUnitTests({ ...fixture, argv: ["--inventory-only"], log: message => messages.push(message) })
  assert.equal(result.code, 0)
  assert.equal(fixture.calls.length, 3)
  assert(messages.some(message => message === "Inventory only: no tests executed"))
})
test("refuses a faulty actual partition before invoking either test group", async () => {
  const fixture = fakeChild([ALL, [...NORMAL, HEAVY_FILES[0]], HEAVY_FILES])
  await assert.rejects(runUnitTests({ ...fixture, log: () => {} }), /overlap/u)
  assert.equal(fixture.calls.length, 3)
})
test("preserves inventory failure and stops before testing", async () => {
  const calls = [], outcome = { code: 7, signal: null, stdout: "" }
  const result = await runUnitTests({ child: async args => { calls.push(args); return outcome }, log: () => {} })
  assert.equal(result, outcome)
  assert.equal(calls.length, 1)
})
test("preserves ordinary failure or signal without starting heavy tests", async () => {
  for (const outcome of [{ code: 9, signal: null }, { code: null, signal: "SIGTERM" }]) {
    const fixture = fakeChild(undefined, [outcome])
    assert.equal(await runUnitTests({ ...fixture, log: () => {} }), outcome)
    assert.equal(fixture.calls.length, 4)
  }
})
test("preserves the heavy child failure rather than returning a mock full pass", async () => {
  const outcome = { code: 11, signal: null }, fixture = fakeChild(undefined, [{ code: 0, signal: null }, outcome])
  assert.equal(await runUnitTests({ ...fixture, log: () => {} }), outcome)
})
test("spawns installed CLI without shell or visible Windows window and returns its exact code", async () => {
  const child = new EventEmitter(), signals = new EventEmitter(), calls = []
  child.stdout = new EventEmitter(); child.kill = () => true
  const result = runChild(["list", "--filesOnly", "--json"], { capture: true, signalSource: signals,
    spawnImpl: (...args) => { calls.push(args); return child } })
  child.stdout.emit("data", Buffer.from("[]")); child.emit("close", 3, null)
  assert.deepEqual(await result, { code: 3, signal: null, stdout: "[]" })
  assert.equal(calls[0][0], process.execPath)
  assert(calls[0][1][0].endsWith(path.join("vitest", "vitest.mjs")))
  assert.deepEqual(calls[0][1].slice(1), ["list", "--filesOnly", "--json"])
  assert.equal(calls[0][2].shell, false); assert.equal(calls[0][2].windowsHide, true)
  assert.equal(signals.listenerCount("SIGTERM"), 0)
})
test("forwards termination and keeps it a signal failure even if a child exits zero", async () => {
  const child = new EventEmitter(), signals = new EventEmitter(), kills = []
  child.kill = signal => { kills.push(signal); return true }
  const result = runChild(["run"], { signalSource: signals, spawnImpl: () => child })
  signals.emit("SIGINT"); child.emit("close", 0, null)
  assert.deepEqual(await result, { code: 0, signal: "SIGINT", stdout: "" })
  assert.deepEqual(kills, ["SIGINT"])
  assert.equal(signals.listenerCount("SIGINT"), 0)
})
test("decodes a Korean file path split across three UTF-8 byte chunks", async () => {
  const child = new EventEmitter(), signals = new EventEmitter()
  child.stdout = new EventEmitter(); child.kill = () => true
  const result = runChild(["list", "--filesOnly", "--json"], { capture: true, signalSource: signals, spawnImpl: () => child })
  const text = JSON.stringify([{ file: path.resolve("한글 폴더", "src/한글.test.ts") }])
  const bytes = Buffer.from(text), at = bytes.indexOf(Buffer.from("한"))
  child.stdout.emit("data", bytes.subarray(0, at + 1))
  child.stdout.emit("data", bytes.subarray(at + 1, at + 2))
  child.stdout.emit("data", bytes.subarray(at + 2))
  child.emit("close", 0, null)
  assert.equal((await result).stdout, text)
})
test("sanitizes synchronous spawn failure without printing private diagnostics", async () => {
  await assert.rejects(runChild(["list"], { spawnImpl: () => { throw Error("PRIVATE-DIAGNOSTICS") } }),
    error => error.message === "Unable to start installed Vitest")
})
test("fails on spawn error or excessive inventory without leaving signal handlers", async () => {
  for (const excessive of [false, true]) {
    const child = new EventEmitter(), signals = new EventEmitter()
    child.stdout = new EventEmitter(); child.kill = () => true
    const result = runChild(["list"], { capture: true, signalSource: signals, spawnImpl: () => child })
    if (excessive) child.stdout.emit("data", Buffer.alloc(1024 * 1024 + 1))
    else child.emit("error", Error("do not print underlying private diagnostics"))
    await assert.rejects(result, excessive ? /capture limit/u : /Unable to start/u)
    assert.equal(signals.listenerCount("SIGTERM"), 0)
  }
})
