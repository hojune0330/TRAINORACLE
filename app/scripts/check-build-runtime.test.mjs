import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildRuntimeIssue } from './check-build-runtime.mjs'

test('explains the reproduced Windows runtime failure before compilation', () => {
  assert.match(buildRuntimeIssue('win32', 'v24.11.1'), /24\.19\.0/)
})
test('permits the verified Windows runtime and does not infer failures on other platforms', () => {
  assert.equal(buildRuntimeIssue('win32', 'v24.19.0'), null)
  assert.equal(buildRuntimeIssue('linux', 'v24.11.1'), null)
})
