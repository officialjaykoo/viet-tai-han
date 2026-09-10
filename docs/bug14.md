# Bug14 — Legacy & Complexity Retirement, D1 Final Consolidation

## 0. Mission

Bug14의 목표는 새로운 기능을 만드는 것이 아니다.

목표는 현재 VTH에서:

* RED에서 물려받았지만 더 이상 제품 목적에 맞지 않는 subsystem
* 미래를 위해 미리 만들어 두었지만 실제 사용되지 않는 subsystem
* 이미 다른 canonical path로 대체된 legacy DB 구조
* 사용자가 얻는 가치보다 유지보수 비용이 큰 기능
* 반쪽만 구현된 기능
* 동일 사실을 여러 곳에 저장하는 구조
* 불필요한 background/event/write amplification
* stale locale / stale compatibility / stale product semantics

를 제거하거나 축소하여,

```text
기능 수 ↓
테이블 수 ↓
인덱스 수 ↓
runtime side effect ↓
write amplification ↓
legacy semantics ↓
코드 경로 ↓

correctness ↑
maintainability ↑
predictability ↑
testability ↑
operational safety ↑
```

를 달성한다.

Bug14는 VTH의 **최종 대형 architecture cleanup 단계**다.

이후에는 architecture hunting보다 실제 사용자·UX·content·운영 성숙도로 이동한다.

---

# 1. 절대 원칙

Bug14의 기본 질문은:

> 이 기능이 지금 VTH 핵심 사용자 여정에 직접 기여하는가?

이다.

다음 이유만으로 유지하지 않는다.

```text
RED에 있었기 때문
이미 구현했기 때문
나중에 필요할 수도 있기 때문
코드가 잘 만들어졌기 때문
다른 프로젝트에 있는 기능이기 때문
삭제하기 아깝기 때문
```

좋은 코드라도 필요 없는 subsystem이면 제거한다.

---

# 2. Product 기준

반드시 먼저 읽는다.

```text
docs/PRODUCT.md
docs/ROADMAP.md
docs/ARCHITECTURE.md
docs/VTH_DATABASE.md
docs/VTH_TESTING.md
docs/VTH_CONTENT_FEED.md
docs/VTH_REALTIME_DM.md
```

Bug13이 완료된 뒤에는 Bug13이 갱신한 최신 문서를 사용한다.

현재 PRODUCT 핵심은:

```text
Vietnamese-first
Community
Social identity
Q&A
Marketplace
Business discovery
1:1 DM
Safety / moderation
Mobile-first
Simple infrastructure
```

이다.

---

# 3. Bug14 시작 조건

Bug14는 반드시 **Bug13 완료 후 최신 main**에서 시작한다.

현재 Bug12 완료 main은:

```text
a889f6f
```

이지만 Bug14 구현 시점에는 이를 기준으로 사용하지 않는다.

먼저:

```powershell
git status
git pull --ff-only
git log --oneline -10
```

으로 최신 main을 확인한다.

Bug13 final commit과 deployment가 존재하는지 확인한다.

---

# 4. Bug13 regression contract

Bug13에서 실제 구현된 기능을 먼저 inventory한다.

예상 후보:

```text
Post Save
User Mute
Popular Time Windows
Q&A Filters
Unified Review Queue
viewer-attention policy separation
```

그러나 Bug14는 문서의 예상이 아니라 **실제 source와 migration을 기준**으로 한다.

Bug13에서 구현되지 않은 기능을 Bug14에서 대신 구현하지 않는다.

---

# 5. 새로운 기능 금지

Bug14에서는 원칙적으로:

```text
new social feature
new recommendation system
new ranking algorithm
new monetization feature
new moderation framework
new auth provider
new infrastructure
new queue
new Durable Object
new cache layer
new state manager
```

를 만들지 않는다.

필요 없는 것을 제거하면서 대체 subsystem을 하나 더 만들면 실패다.

---

# 6. External donor 금지

Bug14에서는 RED / Clonagram / Discourse / Lemmy / Apache Answer / Bluesky / GoToSocial에서 새 기능을 찾지 않는다.

Bug13이 마지막 donor-absorption 단계다.

Bug14에서 외부 프로젝트를 볼 수 있는 경우는:

> 특정 cleanup 또는 migration safety 문제를 검증하기 위한 참고

뿐이다.

---

# 7. 먼저 전체 inventory를 만든다

수정 전에 repository 전체를 조사한다.

최소:

```text
src/**
tests/**
scripts/**
seed.sql
migrations/**
docs/**
wrangler config
package.json
```

대상별로 기록:

```text
Subsystem
Runtime files
DB tables
DB columns
Indexes
Routes
UI
Background jobs
Mutation hooks
Tests
Production rows
Product dependency
Decision
```

---

# 8. 분류

모든 후보를 다음 중 하나로 분류한다.

```text
CORE-KEEP
SIMPLIFY
REMOVE
RETAIN-DATA
DEFER
```

정의:

### CORE-KEEP

현재 핵심 VTH journey에 직접 필요.

### SIMPLIFY

기능 자체는 필요하지만 구현이 과함.

### REMOVE

현재 제품에 불필요하며 안전하게 제거 가능.

### RETAIN-DATA

runtime에는 불필요하지만 아직 production data 때문에 물리 제거 불가.

### DEFER

근거 부족. 억지 cleanup 금지.

---

# 9. 제거 판단 기준

REMOVE는 다음을 만족해야 한다.

```text
runtime 필요성 없음
product 필요성 없음
production dependency 없음 또는 안전한 migration 가능
FK dependency 해결
test/seed/script dependency 제거 가능
운영 recovery 고려 완료
```

---

# 10. Production row count만으로 판단하지 않는다

```text
0 rows
```

이라고 무조건 DROP하지 않는다.

또:

```text
rows > 0
```

이라고 무조건 유지하지 않는다.

다음을 함께 확인한다.

```text
runtime reads
runtime writes
FKs
indexes
seed
tests
background tasks
API routes
UI
historical data value
migration feasibility
```

---

# 11. Destructive migration 안전 규칙

Production D1에서 destructive migration 전에 반드시:

1. read-only audit
2. target row counts
3. FK dependency
4. source dependency
5. deterministic transformation 가능 여부
6. rollback/recovery 방법
7. clean-install migration test
8. upgrade-path migration test

를 확인한다.

추측으로 DROP 금지.

---

# 12. 기존 migration 불변

절대:

```text
0001~기존 migration 수정
migration squash
migration rename
이미 적용된 migration 삭제
migration history 재작성
```

하지 않는다.

모든 cleanup은 **새 forward migration**으로 한다.

Bug13 이후 실제 next migration 번호를 사용한다.

번호를 문서에서 미리 가정하지 않는다.

---

# 13. Priority S — Achievements subsystem

기본 판단:

```text
REMOVE
```

현재 제거 후보:

```text
achievements
user_achievements
achievement indexes

achievement-levels.ts
achievements.ts
AchievementsShowcase

achievement grant/sync hooks
achievement background/event logic
achievement tests
achievement translation strings
achievement profile UI
achievement seed/catalog
```

---

# 14. 제거 대상 achievement semantics

최소 다음은 제거한다.

```text
First Post
First Comment
Poster levels
Commenter levels
Karma Climber
Community Leader
Follower Magnet
Social Butterfly
Popular Post
Voter
Cake Day
Conversationalist
Link Poster
Media Maven
Busy Bee
Welcome trophy
laefye
karma badges
age badges
legacy karma trophies
```

---

# 15. Admin / Moderator는 achievement가 아니다

다음은 유지할 수 있다.

```text
Admin
Moderator
```

그러나 canonical truth는:

```text
user.role
subreddit_moderators
```

이다.

achievement row를 생성하지 않는다.

프로필 표시가 필요하면 canonical state에서 derive한다.

---

# 16. 가입 기간은 derive

가입 기간 표시가 필요하면:

```text
user.createdAt
```

에서 계산한다.

persistent achievement 또는 badge 필요 없음.

---

# 17. Veteran 제거

다음 logic 제거를 기본값으로 한다.

