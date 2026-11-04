import { z } from "zod"

/** Units describe the file field; no cadence doubling, interpolation or proprietary score reconstruction. */
export const ACTIVITY_DETAIL_METRICS = {
  distanceMeters: { label: "거리", unit: "m" },
  elapsedSeconds: { label: "경과 시간", unit: "s" },
  clockSeconds: { label: "원본 누적 시계 시간", unit: "s" },
  totalDistanceMeters: { label: "원본 누적 거리", unit: "m" },
  timerSeconds: { label: "타이머 시간", unit: "s" },
  movingSeconds: { label: "이동 시간", unit: "s" },
  sourceDurationSeconds: { label: "원본 기준 시간", unit: "s" },
  heartRateBpm: { label: "심박수", unit: "bpm" },
  cadenceRpm: { label: "원본 케이던스", unit: "rpm" },
  cadenceSpm: { label: "원본 스텝 케이던스", unit: "spm" },
  bikeCadenceRpm: { label: "원본 자전거 케이던스", unit: "rpm" },
  swimCadenceSpm: { label: "원본 수영 케이던스", unit: "spm" },
  fractionalCadenceRpm: { label: "케이던스 소수부", unit: "rpm" },
  runCadence: { label: "원본 러닝 케이던스", unit: "원본/min" },
  powerWatts: { label: "파워", unit: "W" },
  altitudeMeters: { label: "고도", unit: "m" },
  speedMetersPerSecond: { label: "속도", unit: "m/s" },
  enhancedSpeedMetersPerSecond: { label: "확장 속도", unit: "m/s" },
  enhancedAltitudeMeters: { label: "확장 고도", unit: "m" },
  ascentMeters: { label: "상승 고도", unit: "m" },
  descentMeters: { label: "하강 고도", unit: "m" },
  temperatureCelsius: { label: "온도", unit: "°C" },
  airTemperatureCelsius: { label: "원본 기온", unit: "°C" },
  caloriesKcal: { label: "열량", unit: "kcal" },
  verticalOscillationMillimeters: { label: "수직 진폭", unit: "mm" },
  verticalRatioPercent: { label: "수직 비율", unit: "%" },
  groundContactTimeMilliseconds: { label: "지면 접촉 시간", unit: "ms" },
  groundContactBalancePercent: { label: "지면 접촉 균형", unit: "%" },
  stepLengthMillimeters: { label: "보폭", unit: "mm" },
} as const
export type ActivityDetailMetric = keyof typeof ACTIVITY_DETAIL_METRICS
const metric = z.enum(Object.keys(ACTIVITY_DETAIL_METRICS) as [ActivityDetailMetric, ...ActivityDetailMetric[]])
const value = z.number().finite().nullable()
const metrics = z.partialRecord(metric, value)
const timestamp = z.iso.datetime({ offset: true }).refine(value => !value.startsWith("0000-")
  && !value.endsWith("-00:00") && Number.isFinite(Date.parse(value)))
const localTimestamp = z.string().max(50).refine(value => !value.startsWith("0000-") && (
  (/T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/u.test(value) && z.iso.datetime({ local: true }).safeParse(value).success)
  || (value.endsWith("-00:00") && z.iso.datetime({ offset: true }).safeParse(value).success)
))
const sourceText = z.string().trim().min(1).max(200).refine(value => !/[\u0000-\u001f\u007f]/u.test(value))
const summary = z.array(z.strictObject({
  metric, statistic: z.enum(["TOTAL", "AVERAGE", "MAXIMUM", "MINIMUM", "SOURCE"]),
  value, sourceField: z.string().regex(/^[A-Za-z][A-Za-z0-9._/:-]{0,149}$/u),
})).max(100)

/** Additive, versioned detail. File declarations never authenticate a provider or authorize AI use. */
export const activityFileDetailSchema = z.strictObject({
  schemaVersion: z.literal(1),
  source: z.strictObject({
    originProvider: z.enum(["GARMIN", "COROS", "APPLE", "SAMSUNG", "WHOOP", "OTHER", "UNKNOWN"]),
    evidence: z.literal("FILE_METADATA"),
    manufacturer: sourceText.nullable(), product: sourceText.nullable(),
    // This is the source document namespace, not a claim that Garmin produced the file.
    namespace: z.string().max(200).nullable(),
  }),
  summary,
  samples: z.array(z.strictObject({
    sourceIndex: z.number().int().nonnegative().max(99999),
    timestamp: timestamp.nullable(), localTimestamp: localTimestamp.optional(),
    segmentIndex: z.number().int().nonnegative().max(99999),
    lapIndex: z.number().int().nonnegative().max(999).nullable(),
    metrics,
    position: z.strictObject({ latitudeDegrees: z.number().finite().min(-90).max(90), longitudeDegrees: z.number().finite().min(-180).max(180) }).nullable(),
  })).max(100000),
  laps: z.array(z.strictObject({
    sourceIndex: z.number().int().nonnegative().max(999),
    startTime: timestamp.nullable(), endTime: timestamp.nullable(),
    localStartTime: localTimestamp.optional(), localEndTime: localTimestamp.optional(),
    trigger: sourceText.nullable(), summary,
  })).max(1000),
  events: z.array(z.strictObject({
    sourceIndex: z.number().int().nonnegative().max(99999), timestamp: timestamp.nullable(),
    type: z.enum(["TIMER_START", "TIMER_STOP", "UNKNOWN"]),
  })).max(100000),
}).refine(detail => detail.samples.every((sample, index) => sample.sourceIndex === index
  && !(sample.timestamp !== null && sample.localTimestamp !== undefined)
  && (sample.lapIndex === null || sample.lapIndex < detail.laps.length))
  && detail.laps.every((lap, index) => lap.sourceIndex === index
    && !(lap.startTime !== null && lap.localStartTime !== undefined)
    && !(lap.endTime !== null && lap.localEndTime !== undefined))
  && detail.events.every((event, index) => event.sourceIndex === index), { message: "INCONSISTENT_ACTIVITY_DETAIL" })
export type ActivityFileDetailV1 = z.infer<typeof activityFileDetailSchema>
export type ActivityDetailSample = ActivityFileDetailV1["samples"][number]
export type ActivityDetailSummary = ActivityFileDetailV1["summary"]

/** Projection only. Every raw sample remains available; absent values become explicit chart gaps. */
export function activityDetailSeries(detail: ActivityFileDetailV1) {
  const present = new Set(detail.samples.flatMap(sample => Object.keys(sample.metrics) as ActivityDetailMetric[]))
  return [...present].map(metric => ({ metric, ...ACTIVITY_DETAIL_METRICS[metric], samples: detail.samples.map(sample => ({
    sourceIndex: sample.sourceIndex, timestamp: sample.timestamp, value: sample.metrics[metric] ?? null,
    segmentId: sample.segmentIndex, lapIndex: sample.lapIndex,
  })) }))
}
