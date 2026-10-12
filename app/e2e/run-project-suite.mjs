import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { projects, runProjectSuite } from "./run-full-suite.mjs"

export function parseProject(argv) {
  if (argv.length !== 1 || !projects.includes(argv[0])) {
    throw Error("A browser project gate requires exactly one configured project")
  }
  return argv[0]
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const project = parseProject(process.argv.slice(2))
    const checks = spawnSync(process.execPath, ["--test", path.join(process.cwd(), "e2e", "run-full-suite.test.mjs"),
      path.join(process.cwd(), "scripts", "ci-gates.test.mjs")], {
      stdio: "inherit", shell: false, windowsHide: true,
    })
    if (checks.error || checks.signal || checks.status !== 0) process.exitCode = 1
    else process.exitCode = (await runProjectSuite(project)).code
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Browser project gate failed")
    process.exitCode = 1
  }
}
