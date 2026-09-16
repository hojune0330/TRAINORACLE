import test from "node:test"
import assert from "node:assert/strict"
import {
  COROS_WORKOUT_ENDPOINTS,
  COROS_WORKOUT_LIMITS,
  COROS_WORKOUT_SOURCES,
  buildCorosWorkoutFormRequest,
  parseCorosSchedulePushResponse,
  serializeCorosSchedule,
  serializeCorosWorkout,
} from "../functions/_shared/coros-workout-export.mjs"

const syntheticToken = "synthetic-token"
const syntheticOpenId = "synthetic-open-id"

function distanceStep(recoverySeconds) {
  const step = {
    type: "step",
    intensityClass: "Active",
    name: "400 m",
    length: { unit: "meter", value: 400 },
  }
  if (recoverySeconds !== undefined) step.recovery = { unit: "second", value: recoverySeconds }
  return step
}

function singleWorkout(overrides = {}) {
  return {
    id: 2_772_480,
    title: "Synthetic 20x400 split sets",
    lastModifiedAt: "2026-09-12T07:26:33.307",
    totalTimeSeconds: 2_660.75,
    workoutType: "run",
    structure: [{
      type: "step",
      intensityClass: "WarmUp",
      name: "Warm up",
      length: { unit: "second", value: 600 },
    }],
    ...overrides,
  }
}

function scheduledWorkout(id, workoutDay, overrides = {}) {
  return singleWorkout({
    id,
    workoutDay,
    startTime: `${workoutDay}T06:00:00`,
    ...overrides,
  })
}

test("serializes synthetic 20x400 split sets without a final fake recovery", () => {
  const structure = [
    { type: "repetition", repetitions: 9, steps: [distanceStep(60)] },
    distanceStep(180),
    { type: "repetition", repetitions: 9, steps: [distanceStep(60)] },
    distanceStep(),
  ]
  const payload = JSON.parse(serializeCorosWorkout(singleWorkout({ structure })))

  assert.equal(payload.Id, 2_772_480)
  assert.equal(payload.TotalTime, 2_660.75)
  assert.equal(payload.LastModifiedDate, "2026-09-12T07:26:33.307")
  assert.equal(payload.Structure[0].Length.Value, 9)
  assert.deepEqual(payload.Structure[1].Rest, { Unit: "Second", Value: 180 })
  assert.equal(Object.hasOwn(payload.Structure.at(-1), "Rest"), false)
  assert.equal(9 + 1 + 9 + 1, 20)
  assert.equal(JSON.stringify(payload).includes("IntensityTarget"), false)
  assert.equal(JSON.stringify(payload).includes("Threshold"), false)
})

test("preserves explicit integer time and recovery steps without deriving pace", () => {
  const payload = JSON.parse(serializeCorosWorkout(singleWorkout({
    structure: [{
      type: "step",
      intensityClass: "Rest",
      name: "Timed recovery",
      length: { unit: "second", value: 90 },
      recovery: { unit: "second", value: 30 },
    }],
  })))
  assert.deepEqual(payload.Structure[0].Length, { Unit: "Second", Value: 90 })
  assert.deepEqual(payload.Structure[0].Rest, { Unit: "Second", Value: 30 })
  assert.equal(Object.hasOwn(payload.Structure[0], "IntensityTarget"), false)
})

test("preserves an explicit m/s speed interval without deriving a threshold", () => {
  const payload = JSON.parse(serializeCorosWorkout(singleWorkout({
    structure: [{
      ...distanceStep(60),
      speedRangeMetersPerSecond: { min: 4.25, max: 4.5 },
    }],
  })))
  assert.deepEqual(payload.Structure[0].IntensityTarget, {
    Unit: "RangeOfThresholdSpeed",
    MinValue: 4.25,
    MaxValue: 4.5,
  })
  assert.equal(Object.hasOwn(payload.Structure[0], "ThresholdSpeed"), false)
})

test("builds a single-workout form request without sending it or inventing an id", () => {
  let sendCount = 0
  const originalFetch = globalThis.fetch
  globalThis.fetch = async () => { sendCount += 1; throw new Error("unexpected send") }
  try {
    const request = buildCorosWorkoutFormRequest({
      source: COROS_WORKOUT_SOURCES.SINGLE_WORKOUT,
      token: syntheticToken,
      openId: syntheticOpenId,
      workout: singleWorkout(),
    })
    const form = new URLSearchParams(request.body)
    const payload = JSON.parse(form.get("data"))

    assert.equal(request.url, COROS_WORKOUT_ENDPOINTS.single_workout)
    assert.equal(request.method, "POST")
    assert.equal(request.headers["content-type"], "application/x-www-form-urlencoded")
    assert.deepEqual([...form.keys()], ["token", "openId", "data"])
    assert.equal(form.get("token"), syntheticToken)
    assert.equal(payload.Id, 2_772_480)
    assert.equal(Object.hasOwn(payload, "WorkoutDay"), false)
    assert.equal(sendCount, 0)
  } finally {
    globalThis.fetch = originalFetch
  }
})

