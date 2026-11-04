import type { ActivityDetailSample, ActivityDetailMetric } from "../import/file-activity-detail"
import { requestGarminIntegration, type GarminError, type GarminItem, type GarminSample, type GarminTransport } from "./garmin-integration"

/** Matches the service's canonical digest without converting units or omitting nulls. */
function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return JSON.stringify(value)
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`
  return `{${Object.keys(value as object).sort().map(key => `${JSON.stringify(key)}:${canonical((value as Record<string, unknown>)[key])}`).join(",")}}`
}
export async function garminSamplesDigest(samples: readonly GarminSample[]): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(samples)))
  return [...new Uint8Array(bytes)].map(value => value.toString(16).padStart(2, "0")).join("")
}
export async function loadGarminActivitySamples(ownerId: string, item: GarminItem, signal: AbortSignal, isCurrent: () => boolean,
  transport: GarminTransport = requestGarminIntegration, onProgress: (loaded: number, total: number) => void = () => {}): Promise<{ ok: true; samples: GarminSample[] } | { ok: false; code: GarminError }> {
  const current = () => !signal.aborted && isCurrent()
  if (!current()) return { ok: false, code: "STALE_RESPONSE" }
  const manifest = item.detailManifest
  if (manifest.some((part, index) => part.partIndex !== index) || manifest.reduce((sum, part) => sum + part.sampleCount, 0) > 100000) return { ok: false, code: "INVALID_RESPONSE" }
  const samples: GarminSample[] = []
  try {
    for (const part of manifest) {
      const result = await transport(ownerId, { action: "detail", inboxId: item.inboxId, expectedRevision: item.revision, partIndex: part.partIndex }, signal, current)
      if (!current()) return { ok: false, code: "STALE_RESPONSE" }
      if (!result.ok) return result
      if (!("samples" in result.data) || result.data.inboxId !== item.inboxId || result.data.revision !== item.revision
        || result.data.partIndex !== part.partIndex || result.data.sampleCount !== part.sampleCount || result.data.samples.length !== part.sampleCount || result.data.sha256 !== part.sha256
        || await garminSamplesDigest(result.data.samples) !== part.sha256) return { ok: false, code: "INVALID_RESPONSE" }
      if (!current()) return { ok: false, code: "STALE_RESPONSE" }
      for (const sample of result.data.samples) {
        if (samples.length && sample.offsetSeconds < samples.at(-1)!.offsetSeconds) return { ok: false, code: "INVALID_RESPONSE" }
        samples.push(sample)
      }
      onProgress(part.partIndex + 1, manifest.length)
    }
    return { ok: true, samples }
  } catch { return { ok: false, code: current() ? "INVALID_RESPONSE" : "STALE_RESPONSE" } }
}

/** Display projection only. Provider provenance stays outside the file observation schema. */
export function garminChartSamples(item: GarminItem, samples: readonly GarminSample[]): ActivityDetailSample[] {
  const origin = item.observation ? Date.parse(item.observation.startedAt) : NaN
  return samples.map((sample, sourceIndex) => {
    const instant = origin + sample.offsetSeconds * 1000
    const metrics = Object.fromEntries(Object.entries(sample).filter(([key]) => !["offsetSeconds", "latitude", "longitude"].includes(key))) as Partial<Record<ActivityDetailMetric, number | null>>
    return { sourceIndex, timestamp: Number.isFinite(instant) && Math.abs(instant) <= 8640000000000000 ? new Date(instant).toISOString() : null, segmentIndex: 0, lapIndex: null, metrics,
      position: sample.latitude !== null && sample.latitude !== undefined && sample.longitude !== null && sample.longitude !== undefined
        ? { latitudeDegrees: sample.latitude, longitudeDegrees: sample.longitude } : null }
  })
}
