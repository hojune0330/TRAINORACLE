// COROS Partner API V2.1.1 sections 6.1 and 6.3. This module only builds
// bounded payloads and requests; it does not authorize or send a workout.
export const COROS_WORKOUT_SOURCES = Object.freeze({
  SINGLE_WORKOUT: "single_workout",
  SCHEDULE: "schedule",
})

export const COROS_WORKOUT_ENDPOINTS = Object.freeze({
  [COROS_WORKOUT_SOURCES.SINGLE_WORKOUT]: "https://open.coros.com/coros/tp/workout/push",
  [COROS_WORKOUT_SOURCES.SCHEDULE]: "https://open.coros.com/coros/tp/list/push",
})

export const COROS_WORKOUT_LIMITS = Object.freeze({
  maxScheduleWorkouts: 30,
  maxScheduleDaysFromToday: 365,
  maxTopLevelStructureItems: 64,
  maxRepetitionSteps: 32,
  maxStructureNodesPerWorkout: 256,
  maxRepetitions: 1_000,
  maxLengthValue: 2_147_483_647,
  maxTotalTimeSeconds: 31_536_000,
  maxTitleLength: 120,
  maxStepNameLength: 120,
  maxDataBytes: 256 * 1024,
  maxFormBodyBytes: 1024 * 1024,
  maxResponseDeletedIds: 1_000,
})

const CONTENT_TYPE = "application/x-www-form-urlencoded"
const CONTROL_CHARACTER = /[\u0000-\u001f\u007f]/u
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/u
const LOCAL_DATE_TIME = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?$/u
const PROVIDER_CREDENTIAL = /^[A-Za-z0-9._~-]+$/u
const RESPONSE_CODE = /^\d{4,5}$/u
const WORKOUT_TYPES = new Set(["swim", "bike", "run", "strength", "trailRun"])
const INTENSITY_CLASSES = new Set(["WarmUp", "CoolDown", "Active", "Rest"])
const encoder = new TextEncoder()

function fail(code, path) {
  const error = new TypeError(`${code}:${path}`)
  error.code = code
  error.path = path
  throw error
}

function plainObject(value, path) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("INVALID_OBJECT", path)
  }
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) fail("INVALID_OBJECT", path)
  return value
}

function onlyKeys(value, allowed, path) {
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string" || !allowed.has(key)) {
      fail("UNSUPPORTED_FIELD", `${path}.${String(key)}`)
    }
  }
}

function boundedText(value, maximum, path, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || value.length > maximum || value.trim() !== value || CONTROL_CHARACTER.test(value)) {
    fail("INVALID_TEXT", path)
  }
  if (!allowEmpty && value.length === 0) fail("INVALID_TEXT", path)
  return value
}

function providerCredential(value, maximum, path) {
  const text = boundedText(value, maximum, path)
  if (!PROVIDER_CREDENTIAL.test(text)) fail("INVALID_PROVIDER_CREDENTIAL", path)
  return text
}

function positiveSafeInteger(value, path, maximum = Number.MAX_SAFE_INTEGER) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail("INVALID_POSITIVE_INTEGER", path)
  return value
}

function nonNegativeNumber(value, path, maximum) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > maximum) {
    fail("INVALID_NON_NEGATIVE_NUMBER", path)
  }
  return value
}

function positiveNumber(value, path, maximum = Number.MAX_SAFE_INTEGER) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > maximum) {
    fail("INVALID_POSITIVE_NUMBER", path)
  }
  return value
}

function dateParts(value, path) {
  if (typeof value !== "string" || !DATE_ONLY.test(value)) fail("INVALID_DATE", path)
  const year = Number(value.slice(0, 4))
  const month = Number(value.slice(5, 7))
  const day = Number(value.slice(8, 10))
  const milliseconds = Date.UTC(year, month - 1, day)
  const normalized = new Date(milliseconds).toISOString().slice(0, 10)
  if (normalized !== value) fail("INVALID_DATE", path)
  return { value, milliseconds }
}

function providerDateInteger(value, path) {
  if (!Number.isSafeInteger(value) || !/^\d{8}$/u.test(String(value))) fail("INVALID_PROVIDER_DATE", path)
  const text = String(value)
  return dateParts(`${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`, path)
}

function localDateTime(value, path) {
  if (typeof value !== "string" || !LOCAL_DATE_TIME.test(value)) fail("INVALID_LOCAL_DATE_TIME", path)
  dateParts(value.slice(0, 10), path)
  return value
}

function assertArray(value, minimum, maximum, path) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail("INVALID_ARRAY", path)
  return value
}

function assertSerializedSize(serialized, maximum, code, path) {
  if (encoder.encode(serialized).byteLength > maximum) fail(code, path)
}