```text
Veteran
VETERAN_DAYS
VETERAN_KARMA
hasVeteranAchievement
karma-based veteran
```

가입 기간 자체를 보여주는 것과 Veteran이라는 게임식 tag는 다른 문제다.

---

# 18. Cake Day / Reddit semantics 제거

`account-age.ts`를 audit한다.

필요하면 단순:

```text
formatAccountAge()
```

만 유지한다.

다음 RED/Reddit-specific semantics는 제거한다.

```text
Reddit timechunks comment
Cake Day
formatCakeDayDate
isCakeDay
Feb 29 cake-day behavior
achievement age tiers
```

실제 호출이 없다면 파일 자체를 더 작게 재작성한다.

---

# 19. Priority S — Russian locale

기본 판단:

```text
REMOVE
```

최종 supported UI locale:

```text
vi
ko
en
```

---

# 20. Russian locale 전체 audit

검색:

```text
"ru"
'ru'
Russian
Русский
labelRu
descriptionRu
titleRu
locale === "ru"
startsWith("ru")
RU country detection
```

대상:

```text
Locale type
LOCALES
PREFERRED_LANGUAGES
translation dictionaries
language picker
Accept-Language parser
country detection
cookies
settings
tests
seed
DB values
hard-coded strings
achievement remnants
```

---

# 21. Locale config

최종:

```ts
LOCALES = ["vi", "ko", "en"]
```

형태로 수렴한다.

`RU → ru` country mapping 제거.

---

# 22. Existing preferredLanguage='ru'

Production에서 먼저 count한다.

기존 `preferredLanguage='ru'`은 migration으로 안전하게 normalize한다.

권장 fallback:

```text
unknown
```

또는 현재 locale resolution contract와 가장 자연스러운 값.

임의로 `ko`로 바꾸지 않는다.

---

# 23. Default locale는 별도 판단

Russian removal 때문에 자동으로:

```text
DEFAULT_LOCALE = en → vi
```

까지 바꾸지 않는다.

Vietnamese-first product contract를 검토하고 별도 근거가 있으면 변경할 수 있으나:

* browser locale
* saved preference
* Korea user
* unknown locale
* existing E2E

영향을 모두 테스트한다.

Bug14의 핵심은 Russian 제거이지 default UX 실험이 아니다.

---

# 24. User-generated content 언어는 제한하지 않는다

UI locale 제거와 콘텐츠 언어는 별개다.

사용자는 어떤 언어로든 post/comment/question/listing을 작성할 수 있다.

Russian UI locale 제거가 Russian content를 차단해서는 안 된다.

---

# 25. Content translation은 유지

VTH의 multilingual product pillar 때문에:

```text
content translation
translation metadata
translation actions
```

은 단순히 Russian UI를 제거한다는 이유로 삭제하지 않는다.

다만 별도로 dead/stale translation queue가 있다면 실제 사용 여부를 audit한다.

---

# 26. Priority S — unused Passkey

현재 migration에는 Better Auth passkey storage가 있으나 현재 auth plugin에서 실제 passkey provider/plugin이 존재하는지 다시 확인한다.

대상:

```text
passkey
idx_passkey_user
idx_passkey_credential
passkey code
passkey UI
passkey tests
```

---

# 27. Passkey decision

현재 runtime plugin/route/UI가 없고 production rows가 0이면:

```text
REMOVE
```

한다.

Passkey를 미래에 쓸 수도 있다는 이유로 유지하지 않는다.

나중에 실제 제품 결정이 있을 때 migration을 다시 추가하면 된다.

---

# 28. Priority S — Legacy vote stack

전체 검색:

```text
votes
vote_events
upvotes
downvotes
score
hot_score
weighted score
voter_karma
vote weight
```

---

# 29. Canonical reaction contract 유지

최종 reaction truth:

```text
post_likes
comment_likes
```

Popular:

```text
like_count + comment_count * 3
```

Bug13에서 window가 추가됐더라도 formula 자체는 그 canonical contract를 따른다.

---

# 30. vote_events

현재 runtime에서 사용하지 않는다면:

```text
vote_events
idx_vote_events_target_time
```

을 제거 우선 후보로 한다.

production rows 확인.

---

# 31. legacy votes table

Bug12 기준 production에는 legacy row가 존재했다.

따라서 먼저 해당 row를 확인한다.

검증:

```text
target type
target id
user
value
canonical post_likes/comment_likes counterpart 존재 여부
```

Positive legacy vote가 이미 canonical like로 backfill됐다면 중복 truth가 아니다.

Negative vote는 current VTH semantics에 대응 relation이 없다.

---

# 32. Historical vote data 처리

legacy data가 더 이상 제품 의미를 가지지 않고 canonical conversion이 완료됐다는 증거가 있으면 forward migration으로 제거할 수 있다.

그러나 데이터를 조용히 유실하지 않는다.

필요하면 destructive migration 전 target legacy rows를 명시적으로 기록/보존한 뒤 retire한다.

최종 report에 row count와 처리 방식을 기록한다.

---

# 33. posts/comments legacy columns

감사:

```text
posts.upvotes
posts.downvotes
posts.score
posts.hot_score

comments.upvotes
comments.downvotes
comments.score
```

runtime reference = 0이고 legacy rows가 해결됐으면 physical column removal을 검토한다.

---

# 34. SQLite/D1 column removal

column 제거 때문에 table rebuild가 필요한 경우:

```text
foreign keys
indexes
triggers
default/check
data copy
```

를 정확히 재현해야 한다.

무리하게 column 하나 없애려고 canonical table을 위험하게 rebuild하지 않는다.

위험 대비 이득이 낮으면:

```text
RETAIN-DATA
```

가능.

그러나 Bug14 final report에 이유를 남긴다.

---

# 35. Priority S/A — Karma / Reputation

전체 audit:

```text
user.karma
user.postKarma
user.commentKarma

reputation_ledger
appendReputationLedgerEntry
karma mutation hooks

min_karma_to_media
karma thresholds
karma UI
karma profile
karma permissions
karma ranking
karma tests
```

---

# 36. Karma 기본 판단

현재 Product core에서 reputation point system은 핵심 기능이 아니다.

Achievements 제거 후에도 karma가 다음에 실제 사용되는지 확인한다.

```text
permission
DM
media upload
feed ranking
moderation
trust
rate limits
UI
```

---

# 37. Karma가 실제 authority가 아니면 제거

실제 core permission/ranking에서 사용되지 않는다면:

```text
karma
postKarma
commentKarma
reputation_ledger
karma hooks
karma settings
karma display
```

를 제거한다.

---

# 38. Reputation 대체 시스템 만들지 않는다

Karma를 제거하면서:

```text
trust_score
reputation_v2
user_level
contribution_points
```

같은 새 점수 시스템을 만들지 않는다.

실제 신뢰 signal은 필요한 경우 다음 canonical facts로 충분하다.

```text
account age
role
moderator status
public posts
answers
accepted answers
business verification
moderation history
```

---

# 39. min_karma_to_media

media upload code가 현재 karma를 사용하지 않는다면:

```text
min_karma_to_media
```

site setting도 제거한다.

관련 stale tests/docs도 제거.

---

# 40. Priority A — Ads

전체:

```text
ad_campaigns
ad_impressions
ad_clicks

ads.ts
admin ads
ad APIs
feed ad injection
ad UI
ad cache
ad settings
ads_enabled
ad analytics
```

audit.

---

# 41. Ads default decision

Production에서:

```text
active campaign = 0
campaign rows = 0 또는 의미 없는 seed
ads_enabled = 0
```

이고 실제 운영 계획이 없다면:

```text
REMOVE
```

한다.

---

# 42. Feed는 organic only

Ads 제거 후 feed path에서:

```text
getMonetizationContext()
withFeedAds()
injectAdsIntoFeed()
FeedAdItem
```

같은 wrapper가 없어져야 한다.

최종 canonical feed는 organic post projection 하나로 직접 반환한다.

---

# 43. Media cleanup에서 ads dependency 제거

Ads 제거 시:

```text
media.ts
```

의 unreferenced media query에서:

