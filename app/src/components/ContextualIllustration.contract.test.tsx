import React from "react"
import { readFileSync } from "node:fs"
import { createHash } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"
import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { ContextualIllustration } from "./ContextualIllustration"

afterEach(() => { cleanup(); vi.unstubAllEnvs() })

describe("optional contextual illustrations", () => {
  it("uses a fixed, decorative, lazy image rather than an interactive status icon", () => {
    const { container } = render(<ContextualIllustration image="journal-guide" />)
    const image = container.querySelector("img")!
    expect(image.getAttribute("alt")).toBe("")
    expect(image.getAttribute("aria-hidden")).toBe("true")
    expect(image.getAttribute("loading")).toBe("lazy")
    expect(image.getAttribute("decoding")).toBe("async")
    expect(image.getAttribute("width")).toBe("64")
    expect(image.getAttribute("height")).toBe("64")
    expect(image.getAttribute("draggable")).toBe("false")
    expect(screen.queryByRole("img")).toBeNull()
  })

  it("resolves images from the configured app base, including preview subpaths", () => {
    vi.stubEnv("BASE_URL", "/TRAINORACLE/previews/example/")
    const { container } = render(<ContextualIllustration image="watch-file" size="medium" />)
    const image = container.querySelector("img")!
    expect(image.getAttribute("src")).toBe("/TRAINORACLE/previews/example/illustrations/watch-file-guide-v1.webp")
    expect(image.getAttribute("width")).toBe("80")
    expect(image.getAttribute("height")).toBe("80")
  })

  it("drops only the failed image and keeps nearby words and actions usable", () => {
    const action = vi.fn()
    const { container } = render(<section><h2>파일을 선택해요</h2><ContextualIllustration image="watch-file" /><button onClick={action}>파일 고르기</button></section>)
    fireEvent.error(container.querySelector("img")!)
    expect(container.querySelector("img")).toBeNull()
    expect(screen.getByRole("heading")).toBeVisible()
    fireEvent.click(screen.getByRole("button", { name: "파일 고르기" }))
    expect(action).toHaveBeenCalledOnce()
  })

  it("allows a different illustration after a previous file failed", () => {
    const { container, rerender } = render(<ContextualIllustration image="watch-file" />)
    fireEvent.error(container.querySelector("img")!)
    rerender(<ContextualIllustration image="training-track" />)
    expect(container.querySelector("img")?.getAttribute("src")).toMatch(/illustrations\/training-track-break-v1\.webp$/u)
  })

  it.each(["plan-notebook", "journal-saved", "running-shoe", "analysis-lens", "watch-file-v2", "decorating-kit-v2"] as const)("registers the optional %s artwork without changing fixed decorative behavior", image => {
    const { container } = render(<ContextualIllustration image={image} />)
    const artwork = container.querySelector("img")!
    expect(artwork).toHaveAttribute("alt", "")
    expect(artwork).toHaveAttribute("width", "64")
    expect(artwork).toHaveAttribute("height", "64")
    expect(artwork).toHaveAttribute("loading", "lazy")
    expect(artwork.getAttribute("src")).toMatch(/-v2\.webp$/u)
    fireEvent.error(artwork)
    expect(container.querySelector("img")).toBeNull()
  })

  it("ships the registered small alpha derivatives without adding them to the service worker precache", () => {
    const manifest = JSON.parse(readFileSync("../docs/handoff/contextual-illustrations.json", "utf8")) as {
      totalBytes: number
      assets: {outputName: string; bytes: number; hasAlpha: boolean; sha256: string}[]
    }
    const component = readFileSync("src/components/ContextualIllustration.tsx", "utf8")
    const worker = readFileSync("public/sw.js", "utf8")
    expect(manifest.assets.reduce((total, asset) => total + asset.bytes, 0)).toBe(manifest.totalBytes)
    for (const asset of manifest.assets) {
      const file = readFileSync(`public/illustrations/${asset.outputName}`)
      expect(file.byteLength).toBe(asset.bytes)
      expect(createHash("sha256").update(file).digest("hex")).toBe(asset.sha256)
      expect(file.subarray(0, 4).toString()).toBe("RIFF")
      expect(file.subarray(8, 12).toString()).toBe("WEBP")
      expect(asset.hasAlpha).toBe(true)
      expect(component).toContain(asset.outputName)
      expect(worker).not.toContain(asset.outputName)
    }
  })

  it.each(["training-map", "pace-stopwatch", "record-stopwatch", "plan-adjust"] as const)("keeps %s task artwork optional and non-interactive", image => {
    const { container } = render(<ContextualIllustration image={image} />)
    const artwork = container.querySelector("img")!
    expect(artwork).toHaveAttribute("alt", "")
    expect(artwork).toHaveAttribute("aria-hidden", "true")
    expect(artwork).toHaveAttribute("width", "64")
    expect(artwork.getAttribute("src")).toMatch(/-v3\.webp$/u)
    expect(screen.queryByRole("img")).toBeNull()
    fireEvent.error(artwork)
    expect(container.querySelector("img")).toBeNull()
  })
})
