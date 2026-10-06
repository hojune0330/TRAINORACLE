import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { loadOracleMigrationChain, approveSyntheticOracleStorage } from './oracle-auth-fixture.mjs'

test('operator synthetic role smoke executes and rolls back every identity, flag and document', async () => {
  const db = new PGlite({ extensions: { pgcrypto } })
  try {
    await loadOracleMigrationChain(db)
    const smoke = await readFile(new URL('../../operations/account-journal-rls-rollback-smoke.sql', import.meta.url), 'utf8')
    await assert.rejects(db.exec(smoke), /REHEARSAL_OPERATIONS_REVIEW_REQUIRED/)
    await db.exec('rollback')
    assert.equal((await db.query('select count(*)::integer as count from public.account_storage_operation_reviews')).rows[0].count, 0)
    await approveSyntheticOracleStorage(db)
    const before = (await db.query('select * from public.service_feature_controls order by feature_key')).rows
    const reviewsBefore = (await db.query('select * from public.account_storage_operation_reviews')).rows
    const result = await db.exec(smoke)
    assert.equal(result.at(-1).rows[0].result, 'SYNTHETIC_RLS_ROLLED_BACK')
    for (const table of ['auth.users','auth.sessions','public.user_private_profiles','public.beta_enrollments','public.account_journal_documents',
      'public.account_storage_consents','public.account_storage_consent_events'])
      assert.equal((await db.query(`select count(*)::integer as count from ${table}`)).rows[0].count, 0)
    assert.deepEqual((await db.query('select * from public.service_feature_controls order by feature_key')).rows, before)
    assert.deepEqual((await db.query('select * from public.account_storage_operation_reviews')).rows, reviewsBefore)
  } finally { await db.close() }
}, { timeout: 60000 })
