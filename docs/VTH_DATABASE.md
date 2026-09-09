# VTH Database Contract

**Status:** Canonical  
**Database:** Cloudflare D1 `vth-db` (`DB`)  
**Baseline reviewed:** repository main at migration `0042_public_content_indexes.sql`  
**Rule:** this document describes current data ownership and cleanup policy. Historical migrations are evidence of how the schema evolved, not the primary way to understand the current system.

## 1. Source-of-truth rules

1. D1 is the canonical persistent application store.
2. Better Auth table `"user"` owns the immutable application identity key `user.id`.
3. `username` is a mutable public handle, never a relationship key.
4. R2 stores media bytes; D1 stores authorized media references/ownership metadata.
5. Durable Objects do not replace D1 message history or relationship state.
6. Denormalized counts, previews, unread values and ranks are derived accelerators and must remain recoverable.
7. Applied migrations are immutable. Repairs and cleanup use new forward migrations.

## 2. Canonical domain ownership

| Domain | Canonical tables / records | Authority notes |
| --- | --- | --- |
| Identity | `"user"`, `session`, `account`, `verification` | Better Auth identity/session/provider linkage. `user.id` is the application identity. |
| Community | `subreddits`, `subscriptions`, `subreddit_moderators` | Community ownership/membership/moderation. |
| Public posts | `posts`, `comments`, `post_likes`, `comment_likes` | One canonical positive-like model; comments form the post comment graph. |
| Q&A | `questions`, `answers` | Question/answer lifecycle and accepted-answer relation. |
| Discovery/analytics | `hidden_posts`, `user_activity`, `post_views`, `post_link_clicks` | Viewer-local discovery signals and analytics; not visibility authorities. |
| Social graph | `user_follows`, `friendships`, `user_blocks` | Canonical relationship and bilateral block state. |
| Notifications | `notifications`, `notification_deliveries`, `notification_reads` | Notification/read/delivery truth; client badges and push are projections. |
| Marketplace | `listings`, `listing_saves`, `listing_reports`, `listing_alerts` | Listing lifecycle and viewer relations. |
| Businesses | `businesses`, `business_hours`, `business_reports`, `business_bookings` | Business/service lifecycle. |
| Messaging | `chat_rooms`, `chat_room_members`, `chat_requests`, `chat_messages`, `chat_read_state`, `chat_room_reports` | Canonical DM history, membership/request/read state. |
| Moderation/media | `moderation_actions`, `media_ownership`, `reports`, `post_tags`, `comment_tags` | Moderation audit, authorized media ownership and tags. |
| Monetization foundations | billing/pro-related tables introduced by migration history | Product-support state only where runtime code actively uses it. |

When a table exists historically but is not listed as canonical above, its runtime status must be explicitly checked before new code uses it.

## 3. Identity contract

Canonical identity:

```text
"user".id
```

Required rule:

```text
all user-owned foreign keys / relationship identities
→ user.id
```

Do not use:

```text
username
email
provider account ID
```

as application relationship identity.

Legacy pre-Better-Auth identity objects may remain in historical schema until a safe forward cleanup proves they are removable.

## 4. Canonical public-content visibility

Ordinary public post queries use the shared public predicate:

```sql
p.is_removed = 0
AND p.is_shadow_hidden = 0
AND s.is_removed = 0
```

Comments shown as ordinary live content additionally require the current comment not to be removed, deleted, or shadow-hidden.

Block state is deliberately separate from public visibility. Block affects interaction/contact; moderation state affects public visibility.

Detailed behavior: [`VTH_CONTENT_FEED.md`](VTH_CONTENT_FEED.md).

## 5. Canonical reaction model

### Post likes

Truth:

```text
post_likes(post_id, user_id)
```

Display accelerator:

```text
posts.like_count
```

Invariant:

```sql
posts.like_count = COUNT(post_likes WHERE post_id = posts.id)
```

### Comment likes

Truth:

```text
comment_likes(comment_id, user_id)
```

Display accelerator:

```text
comments.like_count
```

Invariant:

```sql
comments.like_count = COUNT(comment_likes WHERE comment_id = comments.id)
```

