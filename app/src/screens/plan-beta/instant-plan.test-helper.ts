import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"

export async function enterPlanWithoutRecord(event: string | RegExp = /^1500m/u): Promise<void> {
  const user = userEvent.setup()
  await user.click(screen.getByRole("radio", { name: "기록 없이" }))
  const match = typeof event === "string" ? event : event.source
  const distance = /하프|21097/u.test(match) ? "21097" : /마라톤|42195/u.test(match) ? "42195"
    : /10km|10000/u.test(match) ? "10000" : /5km|5000/u.test(match) ? "5000"
    : /3000/u.test(match) ? "3000" : /800/u.test(match) ? "800" : "1500"
  await user.selectOptions(screen.getByRole("combobox", { name: "종목" }), distance)
  await user.click(screen.getByRole("button", { name: "내 계획 받기" }))
}
