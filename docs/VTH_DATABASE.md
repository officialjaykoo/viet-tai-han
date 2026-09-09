# VTH database contract

This document records the Bug12 D1 audit and the Bug11 canonical runtime contract. Applied migrations remain immutable; cleanup is forward-only and evidence-gated.

## Source of truth and boundaries

- D1 binding `DB` in database `vth-db` is the persistent source of truth.
- Better Auth table `"user"` owns internal identity. User-owned foreign keys reference `user.id`.
- `username` is a mutable public handle, never a relationship key.
- R2 stores media bytes; `media_objects` and media-key columns store authorization metadata only.
- Durable Object `ChatRoom` transports committed DM events. It is not a second message database.
- There is no Supabase, generic repository, generic DAO, ORM, or second content model.

## Canonical runtime objects

| Domain | Runtime tables | Contract |
| --- | --- | --- |
| Identity | `user`, `session`, `account`, `verification`, `passkey`, `username_history` | Better Auth sessions/provider identities, passkeys, and username history. |
| Community | `subreddits`, `subscriptions`, `subreddit_moderators` | Community ownership, membership, and moderation. |
| Public content | `posts`, `comments`, `post_likes`, `comment_likes`, `hidden_posts` | One post/comment graph and one positive-like model. |
| Q&A | `questions`, `answers` | Community questions, answers, and accepted-answer state. |
| Social policy | `user_blocks`, `user_follows`, `user_friendships`, `user_presence` | Bilateral blocks, follows, friends, and presence. |
| Messaging | `chat_rooms`, `chat_room_members`, `chat_requests`, `chat_messages`, `chat_message_reports`, `chat_room_reports`, `unread_fanout` | D1 canonical message/request history and read state; realtime is delivery only. Bug10 files remain frozen. |
| Notifications | `notifications`, `push_subscriptions` | Notification rows, push subscriptions, and delivery state. |
| Moderation | `moderation_actions`, `user_warnings`, `banned_words`, `reports` | Auditable user/content moderation. |
| Discovery and analytics | `user_activity`, `post_views`, `post_link_clicks`, `ad_campaigns`, `ad_impressions`, `ad_clicks` | Recommendation signals, view/click analytics, and ad state. Analytics are not visibility authorities. |
| Marketplace | `listings`, `listing_saves`, `listing_alerts`, `listing_reports` | Listing lifecycle, saves, alerts, and reports. |
| Businesses | `businesses`, `business_services`, `business_verification_requests`, `business_bookings` | Business profiles, verification, services, and bookings. |
| Monetization | `user_consents`, `pro_subscriptions`, `billing_events`, `transaction_ledger`, `reputation_ledger` | Consent, provider-neutral billing, and auditable money/reputation events. |
| Security and configuration | `security_rate_events`, `rate_limits`, `api_keys`, `site_settings` | Rate controls, API credentials, and operator settings. |
| Achievements | `achievements`, `user_achievements` | Achievement catalog and user progress. |

`d1_migrations` is Wrangler metadata. `_cf_METADATA` and `sqlite_sequence` are runtime-managed SQLite metadata and are excluded from application object classification.

## Complete schema inventory

The inventory includes all application tables, columns, checks, unique constraints, foreign keys, and explicit indexes without relying on a hand-maintained subset:

```text
node scripts/audit-db-integrity.mjs --local --schema
node scripts/audit-db-integrity.mjs --remote --schema
```

`--schema` emits each table definition, `PRAGMA table_info`, `PRAGMA foreign_key_list`, and every explicit index definition. Table SQL is the evidence for inline `CHECK`, `PRIMARY KEY`, and `UNIQUE` constraints; index SQL records ordinary and unique indexes. The audit is read-only for both targets.

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
- Popular uses `like_count + comment_count * 3`, then `(created_at, id)` descending.
- Recommended remains personalized D1 ranking and reuses the canonical post projection.
- Popular cursors carry rank and deterministic tie-break fields and are bound to the complete feed context.
- A block is not a public-visibility predicate. Direct public reads remain possible; new likes, comments, replies, Q&A answers, accept actions, and guarded notifications are denied bilaterally. Unlike and accepted-answer cleanup remain allowed.

## Counter invariants

Counters are denormalized read accelerators. Relation rows and visible content rows remain authoritative.