test("builds a truthful bounded schedule form from the schedule source", () => {
  const request = buildCorosWorkoutFormRequest({
    source: COROS_WORKOUT_SOURCES.SCHEDULE,
    token: syntheticToken,
    openId: syntheticOpenId,
    today: "2026-09-12",
    schedule: {
      athleteId: 132_265,
      startDate: "2026-09-12",
      endDate: "2026-09-14",
      workouts: [
        scheduledWorkout(100_019, "2026-09-12"),
        scheduledWorkout(100_021, "2026-09-14"),
      ],
    },
  })
  const form = new URLSearchParams(request.body)
  const payload = JSON.parse(form.get("data"))

  assert.equal(request.url, COROS_WORKOUT_ENDPOINTS.schedule)
  assert.equal(payload.AthleteId, 132_265)
  assert.equal(payload.StartDate, "2026-09-12")
  assert.equal(payload.EndDate, "2026-09-14")
  assert.deepEqual(payload.Workouts.map(workout => workout.Id), [100_019, 100_021])
  assert.deepEqual(payload.Workouts.map(workout => workout.WorkoutDay), ["2026-09-12", "2026-09-14"])
})

test("schedule serializer rejects past, overlong, mismatched, and dishonest dates", () => {
  const base = {
    athleteId: 1,
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    workouts: [scheduledWorkout(1, "2026-09-12")],
  }
  assert.doesNotThrow(() => serializeCorosSchedule(base, "2026-09-12"))
  assert.doesNotThrow(() => serializeCorosSchedule({
    ...base,
    endDate: "2027-09-12",
    workouts: [scheduledWorkout(1, "2026-09-12"), scheduledWorkout(2, "2027-09-12")],
  }, "2026-09-12"))
  assert.throws(() => serializeCorosSchedule({ ...base, startDate: "2026-09-11", endDate: "2026-09-11", workouts: [scheduledWorkout(1, "2026-09-11")] }, "2026-09-12"), /SCHEDULE_START_IN_PAST/)
  assert.throws(() => serializeCorosSchedule({ ...base, endDate: "2027-09-13", workouts: [scheduledWorkout(1, "2026-09-12"), scheduledWorkout(2, "2027-09-13")] }, "2026-09-12"), /SCHEDULE_(SPAN_TOO_LARGE|END_TOO_FAR)/)
  assert.throws(() => serializeCorosSchedule({ ...base, endDate: "2026-09-13" }, "2026-09-12"), /SCHEDULE_RANGE_MISMATCH/)
  assert.throws(() => serializeCorosSchedule({ ...base, workouts: [scheduledWorkout(1, "2026-09-12", { startTime: "2026-09-13T06:00:00" })] }, "2026-09-12"), /START_TIME_DAY_MISMATCH/)
})

test("enforces provider and local collection bounds", () => {
  const tooManyWorkouts = Array.from(
    { length: COROS_WORKOUT_LIMITS.maxScheduleWorkouts + 1 },
    (_, index) => scheduledWorkout(index + 1, "2026-09-12"),
  )
  assert.throws(() => serializeCorosSchedule({
    athleteId: 1,
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    workouts: tooManyWorkouts,
  }, "2026-09-12"), /INVALID_ARRAY/)

  assert.throws(() => serializeCorosWorkout(singleWorkout({
    structure: Array.from({ length: COROS_WORKOUT_LIMITS.maxTopLevelStructureItems + 1 }, () => distanceStep()),
  })), /INVALID_ARRAY/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({
    structure: [{ type: "repetition", repetitions: COROS_WORKOUT_LIMITS.maxRepetitions + 1, steps: [distanceStep()] }],
  })), /INVALID_POSITIVE_INTEGER/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({
    structure: [{
      type: "repetition",
      repetitions: 1,
      steps: Array.from({ length: COROS_WORKOUT_LIMITS.maxRepetitionSteps + 1 }, () => distanceStep()),
    }],
  })), /INVALID_ARRAY/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({
    structure: Array.from({ length: 9 }, () => ({
      type: "repetition",
      repetitions: 1,
      steps: Array.from({ length: COROS_WORKOUT_LIMITS.maxRepetitionSteps }, () => distanceStep()),
    })),
  })), /STRUCTURE_TOO_LARGE/)
})