```text
ad_campaigns.image_key
```

dependency도 제거한다.

---

# 44. Priority A — Pro / Billing

전체 audit:

```text
pro_subscriptions
billing_events
transaction_ledger
billing APIs
webhook
signature verification
Pro UI
subscription UI
plan types
provider-neutral billing
```

---

# 45. Monetization 기본 판단

실제:

```text
active Pro users
billing events
transactions
configured billing provider
production checkout
```

가 없다면 제거한다.

미래 수익화 가능성만으로 유지하지 않는다.

---

# 46. Money data safety

다만 transaction/billing row가 실제 production에 하나라도 있다면 가장 보수적으로 처리한다.

실제 금전 기록은 cleanup 편의 때문에 삭제하지 않는다.

그 경우:

```text
RETAIN-DATA
```

또는 최소 read-only archival path를 유지한다.

---

# 47. user_consents는 별도 판단

`user_consents`를 Pro/Ads와 무조건 함께 삭제하지 않는다.

현재 실제:

```text
analytics
personalized ads
marketing
```

중 어떤 기능이 production에서 사용되는지 확인한다.

Analytics/marketing consent가 실제 active policy라면 필요한 부분만 유지할 수 있다.

---

# 48. Consent simplification

Ads/marketing을 제거하면 필요 없는 consent flags를 삭제/축소한다.

예:

```text
personalized_ads
marketing
```

이 실제 제품에서 사용되지 않으면 제거 검토.

하지만 privacy/legal 관련 상태는 코드 다이어트를 위해 임의로 없애지 않는다.

실제 product behavior와 일치시킨다.

---

# 49. reputation_ledger와 monetization 분리

현재 migration에서 reputation ledger가 monetization foundation과 함께 만들어졌더라도 conceptual domain은 다르다.

Karma 제거 여부와 billing 제거 여부를 각각 판단한다.

---

# 50. Priority A — Listing Alerts

현재 audit:

```text
listing_alerts table
listing-alert API
listing alert UI
createListingAlert
deleteListingAlert
matching engine
notification fanout
scheduled matcher
```

---

# 51. Alert가 실제 alert인지 검증

다음 delivery path가 없으면:

```text
new listing
→ saved query match
→ notification/push
```

현재 기능은 이름만 alert다.

---

# 52. Listing Alert default decision

실제 matcher/fanout가 없고 core usage가 없다면:

```text
REMOVE
```

한다.

---

# 53. Saved Search로 이름만 바꾸지 않는다

사용 근거가 없는데:

```text
Listing Alert
→ Saved Search
```

로 rename만 해서 subsystem을 살리지 않는다.

Marketplace core는:

```text
browse
search/filter
listing save
seller
report
DM
```

면 충분하다.

---

# 54. Priority A — Profile Community hack

현재 구조를 전수 audit한다.

현재 pattern:

```text
profile post
→ hidden/personal subreddit/community 생성
→ creator subscribe
→ creator moderator
→ subscriber recount
→ post 연결
```

이 구조가 남아 있다면 RED inheritance adapter로 취급한다.

---

# 55. Product question

먼저 확인:

> VTH에 별도의 “프로필 전용 글”이 정말 필요한가?

기본 판단:

```text
No
```

Profile은 사용자가 작성한 공개 콘텐츠의 projection이면 충분하다.

---

# 56. Preferred profile model

가능하면:

```text
Profile
→ author_id = user.id인 public posts
```

로 단순화한다.

별도 personal community를 만들지 않는다.

---

# 57. Existing profile communities

Production에서 다음을 count한다.

```text
personal/profile communities
posts inside them
subscriptions
moderators
```

---

# 58. Existing data가 없으면 완전 제거

0 또는 test/seed-only이면:

```text
ensureProfileCommunity
profile-community helper
profile naming convention
automatic subscription
automatic moderator membership
subscriber recount side effect
profile-only create path
```

를 제거한다.

---

# 59. Existing real profile posts가 있으면 추측 migration 금지

실제 user data가 있으면:

* post content
* author
* created_at
* media
* comments
* likes
* links

를 보존해야 한다.

명확한 canonical destination이 없으면 row를 억지로 다른 community에 옮기지 않는다.

이 경우:

```text
new personal community creation 중단
legacy rows read-compatible 유지
RETTAIN-DATA
```

할 수 있다.

목표는 stability이지 migration purity가 아니다.

---

# 60. profile projection은 canonical mapper 재사용

Profile post list는 Bug11 canonical public post projection을 사용한다.

별도 profile Post DTO를 만들지 않는다.

---

# 61. Priority A/B — NSFW remnants

전체 audit:

```text
user.isNsfw
user.showNsfw
NSFW account tag
NSFW achievement
NSFW filters
NSFW settings
NSFW seed
```

---

# 62. NSFW 기본 판단

VTH는 adult-content social network가 아니다.

user-level NSFW identity가 product goal에 없다면 제거한다.

---

# 63. Safety와 NSFW tag를 혼동하지 않는다

NSFW user flag를 제거해도:

```text
moderation
banned words
reports
shadow hiding
content removal
abuse controls
```

은 유지한다.

필요한 future sensitive-content handling은 moderation label 문제이지 achievement/account tag 문제가 아니다.

---

# 64. Priority B — Business Booking

Business 자체는 CORE-KEEP.

유지:

```text
businesses
services
verification
location
phone
website
contact
reports
owner
```

---

# 65. Booking engine audit

대상:

```text
business_bookings
booking APIs
booking UI
booking states
start_at
duration
owner_note
slot constraints
booking rate limits
booking notifications
```

---

# 66. Booking default decision

실제:

```text
booking rows = 0
real business users = 0 또는 거의 없음
booking UX unused
```

이면:

```text
REMOVE
```

를 우선한다.

---

# 67. Business contact 단순화

Business detail에서:

```text
phone
website
owner profile
DM/contact
```

로도 현재 Product journey를 만족할 수 있다.

예약 SaaS를 미리 운영할 필요 없다.

---

# 68. Existing active booking이 있다면 제거 금지

Production에:

```text
requested
confirmed
```

booking이 있다면 lifecycle을 먼저 보존한다.

완료되지 않은 실제 예약을 cleanup 때문에 삭제하지 않는다.

---

# 69. Priority B — Detailed Post Analytics

감사:

```text
post_views
post_link_clicks
stats route
post analytics UI
hourly chart
referrer
discovery source
unique viewers
CTR
```

---

# 70. Analytics 질문

다음 중 실제 core dependency가 있는지 확인한다.

```text
Recommended feed
moderation
security
ranking
operator analytics
author UI
```

---

# 71. Creator analytics default

author-facing:

```text
7d
30d
all
hourly
referrer
CTR
```

전체가 핵심 product requirement가 아니라면 축소 또는 제거한다.

---

# 72. Analytics를 제거해도 recommendation signal은 별도 검토

`user_activity` 등 현재 Recommended feed가 필요로 하는 signal까지 실수로 제거하지 않는다.

`post_views`가 실제 recommendation에 사용되는지 source search로 확인한다.

---

# 73. Minimal analytics option

실제 view count만 유용하다면 복잡한 event-level author analytics 대신 더 단순한 구조가 가능한지 비교한다.

그러나 Bug14에서 새 analytics architecture를 만들기 위해 큰 rewrite는 하지 않는다.

비용이 더 크면 현재 구조를 유지할 수 있다.

---

# 74. Privacy / data minimization

analytics row가 없어도 제품이 정상 동작한다면:

```text
viewer_id
session_key
referrer_host
```

등을 장기간 저장할 필요가 있는지 재검토한다.

데이터를 덜 저장하는 것도 안정성과 운영 단순성이다.

---

# 75. Priority B — Presence

Presence는 현재 product contract에 있으므로 무조건 삭제하지 않는다.

감사:

```text
user_presence
POST /api/presence
GET /api/presence
heartbeat client
online user UI
ONLINE_WINDOW_MINUTES
```

---

# 76. Presence write amplification

클라이언트가 주기적으로:

```text
POST /api/presence
→ D1 UPSERT
```