| Counter | Invariant | Write/reconciliation path |
| --- | --- | --- |
| `posts.like_count` | `COUNT(post_likes WHERE post_id = posts.id)`. | Canonical like/unlike batch. Migration `0034` backfill. |
| `comments.like_count` | `COUNT(comment_likes WHERE comment_id = comments.id)`. | Canonical comment-like/unlike batch. Migration `0034` backfill. |
| `posts.comment_count` | Comments with `is_deleted = 0`, `is_removed = 0`, `is_shadow_hidden = 0`. | Comment create/delete/moderation writes and `0037` reconciliation. |
| `questions.answer_count` | Answers with `is_removed = 0` and `is_shadow_hidden = 0`. | Answer write path. |
| `subreddits.subscriber_count` | `COUNT(subscriptions WHERE subreddit_id = subreddits.id)`. | Subscribe/unsubscribe batch and recount repair path. |

The reusable audit reports all five counter drifts and fails in `--strict` mode when any drift is non-zero.

## Migration inventory and disposition

| Migration | Area | Disposition |
| --- | --- | --- |
| `0001_init` | Initial identity, communities, posts, comments, votes, subscriptions | `RETAINED-MIGRATION-COMPAT`; historical base is immutable. |
| `0002_better_auth` | Better Auth tables and FK migration | `CANONICAL`; identity cutover to `user`. |
| `0003_auth_camelcase` | Auth column compatibility | `CANONICAL`; applied history retained. |
| `0004_moderation` | Moderation state | `CANONICAL`. |
| `0005_user_actions` | Hides, follows, blocks, reports | `CANONICAL`. |
| `0006_tags_achievements` | Achievements | `CANONICAL`. |
| `0007_weighted_score` | Vote weighting and score | `RETAINED-DATA`; runtime ranking does not read post/comment score. |
| `0008_messaging_karma` | Messaging and karma | `CANONICAL`; Bug10 runtime remains frozen. |
| `0009_ads_analytics_scoring` | Ads, activity, analytics, hot score | `CANONICAL` for analytics/activity; `RETAINED-DATA` for historical `hot_score`. |
| `0010_rich_post_analytics` | Link/view analytics | `CANONICAL`. |
| `0011_notifications` | Notifications | `CANONICAL`. |
| `0012_preferred_language` | Language preference | `CANONICAL`. |
| `0013_user_settings` | User settings | `CANONICAL`. |
| `0014_achievements_levels_badges` | Achievement rebuild | `CANONICAL`; applied history retained. |
| `0015_content_translation` | Translation metadata | `CANONICAL`. |
| `0016_security_hardening` | Security constraints/indexes | `CANONICAL`. |
| `0017_laefye_achievement` | Achievement product data | `RETAINED-DATA`. |
| `0018_api_keys` | API authentication | `CANONICAL`. |
| `0019_migrate_legacy_languages` | Language conversion | `RETAINED-MIGRATION-COMPAT`; no migration rewrite. |
| `0020_questions_answers` | Q&A | `CANONICAL`. |
| `0021_marketplace` | Marketplace | `CANONICAL`. |
| `0022_business_profiles` | Businesses and bookings | `CANONICAL`. |
| `0023_identity_providers` | Provider identities | `CANONICAL`. |
| `0024_messaging_delivery` | DM delivery/read state | `CANONICAL`; Bug10 runtime remains frozen. |
| `0025_multilingual_content` | Translation target metadata | `CANONICAL`. |
| `0026_monetization_foundations` | Billing and reputation ledgers | `CANONICAL` tables; provider payloads stay external. |
| `0027_friendships` | Friend graph | `CANONICAL`. |
| `0028_user_presence` | Presence | `CANONICAL`. |
| `0029_social_first_identity` | Contact email/onboarding | `CANONICAL`. |
| `0030_username_lifecycle` | Username history | `CANONICAL`. |
| `0031_remove_display_username` | Public handle cleanup | `RETAINED-MIGRATION-COMPAT`; applied history is not rewritten. |
| `0032_allow_zero_karma_dm` | DM eligibility repair | `CANONICAL`; Bug10 runtime remains frozen. |
| `0033_chat_room_reports` | DM reports | `CANONICAL`; Bug10 runtime remains frozen. |
| `0034_simple_likes` | Canonical like tables/counters | `CANONICAL`; positive legacy rows were backfilled. |
| `0035_write_idempotency` | Request IDs and unique indexes | `CANONICAL`. |
| `0036_chat_reliability` | Client message IDs/read boundary | `CANONICAL`; Bug10 runtime remains frozen. |
| `0037_comment_tree_integrity` | Comment tombstones/count repair | `CANONICAL`. |
| `0038_chat_request_integrity` | Chat request constraints | `CANONICAL`; Bug10 runtime remains frozen. |
| `0039_cancel_orphan_pending_chat_requests` | Chat request repair | `CANONICAL`; Bug10 runtime remains frozen. |
| `0040_notification_request_identity` | Notification idempotency | `CANONICAL`. |
| `0041_media_ownership_registry` | R2 ownership metadata | `CANONICAL`. |
| `0042_public_content_indexes` | Public feed/comment indexes | `CANONICAL`; indexes use canonical counters and visibility flags. |
| `0043_remove_legacy_feed_indexes` | Redundant pre-canonical feed/tree indexes | `REMOVED` via forward-only `DROP INDEX IF EXISTS`; no runtime or migration dependency. |

