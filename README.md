# Việt tại Hàn

**Việt tại Hàn (VTH)** is a full-stack social and community platform built for Cloudflare.

Live deployment: **https://vth.kr**

Developer documentation: **https://developers.vth.kr**

The software combines a Facebook/Instagram-style social graph with community, messaging, discovery, marketplace, and local-service features in a single application. It started from the MIT-licensed [`koval01/red`](https://github.com/koval01/red) codebase and has since been substantially reworked in product model, identity, authentication, messaging, moderation, localization, and Cloudflare architecture.

> VTH is an independent project. It is not affiliated with Meta, Facebook, Instagram, Kakao, Zalo, Reddit, or Cloudflare.

## What the software provides

VTH is designed around people and relationships first, rather than around Reddit-style karma or anonymous forum mechanics.

Core product areas include:

- **Profiles** with public usernames and display names
- **Follow, friend, block, and presence** relationships
- **Direct messages and message requests**
- **Notifications and browser push**
- **Communities, posts, comments, and voting**
- **Questions & answers**
- **Marketplace**
- **Local business / service discovery**
- **Recommendations and discovery**
- **Multilingual UI**

The social model uses immutable `user.id` values internally. Public usernames are mutable handles and are not used as account identity.

## Authentication

VTH uses social-only authentication through Better Auth.

Supported providers:

- Facebook
- Kakao
- Zalo

A new user completes onboarding after social sign-in. Provider accounts map to an immutable VTH user ID. Email, when available, is contact metadata rather than the canonical identity or an automatic account-merging key.

## Messaging model

For a sender `A` messaging recipient `B`:

- if either side has blocked the other → messaging is prohibited
- accepted friends → direct message
- if **B follows A** → A may message B directly
- otherwise → message request, subject to the recipient's request privacy setting

Existing conversations remain tied to user IDs, not usernames.

## Reputation

VTH still has reputation-related data inherited from the original community architecture, but the product direction is to keep **reputation separate from core permissions**.

A normal new user with zero reputation should still be able to use ordinary social and community features. Abuse prevention should rely on account state, moderation, rate limits, relationship rules, and behavioral signals rather than a single karma threshold.

## Cloudflare architecture

VTH is deployed primarily on Cloudflare.

| Component | Role |
| --- | --- |
| **Cloudflare Workers + OpenNext** | Next.js application and API runtime |
| **D1** | Primary relational database |
| **R2** | Media storage |
| **Durable Objects** | Stateful coordination where required |
| **Workers AI + Vectorize** | AI-assisted translation/recommendation features |
| **Turnstile** | Human / abuse checks |
| **Workers Rate Limiting** | Request flood protection |
| **Workers Logs** | Production observability |

Main application stack:

- Next.js 16
- React 19
- TypeScript
- Better Auth
- Kysely / D1
- Tailwind CSS
- OpenNext for Cloudflare
- Vitest
- Playwright

## Repository layout

```text
src/app/          Next.js routes and API handlers
src/components/   UI components
src/lib/          application, social, auth, security, and data logic
src/worker.ts     Cloudflare Worker entry
migrations/       D1 schema migrations
docs/             deployment and project notes
public/           static assets and service worker
```

## Local development

Requirements:

- Node.js 22+
- npm
- Cloudflare account for remote Cloudflare services

```bash
git clone https://github.com/officialjaykoo/viet-tai-han.git
cd viet-tai-han
npm ci
cp .dev.vars.example .dev.vars
npm run db:reset:local
npm run dev
```

Then open:

```text
http://localhost:3000
```

Social login requires the corresponding provider credentials in `.dev.vars`.

## Useful commands

```bash
npm run dev
npm run preview
npm test
npm run test:e2e:chromium
npm run db:migrate:local
npm run deploy
```

For the current `vth.kr` Cloudflare setup, see:

- [`docs/CLOUDFLARE_VTH_KR_SETUP.md`](docs/CLOUDFLARE_VTH_KR_SETUP.md)

Do not reuse production secrets or production resource IDs when creating a separate deployment.

## Production secrets

Never commit production credentials.

Typical production secrets include:

- `BETTER_AUTH_SECRET`
- `TURNSTILE_SECRET_KEY`
- `FACEBOOK_CLIENT_SECRET`
- `KAKAO_CLIENT_SECRET` when enabled
- `ZALO_APP_SECRET`
- `VAPID_PRIVATE_KEY`
- billing/webhook secrets
- Cloudflare API credentials

Use Cloudflare Worker secrets or another appropriate secret store. See [`SECURITY.md`](SECURITY.md).

## Development status

VTH is under active development and is being migrated away from several assumptions inherited from the original Reddit-style codebase.

Areas receiving active review include:

- relationship state transitions
- block/privacy behavior
- DM request/direct-message rules
- notification reliability
- idempotency and race conditions
- Worker CPU/resource usage
- mobile UX
- abuse controls

Bug reports and focused fixes are expected during this stage.

## Contributing

Small, focused changes are preferred. When modifying social behavior, test the full state transition rather than only the happy path—for example follow/unfollow, friend request/accept/remove, block/unblock, pending DM promotion, retries, and concurrent requests.

Security issues should not be posted publicly. See [`SECURITY.md`](SECURITY.md).

## Fork and attribution

This repository is a fork of [`koval01/red`](https://github.com/koval01/red), originally released under the MIT License.

VTH retains the applicable upstream MIT copyright notice while adding its own modifications and project documentation.

## License

MIT License. See [`LICENSE`](LICENSE).
