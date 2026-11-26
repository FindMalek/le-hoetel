import { createCn } from "cn/config"

// The type scale tokens in globals.css (`text-caption`, `text-display-xl`, ...) are font sizes; unconfigured, cn reads them as colors and drops one of `text-caption text-muted-foreground`.
export const cn = createCn({
  extend: {
    classGroups: {
      "font-size": [{ text: ["display-xl", "display", "h1", "h2", "h3", "lead", "body", "small", "caption"] }],
    },
  },
})
