// COROS V2.1.1 section 5.5. Parsing does not authorize ingestion or analysis.
export const MAX_DAILY_BODY_BYTES = 1024 * 1024
const MAX_USERS = 50
const MAX_DAYS = 3
const MAX_HRV = 1440

function object(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("INVALID_DAILY_OBJECT")
  return value
}

function number(value, integer = false) {
  if (value === undefined || value === null) return null
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || (integer && (!Number.isSafeInteger(value) || value > 2147483647))) {
    throw new Error("INVALID_DAILY_NUMBER")
  }
  return value
}

function date(value) {
  if (!Number.isInteger(value) || !/^\d{8}$/.test(String(value))) throw new Error("INVALID_DAILY_DATE")
  const text = String(value)
  const iso = `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`
  const parsed = new Date(`${iso}T00:00:00Z`)
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== iso) throw new Error("INVALID_DAILY_DATE")
  return iso
}

function localTime(value) {
  if (value === undefined || value === null || value === "") return null
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2} ([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)) throw new Error("INVALID_SLEEP_TIME")
  date(Number(value.slice(0, 10).replaceAll("-", "")))
  return value
}

export function normalizeCorosDaily(payload) {
  const batches = object(payload).batchDailyList
  if (!Array.isArray(batches) || batches.length < 1 || batches.length > MAX_USERS) throw new Error("INVALID_DAILY_BATCH")
  const seen = new Set()
  return batches.flatMap(batch => {
    object(batch)
    if (typeof batch.openId !== "string" || !/^[A-Za-z0-9_-]{1,300}$/.test(batch.openId)) throw new Error("INVALID_DAILY_USER")
    if (!Array.isArray(batch.dailyList) || batch.dailyList.length < 1 || batch.dailyList.length > MAX_DAYS) throw new Error("INVALID_DAILY_LIST")
    return batch.dailyList.map(raw => {
      object(raw)
      const providerDay = date(raw.happenDay)
      const key = JSON.stringify([batch.openId, providerDay])
      if (seen.has(key)) throw new Error("DUPLICATE_DAILY_IDENTITY")
      seen.add(key)
      const samples = raw.hrvList ?? []
      if (!Array.isArray(samples) || samples.length > MAX_HRV) throw new Error("INVALID_HRV_LIST")
      return {
        provider: "COROS", referenceVersion: "2.1.1", providerUserId: batch.openId, providerDay,
        sleepStartLocal: localTime(raw.sleepStartTime), sleepEndLocal: localTime(raw.sleepEndTime),
        timezone: null, sleepDurationSeconds: null,
        caloriesKcal: number(raw.calorie), steps: number(raw.step, true), restingHeartRate: number(raw.rhr, true),
        overnightHrv: number(raw.ppgHrv, true), sleepAverageHeartRate: number(raw.sleepAvgHr, true),
        hrvSamples: samples.map(sample => {
          object(sample)
          if (sample.hrv == null || sample.timestamp == null) throw new Error("INVALID_HRV_SAMPLE")
          return { hrv: number(sample.hrv, true), timestamp: number(sample.timestamp, true), heartRate: number(sample.hr, true) }
        }),
        analysisStatus: "PENDING_SOURCE_REVIEW",
      }
    })
  })
}

export async function readBoundedDailyJson(request) {
  if (!request.body) throw new Error("EMPTY_DAILY_BODY")
  const reader = request.body.getReader()
  const chunks = []
  let size = 0
  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > MAX_DAILY_BODY_BYTES) {
        await reader.cancel()
        throw new Error("DAILY_BODY_TOO_LARGE")
      }
      chunks.push(value)
    }
  } finally { reader.releaseLock() }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
}
