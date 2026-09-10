# Launch 1 — Core User Journey & Product Readiness

## 0. 배경

Bug1~Bug14는 종료된 legacy/architecture/hardening 단계로 취급한다.

Bug14 이후부터는 새로운 제품 개발 체계인 `Launch N`을 사용한다.

Bug14에서 이미 다음 방향으로 수렴했다.

* D1 = canonical persistent state
* Durable Objects / WebSocket = realtime transport/projection only
* R2 = media
* Better Auth = identity/authentication
* social-only login = Facebook / Kakao / Zalo
* user.id = immutable identity
* username = mutable public identifier
* Vietnamese = primary product language
* Korean = host-country language
* English = fallback/developer/international language
* Russian UI = retired
* legacy RED runtime concepts = retired or being fully retired
* no federation
* no generic repository/DAO architecture
* no dual canonical implementation
* no speculative subsystem

Bug14 이후 architecture는 frozen 상태로 취급한다.

Launch 1에서 구조를 다시 설계하지 마라.

---

# 1. Mission

Launch 1의 목표는 새로운 기능을 많이 추가하는 것이 아니다.

처음 방문한 실제 사용자가 VTH에서 핵심 행동을 자연스럽게 완료할 수 있도록 기존 기능을 하나의 일관된 제품으로 연결한다.

핵심 journey:

```text
방문
→ 로그인
→ onboarding
→ Home
→ 콘텐츠 발견
→ 게시글 읽기
→ 좋아요 / 댓글
→ 게시글 작성
→ Q&A 질문/답변
→ 사용자 프로필 확인
→ follow/friend
→ DM
→ Marketplace 탐색
→ Business 탐색
```

이 흐름이 모바일과 데스크톱에서 모두 끊김 없이 작동해야 한다.

Launch 1 종료 기준은:

> 기능이 존재한다가 아니라 실제 신규 사용자가 별도 설명 없이 핵심 흐름을 사용할 수 있다.

---

# 2. 절대 원칙

## 2.1 Architecture Freeze

다음은 금지한다.

* Repository layer 신설
* DAO layer 신설
* generic Service architecture 신설
* FeatureFacade
* compatibility abstraction
* LegacyAdapter
* dual read
* dual write
* 새로운 cache architecture
* 새로운 state-management framework
* 새로운 UI framework
* 새로운 auth system
* 새로운 DB abstraction
* speculative background worker
* 새로운 infrastructure service
* donor project architecture 이식

명백한 제품 문제를 최소 수정으로 해결한다.

---

## 2.2 No Feature Creep

Launch 1에서는 아래 질문을 먼저 한다.

```text
이 기능이 없어서 사용자가 현재 journey를 완료할 수 없는가?
```

아니면 추가하지 않는다.

예:

* 새로운 badge system → 금지
* 새로운 recommendation engine → 금지
* 새로운 payment system → 금지
* group chat → 금지
* advanced business booking extension → 금지
* gamification → 금지
* creator dashboard → 금지

이미 존재하는 기능이 깨졌거나 UX가 불명확한 경우만 수정한다.

---

## 2.3 Canonical Path Only

동일한 행동을 두 가지 방식으로 구현하지 않는다.

예:

```text
post creation
→ canonical createPost

reaction
→ post_likes / comment_likes

DM
→ existing Bug10 canonical path

visibility
→ existing public visibility helper

block
→ existing bilateral block contract
```

Launch 1 편의를 위해 별도 경로를 만들지 않는다.

Bug10/11/12 canonical behavior를 훼손하지 않는다.

---

# 3. Phase 1 — Full Product Journey Audit

코드를 먼저 수정하지 말고 실제 VTH를 사용자처럼 탐색한다.

가능하면 Playwright + 실제 browser behavior를 함께 확인한다.

다음 journey를 순서대로 실행한다.

---

## J1. Anonymous Visitor

검증:

* `/`
* Home
* Popular
* Q&A
* Marketplace
* Business
* public profile
* public post

확인 항목:

