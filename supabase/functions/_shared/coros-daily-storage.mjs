import { normalizeCorosDaily } from "./coros-daily.mjs"
const encoder = new TextEncoder()
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const encode = bytes => {
  let text = ""
  for (let offset = 0; offset < bytes.length; offset += 8192) text += String.fromCharCode(...bytes.subarray(offset, offset + 8192))
  return btoa(text)
}
const canonical = value => value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`

function context(link, day) {
  if (![link?.ownerId,link?.connectionId,link?.connectionEpoch].every(id => typeof id === "string" && uuid.test(id))
    || !/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("INVALID_DAILY_CONTEXT")
  return encoder.encode(JSON.stringify(["trainoracle.coros-daily.v1",link.ownerId,link.connectionId,link.connectionEpoch,day]))
}

export async function encryptCorosDaily(row, link, material) {
  if (row?.provider !== "COROS" || row.providerUserId !== link?.providerUserId
    || row.analysisStatus !== "PENDING_SOURCE_REVIEW") throw new Error("INVALID_DAILY_CONTEXT")
  const [validated] = normalizeCorosDaily({batchDailyList:[{openId:row.providerUserId,dailyList:[{
    happenDay:Number(row.providerDay?.replaceAll("-","")),sleepStartTime:row.sleepStartLocal,sleepEndTime:row.sleepEndLocal,
    calorie:row.caloriesKcal,step:row.steps,rhr:row.restingHeartRate,ppgHrv:row.overnightHrv,sleepAvgHr:row.sleepAverageHeartRate,
    hrvList:row.hrvSamples?.map(sample=>({hrv:sample.hrv,timestamp:sample.timestamp,hr:sample.heartRate})),
  }]}]})
  if (canonical(row) !== canonical(validated)) throw new Error("INVALID_DAILY_FIELDS")
  const { encryptionKey, digestKey, keyId } = material ?? {}
  if (typeof keyId !== "string" || !/^[A-Za-z0-9._-]{1,80}$/.test(keyId)
    || encryptionKey?.algorithm?.name !== "AES-GCM" || encryptionKey.algorithm.length !== 256
    || encryptionKey.extractable !== false || !encryptionKey.usages.includes("encrypt")
    || digestKey?.algorithm?.name !== "HMAC" || digestKey.algorithm.hash.name !== "SHA-256"
    || digestKey.extractable !== false || !digestKey.usages.includes("sign")) throw new Error("INVALID_DAILY_KEY")
  const aad = context(link,row.providerDay)
  const plaintext = encoder.encode(canonical(row))
  if (plaintext.byteLength > 1_048_560) throw new Error("DAILY_BODY_TOO_LARGE")
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const digestInput = new Uint8Array(aad.length + 1 + plaintext.length)
  digestInput.set(aad); digestInput.set(plaintext,aad.length + 1)
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC",digestKey,digestInput))
  const ciphertext = await crypto.subtle.encrypt({name:"AES-GCM",iv,additionalData:aad},encryptionKey,plaintext)
  return {ownerId:link.ownerId,connectionId:link.connectionId,connectionEpoch:link.connectionEpoch,
    providerDay:row.providerDay,contentDigest:Array.from(digest,b => b.toString(16).padStart(2,"0")).join(""),
    payload:{version:1,algorithm:"AES-GCM",keyId,iv:encode(iv),ciphertext:encode(new Uint8Array(ciphertext))}}
}

// These injected operations must use server credentials and never return tokens to the UI.
export function createCorosDailyStorage({ resolveConnection, keyMaterial, commitBatch }) {
  return async rows => {
    const envelopes = []
    for (const row of rows) {
      const link = await resolveConnection(row.providerUserId)
      if (!link || link.status !== "ACTIVE" || !link.scopes?.includes("DAILY_READ")) throw new Error("DAILY_CONNECTION_UNAVAILABLE")
      envelopes.push(await encryptCorosDaily(row,link,keyMaterial))
    }
    return commitBatch(envelopes)
  }
}

export function createCorosDailyRepository({ supabaseUrl, serviceRoleKey, fetchImpl = fetch }) {
  const base = new URL(supabaseUrl)
  if (base.protocol !== "https:" || !/^[a-z0-9-]+\.supabase\.co$/.test(base.hostname)
    || base.username || base.password || base.port || base.search || base.hash || base.pathname !== "/"
    || typeof serviceRoleKey !== "string" || serviceRoleKey.length < 16) throw new Error("INVALID_DAILY_REPOSITORY_CONFIG")
  const headers = {apikey:serviceRoleKey,authorization:`Bearer ${serviceRoleKey}`,"content-type":"application/json"}
  async function call(url, init = {}) {
    try {
      const result = await fetchImpl(url,{...init,headers,redirect:"error",signal:AbortSignal.timeout(10000)})
      if (!result.ok) throw new Error()
      return await result.json()
    } catch { throw new Error("DAILY_STORAGE_UNAVAILABLE") }
  }
  return {
    async resolveConnection(providerUserId) {
      if (typeof providerUserId !== "string" || !/^[A-Za-z0-9_-]{1,300}$/.test(providerUserId)) throw new Error("INVALID_DAILY_CONTEXT")
      const url = new URL("rest/v1/external_provider_connections",base)
      url.search = new URLSearchParams({provider:"eq.COROS",provider_user_id:`eq.${providerUserId}`,connection_status:"eq.ACTIVE",select:"id,user_id,connection_epoch,connection_status,scopes",limit:"2"}).toString()
      const rows = await call(url)
      if (!Array.isArray(rows) || rows.length > 1) throw new Error("DAILY_CONNECTION_UNAVAILABLE")
      if (!rows.length) return null
      const row=rows[0]
      return {providerUserId,ownerId:row.user_id,connectionId:row.id,connectionEpoch:row.connection_epoch,status:row.connection_status,scopes:row.scopes}
    },
    async commitBatch(envelopes) {
      const result=await call(new URL("rest/v1/rpc/ingest_coros_daily_envelopes",base),{method:"POST",body:JSON.stringify({p_items:envelopes})})
      if (result?.committed !== true || result.processed !== envelopes.length
        || !Number.isSafeInteger(result.inserted) || !Number.isSafeInteger(result.duplicates)
        || result.inserted < 0 || result.duplicates < 0 || result.inserted + result.duplicates !== result.processed) throw new Error("DAILY_STORAGE_UNAVAILABLE")
      return result
    },
  }
}
