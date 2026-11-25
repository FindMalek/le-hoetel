import { expect, test } from "bun:test"
import { brandContrastIssues, brandStyle, contrastRatio, readableForeground } from "../color"

test("contrast follows WCAG and every brand color gets a readable foreground", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1)
  expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 1)
  expect(readableForeground("#f2b134")).toBe("#000000")
  expect(readableForeground("#0a7c66")).toBe("#ffffff")
  for (const gray of ["#757575", "#767676", "#808080", "#8a8a8a"]) {
    const foreground = readableForeground(gray)
    expect(contrastRatio(gray, foreground)).toBeGreaterThanOrEqual(4.5)
  }
})

test("a faint or too dark brand color is flagged for the theme it disappears in", () => {
  expect(brandContrastIssues("#f2e8b0")).toEqual(["light"])
  expect(brandContrastIssues("#101820")).toEqual(["dark"])
  expect(brandContrastIssues("#0a7c66")).toEqual([])
  expect(brandContrastIssues(null)).toEqual([])
  expect(brandStyle({ primaryColor: "#0a7c66", accentColor: null })).toEqual({
    "--primary": "#0a7c66",
    "--primary-foreground": "#ffffff",
  })
})
