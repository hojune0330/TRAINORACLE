import type { ComponentProps } from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"
import { DetailedPrescriptionView } from "./DetailedPrescriptionView"

// Synthetic renderer inputs, not a plan-storage/activation validation fixture.
const fixture = () => ({
  kind: "PACE_TARGET", setCount: 1, repetitionsPerSet: 5, repetitionDistanceM: 1000,
  targetRepSeconds: 222.2, targetEventDistanceM: 5000, repetitionRecoverySeconds: 150, repetitionRecoveryMode: "JOG",
  setRecoverySeconds: null, setRecoveryMode: "NOT_APPLICABLE",
  templateId: "V2-SEED-05", templateVersion: "1.0.0", displayRoundingPolicyVersion: "seconds-v1",
  selectedAnchor: { kind: "RECENT_RESULT", purpose: "CURRENT_CAPABILITY", eventDistanceM: 5000,
    performanceSeconds: 1111, achievedAt: "2026-10-01", seasonId: null, verificationState: "SELF_REPORTED" },
  totals: { totalRepetitions: 5, qualityDistanceM: 5000, repetitionRecoveryOccurrences: 4,
    repetitionRecoveryTotalSeconds: 600, setRecoveryOccurrences: 0, setRecoveryTotalSeconds: 0 },
  operationalComponents: {
    warmup: { easyDurationMinutes: 15, rpeMin: 2, rpeMax: 3,
      strides: { durationSeconds: 20, repetitions: 4, recoverySeconds: 40 } },
    cooldown: { easyDurationMinutes: 10, rpeMin: 1, rpeMax: 2 },
  },
  stopCodes: ["STOP_NEW_OR_WORSENING_PAIN", "STOP_DIZZINESS_OR_FAINTNESS", "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING", "STOP_LOSS_OF_CONTROLLED_FORM"],
} as unknown as ComponentProps<typeof DetailedPrescriptionView>["prescription"])

afterEach(cleanup)

it("keeps the exact main and recovery quantities in plain presentation without mutating the prescription", () => {
  const prescription = fixture(), original = JSON.stringify(prescription)
  const { container } = render(<DetailedPrescriptionView prescription={prescription} />)
  const notation = container.querySelector(".plan-detailed-prescription__notation")!
  expect(notation).toHaveTextContent(/5.*1km/u)
  expect(notation).toHaveTextContent(/222.2초\/1km/u)
  expect(notation).toHaveTextContent(/반복 사이.*150초 조깅/u)
  fireEvent.click(screen.getByText("자세히 보기 · 수행 순서"))
  expect(container.querySelector('[data-phase="prepare"]')).toHaveTextContent("15분 · 힘든 정도 2–3/10")
  expect(container.querySelector('[data-phase="cooldown"]')).toHaveTextContent("10분 · 힘든 정도 1–2/10")
  expect(container.querySelector('[data-recovery-kind="repetition"]')).toHaveTextContent("4번 · 매번 150초 조깅 · 총 600초")
  expect(container).not.toHaveTextContent("처방 무결성")
  expect(JSON.stringify(prescription)).toBe(original)
})

it("keeps every stop condition visible even while preparation and technical details are collapsed", () => {
  const { container } = render(<DetailedPrescriptionView prescription={fixture()} />)
  expect([...container.querySelectorAll("details")].every(detail => !detail.open)).toBe(true)
  const stops = screen.getByRole("list", { name: "운동을 중단해야 하는 경우" })
  expect(stops).toBeVisible()
  expect(stops.querySelectorAll("li")).toHaveLength(4)
  expect(stops).toHaveTextContent("새 통증이나 심해지는 통증이 생기면 중단")
  expect(stops).toHaveTextContent("평소와 다른 호흡 곤란")
  expect(stops.closest("details")).toBeNull()
})
