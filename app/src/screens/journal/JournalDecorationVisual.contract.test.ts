import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const journalCss = readFileSync("src/styles/journal-decoration.css", "utf8")

function rule(selector: string): string {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&")
  return journalCss.match(new RegExp(`${escaped}\\s*\\{[^}]*\\}`, "u"))?.[0] ?? ""
}

describe("DS-05 journal decoration visual contract", () => {
  it("preserves the shared dock, drawer, and desktop tool geometry", () => {
    const dock = rule(".journal-decoration-editor__dock")
    const drawer = rule(".journal-decoration-workspace--open .journal-decoration-toolbar")
    const desktop = journalCss.slice(journalCss.lastIndexOf("@media (min-width: 760px)"))
    const desktopDrawer = desktop.match(
      /\.journal-decoration-workspace--open \.journal-decoration-toolbar\s*\{[^}]*\}/u,
    )?.[0] ?? ""

    expect(dock).toContain("58px")
    expect(drawer).toContain("bottom: calc(58px + env(safe-area-inset-bottom))")
    expect(drawer).toContain("max-height: min(44dvh, 380px)")
    expect(desktopDrawer).toContain("width: min(440px, 42vw)")
    expect(desktopDrawer).toContain("box-sizing: border-box")
  })

  it("fits a complete material tile into the compact mobile drawer", () => {
    const drawerHeader = rule(".journal-decoration-toolbar__drawer-header")
    const header = rule(".journal-decoration-toolbar__drawer-header > header")
    const filters = rule(".journal-decoration-toolbar__filters")
    const tile = rule(".journal-decoration-toolbar__material-tile")
    const preview = rule(".journal-decoration-toolbar__material-preview")

    expect(drawerHeader).not.toContain("position: sticky")
    expect(header).toContain("min-height: 48px")
    expect(filters).toContain("position: sticky")
    expect(filters).toContain("top: 0")
    expect(filters).toContain("padding: 4px 12px")
    expect(tile).toContain("min-height: 92px")
    expect(tile).toContain("grid-template-rows: 48px minmax(16px, auto)")
    expect(tile).toContain("grid-auto-rows: minmax(16px, auto)")
    expect(preview).toContain("height: 48px")
  })

  it("shrinks only the visible handle while retaining its 44px touch target", () => {
    const handle = rule(".decorated-journal-page__transform-handle")
    const visibleHandle = rule(".decorated-journal-page__transform-handle::before")

    expect(handle).toContain("width: 44px")
    expect(handle).toContain("height: 44px")
    expect(visibleHandle).toContain("width: 28px")
    expect(visibleHandle).toContain("height: 28px")
  })

  it("limits only the desktop reading body and leaves the canvas coordinate box untransformed", () => {
    const desktop = journalCss.slice(journalCss.lastIndexOf("@media (min-width: 760px)"))
    const readingWidth = desktop.match(
      /\.journal-decoration-workspace--open > \.decorated-journal-page \.decorated-journal-page__body,[\s\S]*?\{[^}]*\}/u,
    )?.[0] ?? ""

    expect(readingWidth).toContain("width: min(960px, calc(100% - min(440px, 42vw) - 32px))")
    expect(desktop).not.toMatch(/\.decorated-journal-page__free-layer\s*[,\{]/u)
    expect(readingWidth).not.toContain("transform:")
  })
})
