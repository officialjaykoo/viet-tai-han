# bug11.md — Public Content Hardening + Architecture & D1 Convergence

## 0. 작업 정의

번호를 명확히 한다.

```text
Bug10
= DM / Realtime Messaging 고도화

Bug11
= Public Content / Feed 강화
+ RED / VTH / Clonagram architecture convergence
+ D1 schema audit / cleanup
```

Bug11은 단순 버그 수정이 아니다.

현재 VTH가 성장하면서 누적된:

```text
RED 원형
VTH 자체 구현
Clonagram 참고/이식
여러 차례 Bug hardening
legacy DB schema
```

를 한 번 정리하면서 공개 콘텐츠 계층을 강화한다.

---

# 1. 가장 중요한 목표

기능을 더 넣는 것보다 중요한 목표가 있다.

> **같은 문제를 해결하는 구현이 VTH 안에 두 개 이상 남지 않게 한다.**

예:

```text
RED 방식 feed
VTH 방식 feed
Clonagram 방식 feed
```

가 동시에 살아 있는 상태를 만들지 않는다.

어느 구현이 더 낫든 최종적으로:

```text
ONE CANONICAL IMPLEMENTATION
```

만 남긴다.

---

# 2. Clonagram 사용 원칙

Clonagram이 더 낫다면 적극적으로 가져와도 된다.

부분 port든 subsystem 교체든 상관없다.

기준은 출처가 아니다.

기준:

```text
correctness
simplicity
maintainability
performance
testability
```

이다.

---

# 3. 하지만 병존은 금지

가장 위험한 결과:

```text
VTH Feed
→ RED helper
→ Clonagram adapter
→ VTH projection
→ legacy query
```

같은 다층 구조다.

금지한다.

Clonagram 방식을 채택했다면 기존 역할을 하는 RED/VTH 경로를 제거한다.

VTH 방식을 유지하기로 했다면 Clonagram compatibility layer를 만들지 않는다.

---

# 4. Architecture Convergence Rule

모든 주요 변경은 다음 질문에 답해야 한다.

```text
Before:
canonical implementation은 무엇인가?

After:
canonical implementation은 무엇인가?

무엇을 제거했는가?

중복 경로가 남았는가?
```

---

# 5. 새 abstraction 추가 규칙

새:

```text
helper
service
adapter
repository
policy
mapper
```

를 만들 때 반드시 기존 abstraction 중 무엇을 대체하는지 확인한다.

원칙:

> 새 abstraction만 계속 추가하고 이전 구현을 그대로 남겨두면 실패다.

---

# 6. 완료 보고 필수 항목

Bug11 완료 보고에 반드시:

```text
New abstraction introduced:
Old abstraction removed:
Duplicate implementation removed:
Temporary adapter remaining:
Canonical implementation after Bug11:
```

를 기록한다.

`New`는 많은데 `Removed`가 거의 없다면 다시 검토한다.

---

# 7. VTH Architecture Backbone

Bug11 이후에도 기본 구조는 가능하면 다음처럼 단순하게 유지한다.

```text
HTTP Route
    ↓
small domain function
    ↓
D1 query / conditional mutation
```

Realtime이 필요한 영역만:

```text
D1 canonical
+
DO/WebSocket projection
```

이다.

Public content 때문에:

```text
service
→ repository
→ adapter
→ provider
→ manager
→ DAL
```

같은 계층을 만들지 않는다.

---

# 8. 현재 infrastructure는 기본 유지

현재 기준:

```text
Cloudflare Workers / OpenNext
D1
R2
Durable Objects
Better Auth
```

를 유지한다.

Clonagram의:

```text
Supabase
RLS
Supabase Auth
Supabase Realtime
```

를 단지 Clonagram과 맞추기 위해 도입하지 않는다.

단 정말 명확한 전체적 이익이 있다면 별도 architectural decision으로 보고한다.

Bug11 안에서 몰래 infrastructure migration하지 마라.

---

# 9. Identity canonical

유지:

```text
user.id
= immutable canonical identity

username
= mutable public handle
```

RED/Clonagram의 다른 identity assumption을 다시 끌어들이지 않는다.

---

# 10. Public Content 범위

Bug11 주요 domain:

```text
Feed
Post
Like
Comment
Reply
Q&A
Search
Recommended
Notification
Post analytics/out
Public visibility
```

Marketplace는 관련 integrity만 targeted audit한다.

---

# 11. Comparative Source Audit부터 시작

Bug10 완료 후 최신 `main` 기준으로 다시 읽는다.

VTH:

```text
src/lib/db.ts
src/lib/content.ts
src/lib/actions.ts
src/lib/likes.ts
src/lib/qna.ts
src/lib/search.ts
src/lib/marketplace.ts
src/lib/notifications.ts
src/lib/post-analytics.ts
src/lib/user-actions.ts

src/lib/security/feed-cursor.ts

src/app/api/posts/**
src/app/api/comments/**
src/app/api/questions/**

src/components/feed/**
```

Clonagram:

```text
src/actions/post/getHomeFeedPosts.ts
src/actions/post/getExplorePosts.ts
src/actions/post/getPost.ts
src/actions/post/createPost.ts
src/actions/post/togglePostLike.ts
src/actions/post/togglePostRelation.ts

src/actions/comments/createComment.ts
src/actions/comments/toggleCommentLike.ts

src/queries/posts.ts
src/utils/posts.ts
src/lib/validation.ts
```

---

# 12. 비교 판정

각 subsystem을:

```text
KEEP-VTH
ADAPT-CLONAGRAM
REPLACE-WITH-CLONAGRAM-DESIGN
MERGE-THEN-COLLAPSE
REJECT-CLONAGRAM
REMOVE-LEGACY
```

중 하나로 분류한다.

중요:

`MERGE-THEN-COLLAPSE`는 임시 migration 전략이다.

최종 상태에서 두 구현을 남기지 않는다.

---

# 13. Clonagram에서 우선 검토할 좋은 구조

## Post Projection

Clonagram의:

```text
queries/posts.ts
POST_WITH_MEDIA_SELECT
```

처럼 feed/detail에서 post projection을 공통으로 관리하는 구조는 적극 검토한다.

현재 VTH에서:

```text
db.ts
content.ts
search.ts
```

등에 projection이 흩어져 있다면 줄인다.

---

# 14. Canonical Post Projection

Bug11 후 최소:

```text
Feed
Community
Popular
Recommended
Post Detail
```

은 가능한 한 하나의 canonical post projection / mapper를 사용한다.

예:

```text
post-projection.ts
```

정도는 허용한다.

단 giant universal DTO를 만들지는 않는다.

---

# 15. Clonagram 작은 helper 패턴

Clonagram의:

```text
utils/posts.ts
```

처럼:

```text
viewer engagement projection
cursor extraction
visible count
```

을 작은 helper로 나누는 방식은 활용 가능하다.

그러나 helper 중복을 늘리는 방향은 금지.

---

# 16. Action responsibility

Clonagram은:

```text
actions/post/*
actions/comments/*
```

로 책임이 작게 나뉜다.

현재 VTH `actions.ts`가 너무 많은 domain을 담당하고 있다면 Bug11 correctness 수정 후 분리한다.

예:

```text
posts.ts
comments.ts
communities.ts
```

정도.

하지만 파일 수 자체가 목표가 아니다.

---

# 17. Clonagram mutation을 무조건 복사하지 마라

Clonagram의:

```text
INSERT
DELETE
```

중심 like/comment mutation보다 VTH의:

```text
D1 conditional write
idempotency
counter reconciliation
moderation predicate
```

가 더 강하다면 VTH 구현을 유지한다.

즉:

```text
Clonagram structure
+
VTH backend invariant
```

조합을 허용한다.

---

# 18. PUBLIC FEED — 현재 Popular 수정

현재 `popular`이 실제 engagement ranking이 아니라 최신순이면 수정한다.

최종 역할:

```text
Home
= subscription/community 중심 최신

Popular
= 전체 공개 콘텐츠 실제 인기

Recommended
= user activity/follow 기반 개인화
```

---

# 19. Popular canonical signals

우선 단순하게:

```text
like_count
comment_count
created_at
```

을 사용한다.

예:

```text
engagement =
like_count
+ comment_count * COMMENT_WEIGHT
```

정도의 설명 가능한 ranking을 우선한다.

---

# 20. Ranking 과설계 금지

이번 단계에서:

```text
ML recommender
vector DB
embedding
대규모 post_views aggregation
복잡한 anti-brigade model
```

은 하지 않는다.

---

# 21. Legacy score/hot_score

현재 DB에는 과거 ranking 흔적이 있다.

```text
votes
score
hot_score
```

그리고 현재 canonical interaction:

```text
post_likes
comment_likes
like_count
```

가 공존한다.

Bug11 DB audit의 핵심 대상이다.

기존 `hot_score`를 그냥 다시 쓰지 마라.

---

# 22. Popular cursor

Popular ordering이:

```text
rank
createdAt
id
```

라면 cursor도 같은 ordering position을 표현해야 한다.

현재 signed cursor 보안:

