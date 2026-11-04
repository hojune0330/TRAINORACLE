import { z } from "zod"

/** Display original vendor summary values only; labels never convert cadence,
 * pace, time basis or calories, and absent keys remain different from null/zero. */
export const GARMIN_SUMMARY_METRICS = {
  averageBikeCadenceInRoundsPerMinute: ["평균 자전거 케이던스", "rpm"],
  averageHeartRateInBeatsPerMinute: ["평균 심박수", "bpm"],
  averageRunCadenceInStepsPerMinute: ["평균 달리기 스텝 케이던스", "steps/min"],
  averagePushCadenceInPushesPerMinute: ["평균 휠체어 푸시 케이던스", "pushes/min"],
  averageSpeedInMetersPerSecond: ["평균 속도", "m/s"],
  averageSwimCadenceInStrokesPerMinute: ["평균 수영 케이던스", "strokes/min"],
  averagePaceInMinutesPerKilometer: ["평균 페이스", "min/km"],
  activeKilocalories: ["활동 칼로리", "kcal"],
  maxBikeCadenceInRoundsPerMinute: ["최대 자전거 케이던스", "rpm"],
  maxHeartRateInBeatsPerMinute: ["최대 심박수", "bpm"],
  maxPaceInMinutesPerKilometer: ["Garmin maxPace 원본값", "min/km"],
  maxRunCadenceInStepsPerMinute: ["최대 달리기 스텝 케이던스", "steps/min"],
  maxPushCadenceInPushesPerMinute: ["최대 휠체어 푸시 케이던스", "pushes/min"],
  maxSpeedInMetersPerSecond: ["최대 속도", "m/s"],
  numberOfActiveLengths: ["활동 수영 길이 수", "lengths"],
  startingLatitudeInDegree: ["시작 위치 위도", "°"],
  startingLongitudeInDegree: ["시작 위치 경도", "°"],
  steps: ["스텝 수", "steps"],
  pushes: ["휠체어 푸시 수", "pushes"],
  totalElevationGainInMeters: ["누적 상승 고도", "m"],
  totalElevationLossInMeters: ["누적 하강 고도", "m"],
} as const
type Metric = keyof typeof GARMIN_SUMMARY_METRICS
const numericShape = Object.fromEntries(Object.keys(GARMIN_SUMMARY_METRICS).map(field => [field,
  (field === "startingLatitudeInDegree" ? z.number().finite().min(-90).max(90)
    : field === "startingLongitudeInDegree" ? z.number().finite().min(-180).max(180) : z.number().finite().nonnegative()).nullable().optional(),
])) as Record<Metric, z.ZodOptional<z.ZodNullable<z.ZodNumber>>>
export const garminSummarySchema = z.object({ ...numericShape,
  deviceName: z.string().max(200).regex(/^[^\u0000-\u001f\u007f]*$/u).nullable().optional(),
}).strict()
