import {createReviewedProvider} from './provider.mjs';
import {boundedJson,canonical,fail,ID,object,sha} from './primitives.mjs';

// Operational implementation derived from the issued OAuth2 PKCE 2.0 / Activity
// 2.1 / Starter 2.0 contracts, reviewed 2026-11-04. No vendor document is bundled.
export const GARMIN_ENDPOINTS=Object.freeze({authorizationEndpoint:'https://connect.garmin.com/oauth2Confirm',tokenEndpoint:'https://diauth.garmin.com/di-oauth2-service/oauth/token',subjectEndpoint:'https://apis.garmin.com/partner-gateway/rest/user/id',permissionsEndpoint:'https://apis.garmin.com/partner-gateway/rest/user/permissions',registrationEndpoint:'https://apis.garmin.com/partner-gateway/rest/user/registration'});
export const GARMIN_SCOPES=Object.freeze(['PARTNER_WRITE','PARTNER_READ','CONNECT_READ','CONNECT_WRITE']);
export const GARMIN_DELIVERY_CIDRS=Object.freeze(['204.77.162.0/23','204.77.163.0/24','98.199.124.0/23','185.132.79.0/24','208.65.206.0/23','185.207.94.0/23','198.233.176.0/24']);
export const GARMIN_SUMMARY_FIELDS=Object.freeze(['averageBikeCadenceInRoundsPerMinute','averageHeartRateInBeatsPerMinute','averageRunCadenceInStepsPerMinute','averagePushCadenceInPushesPerMinute','averageSpeedInMetersPerSecond','averageSwimCadenceInStrokesPerMinute','averagePaceInMinutesPerKilometer','activeKilocalories','deviceName','maxBikeCadenceInRoundsPerMinute','maxHeartRateInBeatsPerMinute','maxPaceInMinutesPerKilometer','maxRunCadenceInStepsPerMinute','maxPushCadenceInPushesPerMinute','maxSpeedInMetersPerSecond','numberOfActiveLengths','startingLatitudeInDegree','startingLongitudeInDegree','steps','pushes','totalElevationGainInMeters','totalElevationLossInMeters']);
export function createGarminStarterProvider(settings,{fetchImpl=fetch,now=()=>Date.now(),testEndpoints,allowLocalHttp=false}={}) {
  if(settings.accessLevel!=='STARTER'||typeof settings.clientId!=='string'||!settings.clientId||typeof settings.clientSecret!=='string'||!settings.clientSecret)fail(503,'PROVIDER_CONFIGURATION_PENDING');
  if(testEndpoints&&!allowLocalHttp)fail(503,'CONFIGURATION_INVALID');const endpoints=testEndpoints??GARMIN_ENDPOINTS;
  const allowedSummaryFields=settings.allowedSummaryFields??[];
  if(!Array.isArray(allowedSummaryFields)||new Set(allowedSummaryFields).size!==allowedSummaryFields.length||allowedSummaryFields.some(field=>!GARMIN_SUMMARY_FIELDS.includes(field)))fail(503,'PROVIDER_CONFIGURATION_PENDING');
  const profile={...endpoints,protocol:'OAUTH2_AUTHORIZATION_CODE_PKCE',evidenceReference:settings.evidenceReference,validUntil:settings.validUntil,clientId:settings.clientId,clientSecret:settings.clientSecret,tokenAuth:'client_secret_basic',basicCredentialsEncoding:'RAW',scopes:[...GARMIN_SCOPES],subjectField:'userId',redirectUri:settings.redirectUri,allowedDetailFields:settings.allowedDetailFields??[],allowedSummaryFields:[...allowedSummaryFields].sort(),revisionSemantics:'NO_SOURCE_REVISION_CONSERVATIVE_CONFLICT',accessLevel:'STARTER'};
  const adapter=createReviewedProvider(profile,{allowLocalHttp,fetchImpl,now});
  const requireRotation=credentials=>{if(!credentials.refreshToken||!credentials.refreshExpiresAt)fail(502,'PROVIDER_RESPONSE_INVALID');return credentials;};
  return Object.freeze({...adapter,kind:'GARMIN_STARTER',clientId:settings.clientId,allowedSummaryFields:Object.freeze([...profile.allowedSummaryFields]),
    authorizationUrl(state,challenge){const url=new URL(adapter.authorizationUrl(state,challenge));url.searchParams.delete('scope');return url.href;},
    async exchange(code,verifier){return requireRotation(await adapter.exchange(code,verifier));},
    async refresh(credentials){if(!credentials.refreshExpiresAt||Date.parse(credentials.refreshExpiresAt)<=now())fail(409,'OAUTH_RESTART_REQUIRED');return requireRotation(await adapter.refresh(credentials));},
    async revoke(credentials){let response;try{response=await fetchImpl(endpoints.registrationEndpoint,{method:'DELETE',headers:{authorization:`Bearer ${credentials.accessToken}`},redirect:'error',cache:'no-store',signal:AbortSignal.timeout(8000)});}catch{fail(502,'PROVIDER_UNAVAILABLE');}if(!response.ok)fail(502,'PROVIDER_UNAVAILABLE');return true;},
  });
}

