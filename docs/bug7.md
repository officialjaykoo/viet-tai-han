# bug7.md — Profile / Settings / Social Identity Integrity + Clonagram Comparative Hardening

## 목적

Việt tại Hàn의 **Profile / Settings / Social Identity / Relationship / Privacy 영역을 실제 최신 코드 기준으로 전면 점검하고 수정하라.**

이번 작업의 목적은 UI 재디자인이나 기능 추가가 아니다.

목표는 다음이다.

* correctness
* server/client 상태 일관성
* immutable identity 보장
* social-first authentication 일관성
* profile/privacy/relationship state machine 무결성
* block/unblock correctness
* avatar/media ownership 보안
* settings mutation 신뢰성
* 모바일 UX
* 회귀 테스트
* race/idempotency 방어

이번 bug7에서는 공개 프로젝트 **`zivavu/Clonagram`** 의 profile/follow/privacy 구현을 참고 대상으로 사용한다.

단:

> **Clonagram을 VTH에 합치거나 그대로 복사하지 마라.**

VTH가 본체다.

Clonagram은 다음을 확인하기 위한 비교 구현이다.

* 우리가 놓친 상태가 있는가
* profile/social graph UX가 더 명확한 부분이 있는가
* state transition을 더 단순하게 표현하는 방법이 있는가
* 테스트해야 할 edge case가 더 있는가

---

# 0. 시작 조건 — bug6 완료본에서 작업

이 문서는 bug6 이전 코드 기준으로 적용하지 마라.

반드시 먼저:

1. 최신 `main`을 확인
2. bug6 변경사항을 읽음
3. bug6에서 이미 해결된 항목을 확인
4. 같은 문제를 다시 다른 방식으로 구현하지 않음
5. bug6가 만든 API/helper/test와 중복되는 새 abstraction을 만들지 않음

bug6와 이 문서가 충돌하면:

> **최신 코드의 더 강한 invariant를 유지한다.**

단순히 문서대로 기계적으로 되돌리지 마라.

---

# 1. 절대 유지할 VTH 원칙

다음은 변경 불가다.

* 로그인은 **social-first**
* email/password 로그인 재도입 금지
* Facebook / Kakao / Zalo 구조 유지
* `contactEmail`은 로그인 identity가 아니라 선택적 연락처
* immutable internal identity = `user.id`
* public mutable handle = `username`
* 관계/차단/메시지/notification 내부 FK는 가능한 한 `user.id`
* public URL/display에서만 username 사용
* Better Auth authoritative
* `allowUnlinkingAll: false` 유지
* `/i/api`
* `apiFetch`
* signed request
* tunnel/PoW
* 기존 security path 우회 금지
* username history/cooldown/old URL redirect 유지
* D1 = canonical relational state
* R2 media ownership 보장
* 기존 Cloudflare architecture 유지

---

# 2. Clonagram 사전 비교 — 구현 전 반드시 수행

코드를 수정하기 전에 Clonagram의 현재 구현을 직접 읽어라.

최소 비교 대상:

```text
src/actions/follow/followUser.ts
src/actions/follow/unfollowUser.ts
src/actions/follow/cancelFollowRequest.ts
src/actions/follow/getFollowStatus.ts
src/queries/followStatus.ts

src/actions/profile/updateProfile.ts
src/actions/profile/updateAvatar.ts
src/actions/profile/getUserProfileWithPosts.ts

관련 follow/profile/privacy UI
관련 E2E:
- follow.spec.ts
- auth.spec.ts
- notifications.spec.ts
- direct-messages.spec.ts
```

비교 결과를 구현 전에 내부적으로 다음 네 등급으로 분류하라.

```text
A. VTH가 이미 더 강함 → VTH 유지
B. Clonagram 방식이 더 단순하고 정확함 → VTH식으로 흡수
C. 아이디어는 좋지만 Supabase 의존 → VTH architecture로 재구현
D. VTH와 정책/architecture가 다름 → 가져오지 않음
```

