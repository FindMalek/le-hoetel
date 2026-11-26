import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock"
import defaultMdxComponents from "fumadocs-ui/mdx"
import type { MDXComponents } from "mdx/types"

export function getMDXComponents(components?: MDXComponents): MDXComponents {
  return {
    ...defaultMdxComponents,
    // Every code block is an unnamed scroll region; the title names it so several blocks on a page stay unique landmarks for axe.
    pre: ({ ref: _ref, title, children, ...props }) => (
      <CodeBlock {...props} title={title} viewportProps={title ? { "aria-label": title } : undefined}>
        <Pre>{children}</Pre>
      </CodeBlock>
    ),
    ...components,
  }
}
