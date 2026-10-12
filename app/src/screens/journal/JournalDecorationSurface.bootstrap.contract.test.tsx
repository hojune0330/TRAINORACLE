import React from "react"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { DECORATION_STATE_EVENT, readDecorationStateSerialized } from "../../domain/decorations"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { JournalDecorationSurface } from "./JournalDecorationSurface"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null) })
afterEach(() => { cleanup(); vi.restoreAllMocks(); localStorage.clear(); setActiveLocalAccount(null) })

it("initializes empty decoration storage after commit and before mounting an editable session", async () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {})
  const writesBeforeEditing: boolean[] = []
  const originalSet = Storage.prototype.setItem
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key, value) {
    if (key.includes("decorations")) writesBeforeEditing.push(document.querySelector(".journal-decoration-workspace") === null)
    originalSet.call(this, key, value)
  })
  function MountedPreview() {
    const [revision, setRevision] = React.useState(0)
    React.useEffect(() => {
      const update = () => setRevision(value => value + 1)
      window.addEventListener(DECORATION_STATE_EVENT, update)
      return () => window.removeEventListener(DECORATION_STATE_EVENT, update)
    }, [])
    return <output aria-label="합성 꾸미기 미리보기 갱신">{revision}</output>
  }
  function Fixture() {
    const [open, setOpen] = React.useState(false)
    return <><MountedPreview /><button type="button" onClick={() => setOpen(true)}>꾸미기 화면 열기</button>
      {open && <JournalDecorationSurface date="2026-10-08" hasEntries><article>합성 일지 본문</article></JournalDecorationSurface>}
    </>
  }
  render(<Fixture />)
  expect(readDecorationStateSerialized()).toBeNull()
  fireEvent.click(screen.getByRole("button", { name: "꾸미기 화면 열기" }))
  expect(await screen.findByText("합성 일지 본문")).toBeVisible()
  expect(readDecorationStateSerialized()).not.toBeNull()
  expect(screen.getByLabelText("합성 꾸미기 미리보기 갱신")).toHaveTextContent("1")
  expect(writesBeforeEditing).not.toHaveLength(0)
  expect(writesBeforeEditing.every(Boolean)).toBe(true)
  expect(errors.mock.calls.some(args => args.join(" ").includes("while rendering a different component"))).toBe(false)
})