---

# 3. Clonagram에서 적극 참고할 패턴

## 3.1 관계 mutation은 user ID 기반

Clonagram처럼 relationship target은 username이 아니라 immutable user ID를 사용한다.

VTH에서도:

```text
follow
unfollow
friend
friend request
block
unblock
privacy relationship checks
```

의 canonical mutation key가 `user.id`인지 전부 확인한다.

username은 display/navigation 용도로만 사용한다.

---

## 3.2 relationship state를 명시적으로 표현

Clonagram은 follow 상태를 개념적으로:

```text
none
requested
following
```

으로 구분한다.

VTH에서도 boolean 여러 개를 조합해 암묵적으로 상태를 추론하는 코드가 있다면 정리한다.

VTH의 실제 정책에 맞는 explicit state를 사용하라.

예:

```text
follow:
none
pending
following

friend:
none
outgoing_pending
incoming_pending
friends

block:
none
blocked_by_me
blocked_by_peer
```

단, 기존 DB schema를 무조건 이 enum으로 뜯어고치라는 뜻은 아니다.

**service/API가 반환하는 canonical state projection을 명확하게 하라.**

클라이언트가 여러 boolean을 가지고 상태기계를 재구성하지 않게 한다.

---

## 3.3 avatar는 일반 profile save와 분리

Clonagram처럼 avatar update와 일반 profile update의 lifecycle을 분리하는 접근을 참고한다.

VTH 권장 semantics:

```text
username/name/bio
→ 일반 Profile PATCH

avatar
→ 별도 avatar mutation
→ 선택/업로드 후 즉시 저장
```

이 구조를 사용하면:

* unrelated validation 영향 감소
* avatar ownership 검사 명확
* R2 orphan 감소
* session/header/profile 동기화 단순화

가 가능하다.

---

## 3.4 서버 validation 후 canonical refresh

Profile/relationship mutation 성공 후:

* 서버 state
* route/server component
* client projection
* session/header projection

이 서로 다르게 남지 않도록 한다.

필요한 경우 정확한:

```text
router.refresh()
session refresh/invalidation
cache revalidation
```

을 사용한다.

무조건 전체 페이지 reload로 숨기지 마라.

---

# 4. Clonagram에서 가져오지 말 것

다음은 VTH에 이식하지 마라.

## 4.1 Supabase architecture

금지:

```text
Supabase Auth
Supabase RLS를 VTH authorization 대체물로 사용
Supabase Storage
Supabase Realtime
Supabase Postgres-specific logic
```

VTH는 계속:

```text
Better Auth
D1
R2
Durable Objects
Workers
```

를 사용한다.

---

## 4.2 email/password 흐름

Clonagram의:

* email signup
* password reset
* email/password identity

는 참고 대상이 아니다.

VTH에 추가하지 마라.

---

## 4.3 follow → DM 자동 승격을 bug7에 복사하지 마라

Clonagram에는 follow mutation이 기존 DM request/primary folder 상태에 영향을 주는 coupling이 있다.

이 아이디어 자체는 VTH의:

```text
friend
follow
DM direct eligibility
message request
```

정책과 관련 있으므로 기록하되,

**bug7에서 DM state machine을 다시 설계하지 마라.**

DM promotion/realtime/request reconciliation은 **bug8에서 처리한다.**

bug7에서는 오직:

> 현재 VTH 정책상 relationship 변경 후 새 DM authorization 결과가 정확한가

까지만 검증한다.

---

## 4.4 private profile authorization을 client에 맡기지 마라

Clonagram의 profile query 구현을 그대로 복사하지 마라.

VTH에서는 private/blocked/visibility 관련 정책을:

```text
server loader
service
query authorization
```

단에서 적용한다.

UI에서 숨기는 것만으로 보안을 구현하지 마라.

---

# P0 — 반드시 먼저 수정

# 5. OAuth account-link callback error 유실

