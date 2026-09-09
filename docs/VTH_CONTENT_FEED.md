# VTH public content and feed contract

This document is the Bug11 runtime contract for public post discovery and interaction. D1 rows are canonical; UI state, caches, and analytics are projections.

## Canonical paths

| Surface | Entry point | Order/personalization |
| --- | --- | --- |
| Home | `src/app/page.tsx` → `getFeedPosts({ mode: "home" })` | Subscribed-community recency. |
| Popular | `src/app/page.tsx` or `/api/posts?feed=popular` → `getFeedPosts({ mode: "popular", sort: "popular" })` | Public canonical engagement rank. |
| Community | `/r/[name]`, `/api/subreddits/[name]` → `getFeedPosts({ mode: "community" })` | Community recency. |
| Recommended | `/recommended` → `getRecommendations` | Personalized D1 activity/follow signal. |
| Profile posts | `/u/[username]`, `/api/profile/[username]` → `getFeedPosts({ sort: "new" })` | Author-scoped recency. |
| Post detail | `/post/[id]`, `/api/posts/[id]` → `getPostDetail` | One public post projection plus comment tree. |
| Search | `/search`, `/api/search` → `searchAll` | Public visibility-filtered text search. |
| Out/analytics | `/api/posts/[id]/out`, `/view`, `/stats` | Operates only on publicly visible posts. |

All post projections use `src/lib/post-projection.ts`. All public post queries use `src/lib/content-visibility.ts`:

```sql
p.is_removed = 0
AND p.is_shadow_hidden = 0
AND s.is_removed = 0
```

Comments shown publicly additionally require live, non-deleted, non-shadow-hidden state. Block state is intentionally separate from visibility: a blocked author's public post can still be read directly, but new positive interactions are denied bilaterally.

## Feed ranking and pagination

The canonical popular score is:

```text
engagement_rank = like_count + comment_count * 3
```

Ordering is:

```text
engagement_rank DESC,
created_at DESC,
id DESC
```

`like_count` and `comment_count` are canonical display counters backed by relation tables and live comment rows. Legacy `score` and `hot_score` are not used. Signed feed cursors bind `sort`, mode, community, author, viewer, and scope. Popular cursors also carry the exact rank and `(created_at, id)` position; a popular cursor without rank is rejected.

A page requests `limit + 1`, returns at most `limit`, and emits the last returned row as the signed continuation boundary. A rank tie therefore cannot skip or duplicate rows when timestamps and IDs are stable.

## Interaction policy

- Like insert: denied if either direction of `user_blocks` exists; unlike remains allowed.
- Comment root: actor↔post-author block denies the final insert.
- Reply: actor↔post-author and actor↔parent-author block denies the final insert.
- Q&A answer: actor↔question-author block denies the final insert.
- Accept answer: question owner↔answer-author block denies new acceptance; clearing an existing acceptance remains allowed.
- Comment, reply, and mention notifications use the same bilateral block guard, including the final unread/push fanout boundary.
- Public reads do not use block state as a content-visibility predicate.

All final writes use D1 conditional SQL in addition to preflight checks, so a block created between the read and write cannot be bypassed. Positive reaction rows are unique by `(post_id, user_id)` or `(comment_id, user_id)`.

## Write validation and retries

`src/lib/content-payload.ts` rejects `null`, arrays, primitives, empty required strings, wrong optional types, and unknown like actions with HTTP 400 through the route's `AuthError` handling.

Post, comment, question, answer, and listing creation use request IDs when supplied. The same actor/request ID with the same normalized payload returns the original ID. Reusing that request ID with a different target, parent, body, title, category, price, or location returns HTTP 409.

## Canonical truth audit

```text
Canonical Post Like Truth:       post_likes(post_id, user_id)
Canonical Comment Like Truth:    comment_likes(comment_id, user_id)
Canonical Display Counter:       posts.like_count, comments.like_count, posts.comment_count
Canonical Popular Ranking Signal: like_count + comment_count * 3
Legacy Vote Data Status:         votes retained for migration compatibility; seed no longer creates rows
Legacy Score Status:             posts/comments score and vote columns retained, not runtime ranking/counter inputs
Legacy hot_score Status:         retained historical scoring column, not runtime ranking input
```

DB schema and migration dispositions are recorded in `docs/VTH_DATABASE.md`. Bug10 messaging files and contracts are unchanged; they remain the single canonical messaging implementation and are not reused as a public-content reconciliation scheduler.
