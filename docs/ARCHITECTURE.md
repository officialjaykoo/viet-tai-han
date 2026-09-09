# VTH architecture

This document is the current architecture contract. It describes deployed boundaries and invariants, not a historical implementation plan.

## 1. Product boundary

VTH is a community and social platform for Vietnamese people living in Korea. The product includes communities, posts, comments, likes, Q&A, marketplace listings, local businesses, profiles, follow/friend/block relationships, 1:1 messaging, notifications, and Vietnamese/Korean UI.

The product is relationship-first. Familiar social UX does not imply a large social-network architecture.

## 2. Runtime topology

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

- Next.js pages, route handlers, and server actions are built with OpenNext for the Worker runtime.
- The custom Worker applies edge rate limits and ingress rules before the OpenNext handler.
- D1 is the source of truth. No stateful edge service is authoritative over D1.
- ChatRoom Durable Objects coordinate live DM delivery only; they do not persist chat history.
- Workers AI is used for content language detection/translation only.

## 3. Persistent state

D1 binding `DB` in database `vth-db` stores Better Auth records and application state, including users, profiles, communities, posts, comments, likes, questions, answers, listings, businesses, relationships, notifications, chat rooms, requests, messages, reports, and read state.

All schema changes are forward-only migrations in `migrations/`. Applied migrations are immutable. Derived counts, previews, and unread fanout are recoverable from canonical rows and must not replace them.

## 4. Identity/auth

- Better Auth owns social sign-in and sessions.
- Current social providers are Facebook, Kakao, and Zalo when configured.
- `user.id` is the immutable internal identity used by relationships, messages, notifications, moderation, and foreign keys.
- `username` and `display_username` are public profile handles and may change.
- Provider identities are not merged solely because two providers expose the same email.
- Block state overrides ordinary social and contact permissions.

## 5. Content

Posts belong to communities and are authored by immutable user IDs. Comments, votes/likes, questions, answers, listings, business records, and moderation records remain relational D1 state. Content discovery and recommendations are D1-backed; there is no separate recommendation service.

Translation metadata and translated content are stored with the canonical content record. Translation failure must not invalidate a successful content write.

## 6. Social graph

Follow, friendship, block, presence, notification, and unread state are D1 records. Relationship transitions are server-authorized, idempotent where retried, and protected by database uniqueness/conditional writes at the final write boundary.

A block removes or overrides applicable contact relationships and prevents new social or messaging actions. Public usernames are never used as relationship identity.

## 7. Messaging

- D1 stores rooms, two-person membership, message requests, canonical messages, delivery status, and read boundaries.
- A direct-message room is keyed by the pair of immutable user IDs; there is one room per pair.
- At most one pending request exists for a room/pair.
- The request-specific opener is only deliverable under that request's current state and opener identity.
- Decline/cancel cannot be bypassed by an older opener or a stale retry.
- Block cancels pending requests, revokes direct membership/delivery, and prevents old unread state from being resurrected.
- ChatRoom DO receives committed events and fans them out to connected sockets. It is not a message store.
- History is read from D1 and remains recoverable when a socket is offline.
- Canonical message ordering and read boundaries use `(created_at, id)`.
- `clientMessageId` and request identifiers make retries safe without duplicate canonical messages or notification side effects.

## 8. Media

R2 binding `MEDIA_BUCKET` stores uploaded media in bucket `vth-media`. D1 stores media keys and application metadata. Upload authorization, ownership, content constraints, and deletion behavior are enforced by the application; an R2 object is not a substitute for an authorized D1 record.

## 9. Translation

Workers AI binding `AI` is limited to language detection and translation for supported content languages. The application may use deterministic heuristics before AI. AI availability or translation failure must degrade the translation result, not the canonical content operation.

## 10. Security ingress

- The Worker applies IP rate limits before SSR, D1, or AI work.
- Browser application API traffic uses `POST /i/api` with the signed Protobuf tunnel, challenge, cookie, and proof-of-work flow.
- Direct `/api/*` traffic follows the existing public API boundary and requires `Authorization: Bearer <api_key>` at ingress. The route handler then applies its own session, ownership, and policy checks where required.
- OAuth callbacks and the billing webhook are explicit ingress exceptions handled by their own verification paths.
- Turnstile, Better Auth sessions, API-key checks, server-side authorization, block checks, and database constraints are separate controls; none is replaced by a client-side check.

## 11. Deployment

- Worker name: `vth`.
- Public hosts: `vth.kr` and `developers.vth.kr`.
- D1: `vth-db`; R2: `vth-media`.
- Durable Object binding: `CHAT_ROOM` → `ChatRoom`.
- OpenNext assets are served through the Worker `ASSETS` binding.
- Build the production bundle with `npm run build:worker` before deploy.
- Deploy with `npm run deploy` after migrations, secrets, smoke checks, and the production runbook are reviewed.

## 12. Invariants

1. D1 remains authoritative for persistent application state.
2. Every user-owned relation references immutable `user.id`, never a username.
3. Applied migrations are not rewritten; repairs use forward migrations.
4. Canonical writes commit before non-critical derived work or realtime delivery.
5. Retries cannot create duplicate relationship, message, or notification state.
6. A block cannot be bypassed by stale requests, memberships, unread state, or sockets.
7. Realtime loss cannot destroy or hide recoverable D1 history.
8. Direct API authentication and route authorization are both required where the route contract requires them.

## 13. Explicit non-goals

The current architecture does not include:

- PostObject as persistent post state
- Vectorize
- Redis
- Kafka
- a generic background queue architecture
- microservices
- a graph database
- general-purpose Durable Objects for application state
- a separate recommendation service or recommendation infrastructure
- federation

## UI layout and content density

Consumer pages use one `PageShell` width system:

- `wide`: `max-width: 1240px` for home and popular feeds.
- `standard`: `max-width: 1024px` for communities, Q&A, marketplace, recommended, messages, profiles, and related detail pages.
- `compact`: `max-width: 768px` for settings, post creation, notifications, and form-focused pages.

`PageShell` always applies the same safe-area-aware horizontal padding. At mobile widths the three desktop tiers converge to the same responsive shell and `16px` horizontal padding; no separate mobile width tier exists.

`PostCard` owns the shared post action footer. Like, comment, and share controls use a single compact visual row with `16px` icons and tight text line-height, desktop `36px` visual controls, and mobile `44px` touch targets. Like/comment/share mutations and permissions remain unchanged.