## Object classification and cleanup evidence

| Object | Runtime references | Production read-only evidence | Decision / final status |
| --- | --- | --- | --- |
| `users` table | None; Better Auth uses `user` | Table absent after `0002` | `REMOVED`. |
| `votes` table | Migration-only; runtime uses `post_likes`/`comment_likes` | 1 legacy row | `RETAINED-DATA`; no blind deletion. |
| `posts.upvotes`, `posts.downvotes`, `posts.score` | No runtime references | `posts.score` has 1 non-zero row | `RETAINED-DATA`; physical columns preserve legacy data. |
| `posts.hot_score` | No runtime references | 1 non-zero row | `RETAINED-DATA`; physical column preserves legacy data. |
| `comments.upvotes`, `comments.downvotes`, `comments.score` | No runtime references | `comments.score` non-zero rows: 0 | `RETAINED-DATA`; physical columns preserve migration compatibility. |
| `user_activity.score` | Recommendation/activity runtime signal | Used by activity upsert/query paths | `CANONICAL`; it is not post ranking score. |
| `idx_posts_feed` | No runtime references; superseded by `0042` public indexes | No dependency in migration/runtime search | `REMOVED` by `0043`. |
| `idx_posts_score` | No runtime references; score ranking retired | Legacy-only definition | `REMOVED` by `0043`. |
| `idx_posts_subreddit_created` | No runtime references; superseded by public recency index | Local/production plan uses `idx_posts_public_created` | `REMOVED` by `0043`. |
| `idx_comments_post_created` | No runtime references; superseded by public comment index | Local/production public comment plan uses `idx_comments_public_post` | `REMOVED` by `0043`. |
| `idx_comments_thread` | No runtime references; score ordering retired | Legacy-only definition | `REMOVED` by `0043`. |
| `post_likes`, `comment_likes` | Canonical runtime reads/writes | Counter drift audit: 0 | `CANONICAL`. |
| `posts.like_count`, `comments.like_count`, `posts.comment_count` | Canonical projection/ranking counters | Counter drift audit: 0 | `CANONICAL`. |
| `questions.answer_count`, `subreddits.subscriber_count` | Canonical Q&A/community counters | Counter drift audit: 0 | `CANONICAL`. |

The production audit before `0043` was read-only: FK violations `0`, all five counter drifts `0`, relation orphans `0`, `votes=1`, `posts.score_nonzero=1`, `posts.hot_score_nonzero=1`. Therefore only dead indexes are removed; legacy rows and columns are retained.

## Audit command and migration gates

```text
npm run db:reset:local
npm run db:audit:local
node scripts/audit-db-integrity.mjs --remote --strict
```

`audit-db-integrity.mjs` never mutates D1. It reports `PRAGMA foreign_key_check`, five counter drifts, relation orphans, and legacy row counts. `--strict` exits non-zero on FK, drift, or orphan failures. Remote destructive commands are not embedded in the script.

The migration gate is:

1. Empty local D1: apply all migrations, then seed.
2. Upgrade local D1: apply the pending migration to the existing seeded database.
3. Run the read-only audit and applicable `EXPLAIN QUERY PLAN` checks.
4. Run remote read-only audit before applying a forward migration.
5. Apply migration and verify index presence, canonical counters, FK checks, and production smoke routes.

No existing migration is rewritten or squashed.