* 로그아웃 상태에서 의미 없는 버튼이 노출되는가
* 클릭 후 401/403 raw error가 나오는가
* 로그인해야 하는 행동은 적절히 로그인으로 유도되는가
* 빈 화면이 존재하는가
* loading state가 깨지는가
* navigation이 순환하거나 막히는가
* 모바일에서 메뉴를 찾을 수 있는가

---

## J2. Social Login

Facebook / Kakao / Zalo 로그인 흐름의 코드를 각각 audit한다.

실제 provider credential이 없는 환경에서는 mock/E2E 가능한 부분까지 검증한다.

확인:

```text
login
→ callback
→ account linking
→ new user creation
→ temporary username
→ onboarding decision
→ redirect
```

다음을 방지한다.

* callback loop
* synthetic email 노출
* provider 내부 ID 노출
* username 누락
* onboarding 건너뜀
* onboarding 완료 사용자 재진입
* account linking으로 중복 user 생성

provider별 UX 차이는 최소화한다.

---

# 4. Phase 2 — Onboarding

신규 사용자 onboarding을 Launch 1의 최우선 UX로 취급한다.

검증:

* display name
* username
* avatar
* preferred language
* 최소 필수 정보
* submit
* redirect

목표:

```text
로그인
→ 최대한 짧은 onboarding
→ 바로 Home 사용
```

불필요한 질문을 제거한다.

초기 가입에서 받지 않아도 되는 정보는 settings로 미룬다.

예:

* 과도한 profile 정보
* contact information
* NSFW 관련 옵션
* 세세한 notification 설정
* business 관련 질문

username validation은 명확한 메시지를 제공해야 한다.

Vietnamese 사용자가 영어 개발자 오류 메시지를 보지 않게 한다.

---

# 5. Phase 3 — Navigation / Information Architecture

현재 navigation 전체를 inventory한다.

Desktop / Mobile 각각 확인한다.

핵심 navigation은 사용자가 즉시 찾을 수 있어야 한다.

최소 핵심:

```text
Home
Q&A
Marketplace
Businesses
Messages
Notifications
Profile
```

Popular / Recommended 등은 Home 내부 탭으로 유지 가능한지 검토하되, 새 navigation 구조를 과도하게 만들지 않는다.

검사:

* 동일 목적 링크 중복
* dead navigation
* 빈 page
* 메뉴 이름 불일치
* 모바일에서 숨겨진 핵심 기능
* 뒤로가기로 흐름 깨짐
* login 상태별 잘못된 항목

삭제 가능한 중복 UI는 삭제한다.

---

# 6. Phase 4 — Home / Feed

Home은 Launch 1의 가장 중요한 화면이다.

검증:

```text
Home
Popular
Recommended
```

각 feed가 사용자에게 무엇인지 UI상 이해 가능한지 확인한다.

기능 자체를 재설계하지 않는다.

확인:

* first load
* empty state
* pagination
* cursor
* duplicate posts
* mute
* block
* hidden/removed content
* like count
* comment count
* save state
* translated content
* author/profile link
* community link

게시글 카드에서 사용자가 알아야 할 정보만 보여준다.

legacy UI나 의미 없는 metadata는 제거한다.

모바일에서 카드 폭, 버튼 크기, overflow를 집중 검사한다.

---

# 7. Phase 5 — Post Detail & Creation

## 읽기

확인:

* title
* body
* media
* external link
* author
* community
* timestamps
* likes
* comments
* save
* report
* translation

removed/shadow-hidden/block된 콘텐츠가 canonical visibility contract와 일치해야 한다.

---

## 작성

검증 journey:

```text
Create
→ community 선택
→ title
→ body/link/media
→ submit
→ post detail 또는 feed
```

확인:

* validation message
* duplicate submit
* requestId idempotency
* media ownership
* moderation
* successful redirect
* optimistic UI가 canonical state와 불일치하지 않는지

기존 createPost path를 유지한다.

---

# 8. Phase 6 — Comments & Interaction

검증:

* top-level comment
* reply
* max depth
* delete
* removed comment
* moderation
* block relationship
* like/unlike
* duplicate requests

모바일에서 reply UX가 너무 깊어져 폭이 무너지지 않는지 검사한다.

댓글 기능 확장은 하지 않는다.

---

# 9. Phase 7 — Q&A

