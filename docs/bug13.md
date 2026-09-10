# Bug13 — Best-of-7 Product Patterns & VTH Convergence

## 0. Mission

Bug13은 7개 오픈소스 프로젝트의 코드를 섞는 작업이 아니다.

목표는:

```text
RED
Clonagram
Discourse
Lemmy
Apache Answer
Bluesky
GoToSocial
```

에서 VTH보다 실제로 나은 패턴을 조사하고,

```text
좋은 패턴
→ VTH 방식으로 재설계
→ 기존 canonical architecture에 흡수
→ 중복 경로 제거
```

하는 것이다.

최종 시스템은 반드시 **VTH 방식 하나**여야 한다.

---

# 1. Baseline

최신 `main`에서 시작한다.

현재 Bug12 완료 baseline:

```text
main:
a889f6f

lint:
0 errors / 0 warnings

unit:
51 files / 233 tests

worker:
22 files / 131 tests

integration:
21 files / 127 tests

Chromium E2E:
32 passed / 1 skipped

critical repeat x3:
12 / 12 passed

DB:
FK violations 0
counter drift 0
orphans 0
```

Migration latest:

```text
0043_remove_legacy_feed_indexes.sql
```

Bug13은 이보다 품질을 떨어뜨리면 안 된다.

---

# 2. 먼저 canonical docs를 읽는다

수정 전에 반드시:

```text
docs/PRODUCT.md
docs/ROADMAP.md
docs/ARCHITECTURE.md
docs/VTH_DATABASE.md
docs/VTH_TESTING.md

docs/VTH_CONTENT_FEED.md
docs/VTH_REALTIME_DM.md
```

를 읽는다.

Source가 문서와 다르면 어느 쪽이 stale인지 판정한다.

무조건 문서에 코드를 맞추지 않는다.

---

# 3. Bug13의 핵심 규칙

외부 프로젝트마다 하나씩 억지로 가져오지 않는다.

분류:

```text
ADOPT
ADAPT
VTH-ALREADY-STRONGER
DEFER
REJECT
```

실제 구현은:

```text
Impact >= 4/5
Complexity <= 3/5
명확한 VTH product fit
```

을 우선한다.

---

# 4. License / donor rule

외부 프로젝트 소스를 그대로 복사하는 것을 기본 전략으로 사용하지 않는다.

기본:

```text
concept / invariant / UX pattern
→ VTH-native implementation
```

이다.

Verbatim code copy가 필요하면 license compatibility와 attribution requirement를 먼저 확인한다.

---

# 5. Reference 1 — RED

Repository:

```text
koval01/red
```

확인:

```text
README
src/worker.ts
src/lib/security/**
src/lib/internal-api/**
D1 access path
Cloudflare bindings
```

## 가져올 것

RED의 가장 큰 장점은 기능이 아니라:

```text
Cloudflare-native simplicity
edge-first rejection
D1 directness
small dependency surface
```

이다.

Bug13의 모든 새 기능에 이 원칙을 적용한다.

---

# 6. RED decision

분류 예상:

```text
VTH-ALREADY-STRONGER / KEEP
```

VTH는 이미 RED보다 많은 correctness invariant를 갖고 있다.

RED로 되돌아가지 않는다.

대신 Bug13 신규 기능에서:

```text
새 DB 없음
새 cache 없음
새 queue 없음
새 Worker 없음
새 DO 없음
새 state manager 없음
```

을 기본값으로 한다.

---

# 7. RED cost gate

새로운 endpoint마다 확인:

```text
SSR 전에 거절 가능한 요청인가?
불필요한 D1 read가 추가됐는가?
per-card N+1이 생겼는가?
AI가 필요 없는 경로에서 AI를 호출하는가?
DO가 coordination 외 state authority가 되었는가?
```

하나라도 그렇다면 구조를 다시 단순화한다.

---

# 8. Reference 2 — Clonagram

중점 source:

```text
src/actions/post/togglePostRelation.ts
src/actions/post/getExplorePosts.ts
src/queries/posts.ts
src/utils/posts.ts
```

Clonagram에서 이미 Bug11에 가져온:

```text
small post projection
central validation
engagement scoping
```

은 다시 만들지 않는다.

---