를 실행한다면 write frequency를 측정한다.

---

# 77. Preferred presence simplification

실시간 online precision이 필요하지 않으면:

```text
Online now
```

보다:

```text
Recently active
```

개념으로 축소한다.

---

# 78. Presence throttle

가능하면:

```text
already normal authenticated activity
→ occasionally update last_seen
```

형태로 수렴한다.

전용 heartbeat가 필요하다면 server/client 양쪽에서 충분히 throttle한다.

D1 write를 매 수십 초마다 하지 않는다.

---

# 79. Presence 삭제 조건

실제 UI에서 사용되지 않고 DM에도 필요 없다면:

```text
user_presence
presence API
presence heartbeat
```

전체 제거 가능.

PRODUCT.md도 실제 제품 방향에 맞춰 수정한다.

---

# 80. Priority C — contactEmailVerified scaffold

audit:

```text
contactEmail
contactEmailVerified
verification UI
verification token
verification API
email sender
```

---

# 81. verification workflow가 없으면 축소

실제 verification mechanism이 없다면:

```text
contactEmailVerified
```

를 canonical truth처럼 유지하지 않는다.

---

# 82. contactEmail 자체

contact email이 다음에 실제 필요한지 확인한다.

```text
account recovery
business contact
admin communication
security
```

social-only auth에서 필요 없다면 contactEmail 자체도 별도 검토 가능.

그러나 OAuth synthetic/internal email과 혼동하지 않는다.

---

# 83. Developer API / api_keys — audit only

다음은 이번 cleanup에서 조사하되 **자동 삭제 대상은 아니다.**

```text
developers.vth.kr
api_keys
developer docs
/i/api tunnel
```

사용자가 명시적으로 developer surface를 유지해 왔으므로 단순 cleanup 이유로 제거하지 않는다.

---

# 84. api_keys dead 여부

실제 public/external API key consumer가 전혀 없더라도:

```text
API foundation을 유지할 명확한 project intent
```

가 문서에 있으면 DEFER 가능.

불필요한 route/DB만 개별 제거할 수 있다.

---

# 85. Do NOT remove these

다음은 이번 다이어트의 보호 대상이다.

```text
Better Auth social login
Facebook/Kakao/Zalo
user.id canonical identity

communities
posts
comments
likes
search

Q&A
accepted answers

follow
friend
block
mute if Bug13 added it

DM
chat requests
unread
WebSocket
Durable Object

notifications
push

Marketplace core
listing saves

Business directory
business verification

moderation
reports
rate limits

R2 media ownership
media cleanup

D1 audit
E2E test infrastructure

Vietnamese
Korean
English UI

content translation

Bug13 post saves / Popular windows / Q&A filters if implemented
```

---

# 86. Bug10 frozen contract

가능한 한 다음 파일을 건드리지 않는다.

```text
src/components/messages/messages-client.tsx
src/components/notifications/use-unread-count.ts
src/lib/chat-room-state.ts
src/lib/chat-send-recovery.ts
src/workers/ChatRoom.ts
```

cleanup 대상 subsystem이 이 파일에 직접 import돼 있지 않는 이상 변경 금지.

---

# 87. DM invariants 유지

```text
D1 canonical
HTTP authoritative mutation
DO/WebSocket transport
clientMessageId idempotency
signed cursor
read boundary
selective reconciliation
multi-tab unread
block teardown
```

그대로 유지한다.

---

# 88. Bug11 invariants 유지

```text
single post projection
single public visibility predicate
positive-like relations
strict payload validation
requestId same payload → same id
changed payload → 409
counter invariants
deterministic Popular cursor
bilateral block final-write guards
```

유지.

---

# 89. Bug12 quality gate 유지

Bug14 완료 후에도:

```text
lint 0 errors
lint 0 warnings
DB drift 0
FK violation 0
orphan 0
critical E2E clean
```

을 유지한다.

---

# 90. Bug13 semantics 유지

실제 구현됐다면 최소:

```text
Save ≠ Like
Mute ≠ Block
Hide ≠ Remove
Public visibility ≠ interaction permission
```

계약 유지.

Cleanup 중 합쳐버리지 않는다.

---

# 91. Source deletion principle

Subsystem 제거 시:

```text
DB만 DROP
```

하고 코드가 남는 것도 실패고,

```text
UI만 숨김
```

하고 DB/runtime가 남는 것도 실패다.

완전 제거 대상은:

```text
route
UI
lib
type
tests
seed
migration dependency
settings
docs
background hooks
DB object
```

전부 정리한다.

---

# 92. No tombstone adapter

삭제한 기능 대신:

```text
deprecated helper
compat adapter
legacy facade
empty wrapper
always-return-null service
```

를 영구적으로 남기지 않는다.

가능하면 import 자체를 제거한다.

---

# 93. No feature flags for dead features

실제로 제거하기로 결정한 기능을:

```text
ACHIEVEMENTS_ENABLED=0
ENABLE_OLD_ADS=false
```

같은 feature flag 뒤에 보관하지 않는다.

그건 cleanup이 아니다.

---

# 94. Site settings cleanup

모든 `site_settings` key를 inventory한다.

삭제되는 subsystem의 key:

```text
ads_enabled
karma thresholds
booking limits
obsolete vote/scoring settings
legacy feature toggles
```

도 같이 제거한다.

---

# 95. Environment variable cleanup

다음 위치를 감사:

```text
wrangler config
cloudflare-env.d.ts
.dev.vars.example
worker Env type
docs
```

삭제된 subsystem의 unused env var를 제거한다.

실제 Cloudflare secret 자체 삭제가 필요한 경우 user action이 정말 필요할 때만 명확히 보고한다.

---

# 96. Type cleanup

다음 잔재를 허용하지 않는다.

```text
unused interface
legacy enum
deprecated union member
old locale member
old ad FeedItem variant
old achievement type
old booking state
old vote type
```

TypeScript compile만 통과한다고 완료가 아니다.

---

# 97. Test cleanup

삭제된 기능의 테스트는 삭제한다.

그러나:

```text
test 수가 줄었다
```

는 문제 자체가 아니다.

중요한 것은 남은 canonical behavior가 더 강하게 검증되는 것이다.

---

# 98. 테스트를 억지로 대체하지 않는다

Achievement test 20개를 지웠다고 새 의미 없는 test 20개를 만들 필요 없다.

대신 removal regression에 필요한 test만 추가한다.

---

# 99. Removal regression tests

최소 다음을 확인한다.

```text
removed route → 404/not present
removed UI → navigation에 없음
removed DB table → absent
removed column → absent if physically retired
removed locale → parser가 ru를 accepted locale로 보지 않음
legacy values → safe fallback
feed → unchanged
DM → unchanged
Q&A → unchanged
Marketplace core → unchanged
Business discovery → unchanged
```

---

# 100. Clean install DB gate

빈 D1:

```text
all historical migrations
→ Bug14 forward migrations
→ seed
→ audit
```

PASS.

---

# 101. Upgrade DB gate

Bug13 완료 상태 local DB:

```text
existing data
→ Bug14 migration
→ audit
```

PASS.

이 path가 실제 production upgrade를 대표한다.

---

# 102. Schema audit before/after

Bug14 시작 전과 끝에:

```text
tables
columns
explicit indexes
FKs
CHECK constraints
```

개수를 기록한다.

---

# 103. 목표는 숫자 줄이기 자체가 아님

예:

```text
table 60 → 40
```

이 되었다고 자동 성공이 아니다.

모든 남은 table에 분명한 owner/domain이 있어야 한다.

---

# 104. Canonical DB final state

최종 `docs/VTH_DATABASE.md`만 읽어도 다음 질문에 답할 수 있어야 한다.

```text
identity truth?
post truth?
like truth?
Q&A truth?
social relation truth?
DM truth?
notification truth?
marketplace truth?
business truth?
moderation truth?
viewer preference truth?
```

---

# 105. No unknown table

Bug14 후 application table 중:

> “이건 왜 있지?”

라는 답이 나오는 object가 없어야 한다.

각 table은:

```text
CANONICAL
RETAINED-DATA
```

