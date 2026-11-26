export interface FeedbackInput {
  message: string
  page?: string
}

// The repo is public: whatever can identify someone or open a session is cut before it leaves. Names cannot be detected, the widget says so.
const REDACTIONS: [RegExp, string][] = [
  [/\S*(?::\/\/|www\.|\.[a-z]{2,}\/|[?&#][\w-]+=)\S*/giu, "[link]"],
  [/[^\s@＠<>()]+\s*(?:@|＠|%40)\s*[\p{L}\p{M}\p{N}_-]+(?:\.[\p{L}\p{M}\p{N}_-]+)+/gu, "[email]"],
  [/(?=[\w.-]*\d)[\w.-]{20,}/g, "[code]"],
  // Any dash, plus invisible format characters like bidi marks, which Arabic keyboards put between digits.
  [/\+?\p{Nd}(?:[\s\p{Pd}\p{Cf}()./_,]*\p{Nd}){6,}/gu, "[number]"],
]

function redact(text: string): string {
  return REDACTIONS.reduce((result, [pattern, label]) => result.replace(pattern, label), text)
}

/** The route only: no query or hash, and any segment that is not a plain word (id, token) becomes `:id`. */
function publicPath(page: string): string {
  return (page.split(/[?#]/)[0] ?? "")
    .split("/")
    .map((segment) => (/^([a-z]{1,30}(-[a-z]{1,30})*)?$/.test(segment) ? segment : ":id"))
    .join("/")
}

/** A code block, so a stranger's text cannot mention users, load images or add links. */
function codeBlock(text: string): string {
  const longest = Math.max(2, ...(text.match(/`+/g) ?? []).map((run) => run.length))
  const fence = "`".repeat(longest + 1)
  return `${fence}text\n${text}\n${fence}`
}

/** Opens an issue labelled `feedback` in the project repo. Answers the issue number. */
export async function createFeedbackIssue(
  config: { repo: string; token: string; fetch?: typeof fetch },
  input: FeedbackInput,
): Promise<number> {
  const call = config.fetch ?? fetch
  const message = redact(input.message)
  const title = message.replace(/\s+/g, " ").trim().slice(0, 70)
  const page = input.page ? `\n\nPage: \`${publicPath(input.page)}\`` : ""
  const body = `${codeBlock(message)}${page}`
  const response = await call(`https://api.github.com/repos/${config.repo}/issues`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${config.token}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      "user-agent": "ritorno-feedback",
    },
    body: JSON.stringify({ title: `Feedback: ${title}`, body, labels: ["feedback"] }),
  })
  if (!response.ok) throw new Error(`GitHub answered ${response.status}`)
  return ((await response.json()) as { number: number }).number
}
