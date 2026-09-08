# Việt tại Hàn

Việt tại Hàn is a community and social platform for Vietnamese people living in Korea.

Production: [vth.kr](https://vth.kr)
Developer host: [developers.vth.kr](https://developers.vth.kr)

VTH started as a fork of the MIT-licensed [`koval01/red`](https://github.com/koval01/red) project and has been substantially reworked for its product model, identity, authentication, messaging, localization, and Cloudflare deployment. VTH is independent and is not affiliated with Meta, Facebook, Instagram, Kakao, Zalo, Reddit, or Cloudflare.

## Core product

- Posts, comments, and likes
- Communities
- Questions and answers
- Marketplace listings
- Local businesses and services
- Profiles
- Follow, friends, and block relationships
- 1:1 chat and message requests
- Notifications and browser push
- Vietnamese/Korean multilingual UI

## Design principles

- **People-first identity:** `user.id` is immutable canonical identity; public usernames are mutable handles.
- **Explicit privacy:** follow, friend, block, chat, and message-request rules are predictable and enforced server-side.
- **Retry-safe social actions:** relationship, messaging, notification, and related transitions are idempotent and race-safe.
- **Edge-first architecture:** the application is designed for Workers, D1, R2, Durable Objects, Turnstile, and related edge services.
- **Multilingual by design:** Vietnamese and Korean are product requirements, not post-launch decoration.

## Architecture

VTH keeps canonical state in D1 and uses edge services for narrowly defined responsibilities:

```text
Next.js UI
    |
VTH Worker
    |
    +-- D1          canonical persistent state
    +-- R2          media
    +-- ChatRoom DO realtime DM delivery only
    +-- Workers AI  translation only
```

- D1 is the source of truth for users, content, relationships, notifications, and messages.
- R2 stores uploaded media; media metadata and authorization remain application state.
- ChatRoom Durable Objects deliver realtime DM events only. They do not persist chat history.
- Workers AI is used for translation only.
- Browser application requests use `/i/api`.
- Direct `/api/*` requests use the existing public API boundary: `Authorization: Bearer <api_key>` is required before route-specific authorization.

## Repository layout

```text
src/app/          Next.js pages and API handlers
src/components/   shared and feature UI
src/lib/          application, identity, social, auth, security, and data logic
src/worker.ts     Cloudflare Worker entry point
migrations/       forward-only D1 schema migrations
docs/             active architecture and operations documentation
public/           static assets and service worker
```

## Local development

Requirements: Node.js 22+ and npm.

```bash
git clone https://github.com/officialjaykoo/viet-tai-han.git
cd viet-tai-han
npm ci
cp .dev.vars.example .dev.vars
npm run db:reset:local
npm run dev
```

Open `http://localhost:3000`. Social login requires the corresponding provider credentials in `.dev.vars`. Never copy production credentials or production resource identifiers into another deployment.

## Commands

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e:chromium
npm run build
npm run build:worker
npm run preview
```

- `npm run build` runs the Next.js application build.
- `npm run build:worker` creates the production OpenNext Cloudflare Worker bundle.
- `npm run preview` builds the Worker bundle and starts the Cloudflare preview.
- `npm run test:e2e:chromium` runs the Chromium Playwright project.

For local database work, use `npm run db:migrate:local`, `npm run db:seed:local`, or `npm run db:reset:local`. Deploy with `npm run deploy` only after reviewing the production runbook.

## Documentation

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — current runtime boundaries and invariants
- [`docs/CLOUDFLARE_VTH_KR_SETUP.md`](docs/CLOUDFLARE_VTH_KR_SETUP.md) — production resources, deployment, smoke checks, and rollback
- [`docs/VTH_REALTIME_DM.md`](docs/VTH_REALTIME_DM.md) — DM request, persistence, delivery, and retry rules
- [`docs/USER_ID_REKEY_RUNBOOK.md`](docs/USER_ID_REKEY_RUNBOOK.md) — dangerous one-off user ID maintenance
- [`docs/README.md`](docs/README.md) — active documentation index
- [`SECURITY.md`](SECURITY.md) — security policy and reporting

## Security and contribution

Never commit secrets. Production secrets belong in Cloudflare Worker secrets or another approved secret store; see [`SECURITY.md`](SECURITY.md).

Prefer small, focused changes. Social behavior changes must cover complete state transitions, including block/privacy rules, retries, and concurrent requests. Security issues must not be posted publicly.

## Fork and attribution

This repository is a fork of [`koval01/red`](https://github.com/koval01/red), originally released under the MIT License. VTH retains the applicable upstream MIT copyright notice while adding its own modifications and documentation.

## License

MIT License. See [`LICENSE`](LICENSE).