둘 중 하나로 설명 가능해야 한다.

---

# 106. RETAINED-DATA 최소화

가능하면 legacy physical object를 제거한다.

그러나 안전하지 않은 physical rewrite 때문에 안정성을 희생하지 않는다.

---

# 107. RETAINED-DATA documentation

남긴다면 반드시:

```text
Object
Why retained
Runtime reads
Runtime writes
Production rows
Future removal condition
```

을 기록한다.

---

# 108. D1 query-plan regression

테이블/index 제거 후 핵심 query를 다시 확인한다.

최소:

```text
Home
Popular
Community
Profile
Post comments
Q&A list
Marketplace list
Business discovery
```

---

# 109. EXPLAIN QUERY PLAN

Bug13/11에서 사용하던 핵심 query에 대해 planner를 확인한다.

필요한 canonical index를 cleanup 과정에서 실수로 삭제하지 않는다.

---

# 110. N+1 audit

cleanup 후 특히:

```text
feed
profile
business
marketplace
review queue
saved posts
muted-user filtering
```

에서 새 N+1이 생기지 않았는지 확인한다.

---

# 111. Runtime write audit

Bug14 전/후 주요 action별 side effect를 표로 만든다.

예:

```text
Create Post
Before:
post insert
activity
achievement
karma
analytics...
After:
canonical post insert
necessary moderation/idempotency only
```

실제 source 기준으로 작성한다.

---

# 112. 목표

특히:

```text
post create
comment create
like
follow
profile load
feed load
```

에서 불필요한 DB read/write가 감소해야 한다.

---

# 113. Background work audit

현재 scheduled/async 작업 모두 list한다.

예:

```text
media cleanup
achievement sync
alert matching
analytics
other cron
```

실제 필요한 것만 남긴다.

Media cleanup처럼 storage safety에 직접 필요한 작업은 유지.

---

# 114. Dependency audit

`package.json`도 검사한다.

삭제한 subsystem 때문에 더 이상 사용하지 않는 dependency가 생기면 제거한다.

그러나 dependency 숫자를 줄이기 위해 unrelated rewrite는 하지 않는다.

---

# 115. Current important dependencies

다음은 제거 목표가 아니다.

```text
Next
React
OpenNext Cloudflare
Better Auth
Kysely/D1 adapter
Base UI
lucide
image processing libs actually used
Playwright
Vitest
```

---

# 116. Documentation convergence

Bug14 완료 후 업데이트:

```text
docs/PRODUCT.md
docs/ROADMAP.md
docs/ARCHITECTURE.md
docs/VTH_DATABASE.md
docs/VTH_TESTING.md
```

필요한 경우:

```text
docs/VTH_CONTENT_FEED.md
docs/VTH_REALTIME_DM.md
```

도 실제 구현에 맞춘다.

---

# 117. PRODUCT.md 수정 원칙

삭제된 기능이 Product scope에 명시돼 있으면 같이 제거한다.

예:

```text
presence
booking
developer API
```

는 실제 최종 decision에 맞춘다.

---

# 118. Historical Bug 문서는 source of truth가 아님

`bug*.md`는 작업 기록이다.

현재 truth는 canonical docs다.

Bug14 종료 후 obsolete architecture 설명을 canonical docs에 남기지 않는다.

---

# 119. Recommended execution order

다음 순서를 권장한다.

```text
Phase 0  Baseline / Inventory
Phase 1  Low-risk dead code/object removal
Phase 2  Achievements / Locale cleanup
Phase 3  Vote / Karma legacy retirement
Phase 4  Monetization / Ads cleanup
Phase 5  Product subsystem simplification
Phase 6  DB physical consolidation
Phase 7  Runtime side-effect audit
Phase 8  Docs convergence
Phase 9  Full regression / production verification
```

---

# 120. Phase 1 — low-risk targets

먼저:

```text
dead passkey
dead vote_events
dead indexes
dead settings
unused types
unused locale strings
unused helpers
```

같은 evidence-clear 대상부터 처리한다.

---

# 121. Phase 2

```text
Achievements
Russian locale
Veteran/Cake Day
NSFW remnants if confirmed
```

정리.

---

# 122. Phase 3

```text
votes
upvotes/downvotes
score/hot_score
karma
postKarma/commentKarma
reputation ledger
```

을 하나의 RED reputation/scoring legacy audit로 묶는다.

---

# 123. Phase 4

```text
Ads
Pro
Billing
Consent
```

을 실제 production evidence로 판단.

---

# 124. Phase 5

```text
Listing Alerts
Profile Community
Business Booking
Post Analytics
Presence
contactEmailVerified
```

를 product-value 기준으로 축소.

---

# 125. Phase 6

앞 단계에서 runtime dependency가 0이 된 뒤에만 physical DB cleanup을 한다.

순서를 거꾸로 하지 않는다.

---

# 126. Do not mix huge migrations unnecessarily

모든 제거를 한 SQL migration 하나에 우겨 넣지 않는다.

D1 table rebuild 위험과 domain별 rollback/debugging을 고려해:

```text
legacy reactions
achievements
monetization
product simplification
```

등 논리적 단위로 forward migration을 나눌 수 있다.

단 migration을 지나치게 쪼개지도 않는다.

---

# 127. Migration naming

예시는 개념뿐이다.

실제 번호는 Bug13 후 next 번호 사용.

예:

```text
00xx_retire_achievements_and_reputation.sql
00xy_remove_unused_product_subsystems.sql
00xz_finalize_canonical_schema.sql
```

실제 dependency를 보고 나눈다.

---

# 128. Production migration 순서

각 destructive group에 대해:

```text
local clean
local upgrade
local audit
tests
remote read-only audit
production migration
remote audit
production smoke
```

순서 유지.

---

# 129. One destructive wave at a time

여러 위험 migration을 production에 한꺼번에 넣지 않아도 된다.

문제가 생겼을 때 어느 migration이 원인인지 알아야 한다.

---

# 130. Production smoke

최소:

```text
/
?feed=popular
/questions
/marketplace
/businesses
/messages
/notifications
/settings
/login
profile
post detail
saved page if Bug13 added
```

---

# 131. Authentication smoke

실제 social OAuth provider configuration을 파괴하지 않았는지 확인.

CI에서는 real OAuth를 호출하지 않는다.

---

# 132. Critical E2E

Bug12/Bug13 critical tests 유지.

최소:

```text
auth/session
post create
like/comment
block
mute if present
save if present
DM
Q&A
Marketplace
Business discovery
```

---

# 133. Repeat stability gate

critical subset:

```text
--repeat-each=3
```

clean pass.

retry-only 성공을 green이라고 보고하지 않는다.

---

# 134. Required commands

최종:

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

전부 PASS.

---

# 135. Additional DB schema audit

Bug14에서는 반드시 schema output도 실행한다.

기존 audit script의 schema mode를 사용해:

```text
tables
columns
FK
indexes
CHECK/UNIQUE
```

를 최종 확인한다.

---

# 136. Remote audit

Production migration 전후 read-only audit 실시.

최종:

```text
FK violations = 0
counter drift = 0
orphans = 0
```

필수.

---

# 137. Counter invariants

유지:

```text
posts.like_count
comments.like_count
posts.comment_count
questions.answer_count
subreddits.subscriber_count
```

Bug13에서 새 canonical counter가 생겼다면 함께 audit.

---

# 138. No new denormalized counters

Cleanup 중:

```text
save_count
mute_count
profile_post_count
booking_count
```

같은 새 scalar counter를 만들지 않는다.

---

# 139. Performance comparison

Bug14 전/후 최소:

```text
Home
Popular
Profile
Post Detail
Marketplace
Business
```

핵심 query의 D1 접근과 planner를 비교한다.

---

# 140. Complexity metrics

최종 보고에 반드시:

```text
Tables before / after
Columns before / after
Indexes before / after

Runtime routes before / after
Source files added / deleted
Helpers added / deleted

Background jobs before / after
Major mutation side effects before / after

Dependencies before / after
Site settings before / after
Locales before / after
```

를 기록한다.

---

# 141. Expected direction

