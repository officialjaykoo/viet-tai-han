Việt tại Hàn의 Profile + Settings 영역을 실제 코드 기준으로 전면 점검하고 아래 문제를 수정하라.

목표는 UI 재디자인이 아니라 **correctness, 상태 일관성, social-first identity, 보안, 모바일 UX, 회귀 테스트**를 바로잡는 것이다.

현재 프로젝트의 중요한 원칙을 유지한다.

* 로그인은 social-first다.
* email/password 로그인을 다시 도입하지 마라.
* `contactEmail`은 로그인 identity가 아니라 선택적 연락처다.
* Facebook / Kakao / Zalo 연결 구조를 유지한다.
* 내부 immutable identity는 `user.id`다.
* public handle은 `username`이며 변경될 수 있다.
* `/i/api`, `apiFetch`, signed request, tunnel/PoW 보안 경로를 우회하지 마라.
* 기존 username history/cooldown/redirect 보장을 깨지 마라.
* 변경 후 lint/typecheck/unit/integration/e2e까지 수행하라.

## P0 — 반드시 먼저 수정

### 1. OAuth account-link callback error 유실

관련:

* `src/app/settings/page.tsx`
* `src/components/settings/settings-client.tsx`

SettingsPage가 `searchParams.error`를 받고 있지만 SettingsClient의 `initialIdentityError`로 넘기지 않는다.

수정:

* OAuth/link callback의 error를 SettingsClient에 전달한다.
* account section에서 사용자가 실제 오류를 볼 수 있어야 한다.
* 오류를 UI에 전달한 뒤 URL query에서 정리하는 현재 의도는 유지해도 된다.
* Better Auth가 실제 callback에서 사용하는 error query 형태도 확인하고 필요한 경우 `error`, `error_description` 등을 안전하게 처리하라.
* raw provider/server error를 그대로 노출하지 말고 기존 localized public error 체계를 사용하라.

회귀 테스트:

* `/settings?section=account&error=...`
* 오류 메시지 표시
* account section 유지
* URL cleanup 이후에도 오류 메시지는 화면에 남아 있음

### 2. Blocked account unblock의 false-success 제거

현재 SettingsClient의 `unblock()`은 HTTP 결과를 검사하지 않고 무조건 blocked local state에서 사용자를 제거한다.

수정:

* `res.ok`와 response payload를 반드시 검사한다.
* 실패하면 목록을 유지하고 localized error 표시.
* network exception도 처리.
* username이 null인 blocked user도 반드시 unblock 가능해야 한다.
* mutation identity로 username을 사용하지 말고 `user.id`를 사용하도록 구조를 변경한다.

권장:

* `/api/me/blocks/[userId]` DELETE 같은 id 기반 endpoint를 만든다.
* settings의 `BlockedUser.id`를 mutation key로 사용한다.
* public profile URL에만 username을 사용한다.

### 3. Avatar 보안 경계 수정

관련:

* `src/lib/avatar.ts`
* `src/lib/media.ts`
* `src/lib/media-key.ts`
* `src/lib/username-lifecycle.ts`
* `src/lib/user-settings.ts`
* `/api/me/profile`
* `ProfileAvatarEditor`
* `SettingsClient`

현재 `normalizeAvatarImage()`는 임의 HTTPS URL과 임의 `/...` 경로를 허용한다.
이 상태에서는 사용자가 직접 PATCH를 보내 arbitrary remote tracking image 또는 임의 same-origin path를 avatar로 지정할 수 있다.

프로필 사용자가 직접 설정할 수 있는 avatar는 기본적으로 다음만 허용하라.

1. `null`
2. 유효한 `generated:<seed>`
3. 본인이 업로드한 `/api/media/<valid-media-key>`

media avatar인 경우 이미 존재하는 `assertOwnedMediaKey()`를 사용해서 `uploadedBy === session.user.id`를 서버에서 검증하라.

다른 사용자의 media object를 avatar로 지정할 수 없어야 한다.

OAuth provider가 최초 로그인 때 제공한 remote avatar와 사용자 직접 avatar 변경을 구분하라.

프로필 수정 API를 통해 새로운 arbitrary HTTPS URL을 삽입하는 것은 금지한다.

기존 계정에 저장된 OAuth remote avatar가 name/bio 수정 때문에 깨지지 않도록:

* Profile PATCH는 dirty field만 전송하도록 고친다.
* username/name/bio/image를 매번 전부 보내지 마라.
* image를 변경하지 않았으면 image 필드를 보내지 않는다.
* username을 변경하지 않았으면 username 필드를 보내지 않는다.

필요하다면 기존 OAuth CDN avatar는 현재 값 유지만 허용하고, 사용자가 임의 remote URL로 교체하는 것은 막아라.

테스트:

* user A가 자기 media → 성공
* user A가 user B media → 400/403
* arbitrary `https://attacker.example/...` → 거절
* `//attacker.example/...` → 거절
* `/api/auth/...` → 거절
* invalid `/api/media/...` → 거절
* generated avatar → 성공
* null/default avatar → 성공

## P1 — 상태 일관성

### 4. Profile PATCH를 partial update로 정리

SettingsClient `persistProfile()`이 현재 항상 username/name/bio/image를 전송한다.

각 dirty field만 PATCH하라.

예:

* name만 변경 → `{name}`
* bio만 변경 → `{bio}`
* username+name → `{username,name}`
* avatar는 가능하면 별도 avatar update flow로 분리

이렇게 해서 unrelated field validation 때문에 정상 수정이 실패하지 않도록 한다.

### 5. Avatar UX를 하나로 통일

현재:

* profile header의 ProfileAvatarEditor = 즉시 저장
* Settings profile avatar = preview만 바꾸고 Save Profile 필요

같은 기능이 서로 다른 semantics를 갖고 있다.

공통 avatar editor/update hook 또는 공통 service를 만들어 한 동작으로 통일하라.

권장 semantics:
**avatar는 선택 즉시 저장.**

그러면 Settings의 일반 Save Profile은 username/name/bio만 담당하게 한다.

avatar 저장 성공 후:

* local preview
* Settings state
* auth session/header avatar
* server-rendered profile
  가 모두 동일해야 한다.

필요하면 `router.refresh()` 및 auth session invalidation을 정확히 사용하라.

코드 중복:

* uploadFile
* camera/gallery input
* generated/default avatar
* persist image
  를 하나로 합쳐라.

### 6. R2 orphan media 문제 완화

`src/lib/media.ts`에는 uploaded object를 영구 보존하고 향후 ownership registry/janitor가 필요하다고 이미 명시돼 있다.

최소한 avatar UX 때문에 발생하는 불필요한 orphan을 줄여라.

* upload 성공 → avatar persist 실패
* upload 후 사용자가 저장하지 않음
* 연속으로 여러 avatar 업로드

이 경우가 얼마나 orphan을 만드는지 검사하라.

가능하면 media ownership/reference registry를 도입하고 age-based cleanup 가능 구조로 만든다.
이번 변경 범위가 너무 커진다면:

* immediate avatar persistence로 orphan 발생 경로를 줄이고
* 명확한 cleanup TODO + 테스트 가능한 registry 설계를 별도 문서화하라.

절대 다른 게시글/프로필에서 참조 중인 object를 즉시 지우는 위험한 cleanup은 만들지 마라.

### 7. Theme optimistic update rollback

현재 theme 선택 시 `setTheme()`이 DB 저장보다 먼저 실행되고 cookie도 즉시 바뀐다.

저장 실패 시:

* 이전 theme
* cookie
* DOM theme
  를 모두 이전 상태로 rollback하라.

또는 서버 성공 후 commit하는 방식으로 바꿔도 되지만 UI flicker를 고려하라.

테스트:

* theme PATCH를 강제로 500/503
* 선택 전 theme 유지
* cookie도 이전 값
* error 표시

### 8. 모든 Settings mutation network exception 처리

다음을 전부 조사:

* persistProfile
* saveContactEmail
* savePreferences
* loadIdentityMethods
* linkIdentity
* unlinkIdentity
* unblock
* consent
* avatar upload/save

`apiFetch()` 자체 reject, tunnel failure, malformed response, 401/403/409/429/500/502/503을 구분해 UI가 깨지거나 unhandled rejection이 발생하지 않도록 한다.

공통 request/action helper로 중복 처리를 줄여라.

성공하지 않은 mutation에서 success message 또는 optimistic state가 남아서는 안 된다.

### 9. Linked accounts loading state 수정

