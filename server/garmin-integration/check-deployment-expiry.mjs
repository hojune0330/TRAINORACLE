import {readFile,appendFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
export function expiryState(expiresAt,now=Date.now()) {
  const expiry=Date.parse(expiresAt);
  if(!Number.isFinite(expiry)||!Number.isFinite(now))throw Error('INVALID_EXPIRY');
  const days=Math.ceil((expiry-now)/86400000);
  return {days,level:days<=0?'EXPIRED':days<=1?'ONE_DAY':days<=7?'SEVEN_DAYS':days<=14?'FOURTEEN_DAYS':'READY'};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const metadata=JSON.parse(await readFile(new URL('./deployment-credential.json',import.meta.url),'utf8'));
  const state=expiryState(metadata.expiresAt);
  const message=`Garmin deployment credential: ${state.level}; ${state.days} days remaining. Operations must rotate and update metadata. This is not Garmin user OAuth or a running Worker expiry.`;
  process.stdout.write(message+'\n');
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,message+'\n');
  if(state.level!=='READY'){process.stdout.write('::warning::'+message+'\n');process.exitCode=1;}
}