function serializeLength(value, workoutType, path) {
  plainObject(value, path)
  onlyKeys(value, new Set(["unit", "value"]), path)
  const length = positiveSafeInteger(value.value, `${path}.value`, COROS_WORKOUT_LIMITS.maxLengthValue)
  if (value.unit === "meter") {
    if (workoutType === "strength") fail("UNSUPPORTED_LENGTH_UNIT", `${path}.unit`)
    return { Unit: "Meter", Value: length }
  }
  if (value.unit === "second") return { Unit: "Second", Value: length }
  fail("UNSUPPORTED_LENGTH_UNIT", `${path}.unit`)
}

function serializeRecovery(value, path) {
  plainObject(value, path)
  onlyKeys(value, new Set(["unit", "value"]), path)
  if (value.unit !== "second") fail("UNSUPPORTED_RECOVERY_UNIT", `${path}.unit`)
  return {
    Unit: "Second",
    Value: positiveSafeInteger(value.value, `${path}.value`, COROS_WORKOUT_LIMITS.maxLengthValue),
  }
}

function serializeSpeedRange(value, workoutType, path) {
  if (!new Set(["bike", "run", "trailRun"]).has(workoutType)) fail("UNSUPPORTED_INTENSITY", path)
  plainObject(value, path)
  onlyKeys(value, new Set(["min", "max"]), path)
  const min = positiveNumber(value.min, `${path}.min`)
  const max = positiveNumber(value.max, `${path}.max`)
  if (min > max) fail("INVALID_SPEED_RANGE", path)
  return {
    Unit: "RangeOfThresholdSpeed",
    MinValue: min,
    MaxValue: max,
  }
}

function countStructureNode(state, path) {
  state.nodes += 1
  if (state.nodes > COROS_WORKOUT_LIMITS.maxStructureNodesPerWorkout) {
    fail("STRUCTURE_TOO_LARGE", path)
  }
}

function serializeStep(value, workoutType, path, state) {
  plainObject(value, path)
  for (const unsupported of ["paceSecondsPerKm", "thresholdSpeed", "thresholdPace", "intensityTarget", "ftp", "thresholdHr"]) {
    if (Object.hasOwn(value, unsupported)) fail("UNSUPPORTED_INTENSITY", `${path}.${unsupported}`)
  }
  onlyKeys(value, new Set(["type", "intensityClass", "name", "length", "recovery", "speedRangeMetersPerSecond"]), path)
  if (value.type !== "step") fail("INVALID_STRUCTURE_TYPE", `${path}.type`)
  if (!INTENSITY_CLASSES.has(value.intensityClass)) fail("INVALID_INTENSITY_CLASS", `${path}.intensityClass`)
  countStructureNode(state, path)

  const output = {
    IntensityClass: value.intensityClass,
    Name: boundedText(value.name, COROS_WORKOUT_LIMITS.maxStepNameLength, `${path}.name`),
    Length: serializeLength(value.length, workoutType, `${path}.length`),
  }
  if (Object.hasOwn(value, "speedRangeMetersPerSecond")) {
    output.IntensityTarget = serializeSpeedRange(
      value.speedRangeMetersPerSecond,
      workoutType,
      `${path}.speedRangeMetersPerSecond`,
    )
  }
  if (Object.hasOwn(value, "recovery")) output.Rest = serializeRecovery(value.recovery, `${path}.recovery`)
  output.Type = "Step"
  return output
}

function serializeRepetition(value, workoutType, path, state) {
  plainObject(value, path)
  onlyKeys(value, new Set(["type", "repetitions", "steps"]), path)
  if (value.type !== "repetition") fail("INVALID_STRUCTURE_TYPE", `${path}.type`)
  countStructureNode(state, path)
  const steps = assertArray(value.steps, 1, COROS_WORKOUT_LIMITS.maxRepetitionSteps, `${path}.steps`)
  return {
    Type: "Repetition",
    Length: {
      Unit: "Repetition",
      Value: positiveSafeInteger(value.repetitions, `${path}.repetitions`, COROS_WORKOUT_LIMITS.maxRepetitions),
    },
    Steps: steps.map((step, index) => serializeStep(step, workoutType, `${path}.steps[${index}]`, state)),
  }
}

function serializeStructure(value, workoutType, path) {
  const structure = assertArray(value, 1, COROS_WORKOUT_LIMITS.maxTopLevelStructureItems, path)
  const state = { nodes: 0 }
  return structure.map((item, index) => {
    const itemPath = `${path}[${index}]`
    plainObject(item, itemPath)
    if (item.type === "step") return serializeStep(item, workoutType, itemPath, state)
    if (item.type === "repetition") return serializeRepetition(item, workoutType, itemPath, state)
    fail("INVALID_STRUCTURE_TYPE", `${itemPath}.type`)
  })
}