function ipNumber(address){const value=address?.replace(/^::ffff:/,'');if(typeof value!=='string'||!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value))return null;const p=value.split('.').map(Number);if(p.some(n=>n>255))return null;return p.reduce((n,v)=>(n*256+v)>>>0,0);}
export function inCidrs(address,cidrs=GARMIN_DELIVERY_CIDRS){const n=ipNumber(address);if(n===null)return false;return cidrs.some(cidr=>{const [ip,bits]=cidr.split('/');const base=ipNumber(ip),size=Number(bits);if(base===null||!Number.isInteger(size)||size<0||size>32)return false;const mask=size===0?0:(0xffffffff<<(32-size))>>>0;return (n&mask)===(base&mask);});}
export function authenticateGarminPush(request,peerAddress,{clientId,trustedProxyAddresses=[],deliveryCidrs=GARMIN_DELIVERY_CIDRS}={}) {
  // Forwarding headers are ignored unless the TCP peer is an explicitly pinned
  // company proxy which overwrites (never appends) this one header.
  const candidate=trustedProxyAddresses.includes(peerAddress)?request.headers.get('x-trainoracle-peer-ip'):peerAddress;
  if(!inCidrs(candidate,deliveryCidrs))fail(403,'ACCESS_DENIED');
  const supplied=request.headers.get('garmin-client-id');if(supplied!==null&&supplied!==clientId)fail(403,'ACCESS_DENIED');
  // The issued PUSH section documents source ranges, not a signed payload.
  // garmin-client-id is routing metadata, never treated as a secret/signature.
}
const number=(value,nullable=true)=>value===undefined||value===null?nullable?null:fail(422,'INVALID_OBSERVATION'):typeof value==='number'&&Number.isFinite(value)?value:fail(422,'INVALID_OBSERVATION');
const identifier=value=>{const s=typeof value==='number'&&Number.isSafeInteger(value)&&value>=0?String(value):value;if(typeof s!=='string'||!ID.test(s))fail(422,'INVALID_OBSERVATION');return s;};
const summaryFields=['summaryId','activityId','startTimeInSeconds','startTimeOffsetInSeconds','durationInSeconds','distanceInMeters','activityType','manual','isWebUpload','isParent','parentSummaryId'];
const sampleFields=['startTimeInSeconds','heartRate','powerInWatts','stepsPerMinute','speedMetersPerSecond','elevationInMeters','latitudeInDegree','longitudeInDegree','timerDurationInSeconds','clockDurationInSeconds','movingDurationInSeconds','totalDistanceInMeters','bikeCadenceInRPM','swimCadenceInStrokesPerMinute','airTemperatureCelcius'];
const pick=(value,fields)=>Object.fromEntries(fields.filter(k=>value[k]!==undefined).map(k=>[k,value[k]]));

/** Lightweight ingress minimization only; no analysis or journal write before ACK.
 * Excludes activityName/description, raw account tokens and unknown vendor fields.
 * Files (tokenized callback URL), MoveIQ, PING and historical feeds are excluded. */