```text
HMAC
TTL
viewer context
mode context
```

은 유지한다.

---

# 23. Block Interaction Policy

Bug7 invariant:

```text
blocked user의 public content read
= 가능

blocked relationship의 new positive interaction
= 불가
```

이를 server write 전체에 적용한다.

---

# 24. Like

새 like:

```text
actor ↔ content author bilateral block 없음
```

이어야 한다.

최종 D1 INSERT 자체에서 검사한다.

---

# 25. Unlike

Block 이후에도 existing like 제거는 허용한다.

```text
positive relation 생성
→ guard

positive relation 제거
→ 허용
```

---

# 26. Comment

새 comment:

```text
actor ↔ post author
```

blocked면 불가.

현재 strong conditional INSERT 구조는 유지한다.

---

# 27. Reply

새 reply는:

```text
actor ↔ post author
actor ↔ parent author
```

둘 다 허용 상태여야 한다.

---

# 28. Q&A

Answer 역시 public positive interaction으로 동일 policy에 편입한다.

```text
actor ↔ question author blocked
→ answer 불가
```

---

# 29. Answer race

Final INSERT 자체에서:

```text
question exists
not removed
not shadow
not locked
not blocked
```

를 검사한다.

Stale pre-check만 믿지 않는다.

---

# 30. Accepted Answer

새 accept:

```text
question owner ↔ answer author
```

blocked면 금지.

기존 accept 해제는 cleanup이므로 허용.

---

# 31. Notification race

다음 notification:

```text
comment_on_post
reply_to_comment
mention
```

도 bilateral block guard 적용.

---

# 32. Happens-before rule

명확한 invariant:

```text
block D1 commit 이전에 완료된 interaction
→ historical state 유지 가능

block D1 commit 이후
→ new positive interaction 불가
→ new actor notification 불가
→ new actor push 불가
```

---

# 33. Public Visibility

Canonical public visibility를 정한다.

최소:

```text
post.is_removed = 0
post.is_shadow_hidden = 0
community active
```

---

# 34. 모든 public surface 확인

최소:

```text
Home
Popular
Community
Recommended
Post Detail
Search
Profile Posts
/out redirect
Post analytics view
```

가 동일 moderation visibility를 사용해야 한다.

---

# 35. Block과 visibility 구분

Block 때문에 direct public post가 자동 404가 되어서는 안 된다.

```text
Block
= interaction policy

Moderation
= public visibility policy
```

둘을 섞지 않는다.

---

# 36. Runtime Payload Validation

Clonagram의 중앙 validation 접근은 채택할 가치가 있다.

하지만 VTH에 Zod를 꼭 추가하지 않는다.

기존 VTH parser pattern으로:

```text
parseLikePayload
parseAcceptAnswerPayload
...
```

처럼 정리한다.

---

# 37. Malformed JSON

Relevant API에서:

```text
null
[]
string
number
{}
wrong types
```

→ 400.

500 TypeError 금지.

---

# 38. Idempotency

현재 strongest canonical semantics를 기준으로 통일한다.

```text
same requestId
+ same payload
→ same canonical result

same requestId
+ conflicting payload
→ 409
```

최소:

```text
Post
Comment
Question
Answer
Listing
```

audit.

---

# 39. DB CLEANUP — Bug11 중요 축

Bug11은 기능 코드만 정리하지 않는다.

D1도 한 번 canonical schema audit를 수행한다.

하지만:

> **DB cleanup ≠ 모든 migration 다시 작성**

이다.

---

# 40. 왜 DB audit이 필요한가

VTH schema에는 여러 개발 단계의 흔적이 누적되어 있다.

예:

```text
legacy votes
score
hot_score

new post_likes
comment_likes
like_count

write idempotency additions
messaging integrity additions
friendship
presence
media ownership
...
```

이 자체가 문제는 아니다.

문제는:

> 현재 무엇이 canonical이고 무엇이 legacy인지 source를 읽지 않고는 명확하지 않은 상태

다.

이를 Bug11에서 정리한다.

---

# 41. 모든 DB object inventory

최신 migration 전체를 기준으로 inventory를 만든다.

분류 대상:

```text
tables
columns
indexes
unique constraints
foreign keys
CHECK constraints
```

---

# 42. DB Object Classification

각 object를 반드시 다음 중 하나로 분류한다.

```text
[CANONICAL]
현재 production source가 사용

[LEGACY-BUT-USED]
과거 구조지만 아직 source가 참조

[LEGACY-DEAD]
runtime source 참조 없음

[MIGRATION-COMPAT]
migration/history 이유로 당장 유지

[UNKNOWN]
사용 여부 확인 필요
```

