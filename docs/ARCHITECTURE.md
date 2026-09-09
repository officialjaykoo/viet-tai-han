# VTH Architecture Contract

**Status:** Canonical  
**Scope:** deployed system boundaries, state ownership, security, and engineering invariants  
**Rule:** implementation history belongs in Git history. This document describes the system VTH intends to operate now.

## 1. System boundary

VTH is a focused Korea–Vietnam community/social product. The architecture should remain small enough for a small team to understand end-to-end.

Current runtime shape:

```text
Browser / App Web UI
        |
Next.js / OpenNext
        |
Cloudflare Worker
        |
        +-- D1                 canonical persistent state
        +-- R2                 media bytes
        +-- ChatRoom DO        realtime DM transport/projection only
        +-- Workers AI         language/translation assistance only
        +-- Web Push           optional notification delivery
```

There is no second canonical application database.

## 2. Core architectural rules

1. D1 is authoritative for persistent application state.
2. `user.id` is the immutable internal identity.
3. Public usernames are mutable handles and never relationship keys.
4. Canonical writes commit before best-effort realtime, push, analytics, or translation side effects.
5. Client state is a projection. It may be optimistic but must converge to server truth.
6. Important permissions are enforced at the server/final D1 write boundary, not only by UI prechecks.
7. Retries must not duplicate canonical rows or user-visible side effects.
8. Applied migrations are immutable. Repairs use new forward migrations.
9. One responsibility should have one canonical implementation path.
10. New infrastructure is justified by measured need, not by similarity to another project.

## 3. Identity and authentication

Better Auth owns authentication/session state.

Supported social providers are Facebook, Kakao, and Zalo when configured.

VTH is social-first/social-only at the product layer. It does not require a user-facing email/password account flow.

Identity rules:

```text
user.id
= immutable canonical identity

username
= mutable public handle

provider account identity
= authentication linkage, not application relationship identity
```

Two providers exposing the same email do not automatically imply the same VTH user. Provider-linking must follow explicit account policy.

Every relationship, message, notification, content ownership row, moderation record, and other user-owned foreign key should use `user.id`.

## 4. Request and ingress boundaries

The custom Worker is the first application boundary and can reject abusive traffic before expensive SSR/D1/AI work.

Browser application API traffic uses the existing internal signed/tunneled path where configured. Public API routes enforce their documented bearer/session boundary and then perform route/domain authorization.

OAuth callbacks and external webhooks are explicit exceptions with their own verification contract.

Security layers are complementary:

- edge/IP rate limiting
- Turnstile/bot checks where appropriate
- Better Auth session verification
- API-key verification for public API contracts
- domain ownership/relationship/block checks
- D1 uniqueness/conditional predicates
- moderation state

No client-provided user ID, role, membership, block state, or ownership claim is authoritative.

## 5. Domain write shape

Prefer a direct flow:

```text
Route / server action
→ strict payload parsing
→ small domain function
→ authorization / moderation / rate limit
→ D1 conditional canonical write
→ canonical response
→ best-effort derived side effects
```

Avoid unnecessary permanent layers such as generic repository/DAO/provider/manager stacks.

A helper or service is justified when it centralizes a real invariant or removes duplication.

## 6. Public content

Canonical public-content responsibilities are split deliberately:

- `src/lib/post-projection.ts` owns the shared post projection used by major post surfaces.
- `src/lib/content-visibility.ts` owns the ordinary public-post SQL visibility predicate.
- `src/lib/content-payload.ts` owns strict runtime payload parsing for public-content mutations.

Ordinary public post visibility requires:

```sql
p.is_removed = 0
AND p.is_shadow_hidden = 0
AND s.is_removed = 0
```

Block state is not itself a public-visibility predicate. A blocked user's ordinary public post may still be directly readable, while new positive interaction/contact is denied.

Detailed feed/content contract: [`VTH_CONTENT_FEED.md`](VTH_CONTENT_FEED.md).

## 7. Feed and discovery

Current feed roles:

```text
Home
= subscribed-community recency

Popular
= public canonical engagement

Community / Profile
= recency

Recommended
= D1-backed user activity/follow personalization
```

Popular ranking currently uses:

```text
like_count + comment_count * 3
```

with deterministic:

```text
created_at DESC, id DESC
```

tie-breaks.

Pagination cursors are signed and bound to their complete feed context. A cursor must carry the same ordering tuple used by the SQL query.

No ML/vector recommendation infrastructure is required by the current product.

## 8. Social graph and block policy

Canonical social relations are stored in D1.

Core concepts:

- follow
- friendship/request state
- block
- presence
- notification/unread projection

Relationship APIs should return server-derived state rather than asking clients to reconstruct relationship truth from independent requests.

Block semantics:

- bilateral block prevents new positive interaction/contact
- block can tear down applicable follow/friend/pending-message-request relationships
- block does not automatically delete historical public content or ordinary historical interactions
- cleanup actions such as unlike or clearing an accepted answer may remain allowed
- reporting remains available where needed
- notification/push fanout must recheck applicable block state

The final write boundary should enforce block rules when a race between precheck and write is possible.

## 9. Direct messaging

Messaging has a strict authority split:

```text
HTTP
→ validate/authorize/moderate
→ D1 canonical message/request/read state
→ committed realtime event
→ ChatRoom Durable Object
→ WebSocket clients
```

ChatRoom Durable Objects are transport/projection infrastructure, not a second message database.

Messaging invariants include:

- one DM room per immutable user pair
- explicit room membership/request state
- at most one valid pending request per pair/room contract
- `clientMessageId` idempotency for uncertain sends
- `(created_at, id)` message ordering and read boundaries
- signed history/catch-up cursors
- block/ban connect and broadcast checks
- terminal revoke of stale sockets
- bounded local dedupe with selective canonical reconciliation
- no polling-based canonical message store

Detailed contract: [`VTH_REALTIME_DM.md`](VTH_REALTIME_DM.md).

## 10. Notifications and unread state

Notification rows/read state in D1 are canonical. Push, badges, and in-memory/client unread counts are derived delivery/projection state.

A user-visible notification should be attributable to a canonical source action when idempotency matters.

Queued or delayed notification delivery must not bypass current block/moderation state when the notification itself represents a social interaction.

Cross-tab unread synchronization may use browser transport such as BroadcastChannel, but final convergence remains server-backed.

## 11. Q&A

Questions and answers are canonical D1 records.

Important invariants:

- answers belong to a valid question
- removed/shadow/locked state is enforced at the final write boundary where races matter
- accepted answer belongs to the same question
- request IDs follow same-payload replay / conflicting-payload rejection semantics
- denormalized answer counts remain derived from canonical answer rows

Q&A UX should remain compatible with durable searchable knowledge rather than chat-like transient behavior.

## 12. Marketplace and businesses

Marketplace and business domains reuse common identity, block, moderation, idempotency, media-ownership, and notification principles, but do not need to share one giant content model with posts/Q&A.

Separate domain tables are acceptable when lifecycle and constraints genuinely differ.

## 13. Media

R2 binding `MEDIA_BUCKET` / bucket `vth-media` stores media bytes.

D1 stores authorized references and ownership metadata. An R2 key alone does not authorize access, ownership, attachment, or deletion.

Media writes must enforce:

- authenticated ownership
- acceptable type/size constraints
- valid association with canonical application records
- deletion/cleanup policy

## 14. Translation

Workers AI is limited to supported language detection/translation assistance.

Translation is derived work:

```text
canonical content write succeeds
→ translation may run
→ translation result updates metadata/projection
```

Translation failure must not retroactively invalidate a successful content write.

There is no requirement for an AI-centric application architecture.

## 15. Database architecture

D1 database `vth-db` is the persistent source of truth.

Canonical table ownership and legacy-object status are defined in [`VTH_DATABASE.md`](VTH_DATABASE.md).

Key database principles:

- relational truth before denormalized counters
- explicit unique constraints for idempotent relations where practical
- conditional SQL for race-sensitive permission/state transitions
- counters/previews/ranks are recoverable
- indexes support query plans but never replace visibility/authorization predicates
- old migrations are historical records, not current architecture documentation

## 16. Client state

Client state should be as disposable as practical.

Use local/optimistic state when it gives immediate UX benefit, but define how uncertainty is reconciled.

Do not generalize DM's selective-reconciliation machinery into every domain. HTTP/D1 request-response domains usually need a simpler canonical response flow.

Avoid introducing a global state manager or client data framework solely to match an external project.

## 17. UI architecture

Consumer pages use shared layout/component primitives rather than page-specific width systems.

Current layout tiers:

- wide: Home and Popular
- standard: communities, Q&A, marketplace, recommended, messages, profiles and related detail pages
- compact: settings, create-post, notifications, form-focused pages

Mobile behavior converges onto the same responsive shell rather than a parallel mobile application architecture.

UI component extraction should reduce duplication, not create abstraction for its own sake.

## 18. Testing and CI

Testing responsibility is documented in [`VTH_TESTING.md`](VTH_TESTING.md).

The production-quality baseline includes:

- lint
- typecheck
- unit tests
- Worker tests
- integration tests
- critical browser E2E
- clean local migration/seed checks
- Worker build

A green test suite does not replace production observation, but a red quality gate must not become the accepted baseline.

## 19. Deployment and operations

Production resources currently include:

- Worker: `vth`
- public host: `vth.kr`
- developer host: `developers.vth.kr`
- D1: `vth-db`
- R2: `vth-media`
- Durable Object binding: `CHAT_ROOM` → `ChatRoom`

Operational setup, migration, backup, deploy, smoke and rollback procedures live in [`CLOUDFLARE_VTH_KR_SETUP.md`](CLOUDFLARE_VTH_KR_SETUP.md).

## 20. Architecture convergence policy

VTH originated from RED and may selectively adopt ideas from Clonagram, Discourse, Lemmy, Apache Answer, Bluesky, GoToSocial, and other open-source systems.

Source lineage does not determine the final design.

For each responsibility:

```text
compare implementations
→ choose the best fit for VTH
→ adapt to VTH identity/D1/security/product semantics
→ designate one canonical implementation
→ remove displaced duplicate/temporary paths
```

Do not retain donor-specific compatibility unless the product truly needs it.

## 21. Explicit non-goals

The current architecture does not require:

- Supabase
- Redis
- Kafka
- microservices
- a graph database
- a generic repository/DAO/ORM layer
- general-purpose Durable Objects as primary state
- a separate recommendation service
- Vectorize/embedding infrastructure for ordinary feed recommendation
- federation
- AT Protocol
- ActivityPub
- group-call/media-call architecture

These are not permanently forbidden. They require an explicit product need and architecture decision.

## 22. Architecture review checklist

Before merging a structural change, answer:

```text
What existing responsibility changes?
What becomes canonical after this change?
What old path is removed?
Does a permanent adapter remain?
Does D1 ownership change?
Does retry/block/moderation behavior change?
Does this add infrastructure or a runtime dependency?
How is the change tested?
Which canonical document must be updated?
```

A structural change that only adds a new layer without removing duplication should be treated skeptically.