Bug14는 가능하면:

```text
files deleted > files added
tables removed > tables added
helpers deleted > helpers added
runtime dependencies added = 0
new infrastructure = 0
permanent adapters added = 0
```

이어야 한다.

---

# 142. Added file 허용

다음처럼 실제 consolidation에 필요한 경우만 허용:

```text
migration
targeted migration test
small audit improvement
```

새 architecture layer 추가 금지.

---

# 143. Final subsystem report

표 작성:

| Subsystem | Before | Production Evidence | Decision | After |
| --------- | ------ | ------------------- | -------- | ----- |

최소 포함:

```text
Achievements
Russian locale
Passkey
Votes
vote_events
legacy score/hot_score
Karma
Reputation ledger
Ads
Pro subscriptions
Billing
Consent
Listing Alerts
Profile Community
NSFW
Business Booking
Post Analytics
Presence
contactEmailVerified
Developer API
```

---

# 144. Final DB retirement report

표:

| DB Object | Rows Before | Runtime Reads | Runtime Writes | Decision | Final State |
| --------- | ----------: | ------------: | -------------: | -------- | ----------- |

---

# 145. Final migration report

반드시:

```text
new migrations
tables dropped
tables retained
columns dropped
columns retained
indexes dropped
indexes retained
data transformed
data archived/retained
```

보고.

---

# 146. Final stability report

```text
lint
typecheck
unit
worker
integration
E2E
critical repeat x3
build
worker build
clean DB migration
upgrade DB migration
local audit
remote audit
production smoke
```

실제 숫자.

---

# 147. Final runtime-side-effect report

최소:

```text
Create Post
Create Comment
Like
Follow
Profile Load
Feed Load
```

에 대해 Before/After를 적는다.

Bug14의 중요한 성과는 줄어든 side effect다.

---

# 148. Final retained complexity report

제거하지 않은 후보는:

```text
Why retained
Actual current use
Why simpler alternative rejected
Future removal trigger
```

를 적는다.

“시간 부족”만으로 남기지 않는다.

---

# 149. Cleanup honesty rule

삭제하다 위험해서 중단했다면:

```text
REMOVED
```

라고 보고하지 않는다.

정확히:

```text
RETAINED-DATA
DEFER
```

로 보고한다.

---

# 150. No score chasing

Bug14는 임의의 95점 만들기 작업이 아니다.

코드가 더 작아졌지만 실제 안정성이 떨어지면 실패다.

우선순위:

```text
1 correctness
2 data safety
3 simpler canonical model
4 lower maintenance cost
5 lower runtime work
6 smaller code/schema
```

순서다.

---

# 151. Target architecture after Bug14

이상적인 VTH:

```text
Identity
  Better Auth + social providers

Community
  communities + subscriptions

Content
  posts + comments + likes

Knowledge
  Q&A

Social
  follow + friend + block + mute

Messaging
  D1 + DO/WebSocket

Marketplace
  listings + saves + reports

Businesses
  directory + verification + contact

Moderation
  reports + actions

Media
  R2 + ownership registry

Notifications
  D1 + push

Viewer preferences
  hidden/saved/muted

Infrastructure
  Worker + D1 + R2 + DO
```

이 정도면 충분하다.

---

# 152. What should disappear conceptually

가능한 경우:

```text
gamification platform
Reddit scoring compatibility
unused auth methods
unused UI languages
future billing platform
unused ad server
fake profile communities
half-working alert service
overbuilt creator analytics
overbuilt booking SaaS
```

가 VTH architecture에서 사라져야 한다.

---

# 153. Product philosophy after Bug14

앞으로 기능 추가 기준은:

```text
VTH 실제 문제
→ 사용자 근거
→ 가장 단순한 해결
```

이다.

더 이상:

```text
좋은 오픈소스 기능 발견
→ VTH에 추가
```

방식으로 개발하지 않는다.

---

# 154. Bug14 completion condition

Bug14는 다음 질문에 YES일 때 완료다.

### Product

```text
남은 모든 큰 subsystem이 VTH 핵심 목적과 연결되는가?
```

### Architecture

```text
각 책임에 canonical implementation 하나만 있는가?
```

### Database

```text
각 application table이 왜 존재하는지 설명 가능한가?
```

### Runtime

```text
사용자 action에 불필요한 side effect가 최소화됐는가?
```

### Maintenance

```text
혼자 + AI coding agent로 장기 유지 가능한 구조인가?
```

### Stability

```text
모든 quality gate가 green인가?
```

---

# 155. Final objective

Bug14의 최종 식:

```text
Current VTH
- RED baggage
- unused future scaffolding
- gamification
- stale locales
- obsolete scoring
- dead DB objects
- unnecessary runtime side effects
- half-built product subsystems
=
smaller VTH
```

그러나 동시에:

```text
smaller VTH
+ canonical D1 truth
+ strong tests
+ safe migrations
+ clear product boundaries
+ proven DM/content invariants
=
more stable VTH
```

가 되어야 한다.

---

# Final instruction to Luna

먼저 삭제하지 마라.

먼저 **증명하라.**

```text
어디에서 쓰이는가?
실제 production data가 있는가?
핵심 사용자 여정인가?
없애면 무엇이 깨지는가?
더 단순한 canonical path가 이미 있는가?
```

를 source / DB / tests로 확인한다.

그 다음 제거한다.

반대로 제거 대상으로 합의된 subsystem을 단순히 “혹시 나중에 필요할 수 있다”는 이유로 남기지 마라.

Bug14의 목적은 VTH를 기능이 많은 코드베이스로 만드는 것이 아니라,

> **필요한 것만 남아 있고, 남은 것은 확실히 동작하는 코드베이스**

로 만드는 것이다.
기존 `docs/bug14.md`가 이미 존재하면 전체 내용을 임의로 다시 쓰지 말고, 먼저 현재 문서를 읽고 기존 목표/단계/검증 조건을 보존한 채 **문서 맨 아래에 아래 내용을 정식 Phase로 추가하라.**

`docs/bug14.md`가 아직 없다면 새로 작성하되, Bug14의 기존 목표인 D1 Schema Consolidation / Legacy Retirement와 아래 Source Legacy Sweep을 하나의 통합 작업으로 설계하라.

# Bug14 추가 목표 — Source Legacy Sweep & Removed-Concept Zero Reference

Bug14는 DB schema만 정리해서 끝내지 않는다.

VTH가 RED에서 크게 분기된 현재 시점에서, 과거 RED/Reddit 구조, 폐기된 기능, 반쯤 구현된 subsystem, compatibility scaffold가 `src/**` 런타임 코드에 불필요하게 남아 있는지 **전수 감사하고 제거 또는 명시적 유지 결정**까지 완료한다.

목표는 코드가 RED와 닮지 않게 만드는 것이 아니다.

**현재 VTH에서 실제로 사용하지 않거나 더 이상 canonical하지 않은 개념이 runtime source에 남아 있는 상태를 제거하는 것**이 목표다.

RED에서 유래했다는 이유만으로 삭제하지 않는다.

현재 사용 중이고 단순하며 안정적인 RED-origin 코드는 유지한다.

---

# Phase — Source Legacy Inventory

저장소 전체를 직접 검색하라.

최소 검색 범위:

```text
src/**
tests/**
scripts/**
seed.sql
migrations/**
docs/**
```

다음 키워드만 기계적으로 찾고 끝내지 말고, 관련 import/export/type/API/UI/helper까지 추적하라.

```text
reddit
red

vote
voter
upvote
downvote
votes
score
hot_score

karma
postKarma
commentKarma

achievement
achievements
achievement-level
cake
cake day
veteran

ru
russian

nsfw
showNsfw
isNsfw

passkey

ads
ad_campaign
advertising

pro
subscription
billing
transaction
ledger
reputation
monetization

profile-community

listing-alert
listing_alert

contactEmailVerified
contact_email_verified

deprecated
compat
compatibility
legacy
fallback
old
```

검색어 자체가 삭제 기준은 아니다.

각 match가 실제 어떤 실행 경로에 연결되는지 추적한다.

---