관련:

```text
src/app/settings/page.tsx
src/components/settings/...
```

bug6 이후 최신 구조에서 다시 확인한다.

OAuth/link callback error가:

```text
URL
→ Settings server page
→ account settings
→ localized public error
```

까지 손실 없이 전달되어야 한다.

확인:

* `error`
* 필요한 경우 `error_description`
* provider-specific safe code

raw provider/server/internal error는 그대로 출력하지 마라.

테스트:

```text
/settings?section=account&error=...
```

결과:

* account section 유지
* 오류 표시
* query cleanup 가능
* cleanup 후에도 현재 화면 error 유지
* refresh 후 stale error 재등장하지 않음

---

# 6. Block / Unblock canonical correctness

blocked user mutation은 반드시 `user.id`.

금지:

```text
DELETE /blocks/{username}
```

권장:

```text
DELETE /api/me/blocks/{userId}
```

또는 bug6에서 이미 만들어진 동일한 id 기반 canonical API.

unblock 시 반드시:

```text
HTTP success 확인
payload 확인
network error 처리
```

후에만 client state를 갱신한다.

실패했는데 local list에서 먼저 사라지는 false-success 금지.

username이 null이어도 unblock 가능해야 한다.

---

# 7. Block relationship teardown invariant

Clonagram의 `block-and-delete` UX에서 참고할 것은:

> block이 단순 UI flag가 아니라 relationship graph에 즉시 영향을 줘야 한다는 원칙

이다.

하지만 VTH에서 과거 DM/history를 삭제하라는 뜻은 아니다.

현재 VTH 정책을 기준으로 block 시 다음을 검사한다.

* follow 관계
* pending follow
* friend 관계
* pending friend request
* DM eligibility
* profile visibility
* notification-generating actions

block 이후 **새로운 관계/요청이 살아 있어서는 안 된다.**

필요하면 기존 relationship records를 취소/deactivate/remove한다.

단:

> unblock이 이전 friend/follow/pending request를 자동 부활시키면 안 된다.

반드시 테스트한다.

---

# 8. Block race / duplicate transition

다음 concurrent cases를 검증한다.

```text
follow ↔ block
friend request ↔ block
friend accept ↔ block
unblock ↔ follow
two simultaneous block requests
two simultaneous follow requests
```

DB unique invariant 또는 transaction/batch/conditional mutation으로 canonical 결과를 하나로 만든다.

UI race를 막는 것만으로 해결하지 마라.

---

# 9. Avatar security boundary

사용자가 직접 profile API를 통해 설정 가능한 avatar는 원칙적으로:

```text
null
generated:<valid-seed>
본인이 소유한 /api/media/<valid-key>
```

뿐이다.

R2 media는 반드시 서버에서:

```text
assertOwnedMediaKey()
uploadedBy === session.user.id
```

검증.

금지:

```text
https://attacker.example/x
//attacker.example/x
/api/auth/...
임의 same-origin path
다른 사용자의 R2 media
malformed media key
```

기존 OAuth login에서 받은 remote avatar는 migration compatibility 때문에 기존 값 유지가 필요할 수 있다.

그러나:

> profile PATCH를 이용해 사용자가 새 arbitrary remote URL을 삽입할 수 있어서는 안 된다.

테스트:

1. own media 성공
2. foreign media 실패
3. attacker HTTPS 실패
4. scheme-relative URL 실패
5. auth path 실패
6. invalid media key 실패
7. generated 성공
8. null/default 성공
9. 기존 OAuth remote avatar + bio only 변경 → avatar 보존

---

# 10. Profile PATCH는 partial update

일반 profile save에서 항상:

```text
username
name
bio
image
```

를 전송하지 마라.

dirty fields만 보낸다.

예:

```json
{"name":"..."}
```

```json
{"bio":"..."}
```

```json
{"username":"...","name":"..."}
```

avatar는 가능하면 별도 endpoint/service/action.