# 9. Clonagram 신규 후보 — Saved Posts

Clonagram의 `saves` relation 개념을 VTH에 맞게 도입한다.

목표:

> 한국 생활 정보나 중요한 community post를 사용자가 나중에 다시 찾을 수 있어야 한다.

이것은 VTH Product Goal과 직접 일치한다.

---

# 10. Saved Posts semantics

Canonical relation:

```text
post_saves
```

권장 key:

```text
(user_id, post_id)
```

unique.

Save는 private viewer state다.

다른 사용자에게:

```text
save count
who saved
```

를 공개하지 않는다.

---

# 11. Save는 Like와 다르다

절대:

```text
like_count
Popular ranking
notification
karma
analytics engagement ranking
```

에 영향을 주지 않는다.

Save는 개인 bookmark다.

---

# 12. Save mutation

Desired:

```text
POST /api/posts/:id/save
```

payload는 명시적으로:

```json
{ "saved": true }
```

또는 기존 API convention에 맞는 최소 형태를 사용한다.

Server는 client current state를 신뢰하지 않는다.

---

# 13. Save idempotency

```text
save already exists + save
→ success

save absent + unsave
→ success
```

중복 relation 없음.

D1 uniqueness가 최종 방어선이다.

---

# 14. Saved page

권장:

```text
/saved
```

또는 현재 navigation과 가장 자연스러운 existing surface.

Account menu/Profile secondary action에서 접근 가능하게 한다.

Main navigation item을 하나 더 늘리지는 않는다.

---

# 15. Saved query visibility

Saved relation 자체는 유지해도 된다.

하지만 saved listing에서 post가:

```text
removed
shadow-hidden
community removed
```

이면 ordinary content를 노출하지 않는다.

Canonical public post visibility를 재사용한다.

---

# 16. Save와 mute/block

사용자가 명시적으로 저장한 콘텐츠이므로:

```text
mute
→ save relation 삭제 안 함

block
→ save relation 삭제 안 함
```

을 기본으로 한다.

Saved page는 explicit user intent surface이므로 mute discovery filtering을 적용하지 않아도 된다.

단 canonical public visibility는 항상 적용한다.

---

# 17. Saved UI

Post action footer를 복잡하게 만들지 않는다.

우선:

```text
Post overflow menu
→ Save / Unsave
```

가 적절하다.

필요성이 명확하면 detail page에도 bookmark icon을 둘 수 있다.

---

# 18. Clonagram에서 가져오지 않을 것

```text
generic relation helper 그대로 복사
Supabase mutation model
React Query invalidation
repost architecture
Stories
Reels
group media architecture
```

VTH D1 conditional writes와 현재 projection이 더 적합하다.

---

# 19. Reference 3 — Discourse

중점:

```text
app/models/reviewable.rb
app/models/reviewable_flagged_post.rb
post action / flag path
Guardian permission boundaries
review history
```

Discourse 전체 Reviewable framework를 복사하지 않는다.

---

# 20. 현재 VTH 문제

현재 admin moderation은 크게:

```text
banned words / warning

listing reports

chat reports

content/business reports
```

가 여러 형태로 흩어져 있다.

관리자는 실제로:

> "지금 처리해야 할 신고"

를 한 화면에서 볼 수 있어야 한다.

---

# 21. Discourse 신규 후보 — Unified Review Queue

Discourse의 핵심 아이디어만 가져온다.

```text
여러 source의 신고
→ 하나의 normalized review projection
→ pending/actioned/dismissed lifecycle
```

단 VTH에서 generic polymorphic moderation DB를 새로 만들지 않는다.

---

# 22. Review Queue storage rule

기존 canonical report tables를 유지한다.

예:

```text
reports
listing_reports
business_reports
chat reports
other existing report relations
```

을 그대로 source of truth로 둔다.

새 `reviewables` generic table을 만들지 않는다.

---

# 23. Review Queue는 read model

새 작은 server projection:

예:

```ts
type ReviewQueueItem =
  | PostReviewItem
  | CommentReviewItem
  | ListingReviewItem
  | BusinessReviewItem
  | ChatReviewItem;
```

처럼 discriminated union을 사용한다.

필요 이상의 generic abstraction은 만들지 않는다.

