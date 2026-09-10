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
| Identity | `user`, `session`, `account`, `verification`, `username_history` | Better Auth sessions/provider identities and username history. |
| Community | `subreddits`, `subscriptions`, `subreddit_moderators` | Community ownership, membership, and moderation. |
| Public content | `posts`, `comments`, `post_likes`, `comment_likes`, `hidden_posts`, `post_saves` | One post/comment graph, positive-like model, hidden projection, and private saved-post relation. |
| Q&A | `questions`, `answers` | Community questions, answers, accepted-answer state, and canonical filter fields. |
| Social policy | `user_blocks`, `user_follows`, `user_friendships`, `user_mutes`, `user_presence` | Bilateral blocks, follows, friends, private mutes, and presence. |
| Messaging | `chat_rooms`, `chat_room_members`, `chat_requests`, `chat_messages`, `chat_message_reports`, `chat_room_reports`, `unread_fanout` | D1 canonical message/request history and read state; realtime is delivery only. Bug10 files remain frozen. |
| Notifications | `notifications`, `push_subscriptions` | Notification rows, push subscriptions, and delivery state. |
| Moderation | `moderation_actions`, `user_warnings`, `banned_words`, `reports` | Auditable user/content moderation. |
| Discovery | `user_activity` | Lightweight community activity used by the D1 recommendation path. |
| Marketplace | `listings`, `listing_saves`, `listing_reports` | Listing lifecycle, saves, and reports. |
| Businesses | `businesses`, `business_services`, `business_verification_requests`, `business_bookings` | Business profiles, verification, services, and bookings. |
| Security and configuration | `security_rate_events`, `rate_limits`, `api_keys`, `site_settings` | Rate controls, API credentials, and operator settings. |

Profile publishing uses ordinary `subreddits` rows; the removed `u_*` naming convention has no special authorization or routing path. Existing rows are retained as user content.
Retired feature tables are removed by forward migrations `0048` and `0050`; historical migration files remain immutable.
`d1_migrations` is Wrangler metadata. `_cf_*` and `sqlite_sequence` are runtime-managed SQLite metadata and are excluded from application object classification.

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

`src/lib/content-visibility.ts` is the single SQL predicate used by feed, community, recommended, profile-post, search, and post-detail paths. Comments additionally require `is_removed = 0`, `is_deleted = 0`, and `is_shadow_hidden = 0` for ordinary public interaction.
- Home uses subscribed-community recency.
- Community and profile feeds use recency.
- Popular uses `like_count + (comment_count * 3)`, then `(created_at, id)` descending.
- Popular `window=day|week|month|all` uses UTC calendar cutoffs; the cutoff and window are signed into the cursor. Default is `all` while production volume is low.
- Recommended remains personalized D1 ranking and reuses the canonical post projection.
- A block is not a public-visibility predicate. Direct public reads remain possible; new likes, comments, replies, Q&A answers, accept actions, and guarded notifications are denied bilaterally. Unlike and accepted-answer cleanup remain allowed.
- Saves are private viewer state. Mute is private discovery/attention state: it filters discovery and ordinary actor notifications without deleting saves, follows, friendships, blocks, or DM relations.

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
| `0006_tags_achievements` | Retired achievement catalog | `RETAINED-MIGRATION-COMPAT`; runtime data removal is handled by `0050`. |
| `0007_weighted_score` | Vote weighting and score | `RETAINED-DATA`; runtime ranking does not read post/comment score. |
| `0008_messaging_karma` | Messaging and legacy karma | `RETAINED-MIGRATION-COMPAT`; DM policy no longer gates on karma. |
| `0009_ads_analytics_scoring` | Ads, activity, analytics, hot score | `RETAINED-MIGRATION-COMPAT`; activity remains canonical while ads/analytics runtime is removed. |
| `0010_rich_post_analytics` | Link/view analytics | `RETAINED-MIGRATION-COMPAT`; runtime data removal is handled by `0050`. |
| `0011_notifications` | Notifications | `CANONICAL`. |
| `0012_preferred_language` | Language preference | `CANONICAL`. |
| `0013_user_settings` | User settings | `CANONICAL`. |
| `0014_achievements_levels_badges` | Achievement rebuild | `RETAINED-MIGRATION-COMPAT`; runtime data removal is handled by `0050`. |
| `0015_content_translation` | Translation metadata | `CANONICAL`. |
| `0016_security_hardening` | Security constraints/indexes | `CANONICAL`. |
| `0017_laefye_achievement` | Achievement product data | `RETAINED-MIGRATION-COMPAT`; no runtime achievement engine remains. |
| `0018_api_keys` | API authentication | `CANONICAL`. |
| `0019_migrate_legacy_languages` | Language conversion | `RETAINED-MIGRATION-COMPAT`; no migration rewrite. |
| `0020_questions_answers` | Q&A | `CANONICAL`. |
| `0021_marketplace` | Marketplace | `CANONICAL`. |
| `0022_business_profiles` | Businesses and bookings | `CANONICAL`. |
| `0023_identity_providers` | Provider identities | `CANONICAL`. |
| `0024_messaging_delivery` | DM delivery/read state | `CANONICAL`; Bug10 runtime remains frozen. |
| `0025_multilingual_content` | Translation target metadata | `CANONICAL`. |
| `0026_monetization_foundations` | Billing, consent, and reputation ledgers | `RETAINED-MIGRATION-COMPAT`; zero-data tables are removed by `0048`. |
| `0027_friendships` | Friend graph | `CANONICAL`. |
| `0028_user_presence` | Presence | `CANONICAL`. |
| `0029_social_first_identity` | Contact email/onboarding | `CANONICAL`. |
| `0030_username_lifecycle` | Username history | `CANONICAL`. |
| `0031_remove_display_username` | Public handle cleanup | `RETAINED-MIGRATION-COMPAT`; applied history is not rewritten. |
| `0032_allow_zero_karma_dm` | DM eligibility repair | `RETAINED-MIGRATION-COMPAT`; current DM policy has no karma gate. |
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
| `0044_personal_content_controls` | Private post saves and user mutes | `CANONICAL`; composite primary keys enforce idempotency, foreign keys cascade user-owned state, and viewer discovery/notification filters use these relations. |
| `0045_retire_unused_passkey` | Unused passkey table | `REMOVED`; production row count was 0 and no Better Auth passkey plugin or runtime reference exists. |
| `0046_remove_listing_alerts` | Listing alerts | `REMOVED`; production row count was 0 and no matcher, fan-out, or runtime dependency exists. |
| `0047_remove_russian_ui_locale` | Russian UI locale | `REMOVED`; UI catalogs are vi/ko/en while Russian content translation remains supported. |
| `0048_remove_zero_data_features` | Ads, consent, billing, and reputation tables | `REMOVED`; production rollout is evidence-gated and requires backup plus FK verification. |
| `0049_remove_account_scaffolding` | Karma, account NSFW, and contact-email verification columns | `REMOVED`; forward-only destructive schema cleanup. |
| `0050_remove_retired_history` | Achievement and post-view history tables | `REMOVED` for migration-owned catalog/empty history; aborts when user grants or post views are non-empty. |

