import { readFileSync,readdirSync,writeFileSync,statSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
const root=fileURLToPath(new URL('../../../',import.meta.url)),folder=fileURLToPath(new URL('./',import.meta.url))
const productCommit='d4bcbf9178aa4d8b98b50bafb69e3b1da5ce947a',sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const record=(base,file)=>{const bytes=readFileSync(path.join(base,file));return{file:file.replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes),...(/\.(?:tsx?|css|mjs|json|md|log)$/u.test(file)||file==='.gitignore'?{sha256Lf:sha(bytes.toString('utf8').replaceAll('\r\n','\n'))}:{})}}
// Correct only the changed evidence document. Keep historical product hashes bound to 1f29f765.
const priorFolder=path.join(root,'reports/ux-flow-20261031/followup'),priorPath=path.join(priorFolder,'manifest.json'),prior=JSON.parse(readFileSync(priorPath,'utf8'))
const priorReadme=prior.evidenceFiles.findIndex(item=>item.file==='README.md');if(priorReadme<0)throw Error('Missing prior README record')
prior.evidenceFiles[priorReadme]=record(priorFolder,'README.md');writeFileSync(priorPath,JSON.stringify(prior,null,2)+'\n')
const productFiles=execFileSync('git',['diff','--name-only','1702188ddd26eaf1ef33fdd6481a49df4ac23635',productCommit,'--','app/'],{cwd:root,encoding:'utf8'}).trim().split('\n')
const evidenceFiles=readdirSync(folder,{recursive:true}).filter(file=>!file.includes('vite-cache')&&file!=='manifest.json'&&statSync(path.join(folder,file)).isFile())
const manifest={createdAt:new Date().toISOString(),productCommit,previousHead:'2cba2ab54f0abeac43f43ebc5c7c7ff91ce3a5ca',commonSourceCommit:'77a6fdb1f3ebaea52dcdc70e95891975ba26a570',
  productDelta:{files:['app/src/components/record-ui.css'],insertions:10},hashBasis:'sha256/bytes: raw workspace; sha256Lf: UTF-8 CRLF normalized to LF',
  historicalManifest:{file:'../followup/manifest.json',sha256:sha(readFileSync(priorPath)),productCommit:prior.productCommit},
  productFiles:productFiles.map(file=>record(root,file)),evidenceFiles:evidenceFiles.sort().map(file=>record(folder,file))}
writeFileSync(path.join(folder,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');console.log(JSON.stringify({productCommit,productFiles:productFiles.length,evidenceFiles:evidenceFiles.length}))