Legacy `votes`/upvote/downvote/score fields are not a second runtime reaction model.

## 6. Other counter invariants

| Counter | Canonical invariant |
| --- | --- |
| `posts.comment_count` | number of live, non-removed, non-shadow-hidden comments belonging to the post |
| `questions.answer_count` | number of live, non-removed, non-shadow answers belonging to the question |
| `subreddits.subscriber_count` | `COUNT(subscriptions WHERE subreddit_id = subreddits.id)` |
| message unread projections | recoverable from canonical room/message/read-boundary state |

Counters are read accelerators. If a counter and canonical relation disagree, repair the counter; do not redefine the relation to match the counter.

## 7. Popular ranking truth

Current Popular ranking uses current canonical engagement fields:

```text
engagement_rank = posts.like_count + posts.comment_count * 3
```

Ordering:

```text
engagement_rank DESC,
created_at DESC,
id DESC
```

Legacy `score` and `hot_score` are not runtime Popular authorities.

Current supporting indexes include:

- `idx_posts_public_engagement_rank`
- `idx_posts_public_created`
- `idx_comments_public_post`

Indexes support performance only. SQL still carries explicit visibility and authorization predicates.

## 8. Messaging data contract

D1 remains authoritative for:

- rooms
- pair membership
- message requests
- canonical messages
- message delivery state
- read boundaries
- reports

Key invariants:

```text
one canonical DM room per immutable user pair
message ordering = (created_at, id)
retry identity = clientMessageId / request-specific identifiers
read state = canonical D1 boundary
```

Durable Object/WebSocket state is not a second database.

Detailed contract: [`VTH_REALTIME_DM.md`](VTH_REALTIME_DM.md).

## 9. Idempotency contract

Where create/write APIs accept request IDs, the intended contract is:

```text
same actor + same requestId + same normalized payload
→ return existing canonical result

same actor + same requestId + conflicting normalized payload
→ conflict (HTTP 409 at API boundary)
```

Current public-content areas covered by this model include posts, comments, questions, answers and listings where the corresponding write path supports request IDs.

Unique indexes/constraints and conditional SQL should support the application contract rather than relying only on pre-read checks.

## 10. Migration policy

All persistent schema changes live in `migrations/`.

Rules:

1. Never edit or delete a migration that may have been applied to production.
2. Never repair production by manually changing schema without a recorded forward migration.
3. Backfill/cleanup SQL belongs in a new migration when it changes persistent production meaning.
4. A clean database must be able to apply all repository migrations in order.
5. An existing production-shaped database must be able to apply only the new forward migrations safely.
6. Destructive cleanup requires evidence, not aesthetic preference.

A long migration history is acceptable if current schema ownership is clear and bootstrap remains reliable.

## 11. Migration eras

The schema evolved through several major eras:

| Range | Main purpose |
| --- | --- |
| `0001` | original RED-derived users/community/posts/comments/votes/subscriptions base |
| `0002–0018` | Better Auth, moderation, social actions, achievements, scoring/analytics, notifications, settings, translation, security and API foundations |
| `0019–0028` | language migration, Q&A, marketplace, businesses, provider identity, messaging delivery, monetization, friendships, presence |
| `0029–0033` | social-first identity/username lifecycle and DM policy/report hardening |
| `0034–0042` | canonical simple likes, write idempotency, DM reliability, comment-tree integrity, request integrity, notification identity, media ownership, public-content indexes |

For exact historical DDL, read the migration file itself. New code should use this document and current source to determine canonical ownership.

## 12. Legacy retained objects

The following objects are explicitly treated as legacy/migration-compatible unless a current runtime search proves otherwise.

### `users`

Pre-Better-Auth identity table from the original schema.

Canonical runtime identity is `"user"`.

Do not add new runtime dependencies on `users`.

### `votes`

Original positive/negative vote relation.

Canonical runtime positive reactions are `post_likes` and `comment_likes`.

Do not add new runtime writes/reads to `votes` without an explicit product/architecture decision.

### `posts.upvotes`, `posts.downvotes`, `posts.score`

Legacy reaction/ranking fields.

Not canonical like state and not current Popular ranking inputs.

