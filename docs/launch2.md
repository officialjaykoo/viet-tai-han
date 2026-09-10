# Launch 2 — Product Advantage & Discovery

## 0. 배경

Bug1~Bug14는 architecture convergence / hardening / legacy retirement 단계로 종료됐다.

Launch 1은 Core User Journey & Product Readiness 단계로 종료됐다.

Launch 1 결과:

* Home/feed: PASS
* Post/detail/comment/like: PASS
* Q&A ask/answer/accept: PASS
* Profile/follow/friend/block: PASS
* Marketplace: PASS
* Businesses: PASS
* Mobile chrome/Vietnamese UI: PASS
* DM intent/history/API: PASS
* ChatRoom realtime E2E는 local Durable Object 제약으로 environment-gated skip
* production deployment 및 smoke test 완료
* architecture freeze 유지
* 새 dependency / migration / infrastructure / generic abstraction 없음

Launch 2부터는 “기능이 동작하는가”를 넘어:

> VTH가 왜 일반 Facebook 그룹, 일반 게시판, 단순 중고거래 사이트보다 더 쓸 만한가?

를 제품에 드러내는 단계로 간다.

---

# 1. Mission

Launch 2의 목표는 다음 네 가지 기존 강점을 극대화하는 것이다.

1. Q&A Quality
2. Community Discovery
3. Social Relationship Loop
4. Marketplace / Business Connectivity

핵심 원칙:

```text
새 subsystem을 만든다                  X
새 donor feature를 흡수한다            X
새 architecture를 도입한다             X

기존 VTH 기능을 더 잘 연결한다         O
기존 canonical data를 더 잘 보여준다   O
기존 사용자 journey를 더 강하게 만든다 O
```

Launch 2는 “feature expansion”이 아니라 “product advantage amplification”이다.

---

# 2. Reference Projects 사용 원칙

VTH가 참고한 7개 프로젝트:

* Discourse
* Apache Answer
* Bluesky
* Lemmy
* GoToSocial
* Clonagram
* RED

Launch 2에서는 이 프로젝트들의 architecture나 subsystem을 추가로 가져오지 않는다.

각 프로젝트는 오직 UX/product pattern reference로만 사용한다.

## Discourse

참고할 것:

* 읽기 흐름
* 토론 구조
* 답변 가독성
* 유용한 상태 표시
* navigation clarity

가져오지 말 것:

* plugin ecosystem
* trust level architecture
* 복잡한 moderation hierarchy
* Discourse-specific persistence model

---

## Apache Answer

참고할 것:

* 질문 상태
* 답변 탐색
* accepted answer 강조
* unanswered / solved discovery
* Q&A information density

가져오지 말 것:

* reputation system
* voting architecture
* gamification
* contributor scoring

---

## Bluesky

참고할 것:

* lightweight social navigation
* profile → follow → content 흐름
* author identity visibility
* feed에서 사람 발견

가져오지 말 것:

* federation
* AT Protocol
* custom feed infrastructure
* decentralized identity

---

## Lemmy

참고할 것:

* community discovery
* content → community navigation
* lightweight subscription UX

가져오지 말 것:

* federation
* ActivityPub
* instance architecture

---

## GoToSocial

참고할 것:

* 단순한 relationship state
* 최소 UI
* 명확한 social actions

가져오지 말 것:

* federation
* ActivityPub
* server architecture

---

## Clonagram

참고할 것:

* simple media posting
* lightweight social profile UX
* low-friction content consumption

가져오지 말 것:

* Instagram clone behavior
* media-first product redesign

---

## RED

참고할 것:

* community / post / comment structure
* content hierarchy

가져오지 말 것:

* karma
* achievements
* cake day
* profile community
* Reddit-specific voting/ranking
* old compatibility patterns

Bug14에서 제거한 RED legacy concept은 다시 만들지 않는다.

---

# 3. Architecture Freeze

Launch 2에서도 architecture freeze를 유지한다.

다음은 금지한다.

