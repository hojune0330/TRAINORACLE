import { describe, expect, it } from "vitest"
import { evaluateObjectiveFatigueEvidence } from "./objective-fatigue-evidence"

describe("objective fatigue evidence eligibility", () => {
  it("normalizes pace only against a current same-event reference", () => {
    const result = evaluateObjectiveFatigueEvidence({
      kind: "RUNNING_PACE",
      athleteId: "athlete-1",
      eventId: "5000M",
      methodId: "MANUAL_TRACK_TIME_V1",
      actualSecondsPerKm: 180,
      baseline: {
        athleteId: "athlete-1",
        eventId: "5000M",
        methodId: "MANUAL_TRACK_TIME_V1",
        source: "CURRENT",
        status: "CURRENT",
        secondsPerKm: 189,
      },
    })

    expect(result).toMatchObject({
      status: "NORMALIZED_WITHIN_ATHLETE",
      metricId: "OBJECTIVE_RUNNING_PACE_RATIO_V1",
      value: 105,
      unit: "PERCENT",
      canAggregateAcrossModalities: false,
      canDrivePlan: false,
      canInferSafety: false,
    })
  })

  it("withholds pace when the only reference is a goal", () => {
    const result = evaluateObjectiveFatigueEvidence({
      kind: "RUNNING_PACE",
      athleteId: "athlete-1",
      eventId: "5000M",
      methodId: "MANUAL_TRACK_TIME_V1",
      actualSecondsPerKm: 180,
      baseline: {
        athleteId: "athlete-1",
        eventId: "5000M",
        methodId: "MANUAL_TRACK_TIME_V1",
        source: "GOAL",
        status: "CURRENT",
        secondsPerKm: 174,
      },
    })

    expect(result).toMatchObject({ status: "WITHHELD", reason: "GOAL_IS_NOT_CURRENT_ABILITY" })
  })

  it.each([
    ["missing baseline", undefined, "MISSING_BASELINE"],
    ["stale baseline", {
      athleteId: "athlete-1", eventId: "5000M", methodId: "MANUAL_TRACK_TIME_V1",
      source: "CURRENT", status: "STALE", secondsPerKm: 189,
    }, "BASELINE_NOT_CURRENT"],
    ["different event", {
      athleteId: "athlete-1", eventId: "1500M", methodId: "MANUAL_TRACK_TIME_V1",
      source: "CURRENT", status: "CURRENT", secondsPerKm: 189,
    }, "CONTEXT_MISMATCH"],
    ["different method", {
      athleteId: "athlete-1", eventId: "5000M", methodId: "GPS_AUTO_LAP_V1",
      source: "CURRENT", status: "CURRENT", secondsPerKm: 189,
    }, "METHOD_MISMATCH"],
  ] as const)("withholds pace for %s", (_label, baseline, reason) => {
    const result = evaluateObjectiveFatigueEvidence({
      kind: "RUNNING_PACE",
      athleteId: "athlete-1",
      eventId: "5000M",
      methodId: "MANUAL_TRACK_TIME_V1",
      actualSecondsPerKm: 180,
      ...(baseline === undefined ? {} : { baseline }),
    })

    expect(result).toMatchObject({ status: "WITHHELD", reason })
  })

  it("keeps interval density descriptive instead of calling it fatigue", () => {
    const result = evaluateObjectiveFatigueEvidence({
      kind: "INTERVAL_DENSITY",
      repetitions: 10,
      workSeconds: 60,
      recoverySeconds: 60,
    })

    expect(result).toMatchObject({
      status: "DESCRIPTIVE_ONLY",
      metricId: "OBJECTIVE_INTERVAL_WORK_DENSITY_V1",
      value: 50,
      unit: "PERCENT",
      canAggregateAcrossModalities: false,
      canDrivePlan: false,
      canInferSafety: false,
    })
  })

  it("normalizes velocity loss only inside the recorded strength set", () => {
    const result = evaluateObjectiveFatigueEvidence({
      kind: "STRENGTH_VELOCITY_LOSS",
      exerciseId: "BACK_SQUAT",
      deviceMethodId: "LINEAR_TRANSDUCER_V1",
      firstRepMetersPerSecond: 1,
      lastRepMetersPerSecond: 0.8,
    })

    expect(result).toMatchObject({
      status: "NORMALIZED_WITHIN_SESSION",
      metricId: "OBJECTIVE_STRENGTH_VELOCITY_LOSS_V1",
      value: 20,
      unit: "PERCENT",
      canAggregateAcrossModalities: false,
    })
  })

  it("withholds plyometric comparison when the exercise context differs", () => {
    const result = evaluateObjectiveFatigueEvidence({
      kind: "PLYOMETRIC_CONTACTS",
      athleteId: "athlete-1",
      exerciseId: "DEPTH_JUMP",
      methodId: "COACH_COUNT_V1",
      contacts: 24,
      baseline: {
        athleteId: "athlete-1",
        exerciseId: "POGO_JUMP",
        methodId: "COACH_COUNT_V1",
        status: "CURRENT",
        contacts: 30,
      },
    })

    expect(result).toMatchObject({ status: "WITHHELD", reason: "CONTEXT_MISMATCH" })
  })

  it("keeps strength repetition volume as a count rather than a percentage", () => {
    const result = evaluateObjectiveFatigueEvidence({
      kind: "STRENGTH_DOSE",
      exerciseId: "BACK_SQUAT",
      sets: 4,
      repetitions: 5,
      loadPercent1Rm: 80,
    })

    expect(result).toMatchObject({
      status: "DESCRIPTIVE_ONLY",
      metricId: "OBJECTIVE_STRENGTH_REPETITION_VOLUME_V1",
      value: 20,
      unit: "REPETITIONS",
    })
  })
})
