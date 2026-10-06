import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

export async function enterPlanWithoutRecord(event: string | RegExp = /^1500m/u): Promise<void> {
  const user = userEvent.setup()
  const match = typeof event === "string" ? event : event.source
  const label = /하프|21097/u.test(match) ? "하프 마라톤" : /마라톤|42195/u.test(match) ? "마라톤"
    : /10km|10000/u.test(match) ? "10km" : /5km|5000/u.test(match) ? "5km"
    : /3000/u.test(match) ? "3000m" : /800/u.test(match) ? "800m" : "1500m"
  await user.click(screen.getByRole("button", { name: label }))
  await user.click(screen.getByRole("button", { name: "기록 없이" }))
}
