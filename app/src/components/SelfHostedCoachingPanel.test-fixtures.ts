import { COACHING_PURPOSE_VERSION, COACHING_VERSION, type CoachingExplanation, type CoachingStatus } from "../domain/coaching-self-hosted"
export const exampleRecordId = "1c5a5a24-0f7b-4c1b-a741-cb52193b0566"
export const exampleGarminId = "e0d789b8-373c-493b-a8db-b17cecc9865b"
export const exampleCoachingStatus: CoachingStatus = {
  version: COACHING_VERSION, capability: { enabled: true, reason: "READY" },
  consent: { revision: 0, active: false, purposeVersion: COACHING_PURPOSE_VERSION }, retention: "REQUEST_ONLY",
  records: [
    { documentId: exampleRecordId, journalEntryId: "synthetic-journal-entry-28", revision: 2, date: "2026-10-28", provider: "직접 입력", label: "달리기 · 5km", eligible: true, reason: "READY" },
    { documentId: exampleGarminId, journalEntryId: null, revision: 1, date: "2026-10-29", provider: "Garmin", label: "달리기 · 8km", eligible: false, reason: "PROVIDER_APPROVAL_PENDING" },
  ],
}
export const exampleCoachingExplanation: CoachingExplanation = {
  version: COACHING_VERSION, kind: "explanation", summary: "선택한 기록에는 달리기 한 건이 있어요. 아래 수치는 확인된 기록에서 가져왔어요.",
  facts: [{ id: "distance", label: "기록된 거리", value: 5, unit: "km", sourceDocumentIds: [exampleRecordId] }],
  actions: [{ id: "REVIEW_JOURNAL", label: "일지 확인" }, { id: "REVIEW_PLAN", label: "기존 계획 확인" }],
  sourceDocumentIds: [exampleRecordId], attribution: ["출처: 직접 입력한 운동 기록"], generatedAt: "2026-10-30T01:00:00Z",
  retention: "REQUEST_ONLY", planChanged: false, safetyChanged: false,
}