* Repository
* DAO
* generic Service layer
* FeatureFacade
* compatibility adapter
* donor abstraction
* new cache architecture
* new queue
* new worker
* new DO
* new database abstraction
* new state-management library
* new UI framework
* new recommendation engine
* new search infrastructure
* new analytics platform
* new reputation system

기존 기능을 연결하기 위해 필요한 최소 query / helper / component 수정만 허용한다.

---

# 4. Dependency / Infrastructure Gate

Launch 2 목표:

```text
Dependencies: +0
Infrastructure: +0
Durable Objects: +0
Workers: +0
Databases: +0
Generic abstractions: +0
```

정말 필요한 경우가 아니면 migration도 +0을 목표로 한다.

DB 변경 없이 기존 canonical data로 해결 가능한지 먼저 확인한다.

---

# 5. Phase A — Product Advantage Audit

구현 전에 현재 VTH를 audit한다.

다음 네 축을 기준으로 Product Advantage Matrix를 만든다.

| Area | Current Strength | Missing Connection | User Impact | Proposed Minimal Change | Complexity | Decision |
| ---- | ---------------- | ------------------ | ----------- | ----------------------- | ---------- | -------- |

네 영역:

* Q&A
* Communities
* Social/Profile
* Marketplace/Business

각 항목은 다음으로 분류한다.

### P0

기존 기능 연결이 끊겨 핵심 advantage가 사라짐.

### P1

사용자가 존재하는 기능을 발견하거나 이해하기 어려움.

### P2

정보 구조/시각 강조 개선으로 advantage를 더 잘 보여줄 수 있음.

### P3

새 기능 아이디어.

P3는 Launch 2에서 구현하지 않는다.

---

# 6. Advantage 1 — Q&A Quality

Launch 2의 가장 높은 우선순위다.

VTH에서 Q&A의 목적:

```text
한국 생활 문제
→ 질문
→ 답변
→ 해결
→ 나중에 다른 사용자도 검색/발견
```

Q&A는 단순 post category처럼 보여서는 안 된다.

---

## 6.1 Question State Clarity

현재 상태:

* unanswered
* answered
* solved

각 상태가 목록과 상세에서 명확하게 구분되는지 확인한다.

사용자가 질문을 열기 전에 상태를 이해할 수 있어야 한다.

최소 정보:

```text
질문 제목
상태
답변 수
작성 시점
community/category
```

불필요한 metadata는 늘리지 않는다.

---

## 6.2 Accepted Answer Visibility

accepted answer가 있을 경우:

* 일반 답변과 명확히 구분
* 질문 상세에서 찾기 쉬움
* 과도한 색상/배지 남발 금지
* accepted 상태가 mobile에서도 명확해야 함

accepted answer를 별도 duplicate content로 렌더링하지 않는다.

canonical answer row를 그대로 사용한다.

---

## 6.3 Answer Ordering

현재 canonical ordering을 확인한다.

accepted answer가 존재한다면 사용자가 자연스럽게 발견할 수 있도록 한다.

새 ranking engine을 만들지 않는다.

필요하면 UI-level ordering 또는 기존 query 최소 수정만 허용한다.

---

## 6.4 Q&A Discovery

현재:

* Newest
* Unanswered
* Answered
* Solved

각 필터가 실제 사용 가치가 있는지 검증한다.

특히:

```text
Unanswered
Solved
```

두 필터는 명확하게 작동해야 한다.

빈 결과일 때:

```text
아무 것도 없음
```

으로 끝내지 말고 사용자가 다음 행동을 이해할 수 있는 empty state를 제공한다.

새 recommendation system은 만들지 않는다.

---

## 6.5 Related Content

질문 상세에서 이미 존재하는 search/tag/community 데이터를 이용해 다른 관련 질문을 자연스럽게 발견할 수 있는지 audit한다.

조건:

* 기존 데이터로 가능할 때만 구현
* semantic embedding 금지
* vector DB 금지
* AI recommendation 금지
* 새 ranking subsystem 금지

간단한:

```text
same community
shared keyword
same category
```