---

# 24. Review Queue fields

최소:

```text
sourceType
reportId
status
reason
details
createdAt

reporter
target summary
target href
actionable target id
```

정도.

---

# 25. Sensitive payload 최소화

Review queue DTO에:

```text
email
OAuth identity
session
IP
token
raw private data
전체 DM history
```

를 넣지 않는다.

Chat report는 기존처럼 moderation에 필요한 제한된 context만 제공한다.

---

# 26. Review status

기존 domain status와 호환 가능한 최소 상태:

```text
pending
actioned
dismissed
```

정도로 수렴한다.

Discourse의 복잡한:

```text
score
trust weighting
claim system
priority engine
```

까지 포팅하지 않는다.

현재 VTH 규모에서는 불필요하다.

---

# 27. Review history

관리자가 action을 수행하면 기존:

```text
moderation_actions
resolution note
domain report status
```

를 활용해 누가 무엇을 했는지 감사 가능하게 한다.

동일 정보를 두 DB에 중복 저장하지 않는다.

---

# 28. Admin UX

`/admin/reports`를 하나의 review queue로 개선한다.

필터:

```text
Pending
All

Post/Comment
Marketplace
Business
Chat
```

정도면 충분하다.

---

# 29. Admin action invariants

```text
already reviewed report
→ destructive action 중복 실행 금지

removed target
→ idempotent 처리

dismissed
→ target mutation 없음

actioned
→ report state + moderation effect 일관성
```

을 테스트한다.

---

# 30. Reference 4 — Lemmy

중점:

```text
Active
Hot
Top Day
Top Week
Top Month
Top All
```

그리고 ranking/index evolution.

Lemmy의 stored hot rank/background recalculation architecture는 VTH 규모에 그대로 필요하지 않다.

---

# 31. 현재 VTH Popular의 장점

현재 canonical:

```text
like_count + comment_count * 3
```

tie:

```text
created_at DESC
id DESC
```

cursor signed.

이 correctness는 유지한다.

---

# 32. 현재 VTH Popular의 장기 문제

현재 Popular는 essentially all-time engagement다.

시간이 지나면:

```text
오래된 고-engagement post
→ 계속 상단 유지
```

할 수 있다.

Bug13에서 이를 해결한다.

---

# 33. Lemmy 신규 후보 — Popular Time Windows

다음 window를 지원한다.

```text
day
week
month
all
```

권장 UI:

```text
오늘
이번 주
이번 달
전체
```

Vietnamese translation도 추가한다.

---

# 34. Popular default

Bug13 기본값은:

```text
month
```

을 우선 검토한다.

단 최신 production content volume을 확인해 지나치게 빈 feed가 된다면 `all`을 유지할 수 있다.

결정과 근거를 최종 보고에 적는다.

무조건 알고리즘 취향으로 결정하지 않는다.

---

# 35. Ranking formula는 그대로

Window 내부 ranking:

```text
like_count + comment_count * 3
```

을 유지한다.

Bug13에서:

```text
score
hot_score
votes
```

를 부활시키지 않는다.

---

# 36. Background hot-rank job 금지

Lemmy식 scheduled hot-rank refresh를 그대로 만들지 않는다.

현재 VTH에는:

```text
background ranking updater
cron rank cache
stored hot rank
```

가 필요하지 않다.

---

# 37. Window cursor correctness

Popular cursor context에 최소:

```text
window
windowStart
rank
createdAt
id
viewer/context
```

를 bind한다.

첫 page에서 window cutoff를 계산했다면 다음 page도 **같은 cutoff**를 사용한다.

페이지 요청 중 시간이 흐른다고 window boundary가 움직여 duplicate/skip이 발생하지 않게 한다.

---

# 38. Window ordering

항상:

```text
rank DESC
created_at DESC
id DESC
```

이다.

Cursor tuple과 SQL tuple이 정확히 일치해야 한다.

---

# 39. Popular query-plan gate

변경 후:

```sql
EXPLAIN QUERY PLAN
```

을 수행한다.

0042 index가 충분한지 확인한다.

추측으로 새 index를 추가하지 않는다.

새 index는 실제 planner evidence가 있을 때만 추가한다.

---