function buildWorkout(value, source, path = "workout") {
  plainObject(value, path)
  const common = ["id", "title", "lastModifiedAt", "totalTimeSeconds", "workoutType", "startTime", "structure"]
  const allowed = new Set(source === COROS_WORKOUT_SOURCES.SCHEDULE ? [...common, "workoutDay"] : common)
  onlyKeys(value, allowed, path)
  if (!WORKOUT_TYPES.has(value.workoutType)) fail("INVALID_WORKOUT_TYPE", `${path}.workoutType`)

  const output = {
    LastModifiedDate: localDateTime(value.lastModifiedAt, `${path}.lastModifiedAt`),
    Title: boundedText(value.title, COROS_WORKOUT_LIMITS.maxTitleLength, `${path}.title`),
  }
  if (Object.hasOwn(value, "totalTimeSeconds")) {
    output.TotalTime = nonNegativeNumber(
      value.totalTimeSeconds,
      `${path}.totalTimeSeconds`,
      COROS_WORKOUT_LIMITS.maxTotalTimeSeconds,
    )
  }
  output.Id = positiveSafeInteger(value.id, `${path}.id`)

  if (source === COROS_WORKOUT_SOURCES.SCHEDULE) {
    output.WorkoutDay = dateParts(value.workoutDay, `${path}.workoutDay`).value
  }
  output.WorkoutType = value.workoutType
  if (Object.hasOwn(value, "startTime")) {
    const startTime = localDateTime(value.startTime, `${path}.startTime`)
    if (source === COROS_WORKOUT_SOURCES.SCHEDULE && startTime.slice(0, 10) !== output.WorkoutDay) {
      fail("START_TIME_DAY_MISMATCH", `${path}.startTime`)
    }
    output.StartTime = startTime
  }
  output.Structure = serializeStructure(value.structure, value.workoutType, `${path}.structure`)
  return output
}

function serializedJson(value, path) {
  const serialized = JSON.stringify(value)
  assertSerializedSize(serialized, COROS_WORKOUT_LIMITS.maxDataBytes, "COROS_DATA_TOO_LARGE", path)
  return serialized
}

export function serializeCorosWorkout(workout, source = COROS_WORKOUT_SOURCES.SINGLE_WORKOUT) {
  if (source !== COROS_WORKOUT_SOURCES.SINGLE_WORKOUT && source !== COROS_WORKOUT_SOURCES.SCHEDULE) {
    fail("INVALID_EXPORT_SOURCE", "source")
  }
  return serializedJson(buildWorkout(workout, source), "workout")
}

function buildSchedule(value, today) {
  plainObject(value, "schedule")
  onlyKeys(value, new Set(["athleteId", "startDate", "endDate", "workouts"]), "schedule")
  const todayDate = dateParts(today, "today")
  const startDate = dateParts(value.startDate, "schedule.startDate")
  const endDate = dateParts(value.endDate, "schedule.endDate")
  const day = 24 * 60 * 60 * 1000

  if (startDate.milliseconds < todayDate.milliseconds) fail("SCHEDULE_START_IN_PAST", "schedule.startDate")
  if (endDate.milliseconds < startDate.milliseconds) fail("SCHEDULE_DATE_ORDER", "schedule.endDate")
  if ((endDate.milliseconds - startDate.milliseconds) / day > COROS_WORKOUT_LIMITS.maxScheduleDaysFromToday) {
    fail("SCHEDULE_SPAN_TOO_LARGE", "schedule.endDate")
  }
  if ((endDate.milliseconds - todayDate.milliseconds) / day > COROS_WORKOUT_LIMITS.maxScheduleDaysFromToday) {
    fail("SCHEDULE_END_TOO_FAR", "schedule.endDate")
  }

  const workouts = assertArray(
    value.workouts,
    1,
    COROS_WORKOUT_LIMITS.maxScheduleWorkouts,
    "schedule.workouts",
  ).map((workout, index) => buildWorkout(workout, COROS_WORKOUT_SOURCES.SCHEDULE, `schedule.workouts[${index}]`))

  const ids = new Set()
  let firstWorkoutDay = null
  let lastWorkoutDay = null
  for (const workout of workouts) {
    if (ids.has(workout.Id)) fail("DUPLICATE_WORKOUT_ID", "schedule.workouts")
    ids.add(workout.Id)
    const workoutDate = dateParts(workout.WorkoutDay, "schedule.workouts.WorkoutDay")
    if (workoutDate.milliseconds < startDate.milliseconds || workoutDate.milliseconds > endDate.milliseconds) {
      fail("WORKOUT_OUTSIDE_SCHEDULE", "schedule.workouts.WorkoutDay")
    }
    if (firstWorkoutDay === null || workoutDate.milliseconds < firstWorkoutDay) firstWorkoutDay = workoutDate.milliseconds
    if (lastWorkoutDay === null || workoutDate.milliseconds > lastWorkoutDay) lastWorkoutDay = workoutDate.milliseconds
  }
  if (firstWorkoutDay !== startDate.milliseconds || lastWorkoutDay !== endDate.milliseconds) {
    fail("SCHEDULE_RANGE_MISMATCH", "schedule")
  }

  return {
    AthleteId: positiveSafeInteger(value.athleteId, "schedule.athleteId"),
    StartDate: startDate.value,
    EndDate: endDate.value,
    Workouts: workouts,
  }
}