수준으로 충분하면 그것만 사용한다.

복잡도가 커지면 구현하지 않는다.

---

## 6.6 Question Creation

Ask flow에서 사용자가 일반 post 작성과 혼동하지 않는지 확인한다.

질문 작성 화면은:

```text
무엇을 묻는지
어디에 질문되는지
등록 후 무엇이 일어나는지
```

가 명확해야 한다.

필드를 늘리지 않는다.

---

# 7. Advantage 2 — Community Discovery

VTH는 Reddit/Lemmy처럼 community가 있지만 사용자가 처음부터 community 구조를 이해할 필요는 없다.

목표:

```text
Feed
→ 좋은 콘텐츠 발견
→ 해당 community 발견
→ community 방문
→ 필요하면 subscribe
```

이다.

---

## 7.1 Feed → Community

Post card/detail에서:

* community 이름이 명확하게 보이는지
* community로 이동 가능한지
* 클릭 영역이 혼란스럽지 않은지
* author link와 community link가 구분되는지

확인한다.

---

## 7.2 Community Page

community 방문 시 최소한 다음이 명확해야 한다.

* 이름
* 설명
* subscribe 상태
* 관련 posts
* post 작성 진입점

subscriber count 같은 숫자가 실제 의사결정에 도움이 되지 않으면 과도하게 강조하지 않는다.

---

## 7.3 Subscribe Flow

subscribe/unsubscribe:

* 즉시 상태 변화 확인
* refresh 후 유지
* 로그인 요구 명확
* mobile에서 쉽게 조작
* duplicated CTA 없음

새 subscription architecture는 만들지 않는다.

---

## 7.4 Community Discovery Surface

현재 navigation/home/search 안에서 community를 발견할 수 있는 경로를 audit한다.

새 대형 discovery page를 만들기 전에 기존 UI로 해결 가능한지 먼저 본다.

가능하면:

```text
Home content
Search
Post metadata
Profile activity
```

에서 community를 발견하게 한다.

---

# 8. Advantage 3 — Social Relationship Loop

목표:

```text
좋은 콘텐츠
→ 작성자 발견
→ profile
→ follow/friend
→ 새 콘텐츠 발견
→ 필요하면 DM
```

기존 social 기능을 하나의 loop로 연결한다.

---

## 8.1 Author Identity

Feed/post/Q&A에서 author identity가 너무 약하거나 너무 강하지 않은지 본다.

필요 정보:

* avatar
* display name
* username/handle 필요 시
* profile link

다시 karma/badge/veteran/reputation을 넣지 않는다.

---

## 8.2 Profile

Profile에서 다음이 명확해야 한다.

* 누구인지
* 어떤 공개 글을 썼는지
* follow/friend 상태
* DM 가능 여부

profile-community compatibility는 다시 만들지 않는다.

author_id 기반 canonical post list를 사용한다.

---

## 8.3 Relationship State

다음 상태가 사용자에게 혼동 없이 보이는지 확인한다.

```text
Follow
Following

Add friend
Request sent
Accept
Friends

Block
Blocked

Mute
Muted
```

동일 관계에 여러 버튼이 동시에 뜨지 않아야 한다.

---

## 8.4 Content → Profile → Relationship

Feed/post/Q&A에서 profile로 이동한 뒤 follow/friend가 자연스럽게 이어지는지 E2E로 검증한다.

특히 Q&A:

```text
좋은 답변
→ 답변자 profile
→ follow
```

흐름을 확인한다.

---

## 8.5 Profile → DM

DM 가능 조건이 충족되면 Message CTA를 명확하게 제공한다.

불가능한 경우:

* 버튼을 숨기거나
* 명확한 상태 표시

둘 중 기존 UX와 일관된 최소 방법을 사용한다.

Bug10 canonical DM permission을 우회하지 않는다.

---

# 9. Advantage 4 — Marketplace / Business Connectivity

VTH의 commerce 기능은 독립 서비스처럼 고립되지 않아야 한다.

목표:

```text
Listing
→ seller profile
→ DM

Business
→ owner/profile/contact
→ 필요하면 booking
```

이다.

---

## 9.1 Marketplace Seller Identity

Listing detail에서 seller identity가 명확한지 확인한다.

가능한 행동:

* profile 보기
* DM/contact

새 rating/reputation system 금지.

seller score/karma 금지.

---

## 9.2 Listing → Social

사용자가 판매자를 확인하고 연락하는 흐름:

```text
listing
→ seller
→ profile
→ message
```

을 검증한다.

불필요한 중간 화면을 추가하지 않는다.

---

## 9.3 Business Discovery

Business 목록/상세에서:

* 이름
* category
* location
* verification
* contact
* website
* owner
* booking

중 실제 의사결정에 필요한 정보의 우선순위를 정리한다.

정보를 더 넣는 것이 아니라 중요한 정보를 더 잘 보여준다.

---

## 9.4 Business → Owner

Business owner가 실제 VTH user라면 profile/contact로 자연스럽게 이동 가능한지 확인한다.

새 business-social relation table을 만들지 않는다.

이미 존재하는 owner_id를 사용한다.

---

## 9.5 Booking

Booking은 Launch 1에서 유지가 정당화됐다.

Launch 2에서는 기능 확장을 하지 않는다.

검증:

```text
business detail
→ booking entry
→ select service/time
→ submit
→ status 확인
```

existing behavior만 polish한다.

---

# 10. Cross-Domain Connections

Launch 2에서 가장 중요한 부분이다.

새 기능보다 기존 영역 사이의 연결을 audit한다.

다음 연결을 각각 확인한다.

---

## Q&A → Profile

답변 작성자의 profile에 쉽게 갈 수 있어야 한다.

---

## Q&A → Community

질문이 속한 community를 쉽게 발견할 수 있어야 한다.

---

## Feed → Community

post에서 community discovery 가능.

---

## Feed → Profile

author discovery 가능.

---

## Profile → Posts

해당 사용자의 canonical public posts 표시.

---

## Profile → DM

permission 조건이 맞으면 연결.

---

## Marketplace → Profile

seller identity 확인 가능.

---

## Marketplace → DM

seller contact 가능.

---

## Business → Owner/Profile

owner identity가 있으면 연결.

---

## Business → Contact/Booking

핵심 CTA가 명확해야 한다.

---

# 11. Search Audit

Launch 2에서는 새 search engine을 만들지 않는다.

기존 search가 다음을 얼마나 연결하는지 확인한다.

* posts
* Q&A
* communities
* users
* marketplace
* businesses

모든 entity를 반드시 하나의 global search로 합칠 필요는 없다.

먼저 현재 search UX가 사용자를 막는지 본다.

필요하면:

* result labels
* result grouping
* entity type clarity
* navigation

정도만 개선한다.

새 search backend / FTS architecture / vector search는 금지한다.

---

# 12. Home / Discovery Audit

Home에서 사용자가 VTH의 강점을 발견할 수 있는지 본다.

Home이 단순 post list로 끝나지 않아야 한다.

단, 대시보드처럼 복잡하게 만들지 않는다.

확인:

* Q&A 발견 가능성
* community 발견 가능성
* authors/profile 발견 가능성
* marketplace/business navigation
* Popular/Recommended 의미

필요하면 작은 CTA/section/link를 추가할 수 있다.

대형 홈 재설계는 금지한다.

---

# 13. Vietnamese-first Audit

Launch 2의 모든 변경은 Vietnamese UI를 primary로 검증한다.

특히 다음 용어는 일관성을 본다.

* 질문
* 답변
* 해결됨
* 미답변
* community
* follow
* friend
* message
* marketplace
* business
* booking
* verification

Vietnamese / Korean / English 간 의미가 어긋나지 않아야 한다.

새 locale은 추가하지 않는다.

---

# 14. Mobile-first Audit

각 advantage flow를 mobile에서 검증한다.

최소 viewport:

```text
360x800
390x844
430x932
```

핵심 확인:

* Q&A state labels
* accepted answer
* community link
* author/profile CTA
* follow/friend buttons
* Message CTA
* listing seller/contact
* business contact/booking

버튼이 한 줄에 너무 많이 몰리지 않게 한다.

---

# 15. ChatRoom Warning / Runtime Verification

Launch 1에서 environment-gated skip된 ChatRoom realtime path는 Launch 2 초반에 별도 확인한다.

목표는 architecture 변경이 아니다.

Production 또는 Durable Object 지원 환경에서:

```text
User A
→ User B에게 room 생성
→ send
→ B receive
→ refresh
→ reconnect
→ missed message catch-up
→ read boundary
```

를 검증한다.

또한 build/deploy 시 반복되는 CHAT_ROOM export warning을 분류한다.

결과를 다음 중 하나로 명확히 분류한다.

### A. Harmless tooling warning

실제 DO export/binding/runtime 정상.

→ 기록하고 종료.

### B. Configuration warning

minimal config 수정으로 해결 가능.

→ 수정.

### C. Runtime defect

실제 DM realtime failure.

→ Launch 2 P0 blocker로 수정.

Bug10 architecture를 재설계하지 않는다.

---

# 16. Existing Warning Triage

다음 warning을 분류한다.

* OpenNext Windows warning
* CHAT_ROOM export warning
* Playwright remote-dev auth warning
* duplicate options generated bundle warning

목표:

```text
warning count = 0
```

가 아니다.

목표:

```text
unexplained warning = 0
```

이다.

각 warning에:

* source
* runtime impact
* action
* disposition

을 기록한다.

upstream/generated warning을 억지로 patch하지 않는다.

---

# 17. UI Simplification

Launch 2는 advantage를 강화하면서 UI를 더 복잡하게 만들면 실패다.

각 변경 후 확인:

* CTA 증가했는가?
* button 수가 늘었는가?
* metadata가 늘었는가?
* 같은 action이 중복 노출되는가?
* mobile density가 악화됐는가?

가능하면:

```text
새 UI 추가
```

보다:

```text
기존 UI 우선순위 재배치
기존 링크 강화
dead UI 제거
```

를 선호한다.

---

# 18. No Gamification Rule

다음은 다시 추가하지 않는다.

* karma
* score
* reputation
* achievements
* badges
* veteran
* cake day
* leaderboard
* user level
* answer points
* seller rating points

신뢰는:

```text
verified business
accepted answer
real profile/activity
moderator/admin role
```

같은 실제 canonical evidence로 표현한다.

---

# 19. No AI-first Rule

Launch 2에서는 AI feature를 제품 전면에 추가하지 않는다.

기존 translation은 유지한다.

다음은 금지:

* AI answer generation
* AI recommendation
* AI auto moderation redesign
* AI semantic search
* AI profile scoring
* AI business ranking

실제 사용자 데이터가 쌓인 후 다시 판단한다.

---

# 20. Testing Strategy

기존 tests를 유지한다.

필수:

```text
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
npm run build:worker
```

DB 변경이 있을 때만:

```text
npm run db:reset:local
strict DB audit
clean migration
upgrade migration
```

새 테스트는 실제 Launch 2에서 발견된 regression 위험을 방지할 때만 추가한다.

test count 자체를 목표로 하지 않는다.

---

# 21. Launch 2 E2E Advantage Journeys

다음 journey를 반드시 확인한다.

## Journey A — Q&A Knowledge Loop

```text
User A
→ question 생성
→ User B answer
→ User A accept
→ solved 표시
→ 다른 사용자가 solved question 발견
```

PASS 조건:

* state 정확
* accepted answer 명확
* permissions 정확
* mobile 정상

---

## Journey B — Content → Community

```text
Home
→ post
→ community
→ subscribe
→ refresh
→ state 유지
```

---

## Journey C — Content → Social

```text
Home/Q&A
→ author profile
→ follow
→ relationship state 변경
→ refresh
```

---

## Journey D — Social → DM