---

# 43. 사용 여부는 검색으로 확인

이름만 보고 dead라고 판단하지 마라.

예:

```text
votes
score
hot_score
upvotes
downvotes
```

각각 repository 전체 source/test/script에서 usage를 검색한다.

---

# 44. DB cleanup 단계

## Phase 1 — Audit

아무것도 삭제하지 않는다.

전체 schema map 생성.

## Phase 2 — Canonical 선언

현재 실제 사용되는 table/column/index를 명확히 한다.

## Phase 3 — Source migration

legacy-but-used인데 새 canonical 구조로 옮겨야 하는 사용처를 먼저 수정한다.

## Phase 4 — Dead cleanup

사용처가 0이고 migration safety가 확인된 것만 제거.

---

# 45. Drop은 보수적으로

SQLite/D1에서 column/table drop migration은 위험과 비용이 있다.

따라서:

```text
LEGACY-DEAD
```

라고 해서 무조건 바로 DROP하지 않는다.

다음 조건 모두 확인:

```text
runtime usage 0
test usage 0
scripts usage 0
admin usage 0
migration dependency 없음
data preservation 불필요
```

---

# 46. Legacy column cleanup 기준

예:

```text
votes
score
hot_score
```

가 현재 완전히 dead라면:

### Option A

안전한 migration으로 제거.

### Option B

제거 위험 대비 이익이 낮으면 유지하되:

```text
LEGACY — DO NOT USE
```

로 문서화하고 application source 참조 0을 보장.

중요한 건 physical DROP보다 **logical canonicality**다.

---

# 47. DB naming consistency

현재 schema에서 같은 개념이 서로 다른 naming convention을 쓰는지 audit.

예:

```text
snake_case
camelCase
legacy Better Auth columns
```

단 naming을 예쁘게 만들겠다고 대규모 rename하지 마라.

Runtime complexity를 줄이는 변경만 한다.

---

# 48. Counter columns audit

최소:

```text
like_count
comment_count
answer_count
subscriber_count
unread_count 관련 projection
```

을 audit.

확인:

```text
canonical relation table은 무엇인가
counter update 방식
repair/reconciliation 가능 여부
race safety
```

---

# 49. Counter invariant

예:

```text
posts.like_count
= COUNT(post_likes)

comments.like_count
= COUNT(comment_likes)
```

같이 명확한 invariant가 있어야 한다.

Counter가 historical source와 current source 둘을 혼용하면 안 된다.

---

# 50. Index audit

전체 index도 확인한다.

분류:

```text
used by current query
legacy
duplicate prefix
unused
missing
```

---

# 51. Index를 무작정 삭제하지 마라

SQLite planner와 production workload를 고려한다.

필요하면:

```text
EXPLAIN QUERY PLAN
```

으로 주요 query를 확인한다.

최소:

```text
Home feed
Popular
Recommended
Post detail
Comment tree
Q&A list
Messages는 Bug10 결과 유지
```

---

# 52. Duplicate index

완전히 동일하거나 한 index가 다른 index prefix를 실질적으로 포함하는 경우 검토한다.

하지만 write overhead보다 query benefit이 명확하지 않은 것만 제거 후보로 한다.

---

# 53. Foreign Key Audit

중요 relation:

```text
posts → user
posts → subreddit

comments → post
comments → parent

likes → content/user

questions/answers

chat

friendship

media registry
```

의 FK / delete behavior를 확인한다.

Bug11 범위에서 무리한 FK redesign은 하지 않는다.

실제 integrity hole만 수정한다.

---

# 54. DB schema source-of-truth 문서

Bug11 완료 후 반드시:

```text
docs/VTH_DATABASE.md
```

또는 동등 문서를 만든다.

포함:

```text
canonical tables
canonical identity
major relations
counter invariants
legacy objects still retained
why retained
future removal candidates
```

---

# 55. Migration history는 삭제하지 마라

기존 migration 파일:

```text
0001...
0002...
...
```

을 squash하거나 rewrite하지 않는다.

Production database migration history이기 때문이다.

새 migration으로 앞으로 정리한다.

---

# 56. Clean install 검증

모든 migration을 처음부터 local DB에 적용해:

```text
empty DB
→ all migrations
→ current schema
```

가 정상이어야 한다.

---

# 57. Existing DB upgrade 검증

가능하다면 current pre-Bug11 schema fixture에서:

```text
Bug11 migrations apply
```

후 data/invariants가 유지되는지도 확인한다.

---

# 58. Seed audit

`seed.sql`이 현재 canonical schema만 사용하는지 확인한다.

