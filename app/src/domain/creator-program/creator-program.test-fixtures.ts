import type { CreatorProgramVersion } from "./schema"

/** Synthetic rights metadata only. Never import this module into production registries. */
export function creatorProgramFixture(): CreatorProgramVersion {
  return {
    schemaVersion: 1,
    programId: "fixture-program",
    version: "1.0.0",
    title: "테스트 전용 프로그램",
    author: { authorId: "fixture-author", displayName: "테스트 제작자" },
    source: { sourceId: "fixture-source", publicUrl: "https://example.test/fixture-program" },
    eventDistanceM: 5000,
    audienceLabel: "계약 검사 전용 대상",
    workloadLabel: "계약 검사 전용 부담 표시",
    schedule: { kind: "RELATIVE_CYCLE", durationDays: 7, orderedDayOffsets: [0, 2, 4] },
    grant: {
      programId: "fixture-program", version: "1.0.0", grantId: "fixture-grant",
      evidenceRef: "fixture-grant-evidence", status: "ACTIVE", publicListing: true,
      personalUse: true, commercialListing: false, existingCopyPolicy: "RETAIN_PERSONAL_COPY",
    },
    review: {
      programId: "fixture-program", version: "1.0.0", reviewRef: "fixture-review",
      status: "REVIEWED", reviewedOn: "2026-09-20",
    },
    transformations: [{ kind: "RELATIVE_DATE_SHIFT", policyRef: "fixture-shift" }],
    applicability: ["CURRENT_RECORD", "GOAL_ONLY", "NO_RECORD"].map(kind => ({
      kind: kind as "CURRENT_RECORD" | "GOAL_ONLY" | "NO_RECORD",
      adoptionRef: `fixture-adoption-${kind}`,
      prescriptionRef: `fixture-prescription-${kind}`,
      transformationPolicyRefs: ["fixture-shift"],
    })),
    lifecycle: { status: "ACTIVE", notice: null },
  }
}