# 40. Reference 5 — Apache Answer

중점:

```text
question state
accepted answer
answer count
question list ordering
search/filter
permission tests
```

Apache Answer의 Go service/repository architecture는 가져오지 않는다.

---

# 41. 현재 VTH Q&A

현재 질문 목록은 사실상:

```text
latest 50
```

이다.

하지만 이미 canonical state에는:

```text
answer_count
accepted_answer_id
```

가 있다.

이 정보를 discovery에 활용한다.

---

# 42. Apache Answer 신규 후보 — Q&A filters

최소:

```text
Newest
Unanswered
Answered
Solved
```

를 제공한다.

Vietnamese-first UI copy를 사용한다.

---

# 43. Q&A semantics

```text
Newest
→ normal latest

Unanswered
→ answer_count = 0

Answered
→ answer_count > 0

Solved
→ accepted_answer_id IS NOT NULL
```

이다.

---

# 44. Q&A source-of-truth

Filter용 별도 status column을 만들지 않는다.

이미 있는 canonical:

```text
answer_count
accepted_answer_id
```

를 사용한다.

DB duplication을 만들 이유가 없다.

---

# 45. Q&A URL contract

예:

```text
/questions?filter=newest
/questions?filter=unanswered
/questions?filter=answered
/questions?filter=solved
```

처럼 shareable URL이어야 한다.

Client-only state로 숨기지 않는다.

---

# 46. Q&A malformed filter

잘못된 값:

```text
/questions?filter=xxxx
```

은:

```text
newest fallback
```

또는 명확한 normalized behavior를 사용한다.

500은 금지.

API가 같은 filter를 지원한다면 API는 invalid enum을 400 처리하는 편이 적절하다.

---

# 47. Q&A query index

현재 데이터와 query plan을 확인한다.

Filter 몇 개 때문에 새로운 status index를 무조건 만들지 않는다.

필요하면 Bug14 index consolidation에서 최종 판단할 수도 있다.

---

# 48. Reference 6 — Bluesky

중점:

```text
muteActor
unmuteActor
block
moderation viewer state
```

핵심은:

> Block과 Mute는 같은 기능이 아니다.

---

# 49. Bluesky 신규 후보 — User Mute

VTH에 user mute를 추가한다.

Mute는:

```text
attention/discovery preference
```

이다.

Block은:

```text
interaction/contact barrier
```

이다.

둘을 섞지 않는다.

---

# 50. Canonical mute relation

새 D1 relation:

```text
user_mutes
```

권장:

```text
muter_id
muted_id
created_at

UNIQUE(muter_id, muted_id)
```

`user.id` 사용.

Self mute 금지.

---

# 51. Mute semantics

Mute 후:

```text
Home
Popular
Recommended
Community feed
Search discovery
```

에서 muted author content를 viewer에게 숨긴다.

---

# 52. Direct reads 유지

다음은 유지한다.

```text
/u/:username
/post/:id
```

직접 접근.

즉 mute는 visibility authority가 아니다.

Public visibility는 기존 canonical predicate가 계속 결정한다.

---

# 53. Mute는 interaction permission이 아니다

Muted user의 공개 post를 직접 연 뒤:

```text
like
comment
follow
friend
```

등 ordinary interaction은 block이 없다면 가능하다.

Mute 때문에 403을 반환하지 않는다.

---

# 54. DM과 mute

Mute는 DM block이 아니다.

현재:

```text
allowDms
block
friend/follow relationship
DM request policy
```

가 DM permission을 결정한다.

Mute 하나로 DM room을 revoke하지 않는다.

---

# 55. Notification mute semantics

Muted actor가 만드는 ordinary content notification:

```text
comment_on_post
reply_to_comment
mention
```

은 mute owner에게 fanout하지 않는 것을 기본으로 한다.

그러나:

```text
DM
security
admin/moderation
account
```

notification은 mute로 차단하지 않는다.

---

# 56. Existing relationships

Mute 시:

```text
follow 삭제 안 함
friend 삭제 안 함
block 생성 안 함
DM room revoke 안 함
```

이다.

Unmute하면 discovery가 다시 정상화된다.

---

# 57. Block + Mute coexistence

Block이 더 강한 policy다.