Legacy column/table에 의존한다면 수정한다.

---

# 59. Test helper DB audit

테스트가 production에서 이미 안 쓰는 legacy schema를 계속 직접 조작하는지 확인한다.

그렇다면 canonical path로 수정한다.

테스트 때문에 legacy DB object를 영구 유지하지 않는다.

---

# 60. DATABASE 목표 구조

Bug11 후 개발자가 DB를 볼 때 다음 질문에 빠르게 답할 수 있어야 한다.

```text
게시물 좋아요 truth는 어디인가?
→ post_likes

표시 like count는?
→ posts.like_count

사용자 identity FK는?
→ user.id

feed ranking truth는?
→ 현재 정의된 engagement fields/rank

legacy votes는 쓰는가?
→ 문서에서 즉시 확인
```

---

# 61. DB abstraction 과설계 금지

DB가 복잡하다고:

```text
Repository<T>
GenericDAO
UniversalQueryBuilder
EntityManager
```

같은 계층을 만들지 않는다.

D1 SQL 자체는 충분히 직접적이어야 한다.

---

# 62. db.ts 정리

현재 `db.ts`에:

```text
DB bootstrap
feed query
mapping
domain logic
```

가 섞여 있다면 분리 검토.

목표:

```text
db.ts
→ getDb/getEnv 등 infrastructure

feed/*
→ feed domain query/projection
```

정도가 적절하다.

---

# 63. Clonagram + DB 결합 규칙

Clonagram 구조를 가져오면서 새 table/schema를 그대로 복사하지 않는다.

먼저:

> 현재 VTH D1 schema로 같은 구조를 구현할 수 있는가?

를 본다.

가능하면 DB migration 없이 code structure만 가져온다.

---

# 64. Clonagram schema 채택 조건

Clonagram의 특정 schema 구조가 현재 VTH보다 명확히 낫고:

```text
코드 단순화
constraint 강화
query 감소
```

효과가 크다면 채택 가능.

단:

```text
Supabase compatibility
Clonagram compatibility
```

때문에 schema를 바꾸는 것은 금지.

---

# 65. Architecture Debt Audit

DB뿐 아니라 code architecture에서도 inventory를 만든다.

최소:

```text
feed implementation
post mapper
visibility helper
like mutation
comment mutation
Q&A mutation
notification guard
payload validation
```

각각 canonical 위치를 적는다.

---

# 66. Duplicate Path 제거

예:

```text
mapFeedRow in db.ts
mapFeedRow in content.ts
```

같이 동일한 역할이 중복이면 하나로 수렴시킨다.

Compatibility wrapper가 필요하면 한 단계만 허용하고 제거 계획을 명시한다.

---

# 67. Temporary Adapter 규칙

이행 중 adapter 허용.

하지만 반드시:

```text
TEMPORARY
reason
remove condition
```

을 주석/보고서에 명시한다.

영구 adapter chain 금지.

---

# 68. Recommended

현재 simple personalization은 유지할 수 있다.

Clonagram Explore 구조에서 좋은:

```text
candidate selection
projection
variant orchestration
```

만 가져온다.

---

# 69. Search

Search는 lightweight DTO 유지 가능.

Full Feed DTO를 강제하지 않는다.

다만 visibility predicate는 canonical policy에 맞춘다.

---

# 70. Marketplace

Marketplace 전체를 공개-content 구조로 강제 통합하지 않는다.

다만:

```text
visibility
requestId
block interaction
DB legacy usage
```

관련 부분은 audit한다.

---

# 71. 테스트 — Architecture regression

Bug11의 중요한 테스트는 기능 테스트뿐 아니다.

완료 시 source-level audit로:

```text
old feed path remaining?
duplicate mapper remaining?
legacy score runtime usage?
Clonagram temporary adapter remaining?
```

를 확인한다.

---

# 72. Popular tests

최소:

```text
higher engagement > lower engagement
same engagement → newer
deterministic id tie-break

removed excluded
shadow excluded
hidden excluded
blocked author excluded from discovery

pagination no static duplicate
cursor tamper rejected
wrong mode cursor rejected

Home unchanged
Community unchanged
```

---

# 73. Interaction tests

```text
blocked post like denied
unlike allowed

blocked comment like denied
comment unlike allowed

blocked post comment denied
blocked parent reply denied

blocked question answer denied
blocked answer new accept denied
accept cleanup allowed

report still allowed
```

---

# 74. Visibility tests

```text
shadow feed invisible
shadow detail invisible
shadow /out invisible

removed invisible

normal public content visible

blocked peer direct read
= existing Bug7 policy 유지
```

---

