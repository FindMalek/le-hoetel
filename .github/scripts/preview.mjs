import { execFileSync } from "node:child_process"
import { appendFileSync, existsSync, readdirSync, readFileSync } from "node:fs"
import {
  createApplication,
  createDomain,
  createGithubDeployment,
  createPostgres,
  deployApplication,
  deployPostgres,
  failureExcerpt,
  findStickyComment,
  getApplication,
  getPostgres,
  inspectUrl,
  listDeployments,
  removePostgres,
  saveBuildType,
  saveEnvironment,
  saveGitProvider,
  setDeploymentStatus,
  upsertComment,
} from "./preview-api.mjs"
import { demoOwnerEmail } from "./preview-demo.mjs"
import {
  dockerPort,
  PREVIEW_SECRET_VERSION,
  pickLatest,
  prAppName,
  previewDb,
  previewHost,
  previewSecret,
  renderComment,
  stagingUrl,
  toStatus,
} from "./preview-lib.mjs"
import { formatDotenv, infisicalConfigured, pullSecrets } from "./secrets-lib.mjs"

const env = process.env
const summary = (text) => env.GITHUB_STEP_SUMMARY && appendFileSync(env.GITHUB_STEP_SUMMARY, `${text}\n`)

const missing = ["DOKPLOY_URL", "DOKPLOY_TOKEN", "PREVIEW_DOMAIN", "DOKPLOY_ENVIRONMENT_ID"].filter((k) => !env[k])
if (missing.length) {
  summary(
    `### Preview skipped\n\nSet ${missing.map((k) => `\`${k}\``).join(", ")} (repo variables, \`DOKPLOY_TOKEN\` as a secret) to enable PR previews.`,
  )
  console.log(`skipping, missing: ${missing.join(", ")}`)
  process.exit(0)
}

const repo = env.GITHUB_REPOSITORY
const pr = Number(env.PR_NUMBER)
const sha = env.HEAD_SHA
const ref = env.HEAD_REF
const timeoutMs = Number(env.PREVIEW_TIMEOUT_MIN ?? 25) * 60_000
const https = env.PREVIEW_HTTPS !== "false"

function discoverApps() {
  const apps = existsSync("apps")
    ? readdirSync("apps").map((a) => ({ app: a, dockerfile: `apps/${a}/Dockerfile` }))
    : []
  if (existsSync("docs/Dockerfile")) apps.push({ app: "docs", dockerfile: "docs/Dockerfile" })
  return apps.filter((a) => existsSync(a.dockerfile))
}

const all = discoverApps()

// Smart reuse: only what turbo says changed (and what depends on it) is built, the rest links to staging.
function affectedApps() {
  try {
    const base = env.BASE_REF ? `origin/${env.BASE_REF}` : "origin/main"
    const out = execFileSync("npx", ["--yes", "turbo@2.11.9", "ls", "--affected", "--output=json"], {
      encoding: "utf8",
      env: { ...env, TURBO_SCM_BASE: base, TURBO_SCM_HEAD: sha },
    })
    return new Set(JSON.parse(out).packages.items.map((p) => p.name))
  } catch (e) {
    console.log(`turbo ls --affected failed, deploying everything: ${e.message}`)
    return null
  }
}
const affected = affectedApps()
const isAffected = (app) => !affected || affected.has(app)
const hasApi = all.some((a) => a.app === "api")
const apiChanged = hasApi && isAffected("api")
const apps = all.filter(({ app }) => {
  if (app === "api") return apiChanged
  if (app === "docs") return isAffected("docs")
  return apiChanged || isAffected(app)
})
const deployed = new Set(apps.map((a) => a.app))
const hostOf = (app) => previewHost(pr, app, env.PREVIEW_DOMAIN)
const previewUrl = (app) => `${https ? "https" : "http"}://${hostOf(app)}`
const urlOf = (app) => (deployed.has(app) ? previewUrl(app) : stagingUrl(app, env.STAGING_DOMAIN || undefined))
const db = apiChanged ? previewDb(pr, env.DOKPLOY_TOKEN, "") : null
const password = previewSecret(env.DOKPLOY_TOKEN, pr, "demo")
// The PR comment is public: errors from Dokploy can echo env or connection strings, so secrets are cut out first.
const secretValues = () =>
  [password, db?.password, env.DOKPLOY_TOKEN, ...Object.values(infisicalEnv)].filter((v) => String(v ?? "").length >= 8)