## Personal content controls

`post_saves` has primary key `(user_id, post_id)`, foreign keys to `user`/`posts` with `ON DELETE CASCADE`, and `idx_post_saves_user_created` for the private `/saved` list. It stores no public save count or saver list.

`user_mutes` has primary key `(muter_id, muted_id)`, foreign keys to `user` with `ON DELETE CASCADE`, and a self-mute check. `idx_user_mutes_muter_created` supports settings/discovery queries and `idx_user_mutes_muted` supports dependent lookups. Mute is not a block, permission, or content-removal state.

## Object classification and cleanup evidence

| Object | Runtime references | Production read-only evidence | Decision / final status |
| --- | --- | --- | --- |
| `users` table | None; Better Auth uses `user` | Table absent after `0002` | `REMOVED`. |
| `passkey` table | No runtime references; Better Auth has no passkey plugin | Production rows: 0 | `REMOVED` by `0045`; applied `0023` history remains immutable. |
| `listing_alerts` table | CRUD-only implementation; no matcher or delivery path | Production rows: 0 | `REMOVED` by `0046`; no data migration required. |
| `votes` table | Migration-only; runtime uses `post_likes`/`comment_likes` | 1 legacy row | `RETAINED-DATA`; no blind deletion. |
| `posts.upvotes`, `posts.downvotes`, `posts.score` | No runtime references | `posts.score` has 1 non-zero row | `RETAINED-DATA`; physical columns preserve legacy data. |
| `posts.hot_score` | No runtime references | 1 non-zero row | `RETAINED-DATA`; physical column preserves legacy data. |
| `comments.upvotes`, `comments.downvotes`, `comments.score` | No runtime references | `comments.score` non-zero rows: 0 | `RETAINED-DATA`; physical columns preserve migration compatibility. |
| `achievements`, `user_achievements` | No runtime references | Production grant rows were non-zero before cleanup audit | Catalog is removed; user grants require backup/compare before guarded `0050`. |
| `post_views`, `post_link_clicks` | No runtime references | `post_views` had 7 rows before cleanup audit | `REMOVED` only by guarded `0050` after backup/compare. |
| Ads, consent, billing, reputation tables | No runtime references | Production row counts: 0 | `REMOVED` by `0048`. |
| User karma/NSFW/contact verification columns | No runtime references | Retired account metadata | `REMOVED` by `0049`; backup required before production apply. |
| `user_activity.score` | Recommendation/activity runtime signal | Used by activity upsert/query paths | `CANONICAL`; it is not post ranking score. |
| `idx_posts_feed` | No runtime references; superseded by `0042` public indexes | No dependency in migration/runtime search | `REMOVED` by `0043`. |
| `idx_posts_score` | No runtime references; score ranking retired | Legacy-only definition | `REMOVED` by `0043`. |
| `idx_posts_subreddit_created` | No runtime references; superseded by public recency index | Local/production plan uses `idx_posts_public_created` | `REMOVED` by `0043`. |
| `idx_comments_post_created` | No runtime references; superseded by public comment index | Local/production public comment plan uses `idx_comments_public_post` | `REMOVED` by `0043`. |
| `idx_comments_thread` | No runtime references; score ordering retired | Legacy-only definition | `REMOVED` by `0043`. |
| `post_likes`, `comment_likes` | Canonical runtime reads/writes | Counter drift audit: 0 | `CANONICAL`. |
| `posts.like_count`, `comments.like_count`, `posts.comment_count` | Canonical projection/ranking counters | Counter drift audit: 0 | `CANONICAL`. |
| `questions.answer_count`, `subreddits.subscriber_count` | Canonical Q&A/community counters | Counter drift audit: 0 | `CANONICAL`. |

The Bug12/Bug14 production evidence is read-only. Canonical likes/counters remain authoritative; legacy vote rows and score columns are retained because they are non-empty or required for migration compatibility. Achievement and post-view removal is guarded: `0050` aborts instead of deleting non-empty history. Booking remains active because its routes, UI, idempotent write path, conflict check, and integration coverage are live; a zero-row production count alone is not removal evidence for a core business feature.

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
