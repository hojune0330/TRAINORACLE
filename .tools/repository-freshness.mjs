import { appendFileSync, readFileSync } from "node:fs"
import { pathToFileURL } from "node:url"

const PAGE_SIZE = 100
const POLICY_ACTIVATED_AT = Date.parse("2026-08-14T11:10:24Z")

export function validateBranchDecisions(decisions) {
  if (!Array.isArray(decisions)) throw new Error("Branch decisions must be an array")
  const keys = new Set()
  for (const decision of decisions) {
    const key = `${decision?.branch}@${decision?.sha}`
    if (!decision || typeof decision.branch !== "string" || !decision.branch
      || ["main", "gh-pages"].includes(decision.branch)
      || !/^[a-f0-9]{40}$/u.test(decision.sha ?? "")
      || !/^[a-f0-9]{40}$/u.test(decision.reviewedAgainst ?? "")
      || !["already_integrated", "superseded", "not_adopted"].includes(decision.disposition)
      || typeof decision.reason !== "string" || decision.reason.trim().length < 20
      || !Array.isArray(decision.evidence) || !decision.evidence.length
      || decision.evidence.some(value => typeof value !== "string" || !value.trim())
      || keys.has(key)) throw new Error(`Invalid branch decision: ${key}`)
    keys.add(key)
  }
  return decisions
}

export function evaluateFreshness({ main, branches, pulls, deployment, branchDecisions = [] }) {
  const decisions = new Map(validateBranchDecisions(branchDecisions)
    .map(decision => [`${decision.branch}@${decision.sha}`, decision]))
  const reviewedBranches = []
  const newestPullByBranch = new Map()
  for (const pull of [...pulls].sort((left, right) => right.number - left.number)) {
    if (!newestPullByBranch.has(pull.head.ref)) newestPullByBranch.set(pull.head.ref, pull)
  }
  const unresolvedBranches = branches
    .filter((branch) => branch.name !== "main" && branch.name !== "gh-pages")
    .filter((branch) => Date.parse(branch.committedAt) >= POLICY_ACTIVATED_AT)
    .flatMap((branch) => {
      const pull = newestPullByBranch.get(branch.name)
      const decision = decisions.get(`${branch.name}@${branch.sha}`)
      // Only the exact reviewed tip is settled. Reopened work or a new commit
      // must be assessed again; a disposition never changes deployment checks.
      if (decision && pull?.state !== "open") {
        reviewedBranches.push(`${branch.name}@${branch.sha.slice(0, 7)} (${decision.disposition})`)
        return []
      }
      if (!pull) return [`${branch.name}@${branch.sha.slice(0, 7)} (NO_PR)`]
      if (pull.head.sha !== branch.sha) return [`${branch.name}@${branch.sha.slice(0, 7)} (ADVANCED_AFTER_PR)`]
      if (pull.state === "closed" && pull.mergedAt === null) {
        return [`${branch.name}@${branch.sha.slice(0, 7)} (CLOSED_UNMERGED)`]
      }
      return []
    })

  const problems = []
  if (deployment.sourceSha !== main.sha) {
    problems.push(`Pages source ${deployment.sourceSha.slice(0, 7)} != main ${main.sha.slice(0, 7)}`)
  }
  if (unresolvedBranches.length > 0) {
    problems.push(`Unresolved newer branches: ${unresolvedBranches.join(", ")}`)
  }

  return {
    ok: problems.length === 0,
    mainSha: main.sha,
    deploymentSourceSha: deployment.sourceSha,
    unresolvedBranches,
    reviewedBranches,
    openPullRequests: pulls.filter((pull) => pull.state === "open").map((pull) => pull.number),
    problems,
  }
}

async function githubJson(path, token) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
    },
  })
  if (!response.ok) throw new Error(`GitHub API ${response.status}: ${path}`)
  return response.json()
}

async function paged(path, token) {
  const items = []
  for (let page = 1; ; page += 1) {
    const separator = path.includes("?") ? "&" : "?"
    const batch = await githubJson(`${path}${separator}per_page=${PAGE_SIZE}&page=${page}`, token)
    if (!Array.isArray(batch)) throw new Error(`Expected list from GitHub API: ${path}`)
    items.push(...batch)
    if (batch.length < PAGE_SIZE) return items
  }
}

async function inspectRepository(repository, token) {
  const [mainCommit, branchRefs, pulls, receiptFile] = await Promise.all([
    githubJson(`/repos/${repository}/commits/main`, token),
    paged(`/repos/${repository}/branches`, token),
    paged(`/repos/${repository}/pulls?state=all`, token),
    githubJson(`/repos/${repository}/contents/trainoracle-deploy-receipt.json?ref=gh-pages`, token),
  ])
  const branchCommits = await Promise.all(branchRefs.map(async (branch) => {
    const commit = await githubJson(`/repos/${repository}/commits/${branch.commit.sha}`, token)
    return {
      name: branch.name,
      sha: branch.commit.sha,
      committedAt: commit.commit.committer.date,
    }
  }))
  const deployment = JSON.parse(Buffer.from(receiptFile.content, "base64").toString("utf8"))

  return {
    main: {
      sha: mainCommit.sha,
      committedAt: mainCommit.commit.committer.date,
    },
    branches: branchCommits,
    pulls: pulls.map((pull) => ({
      number: pull.number,
      state: pull.state,
      mergedAt: pull.merged_at,
      head: { ref: pull.head.ref, sha: pull.head.sha },
    })),
    deployment,
    branchDecisions: JSON.parse(readFileSync(new URL("../reports/operations/branch-decisions.json", import.meta.url), "utf8")),
  }
}

async function main() {
  const repository = process.env.GITHUB_REPOSITORY
  const token = process.env.GH_TOKEN
  if (!repository || !token) throw new Error("GITHUB_REPOSITORY and GH_TOKEN are required")

  const result = evaluateFreshness(await inspectRepository(repository, token))
  const lines = [
    "### TrainOracle repository freshness",
    `- main: \`${result.mainSha}\``,
    `- deployed source: \`${result.deploymentSourceSha}\``,
    `- open PRs: ${result.openPullRequests.length === 0 ? "none" : result.openPullRequests.map((number) => `#${number}`).join(", ")}`,
    `- unresolved newer branches: ${result.unresolvedBranches.length === 0 ? "none" : result.unresolvedBranches.join(", ")}`,
    `- reviewed historical branches: ${result.reviewedBranches.length === 0 ? "none" : result.reviewedBranches.join(", ")}`,
  ]
  console.log(lines.join("\n"))
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join("\n")}\n`)
  if (!result.ok) {
    for (const problem of result.problems) console.error(problem)
    process.exitCode = 1
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main()
