import { cn } from "@ritorno/ui/lib/utils"
import { Callout, type CalloutType } from "fumadocs-ui/components/callout"
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"
import type { ComponentProps } from "react"

const CALLOUT_TONE: Record<CalloutType, string> = {
  info: "bg-info-soft",
  idea: "bg-info-soft",
  warn: "bg-warning-soft",
  warning: "bg-warning-soft",
  error: "bg-destructive-soft",
  success: "bg-success-soft",
}

function ToneCallout({ type = "info", className, ...props }: ComponentProps<typeof Callout>) {
  return (
    <Callout type={type} className={cn("rounded-card border-transparent", CALLOUT_TONE[type], className)} {...props} />
  )
}

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    Callout: ToneCallout,
    // Every code block is an unnamed scroll region; the title names it so several blocks on a page stay unique landmarks for axe.
    pre: ({ ref: _ref, title, children, className, ...props }) => (
      <CodeBlock
        {...props}
        title={title}
        className={cn("rounded-browser bg-surface", className)}
        viewportProps={title ? { "aria-label": title } : undefined}
      >
        <Pre>{children}</Pre>
      </CodeBlock>
    ),
    ...components,
  }
}
