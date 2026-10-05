import {cleanup,render,screen} from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {afterEach,describe,expect,it,vi} from "vitest"
import {AccountDataRightsPanel} from "./AccountDataRightsPanel"
afterEach(cleanup)
describe("explicit data-rights action",()=>{
  it("never downloads on mount, requires a click and distinguishes export from restore",async()=>{
    const exportData=vi.fn().mockResolvedValue({ok:false,message:"합성 요청 미완료"})
    render(<AccountDataRightsPanel userId="synthetic-owner" exportData={exportData}/>)
    expect(exportData).not.toHaveBeenCalled()
    expect(screen.getByText(/앱으로 자동 복구하지 않아요/)).toBeVisible()
    await userEvent.click(screen.getByRole("button",{name:"선택한 자료 내려받기"}))
    expect(exportData).toHaveBeenCalledWith("synthetic-owner","journal",expect.any(Function))
    expect(screen.getByRole("status")).toHaveTextContent("합성 요청 미완료")
  })
})