`authClient.listAccounts()` 실패 시 현재 빈 linkedAccounts가 “연결 안 됨” 상태처럼 렌더링될 수 있다.

다음 상태를 구분하라.

* loading
* loaded
* loadError

loadError이면 Facebook/Kakao/Zalo를 모두 “not connected”라고 표시하지 마라.
“연결 정보를 불러오지 못함 / 다시 시도”를 제공하라.

Retry 버튼도 추가하라.

### 10. 실제 구성된 OAuth provider만 노출

현재 Settings UI는 Facebook/Kakao/Zalo 세 개를 항상 렌더링한다.

서버 환경에서 provider가 구성되지 않았으면 “Connect” 버튼을 활성 상태로 보여주지 마라.

auth configuration과 동일한 source of truth로 provider capabilities를 계산하라.

예:

* facebook configured
* kakao configured
* zalo configured

secret 자체는 절대 client로 보내지 말고 boolean capability만 전달.

UI와 auth provider 설정이 서로 다른 로직을 중복해서 갖지 않도록 helper를 추출하라.

### 11. Last login identity protection은 서버가 authoritative

현재 UI는 `socialAccounts.length <= 1`이면 unlink를 disable한다.

이 UX는 유지할 수 있지만 security/correctness는 UI에 의존하지 말고 Better Auth의
`allowUnlinkingAll: false`
정책을 authoritative하게 유지한다.

unknown/legacy provider가 존재하는 경우에도 UI count가 잘못되지 않는지 테스트하라.

social-first 프로젝트이므로 이메일/비밀번호 fallback을 새로 만들지 마라.

## P1 — Push notification semantics 수정

현재 `getPushStatus(userId)`의 `subscribed`는 사용자의 모든 활성 subscription 중 하나라도 있으면 true다.

하지만 PushSettings의 enable/disable 버튼은 현재 브라우저의 service worker subscription을 조작한다.

이 둘을 분리하라.

필요한 개념:

* `currentDeviceSubscribed`
* `activeDeviceCount` 또는 `hasAnySubscription`

Settings의 On/Off 버튼은 **current browser/device** 상태를 기준으로 해야 한다.

다른 PC/휴대폰에 subscription이 있다고 현재 브라우저까지 “켜짐”으로 표시하면 안 된다.

Disable:

* 현재 브라우저 subscription endpoint만 서버에서 삭제
* 해당 browser subscription unsubscribe
* 다른 기기 subscription은 유지

원하면 UI에:
“다른 기기 N개에서 알림 사용 중”
정도는 별도로 표시할 수 있다.

테스트:

* device A subscribed, device B none
* B Settings에서 B는 disabled로 표시
* B enable → B subscription 추가
* B disable → B만 삭제
* A subscription 유지

## P1 — Profile activity pagination

현재:

* posts limit 30
* comments limit 30
* UI pagination/load-more 없음

Posts/Comments 탭에서 30개 이후 데이터도 접근할 수 있도록 cursor pagination 또는 Load More를 구현하라.

repository 기존 feed pagination convention이 있으면 그대로 재사용한다.
새 pagination 규약을 별도로 만들지 마라.

Overview도 명확한 “recent activity” 개념으로 제한하는 것은 괜찮지만 Posts/Comments 탭은 전체 탐색 가능해야 한다.

## P2 — Profile query 최적화

현재 profile page는 active tab과 무관하게:

* achievements
* posts
* comments
* friends
  를 전부 조회한다.

필요한 데이터만 조회하도록 변경한다.

예:

* overview → posts + comments + achievements
* posts → posts + achievements
* comments → comments + achievements
* friends → friends + achievements

sidebar에 항상 필요한 데이터만 공통 조회.

동작을 바꾸지 않으면서 D1 query 수와 response latency를 줄여라.

## P2 — Settings API runtime validation

`src/app/api/me/settings/route.ts`의 TypeScript cast는 runtime validation이 아니다.

다음을 명시적으로 검증하라.

* boolean fields는 실제 boolean만 허용
* theme enum
* allowDms enum
* locale
* contactEmail
* strings/null
* unknown section
* unexpected payload shape

특히 `"false"` 문자열이 truthy 처리되어 true로 저장되는 식의 coercion이 없어야 한다.

가능하면 프로젝트의 기존 validation helper를 재사용한다.

