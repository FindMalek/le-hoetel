import { getTemplate, type TemplateName } from "@ritorno/notification/templates"
import { createElement } from "react"

// The dashboard dev server, so the logo image in the header loads.
const APP_URL = "http://localhost:3002"

/** The preview page for a template: the package's own component with its sample props. */
export function preview(name: TemplateName) {
  const { Email, preview: props } = getTemplate(name)
  // biome-ignore lint/correctness/noComponentHookFactories: a factory called once at module level
  const Preview = () => createElement(Email, { ...props, appUrl: APP_URL })
  Preview.displayName = name
  return Preview
}
