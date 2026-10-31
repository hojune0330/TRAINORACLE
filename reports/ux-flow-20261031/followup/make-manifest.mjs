import { readFileSync, readdirSync, writeFileSync, statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root = fileURLToPath(new URL('../../../', import.meta.url))
const folder = fileURLToPath(new URL('./', import.meta.url))
const productCommit = '1f29f76541b611fcb415838e6b20bb6b39c397b0'
const logs = [
  'unit-utc.log', 'unit-kst.log', 'final-focused-utc.log', 'final-focused-kst.log',
  'personal-states-utc.log', 'personal-states-kst.log', 'account-browser.log', 'account-style-final.log',
  'browser.log', 'review-browser.log', 'build.log', 'typecheck.log', 'defect-check.log',
  'defect-1.log', 'defect-2.log', 'defect-3.log', 'defect-4.log',
]
const sha = file => createHash('sha256').update(readFileSync(file)).digest('hex')
const fileRecord = (base, file) => ({ file: file.replaceAll('\\', '/'), bytes: statSync(path.join(base, file)).size, sha256: sha(path.join(base, file)),
  ...(/\.(?:tsx?|css|mjs|json|md|log)$/u.test(file) || file === '.gitignore'
    ? { sha256Lf: createHash('sha256').update(readFileSync(path.join(base, file), 'utf8').replaceAll('\r\n', '\n')).digest('hex') } : {}) })
const productFiles = execFileSync('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', productCommit], { cwd: root, encoding: 'utf8' }).trim().split('\n')
const evidenceFiles = readdirSync(folder, { recursive: true }).filter(file => !file.includes('vite-cache') && !file.includes('review-cache')
  && file !== 'manifest.json' && statSync(path.join(folder, file)).isFile()
  && (/\.(?:png|json|md|mjs)$/u.test(file) || file === '.gitignore' || logs.includes(file)))
const manifest = {
  createdAt: new Date().toISOString(), baseCommit: '1702188ddd26eaf1ef33fdd6481a49df4ac23635', productCommit,
  commonSourceCommit: 'afc43a23641692294ee681bf85ca7fd3b5fac2f6',
  hashBasis: 'sha256 and bytes: workspace raw bytes; sha256Lf: UTF-8 text with CRLF normalized to LF for Git checkout portability',
  vendorNativeDirectUse: { apple: 0, garmin: 0 },
  viewport: { regular: [320, 375, 430], domFont200Percent: [320] },
  accountOffBrowser: JSON.parse(readFileSync(path.join(folder, 'evidence/results.json'))),
  reviewBrowser: JSON.parse(readFileSync(path.join(folder, 'evidence/review-results.json'))),
  regressionProbes: JSON.parse(readFileSync(path.join(folder, 'defect-results.json'))),
  productFiles: productFiles.map(file => fileRecord(root, file)),
  evidenceFiles: evidenceFiles.sort().map(file => fileRecord(folder, file)),
}
writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(JSON.stringify({ productCommit, productFiles: productFiles.length, evidenceFiles: evidenceFiles.length }))