invalid preferredLanguage를 조용히 무시하고 success를 반환하지 말고 400으로 처리하라.

## P2 — ProfileTabs native Link behavior 복원

`ProfileTabs`에서 Link를 사용하면서 `onClick -> preventDefault -> router.push`를 다시 수행하고 있다.

특별한 이유가 없다면 제거하고 Next `<Link>`에 navigation을 맡겨라.

다음을 깨지 마라:

* Ctrl/Cmd + click
* open in new tab
* middle click
* browser-native link semantics

## P2 — Username UX

username cooldown 상태의 `now`를 mount 시 한 번만 저장하기 때문에 page를 계속 열어둔 상태에서 cooldown이 끝나도 unlock되지 않는다.

expiry 시점에 timer를 설정하거나 상태 계산을 재검토하라.

추가:

* client-side username format validation
* 3–24 chars
* letters/numbers/underscore
* leading @ normalization
  을 서버 규칙과 동일 source of truth로 맞춰 불필요한 confirmation → server error 흐름을 줄여라.

서버 validation은 계속 authoritative해야 한다.

## P2 — Username confirmation dialog 접근성

현재 custom fixed dialog에 다음을 추가하거나 기존 Dialog component로 교체하라.

* Escape close
* initial focus
* focus trap
* close 후 trigger focus restore
* pending 중 중복 confirm 방지

기존 UI 스타일은 유지.

## SettingsClient 구조 정리

`src/components/settings/settings-client.tsx`가 너무 많은 책임을 가진다.

다음 정도로 분리하라.

* ProfileSettings
* AccountSettings
* AppearanceSettings
* PrivacySettings
* NotificationSettings
* ConnectedAccountsSettings
* AvatarEditor/shared avatar action

단, 단순 파일 쪼개기만 하지 말고 mutation/state ownership도 각 영역에 맞게 분리한다.

공통으로 필요한 것은:

* localized async action/error handling
* UserSettings type
* router/session refresh
  정도만 공유한다.

## Contact email semantic audit

`contactEmail`과 `contactEmailVerified`의 전체 사용처를 조사하라.

특히 OAuth가 verified email을 제공할 때:

* Better Auth `emailVerified`
* custom `contactEmailVerified`
  가 서로 다른 의미로 남아 있지 않은지 확인한다.

contactEmailVerified를 실제 기능에 쓸 것이라면 provider verification 정보를 올바르게 반영한다.
사용하지 않는 dead state라면 억지로 UI를 추가하지 말고 향후 용도를 명확히 정리한다.

절대로 contactEmail을 sign-in identity로 다시 만들지 마라.

## 테스트 보강

현재 authenticated E2E는 Settings가 열린다는 정도만 확인하고 있다.
Profile/Settings 전용 회귀 테스트를 추가하라.

최소 테스트 matrix:

1. display name save
2. bio save / clear
3. username 정상 변경
4. invalid username
5. username duplicate 409
6. cooldown 429
7. username 변경 뒤 old profile URL redirect
8. avatar generated
9. own uploaded avatar
10. foreign-owned media avatar rejection
11. malicious remote avatar rejection
12. profile save network failure
13. theme success
14. theme failure rollback
15. locale update
16. NSFW toggle
17. DM preference
18. notification preferences
19. contact email success/error
20. OAuth account list load failure
21. OAuth link callback error
22. last social identity unlink protection
23. unblock success
24. unblock server failure
25. blocked user with null username
26. push multi-device semantics
27. posts/comments >30 pagination
28. mobile 390px Settings/Profile layout
29. username confirmation keyboard accessibility

## 완료 조건

수정 후 다음을 보고하라.

1. 발견한 실제 root cause 목록
2. 수정한 파일 목록
3. DB migration 유무
4. API contract 변경사항
5. 추가한 unit/integration/e2e 테스트
6. 실행한 검증 명령과 결과
7. 아직 의도적으로 남긴 technical debt
8. 보안상 막은 공격/오류 시나리오

기존 기능을 단순히 숨겨서 테스트를 통과시키지 마라.
오류 발생 시 UI와 서버 state가 반드시 일치해야 한다.
username 대신 user.id를 사용할 수 있는 내부 mutation은 user.id를 사용한다.
public URL/display에서만 username을 사용한다.