하지만 block 시 mute row를 굳이 삭제하지 않는다.

예:

```text
mute
→ later block
→ unblock
```

후에도 mute preference가 유지되는 것이 자연스럽다.

---

# 58. Mute UX

Profile overflow/action에:

```text
Mute
Unmute
```

를 추가한다.

Block과 같은 버튼처럼 보이지 않게 한다.

설명:

```text
Mute
→ posts/notifications을 덜 보게 됨

Block
→ 상호작용/메시지 제한
```

의 차이가 명확해야 한다.

---

# 59. Settings

Privacy/settings에:

```text
Muted users
Blocked users
```

를 별도로 보여주는 것이 좋다.

각각 unmute/unblock 가능.

---

# 60. Reference 7 — GoToSocial

중점은 feature copy보다 정책 모델이다.

GoToSocial의 장점:

```text
strict privacy
strict interaction policy
small operational surface
visibility와 interaction의 분리
```

를 VTH에 맞춰 적용한다.

---

# 61. GoToSocial → VTH 3-layer model

Bug13 후 VTH content policy를 세 층으로 명확히 한다.

```text
Layer 1 — Public visibility
removed / shadow / community status

Layer 2 — Interaction permission
block / lock / ownership / DM policy

Layer 3 — Viewer attention preference
mute / hidden post / saved post
```

이 세 개를 섞지 않는다.

---

# 62. 특히 중요한 점

예:

```text
Mute
≠ Block

Save
≠ Like

Hide post
≠ Remove post

Public read
≠ Interaction permission
```

이다.

이 구분을 architecture와 tests에서 명시한다.

---

# 63. GoToSocial에서 이번에 가져오지 않을 것

```text
ActivityPub
federation
followers-only posts
direct posts as content visibility mode
domain block lists
Mastodon API
per-post complex interaction policy
```

현재 VTH 목표에는 과하다.

---

# 64. Bug13 actual adoption set

Audit 결과 특별한 반대 증거가 없다면 우선 구현 후보:

```text
A. Post Save / Bookmark
B. Unified Admin Review Queue
C. Popular Time Windows
D. Q&A State Filters
E. User Mute
F. 3-layer content-policy separation
G. RED-style cost/simplicity regression audit
```

이다.

---

# 65. 반드시 7개 모두 코드 변경할 필요 없음

최종 classification 예:

```text
RED
→ KEEP / VTH already stronger

Clonagram
→ ADAPT save relation

Discourse
→ ADAPT review queue read model

Lemmy
→ ADAPT Popular time windows

Apache Answer
→ ADAPT Q&A filters

Bluesky
→ ADAPT user mute

GoToSocial
→ ADAPT policy separation / simplicity
```

처럼 될 수 있다.

---

# 66. Migration strategy

Bug12 latest:

```text
0043
```

이다.

Bug13에서 DB change가 필요하다면 forward migration을 사용한다.

권장 최소 migration:

```text
0044_personal_content_controls.sql
```

에서:

```text
post_saves
user_mutes
```

를 함께 추가하는 것을 검토한다.

단 실제 최신 migration 번호를 먼저 확인한다.

---

# 67. Migration 0044 권장 constraint

`post_saves`:

```text
user_id NOT NULL
post_id NOT NULL
created_at
UNIQUE(user_id, post_id)
FK user
FK post
```

`user_mutes`:

```text
muter_id NOT NULL
muted_id NOT NULL
created_at
UNIQUE(muter_id, muted_id)
CHECK(muter_id <> muted_id)
FK user
FK user
```

D1/SQLite constraint compatibility를 실제 검증한다.

---

# 68. New indexes

최소 필요한 ownership/listing indexes만 만든다.

예:

```text
post_saves(user_id, created_at DESC)
user_mutes(muter_id, created_at DESC)
```

Unique index가 이미 prefix를 충분히 커버하는지 확인한다.

중복 index를 만들지 않는다.

---

# 69. Bug14 boundary

Bug13에서 다음을 건드리지 않는다.

```text
votes physical removal
posts.score removal
posts.hot_score removal
comments legacy score/vote columns removal
migration squash
baseline rewrite
```

그건 Bug14다.

---

# 70. Feed mute implementation