Q&A는 VTH의 핵심 제품 pillar다.

현재 필터:

```text
Newest
Unanswered
Answered
Solved
```

를 실제 UX 기준으로 검증한다.

journey:

```text
Q&A 방문
→ 질문 탐색
→ 질문 작성
→ 답변
→ solved 처리
```

확인:

* 일반 community post와 Q&A 구분이 명확한가
* answered / solved 의미가 UI상 명확한가
* unanswered filter 정확한가
* empty state
* 모바일
* URL/share
* author/profile navigation

새 Q&A ranking engine을 만들지 않는다.

---

# 10. Phase 8 — Profiles & Social Relationships

profile에서 확인할 정보:

* avatar
* display name
* username
* bio
* member since
* authored public posts
* relationship controls

이미 제거한 achievement/karma/veteran/cake/NSFW UI를 되살리지 않는다.

profile-community compatibility를 다시 만들지 않는다.

Profile post list는 canonical authored posts를 사용한다.

관계:

```text
Follow
Unfollow
Friend request
Accept
Reject
Remove friend
Block
Mute
```

상태 전이가 UI와 DB에서 동일해야 한다.

block은 기존 bilateral interaction contract를 유지한다.

---

# 11. Phase 9 — DM

Bug10 architecture를 변경하지 않는다.

DM은 regression audit만 한다.

journey:

```text
Profile
→ Message
→ room
→ send
→ reconnect
→ receive
→ read
```

확인:

* blocked user
* DM privacy setting
* existing room
* new room
* refresh
* reconnect
* duplicate send
* unread
* mobile keyboard/layout

Bug10 파일은 명백한 regression이 없으면 수정하지 않는다.

---

# 12. Phase 10 — Notifications

검증:

* comment
* mention
* follow
* friend
* DM
* browser push

확인:

* notification click destination
* already deleted content
* blocked user interaction
* unread/read
* badge count
* mobile

새 notification architecture를 만들지 않는다.

---

# 13. Phase 11 — Marketplace

핵심 journey:

```text
browse
→ search/filter
→ listing detail
→ save
→ seller profile/DM
→ create listing
→ report
```

Listing Alerts는 다시 추가하지 않는다.

검증:

* empty state
* deleted/removed listing
* owner actions
* save state
* media
* contact seller
* mobile

결제/escrow는 Launch 1 범위가 아니다.

---

# 14. Phase 12 — Businesses

유지 대상:

* business directory
* search/filter
* detail
* category/location
* contact
* website
* owner
* verification
* report
* existing booking flow

Business Booking은 이미 evidence-gated retention으로 결정했으므로 Launch 1에서는 재설계하지 않는다.

다만 실제 UI flow가 깨졌는지만 확인한다.

---

# 15. Phase 13 — Settings

Settings 전체를 inventory한다.

현재 실제 기능과 연결되지 않은 control이 없어야 한다.

검증:

* profile
* language
* theme
* DM preference
* notifications
* blocked users
* muted users

Bug14에서 제거한:

* NSFW setting
* contactEmailVerified state
* Russian UI
* achievements
* Pro

관련 UI가 남아 있으면 제거한다.

---

# 16. Phase 14 — Vietnamese-first Product Audit

Vietnamese UI를 primary 기준으로 본다.

전체 핵심 journey에서:

* untranslated English
* developer jargon
* Korean-only UI
* 잘못된 Vietnamese wording
* 지나치게 긴 label
* inconsistent terminology

를 찾는다.

기계적으로 모든 문자열을 다시 번역하지 않는다.

사용자가 실제로 보는 핵심 화면부터 처리한다.

우선순위:

```text
login
onboarding
navigation
home
post
Q&A
DM
marketplace
business
settings
```

English는 fallback으로 유지한다.

Korean도 유지한다.

---

# 17. Phase 15 — Mobile Audit

다음 viewport를 최소 검증한다.

```text
360x800
390x844
430x932
```

핵심 화면:

* Home
* navigation
* create post
* post detail
* comments
* Q&A
* profile
* DM
* marketplace
* business
* settings

검사:

* horizontal overflow
* clipped dialog
* fixed element overlap
* bottom navigation overlap
* keyboard/input issues
* touch target
* unreadable text
* oversized cards
* inaccessible menu

