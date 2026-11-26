<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/grid.svg?title=Ritorno&subtitle=Loyalty+and+guest+relationships+for+hotels+in+Tunisia&align=left&mode=dark" />
    <img alt="Ritorno" src="https://shieldcn.dev/header/grid.svg?title=Ritorno&subtitle=Loyalty+and+guest+relationships+for+hotels+in+Tunisia&align=left&mode=light" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/FindMalek/ritorno/actions/workflows/ci.yml"><img alt="build" src="https://shieldcn.dev/github/ci/FindMalek/ritorno.svg?variant=secondary" /></a>
  <a href="https://github.com/FindMalek/ritorno/blob/main/LICENSE"><img alt="license" src="https://shieldcn.dev/github/license/FindMalek/ritorno.svg?variant=secondary" /></a>
  <img alt="Next.js" src="https://shieldcn.dev/badge/Next.js-16-black.svg?logo=nextdotjs&variant=secondary" />
  <img alt="TypeScript" src="https://shieldcn.dev/badge/TypeScript-5-black.svg?logo=typescript&variant=secondary" />
  <img alt="Bun" src="https://shieldcn.dev/badge/Bun-api-black.svg?logo=bun&variant=secondary" />
  <img alt="Turborepo" src="https://shieldcn.dev/badge/Turborepo-monorepo-black.svg?logo=turborepo&variant=secondary" />
</p>

Loyalty and guest relationships for hotels in Tunisia

Ritorno helps a hotel own its relationship with its guests, not the booking site or the tour operator. A guest scans a QR code in the room or at the restaurant table, leaves a name, a phone and a clear consent for WhatsApp and email, and the hotel can then talk to them in French, Arabic or English: a welcome, a birthday message, offers to fill low season, and a short survey after the stay. A low score alerts the manager the same day, and every guest gets the Google review invite.

- **Recognition, not points.** Simple perks delivered as offers with a redemption QR.
- **Consent first.** Consent is logged per channel in an append-only log, every message has an unsubscribe or STOP, and the hotel can export and delete guest data at any time.
- **One hotel, one organization.** Every guest and every query is scoped to a hotel. Branding (logo, colors, name, language) is configuration, never custom code.
- **Email and WhatsApp first.** SMS comes later. English, French and Arabic (right to left) everywhere.

The product, the research behind it, the decisions and the roadmap are in the docs site (`apps/docs`, run `pnpm turbo dev -F docs`). Start with the vision, the decisions and the pitch playbook. Prices in the docs are untested guesses.

---

## Quickstart

You need node 24, pnpm, bun, docker and the Infisical cli.

```bash
pnpm install
infisical login   # once, secrets come from Infisical (docs: Secrets)
pnpm db:up
pnpm dev
```

| App | Url | What it is |
| --- | --- | --- |
| `apps/web` | http://localhost:3000 | landing page |
| `apps/api` | http://localhost:3001 | orpc api on bun |
| `apps/dashboard` | http://localhost:3002 | login and app shell |
| `apps/docs` | http://localhost:3003 | docs site |

Sign in to the dashboard with `ADMIN_EMAIL` and `ADMIN_PASSWORD` of the Infisical `dev` environment.

---

## Structure

```text
ritorno/
├─ apps/
│  ├─ web/        landing page
│  ├─ dashboard/  login and app shell
│  ├─ docs/       docs site
│  └─ api/        orpc on bun
├─ packages/      ui, common, orpc, db, auth, env, config
├─ docker/        local postgres
└─ turbo.json
```

| Package | What it holds |
| --- | --- |
| `@ritorno/ui` | shadcn components and the theme tokens |
| `@ritorno/common` | zod schemas, constants and utils shared by api, web and dashboard |
| `@ritorno/orpc` | procedures and typed clients |
| `@ritorno/db` | drizzle schema, migrations, seed scenario |
| `@ritorno/auth` | better-auth setup |
| `@ritorno/env` | zod-validated env, values from Infisical |

`apps/api` is the only app that touches the database, auth and providers. `web` and `dashboard` call it through `@ritorno/orpc`.

---

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | run every app |
| `pnpm build` | build everything with turbo |
| `pnpm lint` | biome and oxlint |
| `pnpm check` | biome format and fix |
| `pnpm check-types` | typescript across the repo |
| `pnpm test` | tests in every package, against postgres (`pnpm db:up` first) |
| `pnpm test:e2e` | playwright smoke test of web, dashboard and api |
| `pnpm db:generate` / `db:migrate` / `db:seed` / `db:studio` | drizzle |
| `pnpm ui:add <component>` | add a shadcn component |
| `pnpm bump-deps` | update every dependency, catalog included, to the latest version |

---

## Deploy

Every app has a `Dockerfile` in `apps/<app>/`, built from the repo root:

```bash
docker build -f apps/web/Dockerfile -t ritorno-web .
```

The Next apps also run on Vercel with the app folder as the root directory. Set the same env keys everywhere, see `.env.example`.

### Environments

| | web | dashboard | api | docs |
| --- | --- | --- | --- | --- |
| production | [ritorno](https://ritorno.findmalek.engineer) | [app-ritorno](https://app-ritorno.findmalek.engineer) | [api-ritorno](https://api-ritorno.findmalek.engineer/health) | [docs-ritorno](https://docs-ritorno.findmalek.engineer) |
| staging | [staging-ritorno](https://staging-ritorno.findmalek.engineer) | [app-staging-ritorno](https://app-staging-ritorno.findmalek.engineer) | [api-staging-ritorno](https://api-staging-ritorno.findmalek.engineer/health) | [docs-staging-ritorno](https://docs-staging-ritorno.findmalek.engineer) |

- every merge to `main` deploys staging only, merging the release PR deploys production (`.github/workflows/staging.yml`, `release.yml`)
- every PR gets a preview at `pr-<N>-<app>.preview-ritorno.findmalek.engineer` for what changed, the rest links to staging, see the docs page `previews`. WhoDB for preview databases: [whodb-ritorno](https://whodb-ritorno.findmalek.engineer)
- releases: release-please keeps a release PR open (version and `CHANGELOG.md`), merging it tags `vX.Y.Z` and deploys production. Rollback or redeploy: run the `release` workflow with a tag
- rollback, backups and setup: docs pages `deploy-runbook` and `releases`

---

## Agents

The Next apps carry an `AGENTS.md` that points coding agents at the bundled Next docs. Keep shared types in `packages/common` and use the theme tokens instead of raw colors.

The docs site serves `/llms.txt`, `/llms-full.txt` and every page as markdown at `<page-url>.md`, so agents can read the docs without scraping html.

---

<p align="center"><sub>The name, pitch and social card colors live in <code>apps/web/lib/site.ts</code></sub></p>