```text
profile
→ Message
→ existing/new room
→ send
→ receive
```

DO 지원 환경에서는 realtime까지 검증한다.

---

## Journey E — Marketplace Contact

```text
listing
→ seller profile
→ message
```

---

## Journey F — Business Connection

```text
business list
→ detail
→ owner/contact
→ booking entry
```

---

# 22. Performance Guard

Launch 2에서 연결 강화를 이유로 N+1 query를 만들지 않는다.

각 주요 page에서:

* 새로운 per-item DB query
* 반복 relationship lookup
* 반복 profile lookup

이 추가됐는지 확인한다.

가능하면 기존 query projection에 최소 필드만 추가한다.

성능 최적화를 위한 별도 cache/system은 추가하지 않는다.

---

# 23. Security / Privacy Guard

연결이 많아질수록 다음이 깨지지 않아야 한다.

* block
* mute
* visibility
* banned/shadow-hidden content
* DM permission
* private state
* removed listing/business
* ownership
* moderation

UI shortcut 때문에 canonical permission check를 우회하지 않는다.

---

# 24. Complexity Gate

Launch 2 종료 시 반드시 보고한다.

### Added

* files
* routes
* API
* dependencies
* migrations
* DB objects
* abstractions

### Removed

* dead UI
* duplicate CTA
* obsolete helpers
* stale translation keys

### Expected

```text
dependencies +0
infra +0
generic abstraction +0
new canonical subsystem +0
```

Launch 2의 성공은 코드량 증가가 아니다.

---

# 25. Product Advantage Scorecard

Launch 2 종료 시 각 항목을 0~5로 평가한다.

| Area                        | Before | After |
| --------------------------- | -----: | ----: |
| Q&A clarity                 |        |       |
| Q&A discovery               |        |       |
| Community discovery         |        |       |
| Content → Profile           |        |       |
| Social relationship clarity |        |       |
| Profile → DM                |        |       |
| Marketplace → Seller        |        |       |
| Business → Contact          |        |       |
| Mobile usability            |        |       |
| Vietnamese clarity          |        |       |

점수 상승 근거를 실제 UI/journey evidence와 함께 기록한다.

근거 없는 “개선됨” 판정은 금지한다.

---

# 26. Implementation Order

다음 순서를 유지한다.

```text
1. Audit only
2. Product Advantage Matrix 작성
3. CHAT_ROOM/runtime warning triage
4. Q&A
5. Community discovery
6. Social/profile loop
7. Marketplace/business connectivity
8. Search/Home 연결 audit
9. Vietnamese/mobile audit
10. Dead UI sweep
11. Full regression
12. Production deploy
13. Smoke/journey verification
```

처음부터 모든 영역을 동시에 수정하지 않는다.

---

# 27. Git / Deployment

Launch 1 production deployment를 baseline으로 삼는다.

Launch 2 변경은 Launch 1 commit과 섞지 않는다.

작업 완료 후:

```text
lint
typecheck
unit
integration
E2E
build
build:worker
```

통과 후 commit/push/deploy한다.

DB migration이 없다면 production DB 변경은 하지 않는다.

배포 후 최소 smoke:

```text
/
questions
marketplace
businesses
profile
messages
```

핵심 authenticated journeys도 가능한 범위에서 검증한다.

---

# 28. Exit Criteria

Launch 2는 다음 조건을 모두 만족해야 종료한다.

### Q&A

* 질문 상태 명확
* accepted answer 명확
* solved/unanswered discovery 정상

### Community

* feed/post에서 community 발견 가능
* subscribe flow 정상

### Social

* content → profile 자연스러움
* follow/friend state 명확
* profile → DM 자연스러움

### Marketplace

* seller identity/contact 자연스러움

### Business

* owner/contact/booking 진입이 명확

### Runtime

* CHAT_ROOM warning disposition 확정
* 설명되지 않은 warning 0

### Architecture

* architecture freeze 유지
* dependency +0 목표 충족
* new subsystem 없음

### Quality

* full regression PASS
* production deploy PASS
* production smoke PASS

