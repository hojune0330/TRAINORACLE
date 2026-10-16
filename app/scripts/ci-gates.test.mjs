import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFileSync } from "node:fs"
import path from "node:path"
import { test } from "node:test"
import YAML from "yaml"
import { projects } from "../e2e/run-full-suite.mjs"

const workflow = YAML.parse(readFileSync(new URL("../../.github/workflows/ci.yml", import.meta.url), "utf8"))
const jobs = workflow.jobs
const needs = job => (Array.isArray(job.needs) ? job.needs : [job.needs]).filter(name => name !== 'delivery-scope' && name !== 'delivery-complete')
const commands = job => job.steps.filter(step => step.run).flatMap(step => step.run.trim().split("\n").map(line => line.trim()))

test("CI distributes the complete fixed timezone and browser project inventories", () => {
  assert.deepEqual(jobs["app-unit"].strategy.matrix.include, [
    { timezone: "UTC", tz: "UTC", script: "test:unit" },
    { timezone: "KST", tz: "Asia/Seoul", script: "test:unit:kst" },
  ])
  assert.equal(jobs["app-unit"].strategy["fail-fast"], false)
  const unitStep = jobs["app-unit"].steps.find(step => step.env?.UNIT_TEST_SCRIPT)
  assert.equal(unitStep.env.TZ, "${{ matrix.tz }}")
  assert.equal(unitStep.run, 'npm run "$UNIT_TEST_SCRIPT"')
  assert.deepEqual(jobs["app-browser-generic"].strategy.matrix.project, [...projects])
  assert.equal(jobs["app-browser-generic"].strategy["fail-fast"], false)
  assert.deepEqual(needs(jobs["app-browser-generic"]), ["app-quality"])
  assert(commands(jobs["app-browser-generic"]).includes("node e2e/run-project-suite.mjs '${{ matrix.project }}'"))
})

test("quality and dedicated checks keep the original complete command coverage", () => {
  const quality = commands(jobs["app-quality"])
  for (const command of ["npm run test:release-env", "npm run test:device-integration",
    "npm run test:account-record-validator", "npm run test:account-state-validator",
    "npm run typecheck", "npm run typecheck:e2e", "npm run build"]) assert(quality.includes(command), command)
  assert.deepEqual(commands(jobs["app-browser-dedicated"]).filter(command => command.startsWith("npm run test:")), [
    "npm run test:e2e:calendar-decoration", "npm run test:e2e:tower-defense", "npm run test:e2e:account-draft-buffer",
    "npm run test:e2e:account-draft-panel", "npm run test:e2e:account-record-service",
    "npm run test:e2e:account-conflict", "npm run test:e2e:account-decoration",
    "npm run test:e2e:account-calendar-decoration", "npm run test:e2e:account-plan-service",
    "npm run test:e2e:form-input-autosave", "npm run test:e2e:file-analysis",
  ])
  assert.deepEqual(needs(jobs["app-browser-dedicated"]), ["app-quality"])
  assert.deepEqual(needs(jobs["deploy-pages"]), ["contract-tests", "app-quality", "app-browser"])
  assert.equal(workflow.permissions.contents, "read")
  for (const name of ["app-unit", "app-quality", "app-browser-generic", "app-browser-dedicated", "app-browser"]) {
    assert.equal(jobs[name].permissions, undefined)
  }
})