# 모든 발견 항목을 반드시 분류

각 legacy/unused 후보를 아래 중 하나로 분류한다.

```text
CANONICAL
MIGRATION-HISTORY
TEST-FIXTURE
RETAIN-DATA
REMOVE
```

의미:

## CANONICAL

현재 VTH 런타임에서 실제 필요하며 canonical design의 일부다.

유지한다.

## MIGRATION-HISTORY

과거 migration 안에만 존재한다.

이미 적용된 migration history는 그대로 둔다.

runtime code에서 사용하지 않는다면 정상이다.

## TEST-FIXTURE

역사적 schema나 migration compatibility 검증을 위해 테스트에서만 필요한 항목이다.

필요성 증명 후 유지한다.

## RETAIN-DATA

runtime에서는 더 이상 사용하지 않지만 production data/rollback/forward migration 안전성 때문에 당장 물리 제거하기 어려운 항목이다.

runtime reference는 제거하되 DB에는 명시적으로 보존한다.

## REMOVE

현재 제품에서 사용하지 않고 데이터/호환성/테스트 의존성도 없으며 제거 가능한 항목이다.

source, type, helper, API, UI, tests, seed, indexes 등 관련 경로까지 함께 제거한다.

---

# 우선 감사 대상

아래는 이미 legacy 또는 과구현 가능성이 높은 것으로 보이는 영역이다.

하지만 이름만 보고 즉시 삭제하지 말고 실제 호출 그래프와 제품 경로를 먼저 확인하라.

---

## 1. Achievement / Gamification

집중 검사:

```text
src/lib/achievements.ts
src/lib/achievement-levels.ts
```

및 관련:

```text
imports
hooks
components
API
types
tests
profile rendering
notifications
tags
```

다음 개념이 현재 VTH 제품에 실제 사용되는지 확인:

```text
achievement
level
Voter
Cake Day
karma-based reward
gamification
```

실제 제품에 노출되지 않고 canonical requirement도 아니라면 subsystem 전체를 제거한다.

부분 삭제로 dead helper/import를 남기지 않는다.

---

## 2. Karma / Veteran / Cake Day / Reddit semantics

집중 검사:

```text
src/lib/account-age.ts
src/lib/tags.ts
src/lib/auth.ts
```

다음 개념 추적:

```text
karma
postKarma
commentKarma
VETERAN_KARMA
Veteran
Cake Day
Reddit timechunks
timesince
```

단순한 일반 계정 생성일 표시가 필요하면 Reddit 전용 semantics를 유지하지 말고 VTH-native 단순 구현으로 축소한다.

Cake Day나 karma 기반 Veteran 개념이 제품 요구사항에 없다면 제거한다.

---

## 3. Russian locale

VTH의 실제 지원 언어 정책과 비교하라.

검색:

```text
ru
Russian
locale detection
language routing
translation fallback
```

현재 지원 대상이 아니라면:

```text
RU locale
자동 RU 감지
러시아어 전용 분기
관련 message files
관련 tests
```

를 제거한다.

다른 locale 동작을 깨뜨리지 않는다.

---

## 4. profile-community 구조

집중 검사:

```text
src/lib/profile-community.ts
```

및 호출자 전체.

현재 구현이 사용자 프로필 포스트를 위해:

```text
subreddit/community 생성
self subscribe
self moderator
subscriber recount
```

같은 RED/Reddit 구조를 요구하는지 확인하라.

VTH에서 Profile Post가 독립적인 canonical context로 처리 가능하다면 fake/personal subreddit 구조를 제거하거나 최소화한다.

단, 이를 위해 새로운 거대 domain abstraction이나 Repository 계층을 만들지 않는다.

목표는 구조 단순화다.

변경 전:

* Profile Posts
* Home
* Popular
* Community
* Post Detail
* permissions
* visibility
* counters

영향을 모두 확인한다.

---

## 5. Legacy vote / score runtime remnants

Bug11에서 canonical reaction은:

```text
post_likes
comment_likes
```

이며 Popular은:

```text
like_count + comment_count * 3
```

이다.

따라서 runtime source에서 다음을 다시 전수 검색:

```text
votes
upvotes
downvotes
score
hot_score
vote action
vote controls
```

migration history를 제외하고 현재 runtime에 남아 있는 legacy semantics가 있으면 제거한다.

특히:

```text
SQL
types
DTO
projection
API
seed
test helpers
ranking helpers
analytics
```

까지 확인한다.

Bug11 Popular formula를 변경하지 않는다.

---

## 6. Ads / Monetization / Pro / Billing

집중 검사:

```text
ads
ad_campaigns
impression
click tracking
placement
weighted ad selection
feed ad injection

monetization
pro subscription
billing events
transaction ledger
reputation ledger
consent
```

현재 실제 VTH product surface, production API, scheduled process, UI가 사용하는지 확인한다.

단순히 미래를 위해 만들어둔 코드라면 유지하지 않는다.

기능 제거 시 관련:

```text
API
components
types
DB runtime refs
media cleanup refs
tests
seed
cron/scheduled refs
```

를 끝까지 제거한다.

특히 `media.ts` 등의 orphan-media 판단이 `ad_campaigns`를 참조하면 subsystem 제거와 함께 정리한다.

DB table 자체는 production row와 migration safety를 별도 판단한다.

---

## 7. NSFW remnants

검색:

```text
isNsfw
showNsfw
nsfw
```

VTH 현재 제품에 NSFW user preference/policy가 실제 존재하지 않는다면 RED-origin preference와 condition을 제거한다.

단, Marketplace/Q&A/content moderation의 일반 visibility 정책과 혼동하지 않는다.

---

## 8. Listing Alerts

현재 다음만 있고 실제 matcher/fanout/scheduled processing이 없는지 확인:

```text
listing alert CRUD
saved criteria
alert API
```

실제 end-to-end 제품 기능이 아니라 scaffold뿐이라면 제거한다.

반대로 실제 UI + worker + notification fanout까지 연결되어 있으면 CANONICAL로 분류한다.

Bug14에서 새 기능을 완성하기 위해 matcher를 새로 구현하지 않는다.

미완성 기능이면 구현 확대가 아니라 제거가 기본 방향이다.

---

## 9. contactEmailVerified 및 auth compatibility fields

social-only auth architecture와 비교하여:

```text
contactEmailVerified
contact_email_verified
email/password compatibility
synthetic email compatibility
legacy auth fields
```

를 조사한다.

Better Auth 또는 provider compatibility에 실제 필요한 것은 유지한다.

현재 VTH 제품에 의미가 없는 과거 account field/helper는 제거한다.

인증을 깨뜨릴 가능성이 있으므로 반드시:

```text
Facebook seeded session
Kakao/Zalo provider wiring
test-only e2e session
profile/settings
session serialization
```

을 확인한다.

---

## 10. Presence

현재 presence heartbeat가 D1 `last_seen_at`을 자주 UPSERT하는 구조라면 실제 제품 필요성과 write amplification을 측정한다.

필요한 기능이면 유지하되 단순화 가능성을 검토한다.

사용되지 않는다면 제거한다.

Bug14에서 Durable Object나 별도 presence infrastructure를 새로 도입하지 않는다.

---

## 11. Post analytics

검색:

```text
view count
unique viewer
referrer
source
hourly analytics
CTR
analytics dashboard
```

현재 실제 관리자/사용자 제품 경로에서 사용 중인지 확인한다.

사용하지 않는 미래용 analytics subsystem이면 제거 후보로 분류한다.

단순 view_count처럼 이미 canonical product metric으로 쓰이는 부분과 거대한 analytics subsystem을 구분한다.

---

## 12. Booking / Business / 기타 과구현 subsystem

위 목록 외에도 repo를 전체 탐색하면서:

```text
API는 있는데 UI가 없음
UI는 있는데 실제 write path가 없음
CRUD만 있고 consumer가 없음
scheduled path가 없음
dead service/helper
unused types
unused feature flags
future scaffold
```

가 발견되면 동일한 분류 절차를 적용한다.

Bug14 문서에 없는 항목이라도 명백한 dead subsystem이면 보고하고 정리한다.