# 75. Notification tests

```text
normal comment notification
normal reply notification
normal mention

comment commit
→ block
→ delayed notification
= no delivery

push도 없음
```

---

# 76. API validation tests

Relevant mutation endpoints:

```text
null
array
string
number
{}
wrong type
invalid action
```

→ 400.

---

# 77. DB tests

최소:

```text
clean migration from empty DB

canonical like counters

comment counters

Q&A answer counters

FK integrity

requestId unique constraints

Popular query plan

legacy object runtime usage audit
```

---

# 78. Bug11 migration 안전성

Bug10이 먼저 migration을 추가할 수 있다.

따라서 Bug11 migration 번호를 문서에서 고정하지 않는다.

시작할 때 최신 번호 확인.

---

# 79. 작업 순서

## Phase A — Full Audit

```text
VTH source
Clonagram source
D1 migrations
tests
scripts
seed
```

읽는다.

---

## Phase B — Architecture Map

작성:

```text
Domain
Current canonical
Duplicate implementation
Legacy path
Clonagram candidate
Decision
```

---

## Phase C — DB Map

작성:

```text
Object
Type
Current usage
Canonical?
Legacy?
Removal candidate?
```

---

## Phase D — Structural Convergence

먼저:

```text
canonical post projection
feed responsibility
validation
content visibility policy
```

를 하나로 수렴시킨다.

기능 의미는 가능한 유지.

---

## Phase E — P0 Correctness

```text
Block interaction
Q&A conditional write
Notification block race
Shadow detail/out
Malformed payload
```

수정.

---

## Phase F — Popular

```text
real engagement ranking
cursor
performance
index
```

구현.

---

## Phase G — DB Cleanup

```text
dead runtime references 제거
legacy source usage 제거
safe schema/index cleanup
canonical constraints 확인
seed/test 정리
```

---

## Phase H — Dead Code Cleanup

최종적으로:

```text
old mapper
old helper
old query path
temporary compatibility
unused imports/types
```

제거.

---

# 80. 절대 하지 말 것

```text
새 구조만 추가하고 old path 유지

RED + VTH + Clonagram implementation 동시 유지

adapter chain 누적

Supabase migration

DB schema 전면 재작성

기존 migrations rewrite/squash

확인 없이 legacy column DROP

generic repository framework 도입

DM Bug10 결과 회귀

Bug9 UI redesign
```

---

# 81. Validation

반드시:

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
npm run build:worker
```

그리고:

```powershell
npm run db:reset:local
```

또는 현재 프로젝트의 clean local migration 경로로 empty DB migration 검증.

---

# 82. 완료 보고 — Architecture

반드시:

```text
Canonical Feed Implementation:
Canonical Post Projection:
Canonical Like Mutation:
Canonical Comment Mutation:
Canonical Q&A Mutation:
Canonical Visibility Policy:
Canonical Validation Path:
```

---

# 83. 완료 보고 — Removed

```text
Removed RED legacy:
Removed VTH duplicate:
Removed Clonagram temporary adapter:
Removed duplicated mapper/helper:
```

없으면 `none`이라고 명시.

---

# 84. 완료 보고 — DB

반드시 표로:

```text
Object
Before status
After status
Action
Reason
```

분류:

```text
CANONICAL
LEGACY-BUT-RETAINED
REMOVED
MIGRATED
```

---

# 85. 완료 보고 — DB canonicality

명확히 답한다.

```text
Post Like truth:
Comment Like truth:
Post Comment Count truth:
Q&A Answer Count truth:
Feed ranking truth:
Identity truth:
```

---

# 86. 완료 보고 — Clonagram

각 후보:

```text
Clonagram file
Decision
What was adopted
What was rejected
Why
```

---

# 87. Complexity 결과

마지막에 반드시:

```text
Files added:
Files deleted:
Lines/paths duplicated before:
Duplicates removed:

New abstractions:
Old abstractions removed:

Permanent adapters introduced:
```

를 보고한다.

가능하면:

```text
Permanent adapters introduced = 0
```

을 목표로 한다.

---

# 88. 성공 조건

Bug11 성공은 단순히 테스트가 통과하는 것이 아니다.

완료 후 VTH가:

```text
기능 더 많음
+
버그 더 적음
+
DB canonicality 더 명확함
+
구현 경로 더 적음
+
유지보수 구조 더 단순함
```

이어야 한다.

---

# 89. 최종 원칙

이번 작업의 핵심은 이것이다.

> **Clonagram에서 더 좋은 것은 가져온다. RED에서 아직 좋은 것은 유지할 수 있다. VTH 자체 구현이 가장 좋으면 그것을 쓴다. 그러나 최종적으로 같은 역할을 하는 구현은 하나만 남긴다.**

그리고 DB도 동일하다.

> **과거 schema를 무작정 지우는 것이 아니라, 현재 canonical truth를 하나로 만들고 dead legacy만 안전하게 제거한다.**

최종 목표:

```text
좋은 구현 선택
        ↓