test("the real arena remains mandatory in every fixture project with a loopback server", () => {
  const config = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8')
  const fixtureConfig = readFileSync(new URL('../playwright.browser-fixtures.config.ts', import.meta.url), 'utf8')
  const setup = readFileSync(new URL('../e2e/browser-fixtures.setup.mjs', import.meta.url), 'utf8')
  const worker = readFileSync(new URL('../e2e/arena-fixture-worker.mjs', import.meta.url), 'utf8')
  assert.match(config, /browserFixtureTests = .*friend-arena\.spec\.ts/)
  assert.match(fixtureConfig, /testMatch: browserFixtureTests/)
  assert.match(fixtureConfig, /\.\.\.generic/)
  assert(commands(jobs['app-browser-generic']).includes('npm ci --ignore-scripts'))
  assert.match(setup, /envFile: false/)
  assert.match(setup, /ws:\/\/127\.0\.0\.1:/)
  assert.match(setup, /await arena\.terminate\(\)/)
  assert.match(worker, /arena\.server\.listen\(0, "127\.0\.0\.1"/)
})

test("tower defense has one mandatory dedicated owner, without generic duplicate collection", () => {
  const generic = readFileSync(new URL('../playwright.config.ts', import.meta.url), 'utf8')
  const dedicated = readFileSync(new URL('../playwright.tower-defense.config.ts', import.meta.url), 'utf8')
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  assert.match(generic, /testIgnore:\s*\[[^\]]*"\*\*\/tower-defense\.spec\.ts"/)
  assert.match(dedicated, /testMatch:\s*'tower-defense\.spec\.ts'/)
  assert.equal(pkg.scripts['test:e2e:tower-defense'], 'playwright test --config playwright.tower-defense.config.ts')
  assert(pkg.scripts['test:e2e'].split(' && ').includes('npm run test:e2e:tower-defense'))
  assert(commands(jobs['app-browser-dedicated']).includes('npm run test:e2e:tower-defense'))
  assert(needs(jobs['app-browser']).includes('app-browser-dedicated'))
})

function bashCommand() {
  if (process.platform !== "win32") return "bash"
  const git = spawnSync("git", ["--exec-path"], { encoding: "utf8", windowsHide: true, shell: false })
  assert.equal(git.status, 0, "Git is required to locate its Windows Bash runtime")
  return path.resolve(git.stdout.trim(), "../../..", "bin/bash.exe")
}

test("actual aggregate shell guards reject every incomplete or unsuccessful result", () => {
  for (const [name, expectedNeeds] of [
    ["app-browser", ["app-browser-generic", "app-browser-dedicated"]],
  ]) {
    const job = jobs[name]
    assert.deepEqual(needs(job), expectedNeeds)
    assert.equal(job.if, "${{ always() && needs.delivery-scope.outputs.full != 'false' }}")
    const guard = job.steps.find(step => step.shell === "bash" && step.env)
    const keys = Object.keys(guard.env)
    assert.equal(keys.length, expectedNeeds.length)
    assert.deepEqual(Object.values(guard.env), expectedNeeds.map(dependency => `\${{ needs.${dependency}.result }}`))
    const execute = values => {
      const environment = { ...process.env }
      for (const key of keys) delete environment[key]
      Object.assign(environment, values)
      return spawnSync(bashCommand(), ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", guard.run], {
        env: environment, windowsHide: true, shell: false, encoding: "utf8",
      })
    }
    const successful = Object.fromEntries(keys.map(key => [key, "success"]))
    assert.equal(execute(successful).status, 0)
    for (const key of keys) {
      for (const status of ["", "failure", "cancelled", "skipped", "missing", "in_progress"]) {
        assert.equal(execute({ ...successful, [key]: status }).status, 1, `${name}:${key}:${status || "empty"}`)
      }
      const missing = { ...successful }; delete missing[key]
      assert.equal(execute(missing).status, 1, `${name}:${key}:absent`)
    }
  }
})

test("independent quality runs early but unit failures still block publication", async () => {
  assert.deepEqual(needs(jobs['app-quality']), [])
  assert.equal(jobs['app-quality'].needs, 'delivery-scope')
  assert.equal(jobs['app-quality'].if, "needs.delivery-scope.outputs.full == 'true'")
  assert(jobs['deploy-pages'].needs.includes('delivery-complete'))
  const { assertDeliveryResults } = await import('../../.tools/ci-delivery-scope.cjs')
  const results = Object.fromEntries(jobs['delivery-complete'].needs.map(name => [name, { result: 'success' }]))
  results['delivery-scope'].outputs = { full: 'true' }
  assert.equal(assertDeliveryResults(results), 'FULL_CHECKS_PASSED')
  for (const result of ['failure', 'cancelled', 'skipped', '', 'in_progress']) {
    assert.throws(() => assertDeliveryResults({ ...results, 'app-unit': { result } }))
  }
})

test("CI preserves publication and avoids duplicate branch runs and browser builds", () => {
  assert.deepEqual(workflow.on.push.branches, ['main'])
  assert.equal(workflow.concurrency['cancel-in-progress'], "${{ github.event_name == 'pull_request' }}")
  assert.equal(jobs['deploy-pages'].concurrency['cancel-in-progress'], false)
  assert(jobs['deploy-pages'].needs.includes('delivery-complete'))
  assert(jobs['deploy-pages'].needs.includes('delivery-scope'))
  assert(jobs['deploy-pages'].if.includes("!contains(github.event.head_commit.message, '[manual-pages]')"))
  for (const [name, job] of Object.entries(jobs)) {
    if (name !== 'deploy-pages') assert(!String(job.if).includes('manual-pages'), name)
  }
  for (const [name, job] of Object.entries(jobs)) assert(job['timeout-minutes'] > 0 && job['timeout-minutes'] <= 45, name)
  const publish = commands(jobs['deploy-pages']).join('\n')
  assert(publish.includes('build-oracle-pages-release.mjs --account-held'))
  assert(publish.includes('publish-oracle-pages-release.mjs'))
  assert(!publish.includes('rm -rf'))
  assert(!commands(jobs['app-browser-generic']).includes('npm run build'))
  const uploaded = jobs['app-quality'].steps.find(step => step.uses?.startsWith('actions/upload-artifact@'))
  const downloaded = jobs['app-browser-generic'].steps.find(step => step.uses?.startsWith('actions/download-artifact@'))
  assert.equal(downloaded.with.name, uploaded.with.name)
  assert.equal(downloaded.with.path, 'app/dist')
  const expected = Object.keys(jobs).filter(name => !['delivery-complete', 'deploy-pages'].includes(name))
  assert.deepEqual([...jobs['delivery-complete'].needs].sort(), expected.sort())
})