export function parseGarminPush(body,{allowedSummaryFields=[]}={}){
  const feeds=['activities','activityDetails','manuallyUpdatedActivities','userPermissionsChange','deregistrations'];
  if(!object(body)||Object.keys(body).length!==1||!feeds.includes(Object.keys(body)[0]))fail(422,'UNSUPPORTED_GARMIN_FEED');
  const feed=Object.keys(body)[0],list=body[feed];if(!Array.isArray(list)||list.length<1||list.length>50)fail(422,'INVALID_INPUT');
  return list.map(row=>{
    if(!object(row))fail(422,'INVALID_INPUT');const userId=identifier(row.userId);
    if(feed==='deregistrations')return {feed,userId};
    if(feed==='userPermissionsChange'){
      if(!Array.isArray(row.permissions)||row.permissions.length>32||row.permissions.some(p=>typeof p!=='string'||!/^[A-Z_]{1,80}$/.test(p))||!Number.isSafeInteger(row.changeTimeInSeconds)||row.changeTimeInSeconds<0)fail(422,'INVALID_INPUT');
      return {feed,userId,summaryId:identifier(row.summaryId),permissions:[...new Set(row.permissions)].sort(),changeTimeInSeconds:row.changeTimeInSeconds};
    }
    const summary=feed==='activityDetails'?row.summary:row;if(!object(summary))fail(422,'INVALID_OBSERVATION');
    const result={feed,userId,summaryId:identifier(row.summaryId??summary.summaryId),summary:pick(summary,[...summaryFields,...allowedSummaryFields.filter(field=>GARMIN_SUMMARY_FIELDS.includes(field))])};
    if(row.activityId!==undefined)result.summary.activityId=identifier(row.activityId);
    if(feed==='activityDetails'){
      if(row.samples!==undefined&&(!Array.isArray(row.samples)||row.samples.length>100000)||row.laps!==undefined&&(!Array.isArray(row.laps)||row.laps.length>1000))fail(413,'TOO_LARGE');
      result.samples=(row.samples??[]).map(s=>{if(!object(s))fail(422,'INVALID_DETAIL');return pick(s,sampleFields);});
      result.laps=(row.laps??[]).map(l=>({startTimeInSeconds:number(l.startTimeInSeconds,false)}));
    }
    return result;
  });
}
export function normalizeGarminActivity(row,allowedFields=[],allowedSummaryFields=[]){
  if(!['activities','activityDetails','manuallyUpdatedActivities'].includes(row.feed))fail(422,'UNSUPPORTED_GARMIN_FEED');
  const s=row.summary,start=number(s.startTimeInSeconds,false),offset=number(s.startTimeOffsetInSeconds,false);
  if(!Number.isSafeInteger(start)||!Number.isInteger(offset)||Math.abs(offset)>=86400)fail(422,'INVALID_OBSERVATION');
  let startedAt,deviceLocalDate;try{startedAt=new Date(start*1000).toISOString();const local=new Date((start+offset)*1000).toISOString();if(!/^\d{4}-/.test(startedAt)||!/^\d{4}-/.test(local))throw 0;deviceLocalDate=local.slice(0,10);}catch{fail(422,'INVALID_OBSERVATION');}
  const sourceId=s.activityId!==undefined?`activity:${identifier(s.activityId)}`:`summary:${row.summaryId}`;
  const sport=s.activityType==='RUNNING'?'RUNNING':s.activityType==='WALKING'?'WALKING':s.activityType==='CYCLING'?'CYCLING':s.activityType?'OTHER':'UNKNOWN';
  // The generic duration field is a monitoring period, not a guaranteed TIMER.
  const observation={provider:'GARMIN',sourceId,sourceVersion:null,sport,startedAt,timeZone:'UTC',distanceMeters:number(s.distanceInMeters),durationSeconds:number(s.durationInSeconds),durationMeaning:'UNKNOWN',laps:[]};
  const mapping={heartRate:'heartRateBpm',powerInWatts:'powerWatts',stepsPerMinute:'cadenceSpm',speedMetersPerSecond:'speedMetersPerSecond',elevationInMeters:'altitudeMeters',latitudeInDegree:'latitude',longitudeInDegree:'longitude',timerDurationInSeconds:'timerSeconds',clockDurationInSeconds:'clockSeconds',movingDurationInSeconds:'movingSeconds',totalDistanceInMeters:'totalDistanceMeters',bikeCadenceInRPM:'bikeCadenceRpm',swimCadenceInStrokesPerMinute:'swimCadenceSpm',airTemperatureCelcius:'airTemperatureCelsius'};
  const detail=(row.samples??[]).map(sample=>{const at=number(sample.startTimeInSeconds,false);if(!Number.isSafeInteger(at)||at<start)fail(422,'INVALID_DETAIL');return {offsetSeconds:at-start,...Object.fromEntries(Object.entries(mapping).filter(([,field])=>allowedFields.includes(field)).filter(([key])=>Object.hasOwn(sample,key)).map(([key,field])=>[field,number(sample[key])]))};});
  const clock={basis:'DEVICE_OFFSET',offsetSeconds:offset,localDate:deviceLocalDate};
  const summary={};
  for(const field of allowedSummaryFields){
    if(!GARMIN_SUMMARY_FIELDS.includes(field)||!Object.hasOwn(s,field))continue;
    const value=s[field];
    if(field==='deviceName'){
      if(value!==null&&(typeof value!=='string'||value.length>200||/[\u0000-\u001f\u007f]/.test(value)))fail(422,'INVALID_OBSERVATION');
    }else{
      if(value!==null&&(typeof value!=='number'||!Number.isFinite(value)))fail(422,'INVALID_OBSERVATION');
      if(value!==null&&(field==='startingLatitudeInDegree'?Math.abs(value)>90:field==='startingLongitudeInDegree'?Math.abs(value)>180:value<0))fail(422,'INVALID_OBSERVATION');
    }
    summary[field]=value;
  }
  return {observation,detail,clock,summaryId:row.summaryId,manual:s.manual===true||s.isWebUpload===true||row.feed==='manuallyUpdatedActivities',
    summary,
    // Preserve exact reported timer/moving/clock counters and lap markers separately;
    // they do not become derived lap durations or overwrite UNKNOWN summary time.
    lapStartOffsetsSeconds:(row.laps??[]).map(lap=>{const at=number(lap.startTimeInSeconds,false);if(!Number.isSafeInteger(at)||at<start)fail(422,'INVALID_DETAIL');return at-start;}),
    parent:{isParent:s.isParent===true,parentSummaryId:s.parentSummaryId===undefined?null:identifier(s.parentSummaryId)}};
}
