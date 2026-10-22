import { spawnSync } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { laneNames, projects, runProjectLaneSuite } from "./run-full-suite.mjs"

export function parseProjectLane(argv) {
  if (argv.length !== 2 || !projects.includes(argv[0]) || !laneNames.includes(argv[1])) {
    throw Error("A browser lane gate requires exactly one configured project and one configured lane")
  }
  return { project: argv[0], lane: argv[1] }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const { project, lane } = parseProjectLane(process.argv.slice(2))
    const checks = spawnSync(process.execPath, ["--test", path.join(process.cwd(), "e2e", "run-full-suite.test.mjs"),
      path.join(process.cwd(), "scripts", "ci-gates.test.mjs")], {
      stdio: "inherit", shell: false, windowsHide: true,
    })
    if (checks.error || checks.signal || checks.status !== 0) process.exitCode = 1
    else process.exitCode = (await runProjectLaneSuite(project, lane)).code
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Browser project lane gate failed")
    process.exitCode = 1
  }
}