---

# 제거 원칙

삭제할 때 다음과 같은 반쪽 제거를 금지한다.

예:

```text
UI 삭제
→ API 남음
→ helper 남음
→ type 남음
→ tests 남음
→ DB runtime lookup 남음
```

이런 상태는 실패다.

`REMOVE` 결정한 개념은 가능한 범위에서 vertical slice 전체를 정리한다.

```text
UI
API
service/helper
types
imports/exports
tests
seed
scheduled references
runtime SQL
indexes
docs
```

DB physical object는 migration/data safety 규칙에 따라 별도 처리한다.

---

# Removed-Concept Zero Reference Gate

Bug14의 가장 중요한 신규 종료 조건이다.

제거하기로 결정한 모든 concept에 대해서:

```text
migrations/**
→ 역사적 reference 존재 가능

docs/**
→ migration/history 설명으로 존재 가능

tests/**
→ migration compatibility fixture로 명시적 필요성이 있으면 가능

src/**
→ runtime reference 0
```

이어야 한다.

즉:

> 제거했다고 보고한 concept이 `src/**`에 이름만 바뀌어 남아 있거나 dead import/helper/type/API 형태로 남아 있으면 Bug14는 완료가 아니다.

각 REMOVE 대상에 대해 최종 `git grep` 또는 동등한 repo-wide search 결과를 보고하라.

---

# Dead Code Sweep

legacy 키워드 검색과 별개로 실제 dead code도 확인한다.

최소:

```text
unused exported helpers
unused modules
unused API utilities
unused React hooks
unused types/interfaces
unused feature constants
unused scheduled helpers
unused DB query wrappers
unused compatibility adapters
```

를 확인한다.

단순히 ESLint가 경고하지 않는다고 사용 중인 것으로 간주하지 않는다.

import graph와 실제 route/component 호출자를 확인한다.

---

# Architecture Rule

외부 프로젝트나 이전 VTH 구현을 제거하면서 새 layer를 만들지 않는다.

금지:

```text
generic Repository
DAO framework
ORM abstraction
LegacyAdapter
CompatibilityService
FeatureFacade
temporary dual read path
temporary dual write path
```

정말 필요한 compatibility가 아니라면 canonical path 하나로 수렴한다.

목표:

```text
old path 제거
+
canonical VTH path 유지
```

이다.

---

# Bug10 / Bug11 / Bug12 regression boundary

Source cleanup 때문에 이미 안정화한 핵심 동작을 훼손하지 않는다.

특히 Bug10:

```text
DM D1 canonical
DO + WS projection
clientMessageId idempotency
signed cursor
read boundary
block teardown
reconnect reconciliation
cross-tab unread
```

Bug11:

```text
mapPostProjection()
canonical public visibility
Popular ranking
rank cursor
bilateral final-write block checks
strict request validation
requestId 409 semantics
canonical counters
```

Bug12:

```text
lint hard gate
DB audit
critical E2E
migration clean-install / upgrade tests
```

를 regression baseline으로 유지한다.

Bug10 messaging files는 strong reason 없이는 건드리지 않는다.

---

# Database와 Source cleanup 연결

Source에서 legacy runtime reference를 제거했다고 DB object까지 즉시 drop하지 않는다.

DB object 삭제 조건은 별도로 충족해야 한다.

최소:

```text
runtime reference = 0
test/script/seed runtime dependency = 0
production row audit 완료
FK dependency 없음
index dependency 확인
rollback consideration 완료
clean install migration PASS
upgrade migration PASS
```

조건을 만족해야 한다.

그렇지 않으면:

```text
RETAIN-DATA
```

또는

```text
MIGRATION-HISTORY
```

로 명시한다.

---

# 반드시 작성할 Source Legacy Matrix

최종 보고서에 아래 표를 포함하라.

```text
Concept
Source Files
Runtime Usage Before
Decision
Reason
Code Removed
DB Impact
Tests Affected
Runtime References After
```

최소 항목:

```text
Achievements
Karma
Veteran
Cake Day
Russian locale
Profile Community
Votes
Score
Hot Score
Ads
Monetization
Pro/Billing
NSFW
Listing Alerts
contactEmailVerified
Presence
Post Analytics
```

그리고 repo audit 중 추가 발견한 항목도 포함한다.

---

# Complexity Report

Bug14 전후를 수치로 보고한다.

최소:

```text
files added
files deleted
files modified

runtime source files deleted
helpers removed
API routes removed
React components removed
types removed
tests removed
tests added

legacy runtime concepts before
legacy runtime concepts after

permanent adapters before
permanent adapters after

new runtime dependencies
removed runtime dependencies
```

새 dependency는 가급적 0이어야 한다.

cleanup을 위해 새로운 라이브러리를 추가하지 않는다.

---

# 최종 검색 검증

제거 결정된 각 concept에 대해 repo-wide 검색을 반복한다.

최소 별도 검색:

```text
achievement
karma
cake
veteran
vote
upvote
downvote
hot_score
score
russian
ru
nsfw
ad_campaign
monetization
billing
profile-community
listing-alert
contactEmailVerified
```

검색 결과 중 runtime source가 0인지 증명한다.

단순 문자열이 일반 문맥에서 사용되는 경우 false positive를 구분하여 보고한다.

예를 들어 일반적인 `score`라는 변수까지 무조건 제거하지 않는다.

semantic legacy usage 여부를 판단한다.

---

# 최종 검증

최소 아래 전체 실행:

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
npm run build:worker
npm run db:reset:local
```

Bug12에서 critical E2E repeat gate를 만들었다면 그대로 실행한다.

DB audit script가 존재하면 함께 실행한다.

clean-install migration 및 upgrade-path migration 둘 다 검증한다.

---

# Git / Deployment

작업 완료 후:

1. diff 전체 검토
2. unintended deletion 없는지 확인
3. generated artifact 제외
4. tests 전체 green 확인
5. 하나의 명확한 Bug14 commit 또는 논리적으로 필요한 최소 commit으로 정리
6. push
7. production migration이 필요한 경우 migration safety 확인 후 적용
8. deploy
9. production smoke test

사용자에게 명령 실행을 떠넘기지 말고 GitHub/Cloudflare 접근이 가능한 범위는 직접 수행한다.

로컬에서만 가능한 작업이 실제로 필요한 경우에만 정확한 PowerShell 명령을 요청한다.

---

# Bug14 완료 기준

Bug14는 다음이 모두 만족되어야 완료다.

```text
[ ] canonical DB schema가 문서와 일치
[ ] legacy runtime DB access가 제거 또는 명시적 유지됨
[ ] dead table/index/column이 안전하게 정리됨
[ ] applied migration history를 rewrite하지 않음
[ ] clean install migration PASS
[ ] upgrade migration PASS

[ ] source legacy inventory 완료
[ ] 모든 legacy 후보가 분류됨
[ ] REMOVE 결정 concept의 src/** runtime reference = 0
[ ] dead helper/type/API/component 잔해 없음
[ ] 미완성 future scaffold가 불필요하게 남지 않음
[ ] 새로운 compatibility architecture를 만들지 않음

[ ] lint PASS
[ ] typecheck PASS
[ ] unit PASS
[ ] integration PASS
[ ] critical E2E PASS
[ ] build PASS
[ ] worker build PASS

[ ] Bug10 regression 없음
[ ] Bug11 regression 없음
[ ] Bug12 quality gate 유지
```

# 최종 원칙

Bug14의 목적은 RED의 흔적을 지우는 것이 아니다.

**VTH에서 더 이상 의미가 없는 흔적을 지우는 것이다.**

잘 동작하고 단순한 RED-origin 코드는 그대로 둔다.

반대로 기능이 제거됐거나 제품 요구사항에 없는 개념이 runtime source에 남아 있다면, 이름·helper·API·type·test까지 끝까지 추적해서 제거한다.

최종 상태는:

```text
migration history는 history로 남고,
runtime source는 현재 VTH만 설명하며,
DB schema와 source code가 하나의 canonical architecture를 가리킨다.
```

이어야 한다.
