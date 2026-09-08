<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# VTH project rules

## Product scope

VTH is a small social/community service for Vietnamese people living in Korea.

Core product:

- posts, comments, likes
- communities
- Q&A
- marketplace
- local businesses
- follow, friends, block
- 1:1 messaging

Do not turn Facebook/Threads UX references into Facebook-scale architecture.

## Canonical architecture

- D1 is the persistent source of truth.
- R2 stores media.
- ChatRoom Durable Object is realtime DM delivery only.
- Workers AI is translation only.
- Browser application API traffic uses `/i/api`.
- Direct `/api/*` access follows the existing public API authentication boundary.

Do not add or restore:

- PostObject
- Vectorize
- Redis
- Kafka
- generic queues
- graph databases
- microservices
- general-purpose Durable Objects
- separate feed/recommendation infrastructure

unless a concrete approved requirement cannot be satisfied by the current architecture.

## Identity

- `user.id` is immutable canonical identity.
- username is a mutable public handle.
- authentication is social-first/social-only.
- Facebook, Kakao, and Zalo provider identity must not be merged solely by matching email.
- block overrides ordinary social/contact permissions.

## D1 migrations

Never edit or delete an already-applied migration to repair production state.

Always add a forward migration.

Before destructive production data work:

- backup
- dry run
- migration verification
- foreign key check

## Write correctness

For user-created writes:

- authorization is enforced server-side
- retry/idempotency must not create duplicate canonical rows
- state-changing race conditions must be protected at the final SQL write
- client UI checks are never authorization
- derived side effects must not invalidate an already successful canonical write

## Messaging

- D1 stores rooms, membership, requests, messages, and read state.
- WebSocket is delivery only.
- message history must be recoverable from D1.
- block revokes contact permission.
- retries must not duplicate messages or side effects.
- ordering/read boundaries use `(created_at, id)`.

## UX

Consumer pages use Q&A / Marketplace as the baseline VTH visual language:

- VTH radial brand backdrop
- eyebrow → title → description
- consistent card hierarchy
- shared button/input/select primitives
- mobile-first touch targets

Do not invent a different hero/gradient/card language per page.

Auth, admin, and developer documentation may use their own intentional layout systems.

## Verification

For normal code changes run relevant tests.

For broad/core changes run:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:integration`
- relevant Playwright tests

For Worker, bindings, Durable Objects, deployment, or OpenNext changes also run:

- `npm run build:worker`

Do not report a command as passing unless it was actually executed.
