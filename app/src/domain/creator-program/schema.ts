import { z } from "zod"

/** Public, curated source metadata only; never a projection of a private plan. */
const referenceSchema = z.string().min(1).max(160).regex(/^[A-Za-z0-9][A-Za-z0-9._:/@-]*$/)
const identitySchema = z.string().min(1).max(100).regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/)
const labelSchema = z.string().trim().min(1).max(240)

function isCivilDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number)
  if (year < 1 || month < 1 || month > 12 || day < 1) return false
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
  return day <= (days[month - 1] ?? 0)
}

const civilDateSchema = z.string().refine(isCivilDate, "실제 달력 날짜가 필요합니다.")

function civilDayNumber(value: string): number {
  const [year = 0, month = 0, day = 0] = value.split("-").map(Number)
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date.getTime() / 86_400_000
}

const publicUrlSchema = z.string().url().refine(value => {
  try {
    const url = new URL(value)
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash
  } catch { return false }
}, "자격 증명과 쿼리 없는 공개 HTTPS 출처만 허용합니다.")

const entryKindSchema = z.enum(["CURRENT_RECORD", "GOAL_ONLY", "NO_RECORD"])
const transformationKindSchema = z.enum(["SAME_EVENT_PACE", "RELATIVE_DATE_SHIFT", "REVIEWED_VARIANT"])
const copyPolicySchema = z.enum(["RETAIN_PERSONAL_COPY", "HIDE_FUTURE_CONTENT"])
const programIdentityShape = { programId: identitySchema, version: identitySchema }

const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("RELATIVE_CYCLE"),
    durationDays: z.number().int().positive(),
    orderedDayOffsets: z.array(z.number().int().nonnegative()).min(1),
  }).strict(),
  z.object({
    kind: z.literal("FIXED_DATES"),
    durationDays: z.number().int().positive(),
    startsOn: civilDateSchema,
    endsOn: civilDateSchema,
    timeZone: z.string().min(1).max(80).refine(value => {
      try { new Intl.DateTimeFormat("en", { timeZone: value }); return true }
      catch { return false }
    }, "유효한 프로그램 시간대가 필요합니다."),
    dates: z.array(civilDateSchema).min(1),
  }).strict(),
])

const grantSchema = z.object({
  ...programIdentityShape,
  grantId: referenceSchema,
  evidenceRef: referenceSchema,
  status: z.enum(["ACTIVE", "WITHDRAWN"]),
  publicListing: z.boolean(),
  personalUse: z.boolean(),
  commercialListing: z.boolean(),
  existingCopyPolicy: copyPolicySchema,
}).strict()

export const creatorProgramVersionSchema = z.object({
  schemaVersion: z.literal(1),
  ...programIdentityShape,
  title: labelSchema,
  author: z.object({ authorId: identitySchema, displayName: labelSchema }).strict(),
  source: z.object({ sourceId: referenceSchema, publicUrl: publicUrlSchema }).strict(),
  eventDistanceM: z.union([
    z.literal(800), z.literal(1500), z.literal(3000), z.literal(5000),
    z.literal(10000), z.literal(21097), z.literal(42195),
  ]),
  audienceLabel: labelSchema,
  workloadLabel: labelSchema,
  schedule: scheduleSchema,
  grant: grantSchema.nullable().default(null),
  review: z.object({
    ...programIdentityShape,
    reviewRef: referenceSchema,
    status: z.enum(["REVIEWED", "PENDING"]),
    reviewedOn: civilDateSchema.nullable(),
  }).strict().nullable().default(null),
  transformations: z.array(z.object({
    kind: transformationKindSchema,
    policyRef: referenceSchema,
  }).strict()),
  applicability: z.array(z.object({
    kind: entryKindSchema,
    adoptionRef: referenceSchema,
    prescriptionRef: referenceSchema,
    transformationPolicyRefs: z.array(referenceSchema),
  }).strict()).min(1),
  lifecycle: z.object({
    status: z.enum(["ACTIVE", "WITHDRAWN", "RECALLED"]),
    notice: labelSchema.nullable(),
  }).strict(),
}).strict().superRefine((program, context) => {
  const issue = (path: (string | number)[], message: string) =>
    context.addIssue({ code: "custom", path, message })

  for (const [key, binding] of [["grant", program.grant], ["review", program.review]] as const) {
    if (binding && (binding.programId !== program.programId || binding.version !== program.version)) {
      issue([key], "권한과 검토는 정확한 원본 버전에 결합되어야 합니다.")
    }
  }
  if (program.review?.status === "REVIEWED" && !program.review.reviewedOn) {
    issue(["review", "reviewedOn"], "검토 완료 날짜가 필요합니다.")
  }
  if (program.lifecycle.status !== "ACTIVE" && !program.lifecycle.notice) {
    issue(["lifecycle", "notice"], "철회 또는 리콜의 공개 안내가 필요합니다.")
  }
  const policies = new Map(program.transformations.map(item => [item.policyRef, item.kind]))
  if (policies.size !== program.transformations.length) issue(["transformations"], "변환 참조가 중복되었습니다.")
  if (new Set(program.applicability.map(item => item.kind)).size !== program.applicability.length) {
    issue(["applicability"], "진입 종류별 검토는 하나씩 지정합니다.")
  }
  program.applicability.forEach((entry, index) => {
    if (new Set(entry.transformationPolicyRefs).size !== entry.transformationPolicyRefs.length) {
      issue(["applicability", index, "transformationPolicyRefs"], "변환 참조가 중복되었습니다.")
    }
    for (const policyRef of entry.transformationPolicyRefs) {
      if (!policies.has(policyRef)) issue(["applicability", index], "허용 목록에 없는 변환입니다.")
      if (entry.kind !== "CURRENT_RECORD" && policies.get(policyRef) === "SAME_EVENT_PACE") {
        issue(["applicability", index], "목표 또는 기록 없음은 현재 기록 페이스의 근거가 아닙니다.")
      }
    }
  })
  const schedule = program.schedule
  if (schedule.kind === "RELATIVE_CYCLE") {
    schedule.orderedDayOffsets.forEach((offset, index) => {
      if (offset >= schedule.durationDays || (index > 0 && offset <= schedule.orderedDayOffsets[index - 1]!)) {
        issue(["schedule", "orderedDayOffsets", index], "주기 안의 날짜를 중복 없이 오름차순으로 지정합니다.")
      }
    })
  } else {
    if (isCivilDate(schedule.startsOn) && isCivilDate(schedule.endsOn) &&
      civilDayNumber(schedule.endsOn) - civilDayNumber(schedule.startsOn) + 1 !== schedule.durationDays) {
      issue(["schedule", "durationDays"], "실제 시작일과 종료일의 기간이 일치해야 합니다.")
    }
    schedule.dates.forEach((date, index) => {
      if (date < schedule.startsOn || date > schedule.endsOn || (index > 0 && date <= schedule.dates[index - 1]!)) {
        issue(["schedule", "dates", index], "게시 기간 안의 날짜를 중복 없이 오름차순으로 지정합니다.")
      }
    })
  }
})

export type CreatorProgramVersion = z.infer<typeof creatorProgramVersionSchema>
export type CreatorProgramIdentity = Pick<CreatorProgramVersion, "programId" | "version">

/** Private copy provenance only; this is not a second plan or a public payload. */
export const creatorCopyProvenanceSchema = z.object({
  ...programIdentityShape,
  grantId: referenceSchema,
  existingCopyPolicy: copyPolicySchema,
}).strict()
export type CreatorCopyProvenance = z.infer<typeof creatorCopyProvenanceSchema>
