import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAccountStateValidator } from './build-account-state-validator.mjs'
import { validateAccountStateDocument, validateAccountStateDocumentUpdate } from '../../supabase/functions/_shared/account-state-validator.mjs'

test('server state validator rejects missing and invented state envelopes', () => {
  for (const value of [null, undefined, {}, { version: 3, state: 'ACCOUNT_STATE', kind: 'JOURNAL', data: {} },
    { version: 3, state: 'ACCOUNT_STATE', kind: 'PLAN', data: {} },
    { version: 3, state: 'ACCOUNT_STATE', kind: 'DECORATIONS', data: {} }]) {
    assert.equal(validateAccountStateDocument(value), false)
  }
  assert.equal(validateAccountStateDocumentUpdate(null, {}), false)
})

test('server bundle stays independent from browser authentication and storage clients', async () => {
  const result = await buildAccountStateValidator()
  const inputs = Object.values(result.metafile.outputs).flatMap(output =>
    Object.entries(output.inputs).filter(([, info]) => info.bytesInOutput > 0).map(([name]) => name))
  assert.ok(inputs.length > 0)
  assert.deepEqual(inputs.filter(name => /supabase-js|account-plan-service|account-decoration-service|local-journal-ownership|account-journal-api/.test(name)), [])
})
