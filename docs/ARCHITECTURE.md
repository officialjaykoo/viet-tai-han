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


### DM convergence and transport recovery

The DM client keeps the Bug8 authority boundary: D1 is canonical, HTTP performs mutations, ChatRoom delivers committed realtime events, and React state is disposable projection.

- The 256-entry message-ID set is only a fast duplicate cache. When the cache cannot prove uniqueness or an event arrives out of order, the client keeps the immediate local projection and schedules a coalesced canonical inbox refresh.
- Canonical inbox refresh runs after reconnect/catch-up, visibility or network restoration, transport uncertainty, revocation, and remote-tab unread changes. Normal realtime events do not wait for D1 or trigger a per-message inbox read.
- An uncertain HTTP send retries at most once with the same `clientMessageId`. If both attempts are uncertain, the active room history is selectively refreshed; explicit HTTP errors are not retried.
- `vth-unread` `BroadcastChannel` synchronizes unread changes between tabs. `localStorage` storage events are the fallback when `BroadcastChannel` is unavailable.
- Active-room history, conversation-list previews, and global unread counts reconcile independently. A room switch drops late history responses before they can update the selected room.

Bug10 classifications:

- `[HARDENED]` bounded-cache unread misses, coalesced canonical unread reconciliation, uncertain sends, catch-up/live overlap, cross-tab unread refresh, and late catch-up responses.
- `[ADOPTED FROM CLONAGRAM]` fast local projection followed by selective canonical reconciliation, plus independent conversation-list and active-room refreshes.
- `[ALREADY SAFE]` D1 idempotency, canonical ordering, monotonic read boundaries, moderation filtering, block/ban socket revocation, and notification/push guards.
- `[REJECTED FROM CLONAGRAM]` React Query adoption, polling, per-event full invalidation, current-time read models, and a weaker INSERT-only send path.

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

## 14. Public content convergence

Bug11 keeps one canonical public-content path:

- `src/lib/post-projection.ts` maps Feed, Community, Popular, Recommended, Profile Posts, and Post Detail to the same `FeedPost` projection.
- `src/lib/content-visibility.ts` owns the public post predicate: post not removed, post not shadow-hidden, and community not removed.
- `src/lib/content-payload.ts` owns strict runtime parsing for like, comment, Q&A, accept-answer, and listing writes.
- `post_likes` and `comment_likes` are the only runtime positive-reaction tables. Their counters are the only engagement inputs to Popular.
- Public reads do not use `user_blocks` as visibility. Bilateral block checks are applied at final positive-interaction and guarded-notification writes.

Home is subscribed-community recency, Community/Profile are recency, Popular is all public canonical engagement, and Recommended is personalized D1 ranking. Popular uses `like_count + comment_count * 3`, followed by `(created_at, id)` descending. Its signed cursor carries the rank and deterministic tie-break fields and is bound to the complete feed context.

Bug11 classifications:

- `[HARDENED]` public visibility parity across discovery/detail/search/out/analytics, bilateral block enforcement at final writes, strict malformed-payload rejection, request-ID payload conflict detection, canonical counter reconciliation, and migration/seed audit.
- `[ADOPTED FROM CLONAGRAM]` a small shared post projection, centralized visibility/payload helpers, canonical engagement ranking, and deterministic signed pagination.
- `[ALREADY SAFE]` D1 as source of truth, immutable `user.id` identity, Better Auth, Cloudflare/OpenNext/D1/R2/DO boundaries, forward-only migrations, and Bug10 DM convergence.
- `[REJECTED FROM CLONAGRAM]` parallel RED/VTH/Clonagram content models, giant Post DTOs, ORM/repository layers, Supabase, ML/vector recommendation infrastructure, and React Query/polling invalidation.

Bug11 does not modify the frozen Bug10 messaging paths. Messaging schema objects remain inventoried in `docs/VTH_DATABASE.md` and are not copied into a second scheduler or transport.

## 15. Database audit and cleanup policy

`docs/VTH_DATABASE.md` is the canonical schema audit. It inventories every application table, column, check, unique constraint, foreign key, and explicit index through `scripts/audit-db-integrity.mjs --schema`. The default read-only audit reports foreign-key violations, all five canonical counter drifts, relation orphans, and legacy row counts. No applied migration is rewritten or dropped.

Bug12 removes only five dead pre-canonical feed/tree indexes in forward migration `0043_remove_legacy_feed_indexes.sql`. Production contained one legacy `votes` row and non-zero historical post score/hot-score data, so those rows and physical columns remain `RETAINED-DATA`. The production audit runs before any destructive DDL; remote destructive commands are not embedded in the audit script.

## 16. Browser critical-path policy

Chromium is the required browser gate. Existing authenticated, browse, and smoke suites remain the baseline. Critical journeys use allowlisted local test users only, with separate Alice/Bob browser contexts for bilateral policy and Q&A/DM interactions. `/api/auth/e2e-session` is compiled only under the explicit E2E bypass and rejects non-allowlisted usernames; production has no test-session path.

DM assertions use the rendered conversation and the browser WebSocket connection rather than polling. D1 remains authoritative after realtime delivery; the Durable Object only transports committed events. The feed keeps the fixed Popular rank `like_count + comment_count * 3`; Bug12 adds no ranking redesign.

## UI layout and content density

Consumer pages use one `PageShell` width system:

- `wide`: `max-width: 1240px` for home and popular feeds.
- `standard`: `max-width: 1024px` for communities, Q&A, marketplace, recommended, messages, profiles, and related detail pages.
- `compact`: `max-width: 768px` for settings, post creation, notifications, and form-focused pages.

`PageShell` always applies the same safe-area-aware horizontal padding. At mobile widths the three desktop tiers converge to the same responsive shell and `16px` horizontal padding; no separate mobile width tier exists.

`PostCard` owns the shared post action footer. Like, comment, and share controls use a single compact visual row with `16px` icons and tight text line-height, desktop `36px` visual controls, and mobile `44px` touch targets. Like/comment/share mutations and permissions remain unchanged.