const masked = (text) => secretValues().reduce((t, secret) => t.split(String(secret)).join("***"), String(text))
const fromInfisical = infisicalConfigured(env)
const infisicalEnv = fromInfisical ? await pullSecrets("preview", env) : {}

const sticky = await findStickyComment(repo, pr)
const state = { ...(sticky?.state ?? {}) }
let commentId = sticky?.id
const now = () => new Date().toISOString()
const rows = all.map(({ app }) =>
  deployed.has(app)
    ? { app, status: "building", url: urlOf(app), updatedAt: now() }
    : { app, status: "reused", url: urlOf(app), updatedAt: now() },
)

function extraInfo() {
  const tools = []
  if (env.OPENOBSERVE_PUBLIC_URL)
    tools.push({
      name: `OpenObserve (stream pr-${pr})`,
      url: `${env.OPENOBSERVE_PUBLIC_URL.replace(/\/+$/, "")}/web/logs`,
    })
  if (env.UMAMI_URL && env.UMAMI_API_TOKEN) tools.push({ name: "Umami", url: env.UMAMI_URL })
  if (env.GLITCHTIP_URL && env.GLITCHTIP_API_TOKEN) tools.push({ name: "GlitchTip", url: env.GLITCHTIP_URL })
  const extra = { tools }
  if (!deployed.size) extra.note = "No app changed in this PR, every link points to staging."
  else if (!apiChanged)
    extra.note = `The api did not change: previews use the **staging api and database** (shared, demo data). Unchanged apps link to staging.`
  if (apiChanged) {
    extra.creds = {
      ownerEmail: demoOwnerEmail("dar-zitouna"),
      adminEmail: env.PREVIEW_ADMIN_EMAIL ?? "admin@ritorno.local",
    }
    if (state._db) extra.db = { host: state._db, port: db.port, database: db.database, user: db.user }
    extra.whodbUrl = env.WHODB_URL || "https://whodb-ritorno.findmalek.engineer"
  }
  return extra
}

let queue = Promise.resolve()
function publish() {
  queue = queue.then(async () => {
    const res = await upsertComment(repo, pr, renderComment({ pr, sha, rows, state, extra: extraInfo() }), commentId)
    commentId = res.id
  })
  return queue
}

function appEnv(app) {
  const apiPublic = urlOf("api")
  const lines = {
    WEB_URL: urlOf("web"),
    DASHBOARD_URL: urlOf("dashboard"),
    DOCS_URL: urlOf("docs"),
    API_PUBLIC_URL: apiPublic,
  }
  if (app === "api") {
    Object.assign(lines, {
      DEPLOY_ENV: `pr-${pr}`,
      DATABASE_URL: `postgres://${db.user}:${db.password}@${state._db}:5432/${db.database}`,
      SEED: "demo",
      DEMO_PASSWORD: password,
      DEMO_VIEWER_PASSWORD: previewSecret(env.DOKPLOY_TOKEN, pr, "viewer"),
      ADMIN_EMAIL: env.PREVIEW_ADMIN_EMAIL ?? "admin@ritorno.local",
      ADMIN_PASSWORD: password,
      BETTER_AUTH_SECRET: previewSecret(env.DOKPLOY_TOKEN, pr, "auth", 40),
      MESSAGING_LIVE: "false",
    })
  } else {
    lines.API_URL = apiPublic
  }
  if (fromInfisical) return formatDotenv({ ...infisicalEnv, ...lines })
  return [...Object.entries(lines).map(([k, v]) => `${k}=${v}`), env.PREVIEW_APP_ENV ?? ""].filter(Boolean).join("\n")
}

