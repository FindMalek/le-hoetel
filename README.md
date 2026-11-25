<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/grid.svg?title=Le+Hoetel&subtitle=Loyalty+and+guest+relationships+for+hotels+in+Tunisia&align=left&mode=dark" />
    <img alt="Le Hoetel" src="https://shieldcn.dev/header/grid.svg?title=Le+Hoetel&subtitle=Loyalty+and+guest+relationships+for+hotels+in+Tunisia&align=left&mode=light" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/FindMalek/le-hoetel/actions/workflows/ci.yml"><img alt="build" src="https://shieldcn.dev/github/ci/FindMalek/le-hoetel.svg?variant=secondary" /></a>
  <a href="https://github.com/FindMalek/le-hoetel/blob/main/LICENSE"><img alt="license" src="https://shieldcn.dev/github/license/FindMalek/le-hoetel.svg?variant=secondary" /></a>
  <img alt="Next.js" src="https://shieldcn.dev/badge/Next.js-16-black.svg?logo=nextdotjs&variant=secondary" />
  <img alt="TypeScript" src="https://shieldcn.dev/badge/TypeScript-5-black.svg?logo=typescript&variant=secondary" />
  <img alt="Bun" src="https://shieldcn.dev/badge/Bun-api-black.svg?logo=bun&variant=secondary" />
  <img alt="Turborepo" src="https://shieldcn.dev/badge/Turborepo-monorepo-black.svg?logo=turborepo&variant=secondary" />
</p>

Loyalty and guest relationships for hotels in Tunisia

Le Hoetel helps a hotel own its relationship with its guests, not the booking site or the tour operator. A guest scans a QR code in the room or at the restaurant table, leaves a name, a phone and a clear consent for WhatsApp and email, and the hotel can then talk to them in French, Arabic or English: a welcome, a birthday message, offers to fill low season, and a short survey after the stay. A low score alerts the manager the same day, and every guest gets the Google review invite.

- **Recognition, not points.** Simple perks delivered as offers with a redemption QR.
- **Consent first.** Consent is logged per channel in an append-only log, every message has an unsubscribe or STOP, and the hotel can export and delete guest data at any time.
- **One hotel, one organization.** Every guest and every query is scoped to a hotel. Branding (logo, colors, name, language) is configuration, never custom code.
- **Email and WhatsApp first.** SMS comes later. English, French and Arabic (right to left) everywhere.

The product, the research behind it, the decisions and the roadmap are in the docs site (`apps/docs`, run `pnpm turbo dev -F docs`). Start with the vision, the decisions and the pitch playbook. Prices in the docs are untested guesses.

---

## Quickstart

You need node 24, pnpm, bun and docker. The project is already installed and has a `.env` with generated secrets.

```bash
pnpm db:up
pnpm dev
```

| App | Url | What it is |
| --- | --- | --- |
| `apps/web` | http://localhost:3000 | landing page |
| `apps/api` | http://localhost:3001 | orpc api on bun |
| `apps/dashboard` | http://localhost:3002 | login and app shell |
| `apps/docs` | http://localhost:3003 | docs site |

Sign in to the dashboard with `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`.

---

## Structure

```text
le-hoetel/
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
| `@le-hoetel/ui` | shadcn components and the theme tokens |
| `@le-hoetel/common` | zod schemas, constants and utils shared by api, web and dashboard |
| `@le-hoetel/orpc` | procedures and typed clients |
| `@le-hoetel/db` | drizzle schema, migrations, seed scenario |
| `@le-hoetel/auth` | better-auth setup |
| `@le-hoetel/env` | zod-validated env, one root `.env` |

`apps/api` is the only app that touches the database, auth and providers. `web` and `dashboard` call it through `@le-hoetel/orpc`.

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
docker build -f apps/web/Dockerfile -t le-hoetel-web .
```

The Next apps also run on Vercel with the app folder as the root directory. Set the same env keys everywhere, see `.env.example`.

### Environments

| | web | dashboard | api | docs |
| --- | --- | --- | --- | --- |
| production | [lehoetel](https://lehoetel.findmalek.engineer) | [app-lehoetel](https://app-lehoetel.findmalek.engineer) | [api-lehoetel](https://api-lehoetel.findmalek.engineer/health) | [docs-lehoetel](https://docs-lehoetel.findmalek.engineer) |
| staging | [staging-lehoetel](https://staging-lehoetel.findmalek.engineer) | [app-staging-lehoetel](https://app-staging-lehoetel.findmalek.engineer) | [api-staging-lehoetel](https://api-staging-lehoetel.findmalek.engineer/health) | [docs-staging-lehoetel](https://docs-staging-lehoetel.findmalek.engineer) |

- every merge to `main` deploys staging, a published release deploys production (`.github/workflows/staging.yml`, `release.yml`)
- every PR gets a preview at `pr-<N>-<app>.preview-lehoetel.findmalek.engineer` for what changed, the rest links to staging, see the docs page `previews`. WhoDB for preview databases: [whodb-lehoetel](https://whodb-lehoetel.findmalek.engineer)
- releases: release-please keeps a release PR open, merging it tags `vX.Y.Z` and deploys production. Cut a release when a milestone is done: `v0.1.0` foundation and hotel core, `v0.2.0` messaging, `v0.3.0` feedback and dashboard, `v1.0.0` pilot launch
- rollback, backups and setup: docs pages `deploy-runbook` and `releases`

---

## Agents

The Next apps carry an `AGENTS.md` that points coding agents at the bundled Next docs. Keep shared types in `packages/common` and use the theme tokens instead of raw colors.

The docs site serves `/llms.txt`, `/llms-full.txt` and every page as markdown at `<page-url>.md`, so agents can read the docs without scraping html.

---

<p align="center"><sub>The name, pitch and social card colors live in <code>apps/web/lib/site.ts</code></sub></p>