서버도 omitted field와 explicit null/empty value를 구분해야 한다.

특히:

```text
bio omitted ≠ bio clear
image omitted ≠ image null
```

이어야 한다.

---

# 11. Avatar UX 하나로 통일

현재 profile header와 Settings에서 다른 avatar save semantics가 존재한다면 하나로 합친다.

권장:

> **avatar 선택 후 즉시 canonical 저장**

성공 후 다음이 일치해야 한다.

* avatar editor
* Settings preview
* header
* auth/session projection
* public profile
* server-rendered page

저장 실패 시:

* 새 avatar가 저장된 것처럼 보여서는 안 됨
* 이전 canonical avatar로 rollback
* error 표시

upload/service/helper를 여러 컴포넌트에 복제하지 마라.

---

# P0 — Social Identity / Relationship / Privacy Integrity

# 12. Relationship state machine audit

VTH의:

```text
follow
friend
block
DM eligibility
```

관계를 한 번에 검토한다.

가능한 state와 transition을 문서/테스트로 고정한다.

특히 다음을 확인한다.

### Follow

```text
none → following
following → none
```

현재 VTH에 private-follow-request 정책이 이미 있다면:

```text
none → pending
pending → accepted
pending → cancelled
pending → declined
```

도 포함.

**VTH에 없는 private-account 기능을 Clonagram을 보고 임의로 새로 추가하지 마라.**

정책이 없다면 이번 bug7에서는 상태기계 개선만 하고 신규 기능은 추가하지 않는다.

### Friend

```text
none
→ outgoing/incoming pending
→ friends
→ removed
```

동시에 양방향 request가 발생해도 duplicate friendship이 생기지 않아야 한다.

### Block

block은 다른 relationship보다 우선한다.

```text
blocked
>
friend
>
follow
>
DM eligibility
```

실제 VTH 정책과 충돌하면 현재 VTH product rule을 우선하되 테스트로 명시한다.

---

# 13. Relationship canonical state는 서버에서 계산

클라이언트에서:

```text
isFollowing
hasSentRequest
isFriend
isBlocked
...
```

를 제각각 조합해 버튼 상태를 만들어내지 마라.

가능하면 server/service에서 canonical projection을 제공한다.

예:

```ts
{
  followState,
  friendState,
  blockState,
  canViewProfile,
  canInteract,
  canMessage
}
```

모든 필드를 꼭 한 endpoint로 합치라는 의미는 아니다.

**동일 의미를 서로 다른 컴포넌트에서 각각 재계산하지 말라는 뜻이다.**

---

# 14. Username 변경과 relationship 완전 분리

username 변경 전후에도:

* follow
* friend
* block
* DM room ownership
* notification target
* media ownership

이 유지되어야 한다.

관계 테이블에서 username FK 또는 username 기반 lookup으로 canonical link를 유지하는 곳이 없는지 검색한다.

테스트:

```text
A follows B
B username 변경
→ A still follows B

A blocks B
B username 변경
→ block 유지

A/B friends
A username 변경
→ friendship 유지
```

---

# 15. Public profile DTO leakage audit

public profile response/server component에서 내부 user row를 그대로 노출하지 마라.

점검 대상:

* email
* synthetic compatibility email
* contactEmail
* provider IDs
* account IDs
* internal status flags
* moderation metadata
* session information
* admin-only fields
* private settings
* push endpoints
* internal immutable IDs가 정말 노출될 필요가 있는지

public DTO를 명시적으로 구성한다.

`user.id`는 내부 canonical identity지만 **모든 public API에 무조건 노출해야 한다는 뜻은 아니다.**

---

# 16. Privacy authorization은 데이터 로딩 경계에서

다음 actor matrix를 기준으로 profile/social data를 확인한다.

```text
anonymous
self
normal authenticated user
follower
friend
pending requester
blocked by owner
owner blocked by viewer
banned/shadowbanned actor
```

확인 대상:

