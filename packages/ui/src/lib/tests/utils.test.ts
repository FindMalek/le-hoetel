import { expect, test } from "bun:test"
import { cn } from "../utils"

test("cn keeps a type scale size next to a text color", () => {
  expect(cn("text-caption", "text-muted-foreground")).toBe("text-caption text-muted-foreground")
})
