import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
const app = fileURLToPath(new URL('../../app/', import.meta.url))
const { startVitest } = await import('../../app/node_modules/vitest/dist/node.js')
const mode = process.argv[2]
const targets = {
  revoke: ['/CatalogWorkoutPicker.tsx', 'if (confirmation.context !== confirmationContext) setConfirmation', 'if (false) setConfirmation', 'does not resurrect the old checkbox'],
  withdrawal: ['/CatalogWorkoutPicker.tsx', 'draft !== originalDraft.current || confirmation.userEdited', 'draft !== originalDraft.current', 'honors withdrawing an environment answer'],
  numeric: ['/CatalogWorkoutPicker.tsx', 'intake.eventDistanceM, intake.experienceBand, draft]', 'intake.eventDistanceM, intake.experienceBand]', 'requires an environment answer again when the exact segment time changes'],
  prune: ['/PlanCandidates.tsx', 'previous.keys.filter(key => currentKeys.includes(key))', 'previous.keys', 'requires a new review when a removed binding is brought back'],
  gate: ['/PlanCandidates.tsx', ' && unreviewedConditions.length === 0', '', 'requires a new calendar review after changing dates'],
  date: ['/CatalogWorkoutPicker.tsx', ': confirmation.requirements.filter(requirement => !isCatalogEnvironmentRequirement(requirement))', ': confirmation.requirements', 'keeps a typed segment time when the date changes'],
  scope: ['/PlanCandidates.tsx', 'onStart={candidateId => {\n          if (!canSelect || !localAccountScopeIsCurrent(accountScope)) return', 'onStart={candidateId => {\n          if (!canSelect) return', 'never carries a calendar review into another account'],
  crossslot: ['/PlanCandidates.tsx', '.filter(condition => condition.day === reviewedAddress.day && condition.slot === reviewedAddress.slot)', '', "does not extend one slot's explicit application"],
}
const target = targets[mode]
if (!target) throw Error('Unknown mutation')
let applied = false
const empty = fileURLToPath(new URL('./no-env/', import.meta.url))
mkdirSync(empty, { recursive: true })
let ctx
try {
  ctx = await startVitest('test', ['src/screens/plan-beta/CatalogConditionReview.contract.test.tsx'], {
    root: app, config: app + 'vitest.config.ts', run: true, watch: false, maxWorkers: 1, fileParallelism: false,
    testNamePattern: target[3], reporters: ['default', 'json'],
    outputFile: fileURLToPath(new URL(`./mutation-${mode}.json`, import.meta.url)),
  }, { envDir: empty, cacheDir: empty + '/cache-mutation-' + mode,
    plugins: [{ name: 'schedule-condition-mutation', enforce: 'pre', transform(source, id) {
      if (!id.replaceAll('\\', '/').endsWith(target[0])) return
      source = source.replaceAll('\r\n', '\n')
      if (source.split(target[1]).length !== 2) throw Error('Mutation target missing or ambiguous')
      applied = true
      return source.replace(target[1], target[2])
    } }] })
  if (!applied) throw Error('Mutation did not run')
} finally { await ctx?.close() }