* profile
* posts
* comments/activity
* friends list
* follower/following data가 있다면 해당 목록
* DM button eligibility
* relationship actions

UI에서 버튼만 숨기지 말고 loader/service/query 단계에서 권한을 적용한다.

---

# 17. 정책을 새로 발명하지 마라

privacy behavior가 코드마다 다르고 공식 VTH 정책이 명확하지 않다면:

1. 현재 production behavior
2. README/docs
3. existing tests
4. API behavior

를 조사한다.

명확히 결정할 수 없는 product policy는 임의로 바꾸지 마라.

대신 completion report에:

```text
NEEDS PRODUCT DECISION
```

으로 정확하게 남긴다.

단순한 correctness bug는 decision으로 미루지 말고 수정한다.

---

# P1 — Settings / Account State Consistency

# 18. Theme optimistic update rollback

theme 저장 전 DOM/cookie를 optimistic 변경한다면 실패 시:

* 이전 theme
* cookie
* DOM state
* Settings selection

모두 rollback.

테스트:

```text
PATCH 500
PATCH 503
network reject
malformed response
```

실패 후 이전 상태 유지.

---

# 19. Settings mutation 공통 error handling

다음을 전부 검사:

* persistProfile
* avatar save
* avatar upload
* saveContactEmail
* savePreferences
* theme
* locale
* DM preference
* NSFW preference
* notifications
* consent
* loadIdentityMethods
* linkIdentity
* unlinkIdentity
* unblock

처리 대상:

```text
network exception
401
403
409
429
500
502
503
malformed JSON
tunnel failure
```

성공하지 않았는데 success toast/state가 남아서는 안 된다.

공통 helper를 만들 수 있으나 지나치게 generic한 abstraction은 피한다.

---

# 20. Connected accounts의 loading/error/loaded 구분

다음 세 상태를 분명히 한다.

```text
loading
loaded
loadError
```

listAccounts가 실패했다고:

> Facebook/Kakao/Zalo 모두 연결 안 됨

으로 렌더링하면 안 된다.

loadError UI + retry 제공.

---

# 21. 구성된 OAuth provider만 활성화

server auth configuration과 동일한 source of truth에서:

```text
facebook: boolean
kakao: boolean
zalo: boolean
```

capability를 계산한다.

secret 자체는 client 전달 금지.

구성되지 않은 provider에 활성 Connect 버튼 표시 금지.

---

# 22. Last identity unlink protection

UI의 account count는 UX일 뿐이다.

authoritative protection은 Better Auth/server.

```text
allowUnlinkingAll: false
```

유지.

검증:

* Facebook only
* Kakao only
* Zalo only
* multiple accounts
* unknown/legacy account row

마지막 identity를 제거해서 로그인 불가능한 계정이 생기면 안 된다.

email/password fallback 추가 금지.

---

# 23. Account linking concurrency

동시에 두 탭 또는 두 device에서 provider linking/unlinking이 일어나는 경우를 점검한다.

최소:

```text
same provider simultaneous link
link ↔ unlink
two provider links
callback retry
callback refresh
```

결과:

* duplicate account row 없음
* user.id 변경 없음
* 다른 VTH user로 잘못 연결되지 않음
* 마지막 identity 보호
* stale UI가 canonical state를 덮어쓰지 않음

---

# 24. Session / cache stale identity audit

다음 변경 후 오래된 session/cache projection이 남는지 확인한다.

* username
* display name
* avatar
* account status
* role
* social account link/unlink

DB가 canonical인데 cookie/session/header가 오래된 값을 계속 보여주면 수정한다.

특히 username/avatar 변경 후:

```text
header
profile
settings
server component
client component
```

가 서로 다른 값을 장시간 유지하면 안 된다.

---

# P1 — Push semantics

# 25. 현재 device와 전체 device 구분

다음 개념을 분리한다.

```text
currentDeviceSubscribed
activeDeviceCount
hasAnySubscription
```

