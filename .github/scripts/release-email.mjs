import { readFileSync } from "node:fs"

const { VERSION, DRY_RUN = "true", RESEND_API_KEY, RESEND_AUDIENCE_ID, RELEASE_EMAIL_FROM } = process.env
// release-please notes carry commit links, markdown links and bold scopes: readers of the email get plain text.
const raw = readFileSync(`docs/releases/${VERSION}.md`, "utf8")
  .replace(/^---[\s\S]*?---\n/, "")
  .replace(/ \(\[[0-9a-f]{7,40}\]\([^)]*\)\)/g, "")
  .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
  .replace(/\*\*/g, "")
  .replace(/^\* /gm, "- ")
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;")
const html = raw
  .split("\n")
  .map((l) =>
    l.startsWith("# ")
      ? `<h1>${esc(l.slice(2))}</h1>`
      : /^###? /.test(l)
        ? `<h2>${esc(l.replace(/^###? /, ""))}</h2>`
        : l.startsWith("- ")
          ? `<p>• ${esc(l.slice(2))}</p>`
          : l
            ? `<p>${esc(l)}</p>`
            : "",
  )
  .join("\n")
const body = `${html}\n<p style="color:#888;font-size:12px"><a href="{{{RESEND_UNSUBSCRIBE_URL}}}">Unsubscribe</a></p>`
const subject = `Ritorno ${VERSION}: what is new`

if (DRY_RUN !== "false") {
  console.log(`dry run, nothing sent\nsubject: ${subject}\n\n${body}`)
  process.exit(0)
}
if (!RESEND_API_KEY || !RESEND_AUDIENCE_ID || !RELEASE_EMAIL_FROM) {
  throw new Error("set RESEND_API_KEY, RESEND_AUDIENCE_ID and RELEASE_EMAIL_FROM")
}

const resend = async (path, payload) => {
  const res = await fetch(`https://api.resend.com${path}`, {
    method: "POST",
    headers: { authorization: `Bearer ${RESEND_API_KEY}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`resend ${path} failed (${res.status}): ${(await res.text()).slice(0, 300)}`)
  return res.json()
}
const created = await resend("/broadcasts", {
  audience_id: RESEND_AUDIENCE_ID,
  from: RELEASE_EMAIL_FROM,
  subject,
  name: `release ${VERSION}`,
  html: body,
})
await resend(`/broadcasts/${created.id}/send`, {})
console.log(`broadcast ${created.id} sent`)