### `comments.upvotes`, `comments.downvotes`, `comments.score`

Legacy comment vote/ranking fields.

Not canonical comment-like state.

### `hot_score` and legacy score indexes

Historical ranking artifacts.

Not current Popular ranking authority.

### `user_activity.score`

This is **not** the legacy post score. It remains a distinct recommendation/activity signal where current recommendation code uses it.

Do not remove it merely because its column name is `score`.

## 13. Legacy classification gate

Every legacy candidate must be classified using actual repository and production evidence:

```text
CANONICAL
LEGACY-DATA-BUT-NO-RUNTIME
LEGACY-RUNTIME
MIGRATION-COMPAT
SAFE-REMOVE
UNSAFE-REMOVE
```

Required evidence before physical removal:

- `src/**` runtime references
- tests/helpers references
- scripts references
- seed references
- FK/constraint dependencies
- index dependencies
- production row counts
- data-preservation requirement
- rollback/recovery plan

Migration-file references alone do not count as runtime use.

## 14. Database consolidation strategy

Database cleanup happens in two different senses.

### Logical consolidation

Goal:

- one canonical model per concept
- no new runtime references to obsolete objects
- current code/tests/seed use canonical tables
- documentation clearly distinguishes legacy from current truth

This should happen continuously.

### Physical consolidation

Goal:

- remove safe dead indexes
- remove obsolete columns/tables only after evidence
- strengthen useful constraints
- keep query plans efficient
- verify clean and upgrade migration paths

Physical consolidation is intentionally scheduled after the cross-project architecture pass so that the database is cleaned around the design VTH actually keeps.

The target is not “few migrations.” The target is “one understandable current schema.”

## 15. Query-plan discipline

Use `EXPLAIN QUERY PLAN` before adding/removing indexes on important D1 paths.

Priority queries:

- Home feed
- Popular
- Community/Profile recency
- Recommended
- post detail
- comment tree
- Q&A list/detail
- marketplace/business list/detail where traffic justifies it
- DM inbox/history where schema changes touch messaging

An index should have a concrete query purpose. Duplicate/prefix-redundant indexes should be removed only after query-plan evidence.

## 16. Integrity audit

A reusable local/CI integrity audit should converge on checking:

```text
PRAGMA foreign_key_check
post like counter drift
comment like counter drift
post comment counter drift
question answer counter drift
subscriber counter drift
comment parent/orphan integrity
messaging relation integrity where practical
legacy row counts
```

A background reconciliation service is not required solely because counters are denormalized. Operator/CI repair tooling is sufficient until real operation shows a need for periodic background repair.

## 17. Seed and test data

`seed.sql` is development/test data, not a production migration.

Rules:

- production must never run the development seed
- seed should create canonical current relations, not legacy reactions
- tests should not force production to retain obsolete schema objects
- deterministic seed users/data may support browser E2E but test-only authentication must fail closed in production

## 18. Backup and destructive operations

Before production-destructive DB work:

1. verify the target Cloudflare account/database
2. export/backup D1
3. record relevant row counts/integrity status
4. rehearse the forward migration locally
5. verify clean-install and upgrade paths
6. apply the recorded forward migration
7. run post-migration integrity checks and production smoke

Operational commands and rollback procedure live in [`CLOUDFLARE_VTH_KR_SETUP.md`](CLOUDFLARE_VTH_KR_SETUP.md).

The dangerous user-ID rekey procedure, if ever needed again, is isolated in [`USER_ID_REKEY_RUNBOOK.md`](USER_ID_REKEY_RUNBOOK.md).

## 19. Future schema snapshot

After the planned physical consolidation, this document should include or link to a generated current-schema snapshot under `docs/` so a developer can understand current D1 structure without replaying migration history mentally.

The snapshot is descriptive, not a replacement for forward migrations.

## 20. Definition of a clean VTH database

The database is considered clean when:

```text
canonical ownership is unambiguous
+ runtime legacy dependency is zero or explicitly justified
+ counters reconcile to canonical relations
+ foreign-key/integrity checks are clean
+ important query plans use intentional indexes
+ clean-install migrations succeed
+ upgrade migrations succeed
+ production-destructive changes are evidence-backed
```