Public visibility helper에 mute를 섞어 넣지 않는다.

현재:

```text
content-visibility.ts
```

는 canonical public visibility를 유지한다.

Viewer-specific mute는 별도 작은 query predicate/helper로 처리한다.

---

# 71. 권장 형태

예:

```text
public visibility
+
viewer discovery exclusions
```

두 단계.

`content-visibility.ts`를 거대한 policy engine으로 확장하지 않는다.

---

# 72. Feed query performance

Mute 도입 때문에:

```text
post마다 mute query
```

하는 N+1 금지.

가능하면 main feed SQL에서:

```sql
NOT EXISTS (
  SELECT 1
  FROM user_mutes ...
)
```

같은 viewer-scoped predicate로 처리한다.

---

# 73. Saved Post projection

Saved page 때문에 별도 Post DTO를 만들지 않는다.

Bug11 canonical:

```text
mapPostProjection()
```

을 재사용한다.

---

# 74. Review Queue projection

Review queue용 DTO는 admin moderation 전용으로 작게 유지한다.

Post/feed projection과 합치지 않는다.

---

# 75. API / payload validation

Bug11의 strict payload rule을 그대로 적용한다.

새 mutation에서:

```text
null
array
primitive
{}
wrong type
unknown enum
```

은 400.

---

# 76. Authorization

Save:

```text
authenticated user
publicly valid post
```

Mute:

```text
authenticated user
target user exists
not self
```

Admin review:

```text
admin/moderator contract
```

Q&A filters/Popular window:

```text
read-only normalized enum
```

---

# 77. Rate limits

Save/mute는 high-risk write가 아니더라도 기존 mutation rate-limit policy를 확인한다.

새 별도 rate-limit subsystem을 만들지 않는다.

---

# 78. Notifications

Save는 notification 0.

Mute는 notification suppression preference.

Review action은 필요한 경우 existing admin/moderation audit only.

Popular/Q&A filter는 notification과 무관.

---

# 79. Counters

다음 신규 counter는 만들지 않는다.

```text
post.save_count
user.mute_count
```

필요 없음.

Relation만 canonical.

---

# 80. Tests — Saved Posts

최소:

```text
1 save post
2 duplicate save idempotent
3 unsave
4 duplicate unsave
5 saved list only owner
6 removed post excluded
7 shadow post excluded
8 save does not change like_count
9 save does not create notification
10 mute/block do not delete save relation
```

---

# 81. Tests — Mute

최소:

```text
11 mute user
12 duplicate mute idempotent
13 self mute rejected
14 muted author hidden Home
15 hidden Popular
16 hidden Recommended
17 hidden Community
18 hidden Search
19 direct profile readable
20 direct post readable
21 direct like still allowed
22 direct comment still allowed
23 DM policy unchanged
24 muted actor comment notification suppressed
25 muted actor reply notification suppressed
26 muted actor mention suppressed
27 admin/security notification unaffected
28 unmute restores discovery
29 block/unblock preserves mute preference
```

---

# 82. Tests — Popular Windows

최소:

```text
30 day excludes older
31 week excludes older
32 month excludes older
33 all includes old
34 ranking formula unchanged
35 tie created_at
36 tie id
37 window cursor page1/page2 no duplicate
38 cursor tamper rejected
39 cursor wrong window rejected
40 frozen windowStart prevents moving pagination boundary
41 removed excluded
42 shadow excluded
43 muted author excluded
```

---

# 83. Tests — Q&A Filters

최소:

```text
44 newest
45 unanswered only answer_count=0
46 answered only answer_count>0
47 solved only accepted_answer_id non-null
48 removed/shadow excluded
49 invalid web filter normalized
50 invalid API filter 400 if API supports it
51 block write semantics unchanged
52 Alice/Bob ask-answer-accept E2E still passes
```

---

# 84. Tests — Review Queue

최소:

```text
53 listing report appears
54 content report appears
55 business report appears if supported
56 chat report appears
57 pending filter
58 source filter
59 dismiss
60 action
61 repeated action idempotent
62 already removed target safe
63 non-admin denied
64 sensitive fields absent
65 chat context bounded
66 moderation audit preserved
```

---

# 85. Cross-feature tests

