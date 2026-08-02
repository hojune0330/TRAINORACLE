import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it } from "vitest"
import { AccountNetworkSettings } from "./AccountNetworkSettings"

afterEach(cleanup)

describe("account network settings feature boundaries", () => {
  it("keeps product analytics consent hidden while its feature flag is off", () => {
    render(<AccountNetworkSettings userId="athlete-a" today="2026-08-02" />)

    expect(screen.queryByRole("checkbox", { name: "선택 사용 흐름 분석 허용" })).not.toBeInTheDocument()
    expect(screen.queryByText(/사용 흐름 분석/u)).not.toBeInTheDocument()
  })
})
