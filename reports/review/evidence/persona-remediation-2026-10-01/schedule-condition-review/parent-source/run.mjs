import { fileURLToPath } from 'node:url'
import { mkdirSync } from 'node:fs'
const app = fileURLToPath(new URL('../../app/', import.meta.url))
const empty = fileURLToPath(new URL('./no-env/', import.meta.url))
mkdirSync(empty, { recursive: true })
const { startVitest } = await import('../../app/node_modules/vitest/dist/node.js')
const zone = process.argv[2] ?? 'UTC'
process.env.TZ = zone === 'KST' ? 'Asia/Seoul' : 'UTC'
const targets = [
  'src/screens/plan-beta/CatalogConditionReview.contract.test.tsx',
  'src/screens/plan-beta/CatalogWorkoutPicker.contract.test.tsx',
  'src/screens/plan-beta/PlanCandidates.recommendation.contract.test.tsx',
  'src/domain/catalog-condition-review.test.ts',
  'src/domain/catalog-schedule-conditions.test.ts',
]
const ctx = await startVitest('test', targets, {
  root: app, config: app + 'vitest.config.ts', run: true, watch: false,
  maxWorkers: 1, fileParallelism: false, reporters: ['default', 'json'],
  outputFile: fileURLToPath(new URL(`./${zone}.json`, import.meta.url)),
}, { envDir: empty, cacheDir: empty + '/cache' })
await ctx?.close()