VTH에 흡수
        ↓
중복 제거
        ↓
canonical path 하나
        ↓
canonical DB 하나
```

**Bug11은 기능 강화와 동시에 VTH 내부 구조를 다시 단순하게 만드는 작업이어야 한다.**
# Bug10 완료 이후 Bug11 추가 지시사항

## Bug10 완료 상태를 baseline으로 고정

Bug11은 다음 Bug10 완료 커밋 이후 최신 `main`에서 시작한다.

```text
Bug10 commit:
b6209c1 fix: harden DM convergence and transport recovery
```

Bug10에서 확정된 다음 구조를 **canonical messaging implementation**으로 취급한다.

```text
D1 canonical message state
DO / WebSocket realtime delivery
selective canonical reconciliation
bounded live dedupe cache
transport uncertainty recovery
clientMessageId idempotency
reconnect + catch-up
multi-tab unread synchronization
```

Bug11에서는 이 구조를 다시 리팩터링하거나 Clonagram messaging 구조와 통합하지 않는다.

---

# Bug10 regression boundary

Bug11의 architecture / DB cleanup 과정에서 다음 파일과 계약을 함부로 변경하지 않는다.

```text
src/components/messages/messages-client.tsx
src/components/notifications/use-unread-count.ts
src/lib/chat-room-state.ts
src/lib/chat-send-recovery.ts
src/workers/ChatRoom.ts
```

공통 helper 또는 DB schema 정리 과정에서 이 파일들의 import/API가 영향을 받는다면 기존 Bug10 tests를 반드시 다시 실행한다.

특히 다음 invariant는 유지한다.

```text
normal realtime
→ 추가 DB read 없음

uncertainty
→ selective canonical reconciliation

same clientMessageId
→ 최대 하나의 canonical message

canonical sent
→ failed로 회귀하지 않음

room switch
→ previous catch-up response가 current room 오염하지 않음

multi-tab unread
→ BroadcastChannel 우선
→ storage fallback
→ canonical refresh로 최종 수렴
```

---

# Architecture Convergence Audit에 Bug10 신규 abstraction도 포함

Bug11에서 전체 architecture inventory를 만들 때 Bug10에서 추가된 abstraction도 포함한다.

최소:

```text
chat-send-recovery.ts
chat-room-state.ts
unread event transport
canonical reconciliation scheduler
```

단 목적은 삭제가 아니다.

각 abstraction에 대해 다음을 판정한다.

```text
CANONICAL
DUPLICATED
TEMPORARY
LEGACY
```

Bug10에서 새로 생겼다는 이유만으로 다시 합치거나 제거하지 마라.

다음 기준을 적용한다.

> 역할이 명확하고 기존 구현을 실제로 대체했다면 유지한다.

> 같은 역할의 옛 helper/path가 아직 남아 있다면 옛 경로를 제거한다.

즉 Bug11의 convergence는 **새 코드 제거가 아니라 중복 제거**다.

---

# docs/ARCHITECTURE.md를 Bug11 audit 입력으로 사용

Bug10에서 `docs/ARCHITECTURE.md`가 업데이트됐다.

Bug11은 source만 보고 architecture를 다시 추측하지 말고:

```text
docs/ARCHITECTURE.md
현재 source
현재 migrations
tests
```

네 가지를 비교한다.

불일치가 있으면:

```text
문서가 오래됨
또는
source가 architecture contract를 위반함
```

중 어느 쪽인지 판단하고 하나로 수렴시킨다.

Bug11 완료 후:

```text
docs/ARCHITECTURE.md
docs/VTH_DATABASE.md
docs/VTH_CONTENT_FEED.md
```

가 서로 모순되지 않아야 한다.

---

# Bug10에서 확인된 “Selective Reconciliation” 원칙을 일반화할 때 주의

Bug10에서 다음 패턴은 성공적으로 사용됐다.

```text
빠른 local projection
+
불확실할 때 canonical state 확인
```

그러나 Bug11의 Feed/Post/Like/Comment에 이 패턴을 기계적으로 복사하지 마라.

Public Content는 대부분:

```text
HTTP mutation
→ D1 canonical response
```

구조이므로 DM처럼 별도 reconciliation scheduler가 필요하지 않을 수 있다.

따라서:

> 좋은 패턴이라고 해서 domain이 다른 곳에 abstraction을 재사용하지 않는다.

Bug11에서는 domain별로 가장 단순한 구조를 선택한다.

---

# DB cleanup에서 Messaging schema는 Bug10 검증 결과를 우선

Bug10은 DB migration 없이 완료됐다.

따라서 messaging schema는 현재 production invariant를 만족하는 상태로 본다.

Bug11 DB audit에서 messaging table/index도 inventory에는 포함하지만:

```text
chat_messages
chat_rooms
chat_room_members
chat_requests
message delivery/read 관련 columns/indexes
```

는 **명확한 dead legacy 증거가 없는 한 구조 변경하지 않는다.**

Bug11 DB cleanup의 우선순위는 오히려:

```text
posts
comments
votes
post_likes
comment_likes
score
hot_score
questions
answers
feed indexes
content analytics
```

같은 Public Content 계층이다.

---

# Bug11 DB cleanup 우선순위

이번 감사에서 특히 다음 historical transition을 명확히 추적한다.

```text
legacy votes / upvotes / downvotes / score
        ↓
