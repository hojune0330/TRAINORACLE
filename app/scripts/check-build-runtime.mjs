import { pathToFileURL } from 'node:url'

export function buildRuntimeIssue(platform, version) {
  if (platform === 'win32' && version.replace(/^v/, '') === '24.11.1') {
    return 'Windows Node 24.11.1 terminated this production build with 0xC0000409. Use the verified Node 24.19.0 runtime before building. No application files were changed.'
  }
  return null
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const issue = buildRuntimeIssue(process.platform, process.version)
  if (issue) { console.error(issue); process.exitCode = 1 }
}
