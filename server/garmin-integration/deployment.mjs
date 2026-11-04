import {pathToFileURL} from 'node:url';
import {createNodeServer,runtimeFromEnvironment} from './service.mjs';
import {runGarminWorker,workerOptionsFromEnvironment} from './worker.mjs';
import {accountGatewayFromEnvironment} from '../account-gateway/service.mjs';
import {signedGarminIngressFromEnvironment} from '../garmin-ingress/signed-ingress.mjs';

const PUBLIC_ROUTES=new Set(['/api/garmin-integration','/webhooks/garmin','/api/account-journal']);
const INTERNAL_ROUTES=new Set(['/internal/garmin/process','/internal/garmin/revocations','/internal/garmin/maintenance']);
const headers={'content-type':'application/json','cache-control':'no-store','pragma':'no-cache','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
const listen=(server,port,host)=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(port,host,()=>{server.removeListener('error',reject);resolve(server.address().port);});});
const wait=(ms,signal)=>new Promise(resolve=>{if(signal.aborted)return resolve();const done=()=>{clearTimeout(timer);signal.removeEventListener('abort',done);resolve();};const timer=setTimeout(done,ms);signal.addEventListener('abort',done,{once:true});});
async function drain(server,deadlineMs){
  if(!server?.listening)return;
  let timer;await new Promise(resolve=>{server.close(()=>{clearTimeout(timer);resolve();});server.closeIdleConnections();
    timer=setTimeout(()=>{server.closeAllConnections();resolve();},deadlineMs);});
}

/** Public account requests retain their real TCP peer. The optional company
 * ingress verifies its complete signed envelope before supplying a Garmin IP;
 * arbitrary forwarding headers never authenticate a hosting proxy. */
export async function startGarminDeployment({env=process.env,signal,onEvent=()=>{},runtimeFactory=runtimeFromEnvironment,workerRunner=runGarminWorker}={}){
  const emit=value=>{try{onEvent(value);}catch{/* No raw exception logging. */}};
  const rawPort=env.PORT??'10000';if(!/^\d{1,5}$/.test(rawPort)||Number(rawPort)>65535)throw new Error('DEPLOYMENT_CONFIGURATION_INVALID');
  const providerEnabled=env.TRAINORACLE_GARMIN_ENABLED==='true',pushEnabled=env.TRAINORACLE_GARMIN_PUSH_ENABLED==='true';
  const rawRevision=env.RENDER_GIT_COMMIT??env.TRAINORACLE_SOURCE_REVISION;
  const sourceRevision=/^[a-f0-9]{40}$/i.test(rawRevision??'')?rawRevision.toLowerCase():null;
  const runtime=await runtimeFactory(env),workerOptions=workerOptionsFromEnvironment(env),accountGateway=accountGatewayFromEnvironment(env);
  const signedIngress=signedGarminIngressFromEnvironment(runtime.handler,env);
  // An explicitly enabled service must not advertise healthy startup with only a
  // fraction of its protected configuration. SQL approval stays authoritative.
  if((providerEnabled||pushEnabled||workerOptions.enabled)&&!runtime.configured
    ||pushEnabled&&(!providerEnabled||!workerOptions.enabled))throw new Error('DEPLOYMENT_CONFIGURATION_INVALID');
  const controller=new AbortController();let publicServer,internalServer,stopping=false,stopPromise,workerPromise=Promise.resolve(),fatal=false;
  let finish;const finished=new Promise(resolve=>{finish=resolve;});
  const stop=()=>stopPromise??=(async()=>{
    stopping=true;controller.abort();signal?.removeEventListener('abort',stop);
    await Promise.all([drain(publicServer,20000),drain(internalServer,20000),workerPromise]);
    workerOptions.key?.fill(0);emit({event:'DEPLOYMENT_STOPPED',failed:fatal});finish({failed:fatal});
  })();
  const health=()=>({service:'trainoracle-garmin',status:stopping?'stopping':'ok',
    mode:providerEnabled?'CONFIGURED_UNVERIFIED':'PREPARATORY_DISABLED',sourceRevision,
    evidence:{process:'RUNNING',database:'NOT_PROBED',garmin:'NOT_PROBED'},accountGateway:accountGateway.configured?'CONFIGURED_UNVERIFIED':'DISABLED'});
  try{
    if(workerOptions.enabled){
      internalServer=createNodeServer((request,transport)=>INTERNAL_ROUTES.has(new URL(request.url).pathname)?runtime.handler(request,transport):json(404,{error:'NOT_FOUND'}));
      workerOptions.port=await listen(internalServer,0,'127.0.0.1');
    }
    publicServer=createNodeServer((request,transport)=>{
      const path=new URL(request.url).pathname;
      if(path==='/healthz'&&['GET','HEAD'].includes(request.method))return json(stopping?503:200,health());
      if(stopping)return json(503,{error:'SERVICE_STOPPING'});
      if(!PUBLIC_ROUTES.has(path))return json(404,{error:'NOT_FOUND'});
      if(!['POST','OPTIONS'].includes(request.method))return json(405,{error:'METHOD_NOT_ALLOWED'});
      return path==='/api/account-journal'?accountGateway.handler(request):path==='/webhooks/garmin'?signedIngress(request,transport):runtime.handler(request,transport);
    });
    const port=await listen(publicServer,Number(rawPort),'0.0.0.0');
    const crashed=()=>{fatal=true;emit({event:'DEPLOYMENT_LISTENER_FAILED'});void stop();};
    publicServer.on('error',crashed);internalServer?.on('error',crashed);
    if(workerOptions.enabled){
      workerPromise=(async()=>{
        while(!controller.signal.aborted){
          const result=await workerRunner({...workerOptions,signal:controller.signal,onEvent:emit});
          if(controller.signal.aborted)break;
          if(result.reason!=='DEADLINE')throw new Error('WORKER_UNEXPECTED_EXIT');
          // A bounded worker run is renewed by its owning process, never by a
          // second scheduled instance. Shutdown interrupts this delay as well.
          await wait(1000,controller.signal);
        }
      })().catch(()=>{fatal=true;emit({event:'DEPLOYMENT_WORKER_FAILED'});queueMicrotask(()=>void stop());});
    }
    signal?.addEventListener('abort',stop,{once:true});
    emit({event:'DEPLOYMENT_STARTED',mode:health().mode,sourceRevision});
    if(signal?.aborted)void stop();
    return {port,stop,finished,health};
  }catch{
    fatal=true;await stop();throw new Error('DEPLOYMENT_CONFIGURATION_INVALID');
  }
}

if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  const controller=new AbortController(),stop=()=>controller.abort();process.once('SIGINT',stop);process.once('SIGTERM',stop);
  try{
    if(process.argv.length>2)throw new Error('DEPLOYMENT_CONFIGURATION_INVALID');
    const deployment=await startGarminDeployment({signal:controller.signal,onEvent:value=>process.stdout.write(`${JSON.stringify(value)}\n`)});
    if((await deployment.finished).failed)process.exitCode=1;
  }catch{process.stderr.write('GARMIN_DEPLOYMENT_CONFIGURATION_INVALID\n');process.exitCode=1;}
  finally{process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);}
}