Settings On/Off는 현재 브라우저 기준.

예:

```text
Phone A subscribed
PC B none
```

PC B Settings에서는 OFF여야 한다.

B enable → B 추가.

B disable → B만 제거.

A는 유지.

---

# P1 — Profile activity

# 26. Posts / Comments >30 pagination

fixed `limit:30`으로 끝내지 마라.

Posts/Comments tab에서는 전체 history 접근 가능해야 한다.

기존 VTH feed cursor convention을 재사용한다.

새로운 pagination convention 만들지 마라.

Overview는 recent activity만 보여도 된다.

---

# 27. Profile query overfetch 제거

active tab과 무관하게 모든 데이터를 가져오지 마라.

예:

```text
overview
→ recent posts/comments + common profile data

posts
→ posts + common data

comments
→ comments + common data

friends
→ friends + common data
```

단순 query 최적화 때문에 authorization을 여러 곳에 복제하지 말고 service boundary를 유지한다.

---

# P1 — Media lifecycle

# 28. R2 orphan avatar 완화

검사:

```text
upload 성공 → avatar persist 실패
upload 후 user cancel
연속 avatar upload
old avatar replacement
```

위험한 즉시 deletion을 도입하지 마라.

다른 콘텐츠가 참조하는 R2 object 삭제 금지.

가능하면:

```text
ownership
reference
createdAt
referenced/unreferenced
```

기반 cleanup 가능 구조를 만든다.

이번 범위에서 registry가 너무 크면:

* immediate avatar persist로 orphan 경로 감소
* cleanup architecture 문서화
* technical debt 명시

까지 수행.

---

# P2 — Runtime Validation

# 29. Settings API runtime validation

TypeScript cast를 validation으로 취급하지 마라.

명시적으로:

* boolean
* string/null
* theme enum
* allowDms enum
* locale
* preferredLanguage
* contactEmail
* section
* unexpected payload

검증.

예:

```json
{"nsfw":"false"}
```

가 true로 저장되면 안 된다.

invalid preferredLanguage를 무시하고 200 반환하지 마라.

---

# 30. Username validation single source

client/server가 가능한 한 같은 규칙을 사용.

현재 규칙:

* 3–24 chars
* letters
* numbers
* underscore
* leading `@` normalization

서버 authoritative 유지.

client는 불필요한 confirmation → server rejection을 줄이는 역할.

---

# 31. Username cooldown live expiry

mount 시각 하나만 저장해 cooldown 상태를 영구 계산하지 마라.

페이지를 켜둔 채 expiry가 지나면 UI가 정상 unlock되어야 한다.

timer 또는 expiry based state 사용.

---

# 32. Username confirm dialog accessibility

필수:

* Escape close
* initial focus
* focus trap
* trigger focus restore
* pending 중 duplicate submit 금지

가능하면 기존 Dialog primitive 재사용.

---

# 33. ProfileTabs native Link semantics

특별한 필요가 없으면:

```text
preventDefault()
router.push()
```

를 제거한다.

보존:

* Ctrl/Cmd click
* middle click
* open new tab
* browser native navigation semantics

---

# 34. Settings component ownership 정리

거대한 SettingsClient가 여전히 남아 있다면 책임별로 나눈다.

예:

```text
ProfileSettings
AccountSettings
AppearanceSettings
PrivacySettings
NotificationSettings
ConnectedAccountsSettings
SharedAvatarEditor
```

그러나 파일만 분할하고 모든 state를 부모에 남기는 식의 가짜 리팩터링 금지.

각 영역이 자기 mutation/state ownership을 갖게 한다.

공유:

* localization
* async result/error helper
* UserSettings type
* refresh/session reconciliation

정도로 제한한다.

---

# 35. Contact email semantic audit

전체 사용처 검색:

```text
contactEmail
contactEmailVerified
emailVerified
user.email
provider email
synthetic compatibility email
```

반드시 서로 의미를 구분한다.