desktop-only visual perfection보다 mobile usability를 우선한다.

---

# 18. Empty / Error / Loading State Audit

각 주요 page/action에서:

```text
loading
empty
success
auth required
403
404
network error
validation error
```

상태를 확인한다.

raw stack trace나 개발자용 DB/API 오류를 사용자에게 노출하지 않는다.

하지만 generic abstraction으로 error system을 다시 만들지는 않는다.

---

# 19. Dead UI Sweep

Launch 1 끝에 UI 중심 dead sweep를 한다.

찾을 것:

* button with no useful action
* hidden obsolete component
* route with no navigation
* navigation to removed subsystem
* stale translation key
* stale feature label
* empty admin control
* duplicate CTA
* impossible state UI

DB archaeology나 대규모 architecture cleanup으로 확대하지 않는다.

---

# 20. Testing

기존 regression suite를 유지한다.

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

DB 변경이 있는 경우에만:

```text
npm run db:reset:local
strict DB audit
clean migration
upgrade migration
```

실제 bug를 발견했을 때 해당 user journey에 regression test를 추가한다.

테스트 수를 늘리는 것 자체를 목표로 하지 않는다.

---

# 21. E2E Journey Tests

최소한 아래 user journey를 통합 E2E 관점에서 보강/확인한다.

### Journey A

```text
new user
→ onboarding
→ Home
→ create post
→ post visible
```

### Journey B

```text
user A post
→ user B comment/like
→ notification
```

### Journey C

```text
user A
→ user B profile
→ follow/friend
→ DM
```

### Journey D

```text
Q&A
→ create question
→ answer
→ solved
```

### Journey E

```text
Marketplace
→ listing
→ save
→ seller contact
```

### Journey F

```text
Business
→ discover
→ detail
→ contact/booking
```

기존 fixture를 최대한 재사용한다.

---

# 22. Complexity Gate

Launch 1 최종 결과에서 반드시 보고한다.

Before / After:

* production runtime files
* routes
* API routes
* major components
* dependencies
* DB objects changed
* new abstractions
* removed dead UI
* known complexity added

Launch 1의 이상적 결과는:

```text
dependencies: +0
infrastructure: +0
generic abstraction: +0
canonical implementations: unchanged
```

이다.

제품 문제 해결을 위해 필요한 작은 코드 증가는 허용한다.

---

# 23. Do Not Touch

명백한 regression이 없는 한 다음은 재설계하지 않는다.

* Bug10 DM architecture
* Bug11 public content visibility
* Bug11 like canonicalization
* Bug12 DB audit framework
* D1 canonical rule
* R2 media ownership
* Better Auth social identity
* Cloudflare deployment structure
* user.id identity semantics

---

# 24. Implementation Strategy

한 번에 모든 화면을 마구 수정하지 않는다.

순서:

```text
Audit
→ Issue Matrix
→ P0 journey blockers
→ P1 major UX
→ P2 polish
→ regression
```

먼저 `Launch 1 Product Readiness Matrix`를 만든다.

필드:

| Area | Journey | Problem | Severity | Evidence | Fix | Test | Status |

Severity:

* P0 = journey 불가능 / data/security/canonical violation
* P1 = 주요 기능을 찾거나 사용하기 어려움
* P2 = polish / wording / visual consistency
* P3 = future idea — Launch 1에서는 구현하지 않음

P0 → P1 → 필요한 P2만 처리한다.

P3는 구현하지 않는다.

---

# 25. Git

Launch 1 작업 전 현재 Bug14 상태를 clean commit/push/deploy하여 baseline을 확정한다.

Launch 1은 Bug14 commit과 섞지 않는다.

작업 완료 후 의미 있는 단위로 commit한다.

최종 commit 예:

```text
feat: complete Launch 1 product readiness
```

또는 실제 변경 성격에 맞는 더 정확한 메시지를 사용한다.

---

# 26. Final Report

최종 보고서는 다음 순서로 작성한다.

## Launch 1 Result

### Journey Status

각 핵심 journey PASS / PARTIAL / FAIL

### P0 Fixed

