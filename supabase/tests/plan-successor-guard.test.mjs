import { test } from 'node:test';
import assert from 'node:assert/strict';
import { accountPlanStateNeedsJournalGuard } from '../functions/_shared/account-journal-handler.mjs';

test('successor guard routing covers each stored adjusted format without treating initial plans as successors', () => {
  for (const version of [4, 5, 6]) {
    assert.equal(accountPlanStateNeedsJournalGuard({ version, selection: { periodization: { frameOrdinal: 1 } } }), false);
    assert.equal(accountPlanStateNeedsJournalGuard({ version, selection: { periodization: { frameOrdinal: 2 } } }), true);
    assert.equal(accountPlanStateNeedsJournalGuard({ version, selection: { continuation: { predecessorFingerprint: 'retained' } } }), true);
  }
  assert.equal(accountPlanStateNeedsJournalGuard(null), false);
});
