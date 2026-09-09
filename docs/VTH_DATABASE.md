# VTH database contract

This document records the D1 schema audit for Bug11. It describes the canonical runtime tables, retained migration objects, counter invariants, and cleanup candidates. Applied migrations remain immutable.

## Identity and storage boundary

- D1 binding `DB` in database `vth-db` is the persistent source of truth.
- Better Auth table `"user"` owns the immutable internal identity. Every user-owned foreign key uses `user.id`.
- `username` and `display_username` are mutable public handles. They are never relationship keys.
- R2 stores media bytes; `posts.media_key`, `businesses.*_key`, and media registry rows store authorized references only.
- Durable Object `ChatRoom` transports committed DM events. It is not a second message database.
- There is no Supabase, ORM, generic repository, generic DAO, or query-builder layer.

## Canonical runtime objects

| Domain | Canonical tables | Relations and purpose |
| --- | --- | --- |
| Identity | `"user"`, `session`, `account`, `verification` | Better Auth identity, sessions, provider accounts, verification. |
| Community | `subreddits`, `subscriptions`, `subreddit_moderators` | Community ownership, membership, moderation. |
| Public posts | `posts`, `comments`, `post_likes`, `comment_likes` | One post/comment graph and one positive-like model. `posts.subreddit_id` and `posts.author_id` are foreign keys. Comments reference posts and optional parent comments. |
| Q&A | `questions`, `answers` | Questions belong to a community and author; answers belong to a question and author. `accepted_answer_id` points to an answer in the same question. |
| Discovery | `hidden_posts`, `user_activity`, `post_views`, `post_link_clicks` | Viewer-local hides, D1-backed recommendation signals, and post analytics. Analytics are not visibility authorities. |
| Social policy | `user_follows`, `friendships`, `user_blocks` | Relationship state and bilateral block policy. Blocks gate new positive interactions and notification delivery; they do not change public post visibility. |
| Notification | `notifications`, `notification_deliveries`, `notification_reads` | Canonical notification row, push delivery state, and read state. Unread fanout is recoverable. |
| Marketplace | `listings`, `listing_saves`, `listing_reports`, `listing_alerts` | Listing lifecycle and targeted integrity controls. |
| Businesses | `businesses`, `business_hours`, `business_reports`, `business_bookings` | Business profiles and booking/report state. |
| Messaging | `chat_rooms`, `chat_room_members`, `chat_requests`, `chat_messages`, `chat_read_state`, `chat_room_reports` | D1 canonical DM history, request state, membership, and read boundaries. Bug10 messaging abstractions remain canonical and are outside Bug11 cleanup. |
| Moderation and media | `moderation_actions`, `media_ownership`, `reports`, `post_tags`, `comment_tags` | Auditable moderation, authorized media ownership, reports, and content tags. |

## Public content contract

A post is publicly visible only when all of the following are true:

```sql
p.is_removed = 0
AND p.is_shadow_hidden = 0
AND s.is_removed = 0
```

`src/lib/content-visibility.ts` is the single SQL predicate used by feed, community, recommended, profile-post, search, post-detail, link-out, view, and analytics paths. Comments additionally require `is_removed = 0`, `is_deleted = 0`, and `is_shadow_hidden = 0` for ordinary public interaction.

- Home uses subscribed-community recency.
- Community and profile feeds use recency.
- Popular uses the canonical engagement rank `like_count + comment_count * 3`, then `(created_at, id)` descending as the deterministic tie-break.
- Recommended remains personalized D1 ranking; it reuses the canonical post projection.
- Popular cursors are signed and bind `rank`, `created_at`, and `id` to the feed context. A popular cursor without rank is invalid.
- A block is not a visibility predicate. Direct public reads remain possible, while new likes, comments, replies, Q&A answers, accept actions, and guarded notifications are denied bilaterally. Unlike and accepted-answer cleanup remain allowed.

## Counter invariants

Counters are denormalized read accelerators; canonical rows remain authoritative.

| Counter | Invariant | Write/reconciliation path |
| --- | --- | --- |
| `posts.like_count` | Equals `COUNT(post_likes WHERE post_id = posts.id)`. | Like/unlike batch updates from the canonical like table. Migration `0034` backfills it. |
| `comments.like_count` | Equals `COUNT(comment_likes WHERE comment_id = comments.id)`. | Comment like/unlike batch updates from the canonical like table. Migration `0034` backfills it. |
| `posts.comment_count` | Counts comments with `is_deleted = 0`, `is_removed = 0`, `is_shadow_hidden = 0`. | Comment create/delete/moderation writes and migration `0037` reconciliation. |
| `questions.answer_count` | Counts non-removed, non-shadow answers for the question. | Answer creation updates only after the answer insert commits. |
| `subreddits.subscriber_count` | Equals `COUNT(subscriptions WHERE subreddit_id = subreddits.id)`. | Subscribe/unsubscribe use one D1 batch for relation mutation plus scalar recount; `recountSubscribers` remains an operator repair path. |

A future maintenance job may recalculate all counters and compare drift, but no derived counter is allowed to become the sole source of truth.

## Migration inventory and disposition

