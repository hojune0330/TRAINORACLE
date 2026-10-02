import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { CalendarDecorationFrame } from "./CalendarDecorationFrame"
import { calendarDecorationStateSchema } from "../domain/calendar-decoration-schema"

afterEach(cleanup)

const frameState = calendarDecorationStateSchema.parse({
  version: 1,
  paperThemeId: "THEME_TRACK_NOTEBOOK",
  items: [{ placementId: "60d2a6f0-2305-4ef0-9f92-340a98500e8c", itemId: "STICKER_WEATHER_SUN", region: "HEADER_MARGIN",
    transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }],
})

describe("CalendarDecorationFrame owner-filtered preview", () => {
  it("renders only assets present in the confirmed owner's allowed-item snapshot", () => {
    const { container, rerender } = render(<CalendarDecorationFrame state={frameState} allowedItemIds={new Set()}><div>calendar</div></CalendarDecorationFrame>)
    expect(container.querySelectorAll(".calendar-decoration-frame__item")).toHaveLength(0)
    expect(container.querySelector<HTMLElement>(".calendar-decoration-frame")?.style.getPropertyValue("--calendar-paper-art")).toBe("")

    rerender(<CalendarDecorationFrame state={frameState} allowedItemIds={new Set(["STICKER_WEATHER_SUN"])}><div>calendar</div></CalendarDecorationFrame>)
    expect(container.querySelectorAll(".calendar-decoration-frame__item")).toHaveLength(1)
    expect(container.querySelector<HTMLElement>(".calendar-decoration-frame")?.style.getPropertyValue("--calendar-paper-art")).toBe("")
  })
})