```text
Better Auth email
≠ VTH login identity

contactEmail
= optional contact metadata
```

provider가 verified email을 제공할 때 custom verification state와 어떤 관계인지 명확히 한다.

사용하지 않는 dead field라면 억지 UI 추가 금지.

contactEmail을 login/account merge identity로 사용 금지.

---

# bug7 / bug8 경계

## bug7에서 처리

* profile
* settings
* social account link state
* user identity
* username
* avatar
* follow/friend/block canonical relationship
* privacy authorization
* block 이후 synchronous permission
* DM 진입 가능 여부를 결정하는 relationship rule

## bug8으로 넘길 것

* Durable Object WebSocket
* existing socket revocation race
* message broadcast ordering
* reconnect
* catch-up
* unread
* read acknowledgement
* optimistic message state
* message retry/idempotency
* commit/broadcast failure
* block 직후 delayed WebSocket delivery
* DM request realtime reconciliation

bug7에서 위 항목을 발견하면 임시 패치로 DM 구조를 흔들지 말고:

```text
BUG8 FOLLOW-UP
```

으로 정확한 file/function/reproduction을 기록한다.

---

# 필수 DB invariant audit

현재 schema/migrations를 조사해서 가능한 것은 DB에서도 막는다.

최소 확인:

```text
self-follow 불가
duplicate follow 불가
duplicate pending relation 불가
duplicate friendship 불가
duplicate block 불가
relationship FK → immutable user.id
```

SQLite/D1 constraint로 자연스럽게 보장할 수 있는데 application code만으로 막고 있다면 migration 검토.

단 production migration 안전성을 확인한다.

기존 데이터가 constraint를 위반할 가능성이 있으면 migration 전에 audit/repair step 필요.

---

# 필수 테스트 Matrix

## Profile

1. display name save
2. bio save
3. bio clear
4. partial PATCH
5. username change
6. invalid username
7. duplicate username
8. cooldown
9. old username redirect
10. username 변경 후 relationship 유지

## Avatar

11. generated avatar
12. own uploaded avatar
13. foreign media rejection
14. malicious remote URL rejection
15. malformed media rejection
16. null/default
17. OAuth existing avatar + unrelated field update
18. upload success + persist failure rollback
19. header/profile/settings synchronization

## OAuth / account

20. list accounts success
21. load failure
22. retry
23. callback error
24. last identity unlink protection
25. simultaneous link retry
26. user.id unchanged after link/unlink

## Settings

27. theme success
28. theme failure rollback
29. locale
30. NSFW
31. DM preference
32. notification preference
33. contactEmail success/error
34. malformed payload
35. network failure

## Block

36. block
37. unblock
38. unblock server failure
39. null username unblock
40. block removes/disables applicable pending relation
41. unblock does not resurrect relationship
42. block ↔ follow race
43. block ↔ friend accept race
44. repeated block idempotency

## Follow / Friend

45. follow
46. unfollow
47. duplicate follow
48. simultaneous follow
49. friend request
50. accept
51. decline/cancel
52. simultaneous opposite friend requests
53. remove friend
54. username change while related

private/follow-request tests는 VTH에 해당 기능이 실제 존재할 경우에만 추가한다.

## Privacy / authorization

55. anonymous profile access
56. self
57. unrelated authenticated user
58. follower
59. friend
60. blocked actor
61. blocker
62. banned/shadow state according to current policy
63. public DTO has no private fields
64. direct API access cannot bypass UI privacy

## Push

65. A device subscribed / B device none
66. B enable
67. B disable
68. A preserved

## Profile history

69. posts >30
70. comments >30
71. cursor/load-more no duplicates
72. stable pagination under same timestamp where applicable

## UX

73. Settings 390px
74. Profile 390px
75. username dialog keyboard
76. native ProfileTabs Ctrl/Cmd click
77. loading/error/empty account states

---

# State-machine / property test 권장