export function serializeCorosSchedule(schedule, today) {
  return serializedJson(buildSchedule(schedule, today), "schedule")
}

export function buildCorosWorkoutFormRequest(input) {
  plainObject(input, "request")
  const source = input.source
  if (source === COROS_WORKOUT_SOURCES.SINGLE_WORKOUT) {
    onlyKeys(input, new Set(["source", "token", "openId", "workout"]), "request")
  } else if (source === COROS_WORKOUT_SOURCES.SCHEDULE) {
    onlyKeys(input, new Set(["source", "token", "openId", "today", "schedule"]), "request")
  } else {
    fail("INVALID_EXPORT_SOURCE", "request.source")
  }

  const token = providerCredential(input.token, 64, "request.token")
  const openId = providerCredential(input.openId, 32, "request.openId")
  const data = source === COROS_WORKOUT_SOURCES.SINGLE_WORKOUT
    ? serializeCorosWorkout(input.workout, source)
    : serializeCorosSchedule(input.schedule, input.today)
  const form = new URLSearchParams()
  form.set("token", token)
  form.set("openId", openId)
  form.set("data", data)
  const body = form.toString()
  assertSerializedSize(body, COROS_WORKOUT_LIMITS.maxFormBodyBytes, "COROS_FORM_TOO_LARGE", "request")

  return Object.freeze({
    source,
    url: COROS_WORKOUT_ENDPOINTS[source],
    method: "POST",
    headers: Object.freeze({ "content-type": CONTENT_TYPE }),
    body,
  })
}

export function parseCorosSchedulePushResponse(payload) {
  plainObject(payload, "response")
  onlyKeys(payload, new Set(["result", "message", "data"]), "response")
  const result = boundedText(payload.result, 5, "response.result")
  if (!RESPONSE_CODE.test(result)) fail("INVALID_RESPONSE_CODE", "response.result")
  const message = boundedText(payload.message, 500, "response.message", { allowEmpty: true })

  if (result !== "0000") {
    return Object.freeze({
      result,
      message,
      providerError: Object.freeze({ code: result, message }),
      providerAcceptedDateRange: null,
      providerDeletedWorkoutIds: Object.freeze([]),
      deletionScope: "COROS_WORKOUT_ONLY",
      journalDeletionAuthorized: false,
    })
  }
  if (!Object.hasOwn(payload, "data") || payload.data === null) fail("MISSING_SUCCESS_DATA", "response.data")

  plainObject(payload.data, "response.data")
  onlyKeys(payload.data, new Set(["startDate", "endDate", "deletedIds"]), "response.data")
  const startDate = providerDateInteger(payload.data.startDate, "response.data.startDate")
  const endDate = providerDateInteger(payload.data.endDate, "response.data.endDate")
  const day = 24 * 60 * 60 * 1000
  if (endDate.milliseconds < startDate.milliseconds) fail("RESPONSE_DATE_ORDER", "response.data.endDate")
  if ((endDate.milliseconds - startDate.milliseconds) / day > COROS_WORKOUT_LIMITS.maxScheduleDaysFromToday) {
    fail("RESPONSE_DATE_SPAN_TOO_LARGE", "response.data.endDate")
  }

  const deletedIds = assertArray(
    payload.data.deletedIds,
    0,
    COROS_WORKOUT_LIMITS.maxResponseDeletedIds,
    "response.data.deletedIds",
  ).map((id, index) => positiveSafeInteger(id, `response.data.deletedIds[${index}]`))
  if (new Set(deletedIds).size !== deletedIds.length) fail("DUPLICATE_DELETED_ID", "response.data.deletedIds")

  return Object.freeze({
    result,
    message,
    providerError: null,
    providerAcceptedDateRange: Object.freeze({
      startDate: startDate.value,
      endDate: endDate.value,
    }),
    providerDeletedWorkoutIds: Object.freeze(deletedIds),
    deletionScope: "COROS_WORKOUT_ONLY",
    journalDeletionAuthorized: false,
  })
}