weighted score / hot_score
        ↓
simple likes
post_likes / comment_likes / like_count
```

각 단계가 현재 source에서 실제로 사용되는지 repository 전체를 검색한다.

최종적으로 반드시 다음을 명확하게 만든다.

```text
Canonical Post Like Truth:
Canonical Comment Like Truth:
Canonical Display Counter:
Canonical Popular Ranking Signal:
Legacy Vote Data Status:
Legacy Score Status:
Legacy hot_score Status:
```

이 부분이 Bug11 DB audit의 최우선 대상이다.

---

# Counter drift audit 추가

DB cleanup 시 단순 column/table 사용 여부뿐 아니라 **derived counter의 canonicality**도 검사한다.

최소:

```text
posts.like_count
comments.like_count
posts.comment_count
questions.answer_count
subreddits.subscriber_count
```

각 counter에 대해:

```text
source relation/table
increment/decrement path
repair path
race safety
```

를 확인한다.

가능하면 테스트에서:

```text
stored counter
=
canonical relation COUNT(*)
```

를 검증한다.

Counter가 틀려도 영구적으로 복구할 방법이 없는 구조라면 repair helper 또는 audit script를 고려한다.

단 background reconciliation system까지 만들지는 않는다.

---

# Full lint baseline도 기술부채로 기록

Bug10 validation 결과:

```text
npm run lint
→ 기존 baseline 20 errors / 16 warnings
```

이 존재한다.

Bug11의 주 목표는 lint cleanup이 아니므로 이것 때문에 작업 범위를 크게 늘리지 않는다.

하지만 architecture cleanup 중 수정하는 파일에 기존 lint 문제가 있다면 함께 제거한다.

Bug11 완료 시 다시:

```text
전체 lint error/warning before
전체 lint error/warning after
Bug11 changed files lint
```

을 보고한다.

원칙:

> Bug11 때문에 lint debt가 증가해서는 안 된다.

가능하면 자연스럽게 줄어들어야 한다.

---

# Bug11 최종 Complexity Gate 추가

Bug11 완료 후 단순 테스트 PASS 외에 다음 조건을 확인한다.

```text
Canonical implementation count 감소 또는 유지

Duplicate implementation count 감소

Permanent adapter count 증가하지 않음

Legacy runtime dependency 감소

DB canonical object 명확성 증가

Public-content query path 단순화
```

그리고 반드시 숫자 또는 구체적인 파일명으로 보고한다.

예:

```text
Duplicate feed mappers:
Before 3
After 1

Legacy runtime score references:
Before 4
After 0

Permanent compatibility adapters:
Before 1
After 0

Feed canonical entry points:
Home      → ...
Popular   → ...
Recommended → ...
```

Bug11은 **기능이 늘었는데 구조도 더 복잡해지는 결과를 성공으로 판정하지 않는다.**

---

# Bug10에서 Bug11로 넘기는 핵심 원칙

Bug10의 결과가 보여준 좋은 방향은 유지한다.

```text
확실한 bug는 수정
이미 안전한 것은 다시 만들지 않음
필요한 부분만 hardening
불확실 상태만 canonical 확인
기존 architecture를 이유 없이 교체하지 않음
```

Bug11도 동일하게 적용한다.

단 Bug11에서는 한 가지를 추가한다.

```text
새로운 좋은 구현을 채택했다면
↓
기존 중복 구현 제거
↓
하나의 canonical path로 수렴
```

이것이 Bug10과 Bug11의 가장 큰 차이다.