relationship 영역은 deterministic state-machine test를 추가하는 것을 권장한다.

예:

```text
follow
unfollow
friendRequest
accept
removeFriend
block
unblock
renameUser
```

를 여러 순서로 실행해서 항상 다음 invariant를 검사한다.

* self relation 없음
* duplicate canonical relation 없음
* blocked pair에 금지된 active relation 없음
* username 변경이 relationship identity를 바꾸지 않음
* unblock이 이전 state를 부활시키지 않음
* UI projection과 DB canonical state 일치

arbitrary sleep 기반 flaky test 금지.

---

# Clonagram 흡수 결과 보고

완료 보고서에 별도 표를 추가한다.

| Clonagram 요소                   | VTH 판단        | 처리                                  |
| ------------------------------ | ------------- | ----------------------------------- |
| ID-based follow mutation       | Adopt         | VTH user.id 기반 확인/보강                |
| explicit follow state          | Adopt concept | VTH relationship projection에 반영     |
| private account branch         | Compare only  | VTH 기존 정책 없으면 신규 추가 안 함             |
| separate avatar action         | Adopt         | VTH avatar flow 통합                  |
| route/cache refresh            | Adapt         | VTH router/session architecture로 적용 |
| follow→DM promotion            | Defer         | bug8에서 검토                           |
| Supabase RLS                   | Reject        | VTH server authorization 사용         |
| Supabase Auth/Storage/Realtime | Reject        | Better Auth/R2/DO 유지                |

실제 조사 결과에 따라 행을 추가/수정하라.

---

# 검증 명령

최종 변경 후 최소:

```powershell
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
```

repository에 lint script가 실제 존재한다면 lint도 실행.

Cloudflare Worker/DO 관련 변경이 불가피했다면 worker tests도 반드시 실행.

테스트를 통과시키기 위해 기능/validation/security를 숨기거나 제거하지 마라.

---

# 완료 보고서

다음을 반드시 보고하라.

1. 실제 발견한 root cause
2. bug6에서 이미 해결되어 건드리지 않은 항목
3. 수정한 파일
4. 추가/변경 migration
5. API contract 변경
6. relationship state model 변경
7. authorization 변경
8. Clonagram에서 참고한 부분
9. Clonagram에서 의도적으로 거부한 부분
10. 추가한 unit/integration/e2e tests
11. 실행한 명령과 결과
12. 남은 technical debt
13. bug8로 넘긴 DM/realtime 항목
14. 막은 공격/race/failure scenario

---

# 최종 성공 기준

bug7 완료 후 다음 질문에 모두 명확히 답할 수 있어야 한다.

### Identity

* username을 바꿔도 동일 사용자인가?
* 모든 내부 relationship은 user.id에 묶여 있는가?
* social provider를 연결/해제해도 user.id가 유지되는가?
* contactEmail이 login identity로 오용되지 않는가?

### Profile

* 한 필드만 바꾸면 그 필드만 수정되는가?
* avatar ownership을 서버가 검증하는가?
* remote tracking avatar 삽입이 불가능한가?
* client/header/server profile이 수렴하는가?

### Relationship

* follow/friend/block state가 하나의 canonical 결과를 갖는가?
* duplicate/concurrent mutation에도 DB가 깨지지 않는가?
* block이 금지된 관계를 확실히 차단하는가?
* unblock이 과거 관계를 부활시키지 않는가?

### Privacy

* UI를 우회한 직접 API 요청도 같은 권한 정책을 적용받는가?
* public profile response에 private account data가 새지 않는가?

### Settings

* 모든 실패가 실제 실패로 표시되는가?
* optimistic state가 서버 실패 후 남지 않는가?
* OAuth account 상태가 로딩 실패와 미연결을 구분하는가?

### Boundary

* bug7을 고치면서 bug8의 realtime DM architecture를 임시로 다시 설계하지 않았는가?

이 모든 조건을 만족해야 bug7을 완료로 판단한다.