---

# 29. Out of Scope

Launch 2에서 하지 않는다.

* 새로운 donor feature absorption
* payment
* escrow
* group chat
* calling
* federation
* reputation
* badges
* achievements
* ads
* Pro
* billing
* AI recommendation
* vector search
* advanced analytics
* creator dashboard
* business rating
* seller rating
* push architecture redesign
* notification architecture redesign
* feed ranking redesign
* DM architecture redesign
* database refactor
* large cleanup

---

# 30. Final Report Format

Launch 2 종료 보고서는 아래 형식을 사용한다.

## Launch 2 Result

### Product Advantage Matrix

Before / After

### Q&A

수정 내용 + journey result

### Community Discovery

수정 내용 + journey result

### Social Loop

수정 내용 + journey result

### Marketplace / Business Connectivity

수정 내용 + journey result

### Runtime Warning Triage

각 warning disposition

### Architecture

추가 dependency / infra / abstraction 여부

### Validation

lint / typecheck / unit / integration / E2E / build 결과

### Production

deploy version
smoke 결과

### Remaining Issues

Launch 3 후보만 기록

### Launch 3 Recommendation

실제 Launch 2 결과에 근거해 가장 가치 높은 다음 단계 3~5개만 제안한다.

Launch 3를 미리 구현하지 않는다.

---

# Final Principle

Launch 2의 목적은 VTH에 더 많은 기능을 넣는 것이 아니다.

목표는:

```text
Q&A가 있다
→ Q&A가 강하다

community가 있다
→ community를 자연스럽게 발견한다

profile/follow/DM이 있다
→ 사람과 관계가 자연스럽게 연결된다

marketplace/business가 있다
→ 사람과 거래/서비스가 자연스럽게 연결된다
```

로 바꾸는 것이다.

7개 reference project의 장점은 “더 가져오는 것”이 아니라 “이미 VTH에 흡수된 좋은 패턴을 더 잘 보이게 만드는 것”으로 사용한다.

Launch 2가 끝났을 때 VTH는 기능이 많은 서비스가 아니라:

> 한국에 사는 베트남인이 질문하고, 정보를 발견하고, 사람을 찾고, 관계를 만들고, 거래와 지역 서비스를 연결할 수 있는 하나의 제품

으로 보여야 한다.

---

# 31. Launch 2 Execution Report

## Launch 2 Result

Launch 2는 새 subsystem을 추가하지 않고, 기존 canonical link와 상태 표시를 강화했다.

## Product Advantage Matrix

점수는 analytics가 아닌 실제 UI와 journey evidence 기반의 audit score다.

| Area | Before | After | Evidence |
|---|---:|---:|---|
| Q&A clarity | 2 | 4 | unanswered/answered/solved 상태와 accepted answer가 목록/상세에서 구분됨 |
| Q&A discovery | 3 | 3 | 기존 filter/query를 유지하고 새 ranking은 추가하지 않음 |
| Community discovery | 4 | 4 | feed card, community page, subscribe flow가 이미 연결되어 regression으로 확인 |
| Content → Profile | 3 | 4 | Q&A question/answer author와 marketplace/business owner가 canonical profile로 연결됨 |
| Social relationship clarity | 4 | 4 | 기존 follow/friend/block/mute/DM state 유지 |
| Profile → DM | 4 | 4 | 기존 permission gate와 `/messages?to=` intent 유지 |
| Marketplace → Seller | 3 | 4 | listing seller identity가 profile과 message CTA로 연결됨 |
| Business → Contact | 3 | 4 | business owner profile/message CTA와 booking entry 유지 |
| Mobile usability | 3 | 4 | 390×844 Q&A state/link/overflow E2E pass |
| Vietnamese clarity | 4 | 4 | 기존 locale key만 재사용하고 새 locale은 추가하지 않음 |

## Q&A