async function ensurePostgres() {
  // A postgres made before a secret rotation still has the old password: recreate it, preview data is demo only.
  if (state.postgres && state._sv !== PREVIEW_SECRET_VERSION) {
    await removePostgres(state.postgres).catch(() => {})
    delete state.postgres
    delete state._db
  }
  if (!state.postgres) {
    const created = await createPostgres(`pr-${pr}-db`, env.DOKPLOY_ENVIRONMENT_ID, db)
    state.postgres = created.postgresId
    state._db = created.appName
    state._sv = PREVIEW_SECRET_VERSION
    await publish()
    await deployPostgres(state.postgres)
  }
  const deadline = Date.now() + 5 * 60_000
  while (Date.now() < deadline) {
    if ((await getPostgres(state.postgres)).applicationStatus === "done") return
    await new Promise((r) => setTimeout(r, 5_000))
  }
  throw new Error("preview postgres did not start")
}

function gitUrl() {
  const auth = env.PREVIEW_GIT_TOKEN ? `x-access-token:${env.PREVIEW_GIT_TOKEN}@` : ""
  return `https://${auth}github.com/${repo}.git`
}

async function ensureApplication({ app, dockerfile }) {
  if (state[app]) return state[app]
  const name = prAppName(pr, app)
  const created = await createApplication(name, env.DOKPLOY_ENVIRONMENT_ID)
  const id = created.applicationId
  if (!id) throw new Error("application.create returned no applicationId")
  state[app] = id
  await createDomain({
    host: hostOf(app),
    port: dockerPort(readFileSync(dockerfile, "utf8")),
    https,
    certificateType: https ? "letsencrypt" : "none",
    applicationId: id,
    domainType: "application",
  })
  return id
}

async function waitForDeployment(applicationId, known) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const d = pickLatest((await listDeployments(applicationId)).filter((x) => !known.has(x.deploymentId)))
    if (d && toStatus(d) !== "building") return d
    await new Promise((r) => setTimeout(r, 10_000))
  }
  return null
}

const pending = new Set()
process.on("SIGINT", async () => {
  await Promise.allSettled(
    [...pending].map((id) => setDeploymentStatus(repo, id, "failure", { description: "run cancelled" })),
  )
  process.exit(130)
})

async function runApp({ app, dockerfile }) {
  const row = rows.find((r) => r.app === app)
  const ghDeployment = await createGithubDeployment(repo, sha, `preview-${pr}`, `${app} preview for #${pr}`)
  pending.add(ghDeployment)
  const status = (st, extra) => setDeploymentStatus(repo, ghDeployment, st, { auto_inactive: false, ...extra })
  try {
    if (app === "api") await ensurePostgres()
    const id = await ensureApplication({ app, dockerfile })
    row.inspectUrl = inspectUrl(id, await getApplication(id).catch(() => null))
    await status("in_progress", { log_url: row.inspectUrl, environment_url: row.url })
    await publish()
    await saveGitProvider({
      applicationId: id,
      customGitUrl: gitUrl(),
      customGitBranch: ref,
      customGitBuildPath: "/",
      watchPaths: null,
    })
    await saveBuildType({
      applicationId: id,
      buildType: "dockerfile",
      dockerfile,
      dockerContextPath: ".",
      dockerBuildStage: app === "api" ? "runner" : null,
      herokuVersion: null,
      railpackVersion: null,
    })
    await saveEnvironment({
      applicationId: id,
      env: appEnv(app),
      buildArgs: null,
      buildSecrets: null,
      createEnvFile: true,
    })
    const known = new Set((await listDeployments(id)).map((x) => x.deploymentId))
    await deployApplication(id, `PR #${pr} ${sha.slice(0, 7)}`)
    const done = await waitForDeployment(id, known)
    row.status = done ? toStatus(done) : "failed"
    if (row.status === "failed") row.error = done ? masked(failureExcerpt(done)) : "timed out waiting for the build"
  } catch (e) {
    row.status = "failed"
    row.error = masked(e.message ?? e)
  }
  row.updatedAt = now()
  pending.delete(ghDeployment)
  await status(row.status === "ready" ? "success" : "failure", {
    log_url: row.inspectUrl ?? env.RUN_URL,
    environment_url: row.url,
  })
  await publish()
}

await publish()
await Promise.all(apps.map(runApp))
await publish()

summary(`### Preview deployments\n\n${rows.map((r) => `- ${r.app}: ${r.status} ${r.url}`).join("\n")}`)
if (rows.some((r) => r.status === "failed")) process.exit(1)