실제 blocker와 해결 내용

### P1 Fixed

주요 UX 문제

### Removed Dead UI

삭제한 obsolete product surface

### Architecture

새 architecture/infra/dependency가 추가되지 않았음을 명시

### Validation

실행한 모든 test/build 결과

### Production

migration 필요 여부
deploy 결과
smoke test 결과

### Remaining Issues

Launch 1에서 의도적으로 미룬 것

### Recommendation for Launch 2

다음 단계에서 가장 가치가 높은 제품 개선 3~5개만 제시

---

# Final Principle

Launch 1은 VTH를 더 복잡하게 만드는 작업이 아니다.

목표는:

```text
존재하는 기능
→ 연결된 제품
→ 이해 가능한 UX
→ 실제 사용 가능한 서비스
```

로 바꾸는 것이다.

기능 수보다 사용자 journey를 우선한다.

새로운 개념을 추가하기 전에 기존 VTH 기능으로 문제를 해결할 수 있는지 먼저 확인한다.

Bug14까지가 architecture convergence였다면,
Launch 1부터는 product convergence다.

---

# 27. Launch 1 Execution Report

## Launch 1 Result

실제 blocker는 비로그인 `/messages` 접근에서 발견됐다. 서버에서 즉시 `/login`으로 보내고, `/messages?to=<username>` contact intent를 `next`에 보존하도록 수정했다.

## Journey Status

| Journey | Status | Evidence |
|---|---|---|
| Visitor → login → onboarding → Home | PASS | Chromium E2E 및 route smoke |
| Home/feed → post/detail → like/comment | PASS | authenticated Chromium E2E |
| Q&A ask → answer → accept | PASS | Q&A E2E |
| Profile → follow/friend/block | PASS | social E2E |
| Profile/business → DM intent | PASS | guest redirect regression + existing DM coverage |
| Marketplace browse → listing | PASS | marketplace E2E |
| Business browse | PASS | integration coverage + production smoke |
| Mobile chrome and Vietnamese UI | PASS | mobile/authenticated E2E |

로컬 Durable Object 미지원 때문에 production ChatRoom delivery E2E 1개는 환경상 skip됐다. DM history와 API 경로는 테스트했다.

## P0 Fixed

* private `/messages`의 client-only 401 처리 제거
* anonymous contact entry의 redirect intent 보존

## P1 Fixed

이번 audit에서 별도 수정이 필요한 mobile, empty-state, translation, dead-UI blocker는 추가로 발견되지 않았다. 기존 화면과 regression coverage가 요구 journey를 충족했다.

## Architecture

* dependencies: `+0`
* infrastructure: `+0`
* migrations: `+0`
* new generic abstractions: `+0`
* production code change: messages route authorization redirect
* local test fixture change: ephemeral rate-limit events reset

## Validation

* `npm run lint` — pass
* `npm run typecheck` — pass
* `npm test` — 45 unit files / 214 tests, 23 worker files / 134 tests pass
* `npm run test:integration` — 22 files / 130 tests pass
* `npm run test:e2e:chromium` — 35 pass / 1 environment-gated skip
* `npm run build` — pass
* `npm run build:worker` — pass
* `npm run db:audit:local` — foreign keys, drift, orphans all `0`

## Production

DB migration은 필요하지 않았다. Worker deploy 성공:

`1f246d7b-2225-4f2a-ad78-968533e1aade`

Production smoke:

* `https://vth.kr/` — `200`
* `https://vth.kr/questions` — `200`
* `https://vth.kr/marketplace` — `200`
* `https://vth.kr/businesses` — `200`
* `https://developers.vth.kr/` — `200`
* `https://vth.kr/messages?to=bob` — `307` to `/login?next=%2Fmessages%3Fto%3Dbob`

## Remaining Issues

* ChatRoom local development E2E remains environment-gated; production binding is unchanged.
* OpenNext Windows compatibility and existing ChatRoom export warnings remain; no architecture change was introduced to mask them.

## Recommendation for Launch 2

1. Add a production-like ChatRoom E2E environment.
2. Measure real onboarding-to-first-content conversion.
3. Prioritize the highest-friction existing content journey from telemetry.