```text
67 Bob muted by Alice + public post direct read
68 Bob blocked by Alice + positive interaction denied
69 Alice unblocks Bob while mute remains
70 saved Bob post remains in saved relation
71 saved page still obeys public removal
```

이 테스트로:

```text
mute
block
save
visibility
```

의 semantic separation을 증명한다.

---

# 86. E2E — Saved

Chromium:

```text
Alice login
→ post
→ Save
→ /saved
→ post visible
→ reload
→ still saved
→ Unsave
```

---

# 87. E2E — Mute

Alice/Bob context:

```text
Bob creates public post
Alice sees it
Alice mutes Bob
→ feed no longer shows Bob

Alice direct URL
→ Bob post still readable

Alice unmute
→ feed can show Bob again
```

---

# 88. E2E — Q&A Filters

Existing Alice/Bob Q&A E2E를 확장하거나 별도 짧은 test를 만든다.

```text
unanswered before answer
answered after answer
solved after accept
```

를 URL filter 수준에서 검증한다.

---

# 89. E2E — Popular

Browser에서는 window UI/URL wiring 정도만 검증한다.

Ranking 정확성은 integration test에서 담당한다.

---

# 90. E2E — Admin review

Admin E2E fixture가 이미 안전하게 존재하면 하나 추가한다.

없으면 Bug13 때문에 production-adjacent admin impersonation backdoor를 만들지 않는다.

그 경우 integration으로 충분하다.

---

# 91. Flake rule

Bug12 기준을 유지한다.

```text
arbitrary waitForTimeout
→ 금지
```

기존 bot dwell 외에는 event/state/response를 기다린다.

---

# 92. External source audit report

구현 전 표를 만든다.

```text
Project
Pattern inspected
VTH current equivalent
Impact
Complexity
Risk
Decision
```

최종 보고에도 포함한다.

---

# 93. Complexity gate

Bug13 완료 시:

```text
New runtime dependencies:
0 목표

New infrastructure:
0

Permanent donor adapters:
0

Generic repository/DAO:
0

New background scheduler:
0
```

---

# 94. Abstraction gate

다음 이름의 새 계층을 단지 멋있어 보인다는 이유로 만들지 않는다.

```text
PolicyEngine
ContentRepository
RelationManager
FeedProvider
ModerationFramework
SocialGraphAdapter
```

작은 실제 invariant helper면 충분하다.

---

# 95. Expected small modules

실제 source audit 후 필요하면:

```text
post saves
user mute/discovery exclusion
admin review projection
```

정도의 작은 domain module은 허용한다.

역할이 겹치면 기존 module에 넣는다.

---

# 96. Documentation

완료 후 실제 구현에 맞춰:

```text
docs/ROADMAP.md
docs/ARCHITECTURE.md
docs/VTH_DATABASE.md
docs/VTH_TESTING.md
docs/VTH_CONTENT_FEED.md
```

를 업데이트한다.

---

# 97. PRODUCT.md

Bug13 기능이 기존 product contract 안에 있으므로 크게 다시 쓰지 않는다.

단 mute/save 등 product semantics가 명시되어야 할 정도로 중요한 경우 최소 수정한다.

---

# 98. ROADMAP

Bug12:

```text
DONE
```

Bug13:

```text
CURRENT → DONE
```

로 실제 상태를 반영한다.

Bug14는 다음:

```text
D1 Schema Consolidation & Legacy Retirement
```

로 유지한다.

---

# 99. DB audit

Migration 후:

```text
npm run db:reset:local
npm run db:audit:local
```

필수.

추가로:

```text
new table FK
duplicate rows
orphans
```

도 확인한다.

---

# 100. Remote DB

Production migration 전에 read-only 상태를 확인한다.

적용 후:

```text
migration applied
new tables present
FK clean
counter drift 0
legacy counts unchanged
```

확인.

Bug13 때문에 legacy vote data를 변환하거나 삭제하지 않는다.

---

# 101. Required validation

