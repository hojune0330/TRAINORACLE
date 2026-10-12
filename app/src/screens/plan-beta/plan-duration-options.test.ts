import { describe, expect, it } from "vitest"
import type { PlanSession } from "@impl/plan-generator/types"
import { bindCatalogSession } from "@impl/prescription/catalog-session-binding"
import { easyDurationRows } from "./plan-duration-options"

function easySession(
  day: number,
  slot: "AM" | "PM",
  plannedEnergyIntent: "BASE_INTENT" | "RECOVERY_INTENT",
  minimum: number,
  maximum: number,
): PlanSession {
  const rpe = plannedEnergyIntent === "RECOVERY_INTENT"
    ? { minimum: 1, maximum: 2 }
    : { minimum: 3, maximum: 4 }
  return {
    day,
    slot,
    role: "EASY",
    plannedEnergyIntent,
    prescription: {
      kind: "RPE_TIME_RANGE",
      rpe,
      durationMinutes: { minimum, maximum },
    },
  }
}

describe("easy duration options", () => {
  it("groups the same method, intent, and per-session range across AM/PM while preserving each placement", () => {
    const sessions: readonly PlanSession[] = [
      easySession(3, "PM", "BASE_INTENT", 30, 45),
      easySession(1, "AM", "BASE_INTENT", 30, 45),
      easySession(4, "AM", "BASE_INTENT", 30, 30),
      easySession(2, "PM", "RECOVERY_INTENT", 30, 45),
      {
        day: 5,
        slot: "AM",
        role: "REST",
        plannedEnergyIntent: "RECOVERY_INTENT",
        prescription: { kind: "REST" },
      },
      {
        day: 5,
        slot: "PM",
        role: "QUALITY",
        plannedEnergyIntent: "VO2_INTENT",
        prescription: {
          kind: "RPE_TIME_RANGE",
          rpe: { minimum: 7, maximum: 8 },
          durationMinutes: { minimum: 30, maximum: 45 },
        },
      },
    ]
    const before = JSON.stringify(sessions)

    const rows = easyDurationRows(sessions)

    expect(JSON.stringify(sessions)).toBe(before)
    expect(rows.map(({ sessionCount }) => sessionCount)).toEqual([2, 1, 1])
    expect(rows[0]).toMatchObject({
      title: "저강도 달리기",
      minutesLabel: "30분~45분",
      sessionCount: 2,
      daysLabel: "1일차 오전 · 3일차 오후",
    })
    expect(rows[1]?.minutesLabel).toBe("30분")
    expect(rows[2]).toMatchObject({
      title: "회복 운동",
      minutesLabel: "30분~45분",
      daysLabel: "2일차 오후",
    })
    expect(new Set(rows.map(({ key }) => key)).size).toBe(3)
  })

  it("uses a verified catalog total instead of its original duration envelope", () => {
    const source = easySession(1, "AM", "BASE_INTENT", 30, 45)
    const bound = bindCatalogSession(source, "P-BASE-C", {
      eventDistanceM: 5000,
      experience: "DEVELOPING",
      availableSeconds: 45 * 60,
      confirmedRequirements: [],
      fiveK: null,
      segmentPaces: [],
    })

    expect(bound?.prescription.kind).toBe("RPE_TIME_RANGE")
    if (!bound || bound.prescription.kind !== "RPE_TIME_RANGE") throw new Error("synthetic catalog fixture failed")

    expect(bound.prescription.durationMinutes).toEqual({ minimum: 30, maximum: 30 })
    expect(easyDurationRows([bound])[0]?.minutesLabel).toBe("30분")
  })

  it("does not report a catalog envelope as a total when the binding cannot be resolved", () => {
    const bound = bindCatalogSession(easySession(1, "AM", "BASE_INTENT", 30, 45), "P-BASE-C", {
      eventDistanceM: 5000,
      experience: "DEVELOPING",
      availableSeconds: 45 * 60,
      confirmedRequirements: [],
      fiveK: null,
      segmentPaces: [],
    })
    expect(bound?.prescription.kind).toBe("RPE_TIME_RANGE")
    if (!bound || bound.role !== "EASY" || bound.prescription.kind !== "RPE_TIME_RANGE" || !bound.prescription.catalogWorkout) {
      throw new Error("synthetic catalog fixture failed")
    }
    const unavailable: PlanSession = {
      ...bound,
      day: 3,
      slot: "PM",
      prescription: {
        ...bound.prescription,
        catalogWorkout: {
          ...bound.prescription.catalogWorkout,
          catalogId: "UNAVAILABLE-SYNTHETIC-CATALOG",
        },
      },
    }
    const rows = easyDurationRows([bound, unavailable])

    expect(rows).toHaveLength(2)
    expect(rows.find(row => row.daysLabel === "3일차 오후")).toMatchObject({
      minutesLabel: "일부 시간 미정",
      sessionCount: 1,
    })
    expect(rows.find(row => row.daysLabel === "1일차 오전")?.minutesLabel).toBe("30분")
  })
})
