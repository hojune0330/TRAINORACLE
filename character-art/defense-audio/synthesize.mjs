// Original deterministic effects. No sampled or third-party audio.
import {mkdirSync,writeFileSync} from 'node:fs'
import {fileURLToPath} from 'node:url'
const dir=fileURLToPath(new URL('../../app/public/game/defense-audio/',import.meta.url))
mkdirSync(dir,{recursive:true})
for(const [name,duration] of [['shot',.08],['impact',.22],['build',.3]]){
 const rate=22050,n=Math.ceil(rate*duration),out=Buffer.alloc(44+n*2)
 out.write('RIFF');out.writeUInt32LE(out.length-8,4);out.write('WAVEfmt ',8);out.writeUInt32LE(16,16)
 out.writeUInt16LE(1,20);out.writeUInt16LE(1,22);out.writeUInt32LE(rate,24);out.writeUInt32LE(rate*2,28);out.writeUInt16LE(2,32);out.writeUInt16LE(16,34);out.write('data',36);out.writeUInt32LE(n*2,40)
 let seed=42
 for(let i=0;i<n;i++){
  const t=i/rate,a=i/n;seed=(1664525*seed+1013904223)>>>0
  const noise=seed/4294967296*2-1
  const sample=name==='impact'?(Math.sin(t*2*Math.PI*90)*(1-a)+noise*.25)*Math.exp(-a*6)
   :name==='shot'?(noise*.25+Math.sin(2*Math.PI*(750*t-1400*t*t))*.45)*Math.exp(-a*7)
   :Math.sin(2*Math.PI*t*(a<.3?523:a<.6?659:784))*Math.sin(Math.PI*a)*.28
  out.writeInt16LE(Math.round(Math.max(-1,Math.min(1,sample))*.6*32767),44+i*2)
 }
 writeFileSync(`${dir}/${name}.wav`,out)
}