test("rejects malformed and unsupported workout values instead of coercing them", () => {
  assert.throws(() => serializeCorosWorkout(singleWorkout({ id: "2772480" })), /INVALID_POSITIVE_INTEGER/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({ id: undefined })), /INVALID_POSITIVE_INTEGER/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({ structure: [{ ...distanceStep(), length: { unit: "meter", value: 400.5 } }] })), /INVALID_POSITIVE_INTEGER/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({ structure: [{ ...distanceStep(), paceSecondsPerKm: 180 }] })), /UNSUPPORTED_INTENSITY/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({ structure: [{ ...distanceStep(), intensityTarget: { unit: "RangeOfThresholdSpeed", minValue: 4, maxValue: 5 } }] })), /UNSUPPORTED_INTENSITY/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({ structure: [{ ...distanceStep(), speedRangeMetersPerSecond: { min: 5, max: 4 } }] })), /INVALID_SPEED_RANGE/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({
    workoutType: "swim",
    structure: [{ ...distanceStep(), speedRangeMetersPerSecond: { min: 1, max: 2 } }],
  })), /UNSUPPORTED_INTENSITY/)
  assert.throws(() => serializeCorosWorkout(singleWorkout({ workoutType: "Run" })), /INVALID_WORKOUT_TYPE/)
  assert.throws(() => serializeCorosWorkout({ ...singleWorkout(), workoutDay: "2026-09-12" }), /UNSUPPORTED_FIELD/)
  assert.throws(() => serializeCorosSchedule({
    athleteId: 1,
    startDate: "2026-09-12",
    endDate: "2026-09-12",
    workouts: [scheduledWorkout(1, "2026-09-12"), scheduledWorkout(1, "2026-09-12")],
  }, "2026-09-12"), /DUPLICATE_WORKOUT_ID/)
})

test("rejects diary and private provenance fields without echoing their values", () => {
  const privateValue = "synthetic private diary text that must never be exported"
  for (const unsafe of [
    { diaryText: privateValue },
    { privateProvenance: { text: privateValue } },
    { coachJournal: privateValue },
  ]) {
    let error
    try {
      serializeCorosWorkout({ ...singleWorkout(), ...unsafe })
    } catch (caught) {
      error = caught
    }
    assert.ok(error)
    assert.match(error.message, /UNSUPPORTED_FIELD/)
    assert.equal(error.message.includes(privateValue), false)
  }

  const serialized = serializeCorosWorkout(singleWorkout())
  assert.equal(serialized.includes("Description"), false)
  assert.equal(serialized.includes("Provenance"), false)
})

test("normalizes deletedIds only as safe COROS workout ids with no journal authority", () => {
  const receipt = parseCorosSchedulePushResponse({
    message: "OK",
    result: "0000",
    data: {
      startDate: 20260912,
      endDate: 20260914,
      deletedIds: [277_247, 277_248],
    },
  })
  assert.deepEqual(receipt.providerAcceptedDateRange, { startDate: "2026-09-12", endDate: "2026-09-14" })
  assert.deepEqual(receipt.providerDeletedWorkoutIds, [277_247, 277_248])
  assert.equal(receipt.providerError, null)
  assert.equal(receipt.deletionScope, "COROS_WORKOUT_ONLY")
  assert.equal(receipt.journalDeletionAuthorized, false)
  assert.equal(Object.hasOwn(receipt, "deletedIds"), false)

  for (const deletedIds of [["277247"], [1.5], [Number.MAX_SAFE_INTEGER + 1], [1, 1]]) {
    assert.throws(() => parseCorosSchedulePushResponse({
      message: "OK",
      result: "0000",
      data: { startDate: 20260912, endDate: 20260912, deletedIds },
    }))
  }
  assert.throws(() => parseCorosSchedulePushResponse({
    message: "OK",
    result: "0000",
    data: { startDate: 20260912, endDate: 20260912, deletedIds: [], journalIds: [1] },
  }), /UNSUPPORTED_FIELD/)
})

test("keeps provider failures inert even when a failure includes schedule data", () => {
  for (const result of ["5001", "30009"]) {
    const failure = parseCorosSchedulePushResponse({
      result,
      message: "provider error",
      data: {
        startDate: 20260912,
        endDate: 20260914,
        deletedIds: [277_247],
      },
    })
    assert.deepEqual(failure.providerError, { code: result, message: "provider error" })
    assert.equal(failure.providerAcceptedDateRange, null)
    assert.deepEqual(failure.providerDeletedWorkoutIds, [])
    assert.equal(failure.journalDeletionAuthorized, false)
  }
  assert.throws(() => parseCorosSchedulePushResponse({ result: "0000", message: "OK" }), /MISSING_SUCCESS_DATA/)
})

test("request source shapes are strict and no builder performs an automatic send", () => {
  assert.throws(() => buildCorosWorkoutFormRequest({
    source: COROS_WORKOUT_SOURCES.SINGLE_WORKOUT,
    token: syntheticToken,
    openId: syntheticOpenId,
    today: "2026-09-12",
    workout: singleWorkout(),
  }), /UNSUPPORTED_FIELD/)
  assert.throws(() => buildCorosWorkoutFormRequest({
    source: COROS_WORKOUT_SOURCES.SCHEDULE,
    token: syntheticToken,
    openId: syntheticOpenId,
    workout: singleWorkout(),
  }), /UNSUPPORTED_FIELD/)
})
