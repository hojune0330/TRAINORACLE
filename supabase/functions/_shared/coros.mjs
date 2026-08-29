export const MAX_COROS_BODY_BYTES = 1024 * 1024
export const MAX_COROS_BATCH_SIZE = 50

const encoder = new TextEncoder()

function boundedString(value, maxLength) {
  if (typeof value === "number" && Number.isFinite(value)) value = String(value)
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 && trimmed.length <= maxLength ? trimmed : null
}

function optionalNumber(value) {
  if (value === undefined || value === null || value === "") return null
  const number = typeof value === "number" ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? number : null
}

function timestampIso(value) {
  if (typeof value === "string" && value.trim() !== "") {
    const numeric = Number(value)
    if (Number.isFinite(numeric)) return timestampIso(numeric)
    const parsed = Date.parse(value)
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null
  }
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return null
  const milliseconds = value < 1_000_000_000_000 ? value * 1000 : value
  const date = new Date(milliseconds)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function normalizeCorosPush(payload) {
  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("INVALID_COROS_PAYLOAD")
  }
  const list = payload.sportDataList
  if (!Array.isArray(list) || list.length < 1 || list.length > MAX_COROS_BATCH_SIZE) {
    throw new Error("INVALID_COROS_BATCH")
  }

  return list.map((source) => {
    if (source === null || typeof source !== "object" || Array.isArray(source)) {
      throw new Error("INVALID_COROS_ACTIVITY")
    }
    const providerUserId = boundedString(source.openId, 300)
    const providerRecordId = boundedString(source.labelId, 300)
    const mode = boundedString(source.mode, 50)
    const subMode = boundedString(source.subMode, 50)
    const activityStart = timestampIso(source.startTime)
    if (providerUserId === null || providerRecordId === null || activityStart === null) {
      throw new Error("MISSING_COROS_ACTIVITY_IDENTITY")
    }

    return {
      providerUserId,
      providerRecordId,
      activityStart,
      sportCode: `${mode ?? "UNKNOWN"}:${subMode ?? "UNKNOWN"}`,
      distanceMeters: optionalNumber(source.distance),
      durationSeconds: optionalNumber(source.duration),
      deviceName: boundedString(source.deviceName, 120),
    }
  })
}

export async function sha256Hex(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("")
}

export async function withPayloadDigests(items) {
  return Promise.all(items.map(async (item) => ({
    ...item,
    payloadDigest: await sha256Hex(JSON.stringify(item)),
  })))
}

export async function secureSecretMatch(actual, expected) {
  if (typeof actual !== "string" || typeof expected !== "string" || expected.length < 16) {
    return false
  }
  const [actualDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(actual)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected)),
  ])
  const left = new Uint8Array(actualDigest)
  const right = new Uint8Array(expectedDigest)
  let difference = 0
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index]
  return difference === 0
}