전부:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
npm run build:worker
npm run db:reset:local
npm run db:audit:local
```

통과.

---

# 102. Critical repeated E2E

새 critical subset:

```text
save
mute
Q&A filters
```

포함.

최소:

```text
repeat-each=3
```

clean pass.

Retry-only 성공은 green으로 보고하지 않는다.

---

# 103. Production smoke

배포 후 최소:

```text
/
?feed=popular
?feed=popular&window=week
/questions
/questions?filter=unanswered
/saved
/login
/marketplace
/messages
```

정상 렌더.

인증 destructive E2E를 production에서 수행하지 않는다.

---

# 104. Do not regress Bug10

다음 DM authority 유지:

```text
D1 canonical
HTTP writes
DO/WebSocket committed-event transport
clientMessageId
selective reconciliation
multi-tab unread
```

Mute 때문에 DO path를 변경하지 않는다.

---

# 105. Do not regress Bug11

유지:

```text
canonical post projection
canonical public visibility
D1 conditional writes
block policy
request-id semantics
Popular deterministic cursor
counter invariants
```

---

# 106. Do not regress Bug12

유지:

```text
lint 0/0
CI hard gate
DB audit
Alice/Bob allowlist
production E2E fail-closed
critical repeat clean
```

---

# 107. Explicit rejects

Bug13에서 하지 않는다.

```text
federation
ActivityPub
AT Protocol
reels
stories
group chat
ML recommendation
Vector DB
React Query migration
Supabase
generic moderation framework
Discourse trust-level system 전체
Lemmy stored hot-rank cron
GoToSocial post visibility 전체
Apache Answer repository/service architecture
```

---

# 108. Final report — External patterns

반드시:

```text
RED:
Inspected:
Decision:
Adopted:
Rejected:

Clonagram:
...

Discourse:
...

Lemmy:
...

Apache Answer:
...

Bluesky:
...

GoToSocial:
...
```

보고.

---

# 109. Final report — Features

```text
Saved Posts:
implemented / rejected / modified

User Mute:
...

Popular Windows:
...

Q&A Filters:
...

Unified Review Queue:
...
```

---

# 110. Final report — Architecture

```text
Canonical public visibility:
Canonical viewer mute:
Canonical save relation:
Canonical Popular ordering:
Canonical Q&A filter state:
Canonical moderation review projection:
```

을 적는다.

---

# 111. Final report — DB

표:

```text
Object
Migration
Purpose
Canonical?
Indexes
FK
Production rows
```

신규:

```text
post_saves
user_mutes
```

포함.

---

# 112. Final report — Complexity

```text
Files added:
Files deleted:

New modules:
Removed duplicate modules:

Runtime dependencies added:
Infrastructure added:
Permanent adapters:

New tables:
Removed tables:

D1 read impact:
D1 write impact:
```

---

# 113. Final report — Test

```text
lint
typecheck
unit
worker
integration
E2E
critical repeat x3
build
build:worker
DB reset
DB audit
remote audit
```

실제 숫자 보고.

---

# 114. Success condition

Bug13 성공은:

```text
사용자는
→ 중요한 post를 저장할 수 있고
→ block 없이 사람을 mute할 수 있고
→ Q&A를 상태별로 찾을 수 있고
→ 현재 기간의 Popular를 볼 수 있고

관리자는
→ 여러 신고를 하나의 review surface에서 처리할 수 있고

개발자는
→ visibility / interaction / attention을 혼동하지 않고
→ 기존 Cloudflare architecture를 유지한다
```

이다.

---

# 115. 가장 중요한 원칙

외부 프로젝트 7개를 사용했더라도 최종 source에서는:

```text
RED 방식
Clonagram 방식
Discourse 방식
Lemmy 방식
...
```

이 보이면 실패다.

최종 결과는:

```text
VTH 방식
```

하나여야 한다.

---

# 116. Bug14 handoff

Bug13 완료 후 DB를 다시 inventory한다.

그 결과를 Bug14에 넘긴다.

Bug14에서 최종 판단:

```text
votes
score
hot_score
legacy reaction columns
legacy compatibility objects
duplicate indexes
```

를 physical retirement한다.

Bug13에서는 신규 기능을 안정적으로 canonical화하는 데 집중한다.

---

# Final objective

```text
Best ideas from mature projects
+
VTH product fit
+
D1 canonical correctness
+
Cloudflare simplicity
-
donor architecture baggage
-
duplicate implementation
-
unnecessary infrastructure
=
stronger VTH
```