| Migration | Area | Disposition |
| --- | --- | --- |
| `0001_init` | Initial users, communities, posts, comments, votes, subscriptions | Migration-compatible historical base. `users`, `votes`, legacy reaction columns, and legacy score indexes are retained for forward migration history. |
| `0002_better_auth` | Better Auth tables and FK migration | Canonical identity cutover to `"user"`; immutable history. |
| `0003_auth_camelcase` | Auth/profile compatibility columns | Canonical profile compatibility migration. |
| `0004_moderation` | Removal/shadow flags and moderation actions | Canonical moderation state. |
| `0005_user_actions` | Hides, follows, blocks, reports | Canonical social policy and moderation relations. |
| `0006_tags_achievements` | Tags and achievements | Canonical profile/content metadata. |
| `0007_weighted_score` | Vote weighting and score indexes | Legacy/migration-compatible. Runtime public ranking does not read `score` or `hot_score`; Bug11 uses canonical like/comment counters. |
| `0008_messaging_karma` | Messaging and karma fields | Canonical/used; messaging remains frozen under Bug10. |
| `0009_ads_analytics_scoring` | Ads, activity, analytics, scoring support | Mixed: analytics/activity are used; legacy post scoring objects are retained compatibility state. |
| `0010_rich_post_analytics` | Post view/link analytics | Canonical analytics rows and fields. |
| `0011_notifications` | Notification tables | Canonical notification state. |
| `0012_preferred_language` | User language preference | Canonical profile preference. |
| `0013_user_settings` | User settings | Canonical settings. |
| `0014_achievements_levels_badges` | Achievement levels/badges | Canonical achievement metadata. |
| `0015_content_translation` | Translation fields and queue state | Canonical content translation metadata. |
| `0016_security_hardening` | Security constraints/indexes | Canonical hardening. |
| `0017_laefye_achievement` | Achievement seed/compatibility | Retained product achievement data. |
| `0018_api_keys` | API key access | Canonical API authentication state. |
| `0019_migrate_legacy_languages` | Language migration | Migration-compatible data conversion. |
| `0020_questions_answers` | Q&A schema | Canonical Q&A tables. |
| `0021_marketplace` | Marketplace schema | Canonical marketplace tables. |
| `0022_business_profiles` | Business schema | Canonical business tables. |
| `0023_identity_providers` | Provider identity support | Canonical Better Auth provider relations. |
| `0024_messaging_delivery` | DM delivery/read state | Canonical messaging reliability state; frozen after Bug10. |
| `0025_multilingual_content` | Additional translation fields | Canonical translation compatibility. |
| `0026_monetization_foundations` | Billing/pro subscriptions | Canonical monetization state. |
| `0027_friendships` | Friend relations | Canonical social graph state. |
| `0028_user_presence` | Presence | Canonical ephemeral-presence persistence. |
| `0029_social_first_identity` | Identity/profile transition | Canonical identity hardening. |
| `0030_username_lifecycle` | Username lifecycle | Canonical mutable public-handle state. |
| `0031_remove_display_username` | Handle cleanup | Forward-compatible handle migration; applied history retained. |
| `0032_allow_zero_karma_dm` | DM eligibility repair | Canonical messaging policy repair. |
| `0033_chat_room_reports` | DM reports | Canonical moderation relation. |
| `0034_simple_likes` | `post_likes`, `comment_likes`, like counters | Canonical reaction cutover; positive legacy votes were backfilled, negative votes intentionally have no Like equivalent. |
| `0035_write_idempotency` | Request IDs and unique indexes | Canonical retry boundary for public writes and messaging/business writes. |
| `0036_chat_reliability` | Chat reliability fields/indexes | Canonical messaging reliability; frozen after Bug10. |
| `0037_comment_tree_integrity` | Comment tombstone/count repair | Canonical comment-tree invariant repair. |
| `0038_chat_request_integrity` | Chat request constraints | Canonical messaging integrity; frozen after Bug10. |
| `0039_cancel_orphan_pending_chat_requests` | Orphan request cleanup | Canonical messaging repair; frozen after Bug10. |
| `0040_notification_request_identity` | Notification request identity | Canonical notification idempotency. |
| `0041_media_ownership_registry` | Media ownership registry | Canonical R2 authorization metadata. |
| `0042_public_content_indexes` | Public engagement/created/comment indexes | Bug11 canonical query support; indexes use public flags and canonical counters, never legacy score fields. |

## Legacy retained objects and cleanup gate

The following are retained because applied migration history is immutable and production verification has not established a safe destructive cutover:

- `users`: pre-Better-Auth identity table retained for migration continuity. Runtime identity is `"user"`.
- `votes`: pre-`post_likes`/`comment_likes` reaction table retained for migration compatibility. Runtime writes and reads use canonical like tables; seed fixtures now write canonical likes directly.
- `posts.upvotes`, `posts.downvotes`, `posts.score`, `comments.upvotes`, `comments.downvotes`, `comments.score`: legacy reaction/score columns. They are not used for Bug11 ranking or counters.
- `hot_score` and legacy score indexes, where present in historical schema: migration-compatible ranking remnants; not runtime ranking authorities.
- `user_activity.score`: not a legacy post score. It remains a canonical recommendation/activity signal and is intentionally retained.

Safe cleanup candidates require a separate forward migration after production row-count, foreign-key, and rollback evidence. No Bug11 code path introduces a compatibility adapter or a second content model.

## Seed and test-helper audit

- `seed.sql` now inserts positive reactions directly into `post_likes` and `comment_likes`, then reconciles canonical counters. Legacy `votes` fixtures are no longer created.
- Integration helpers create canonical Better Auth `"user"`, community, post, comment, Q&A, and relation rows.
- Bug11 tests cover popular engagement/ties/cursors, public visibility, bilateral interaction blocks, notification guards, payload shape rejection, idempotency conflicts, and subscriber counter reconciliation.

## Query-plan evidence

Migration `0042_public_content_indexes.sql` provides:

- `idx_posts_public_engagement_rank` for canonical engagement rank and deterministic recency/id tie-break.
- `idx_posts_public_created` for public community/recency scans.
- `idx_comments_public_post` for public comment-tree reads.

The release checklist must run `EXPLAIN QUERY PLAN` against local D1 after reset and record any planner choice that does not use an applicable public-content index. Indexes are performance support only; SQL visibility predicates remain mandatory.