* 목록에 `Chưa trả lời`, `Đã trả lời`, `Đã giải quyết` 상태를 명시했다.
* 질문 목록의 community와 author를 canonical `/r/:name`, `/u/:username`으로 연결했다.
* 질문 상세의 author와 answer author를 profile로 연결했다.
* accepted answer는 기존 answer row를 그대로 사용했다.

Journey A: PASS. 질문 생성 → 답변 → accept → solved → 상세 발견을 기존 E2E로 검증했다.

## Community Discovery

새 화면이나 subsystem은 추가하지 않았다. 기존 post card의 community link, community page의 subscribe/create CTA를 유지하고 subscribe → refresh 상태 보존 E2E를 추가해 검증했다.

Journey B: PASS.

## Social Loop

Feed/post의 기존 author link와 profile relationship action은 유지했다. Q&A author link를 보강해:

`Q&A → profile → follow/friend/DM`

경로가 끊기지 않도록 했다.

Journey C: PASS.

## Marketplace / Business Connectivity

* marketplace listing card/detail의 seller identity를 profile로 연결했다.
* listing detail의 기존 message seller CTA를 유지했다.
* business list/detail의 owner identity를 profile로 연결했다.
* business detail의 기존 message owner와 booking entry를 유지했다.

Journeys E/F: PASS locally. Production business directory smoke는 `200`이나 현재 production dataset에는 verified business row가 없어 detail route는 local seeded E2E로 검증했다.

## Runtime Warning Triage

| Warning | Source | Runtime impact | Disposition |
|---|---|---|---|
| OpenNext Windows compatibility | OpenNext build tooling | deployment succeeds; WSL remains recommended | record only |
| CHAT_ROOM export warning | OpenNext/Wrangler generated build | `src/worker.ts` exports `ChatRoom`; production unauthenticated WebSocket probe reaches `401`, not `503` | tooling warning; no architecture change |
| Playwright remote-dev auth warning | local E2E environment | test-only | record only |
| duplicate `options` keys | generated OpenNext bundle | no observed route failure | generated warning; do not patch output |

Authenticated production ChatRoom send/receive/reconnect was not executed because production E2E session injection is intentionally disabled. Local runtime remains environment-gated by Durable Object support.

## Architecture

* dependencies: `+0`
* infrastructure: `+0`
* Durable Objects: `+0`
* Workers: `+0`
* databases/migrations: `+0`
* generic abstractions: `+0`
* new recommendation/search/ranking systems: `+0`

## Validation

* `npm run lint` — pass
* `npm run typecheck` — pass
* `npm test` — 45 unit files / 214 tests, 23 worker files / 134 tests
* `npm run test:integration` — 22 files / 130 tests
* `npm run test:e2e:chromium` — 38 pass / 1 environment-gated skip
* targeted Q&A journey — pass
* targeted community/marketplace/business journeys — 3 pass
* mobile Q&A journey — 1 pass
* `npm run build` — pass
* `npm run build:worker` — pass
* `npm run db:audit:local` — foreign keys, drift, and orphans all `0`

## Production

DB migration은 필요하지 않았다. Worker deploy 성공:

`66bce51a-e361-460f-bf74-40555073df60`

Production smoke:

* `/` — `200`
* `/questions` — `200`
* `/questions/bBPh1e_7Yqw` — `200`
* `/r/life` — `200`
* `/marketplace` — `200`
* `/marketplace/X9RKKmzoVjP` — `200`
* `/u/master` — `200`
* `/businesses` — `200`
* `/messages?to=mira` — `307`
* `developers.vth.kr/` — `200`
* unauthenticated `/api/messages/realtime` WebSocket probe — `401`

## Remaining Issues

* Authenticated production ChatRoom realtime journey still needs a production-like E2E session.
* Production business data is empty, so business detail/owner/booking smoke uses local seeded data.
* Existing generated OpenNext/Wrangler warnings remain documented and unexplained-warning count is otherwise zero.

## Launch 3 Recommendation

1. Add a safe production-like ChatRoom E2E environment.
2. Seed or onboard verified business data before measuring business conversion.
3. Measure Q&A discovery and seller/contact conversion before adding more UI.
