현재 `main`의 글쓰기 파이프라인을 다시 감사하고 수정한다.

이전 감사 보고서의 항목을 그대로 구현하지 마라. 일부는 원인·우선순위가 잘못됐다. 아래 내용이 이번 작업의 canonical contract다.

## 목표

VTH의 기존 구조를 유지하면서:

`작성 UI → /i/api → canonical API → D1/R2 → 상세 → 수정/삭제`

전체 글쓰기 경로를 correctness, authorization, retry, validation 관점에서 닫는다.

새 프레임워크, 새 서비스, 새 queue, 새 DB subsystem을 추가하지 않는다.

기존 `/i/api` signed tunnel, challenge, PoW, rate limiting을 제거하거나 우회하지 않는다.

---

## 반드시 보존할 기존 구조

브라우저 API traffic:

`apiFetch → POST /i/api → signed Protobuf envelope → internal dispatch → /api/*`

mutation에는 이미:

* ATK HMAC signature
* route gate
* one-time challenge
* PoW
* mutate rate limit

이 존재한다.

직접 `/api/*` 접근은 public API key 경로다.

따라서 `_red`를 forge할 수 있다는 이유만으로 `/api/posts`가 인터넷에 무방비 노출됐다고 가정하지 마라.

Public API key 사용자에게 browser Turnstile cookie를 강제하지 마라.

---

# P0-1 — profile community authorization

현재 가장 먼저 수정한다.

Invariant:

```text
일반 community:
authenticated active user가 post 가능

internal profile community u_*:
그 profile community의 실제 owner만 post 가능

"@me" / "profile":
항상 현재 사용자의 profile community로만 resolve
```

수정 대상:

* `src/app/api/posts/route.ts`
* `src/lib/profile-community.ts`
* `src/app/r/[name]/submit/page.tsx`
* 필요한 profile-community helper

### Server rule

일반 subreddit lookup에서 최소:

```sql
SELECT id, name, created_by
FROM subreddits
WHERE name = ? COLLATE NOCASE
  AND is_removed = 0
```

를 가져온다.

`isProfileCommunityName(name)`가 true이면:

```text
created_by === current user id
```

가 아니면 403.

UI에서 `u_*`를 숨기는 것은 authorization이 아니다.

### `/r/[name]/submit`

`u_*` route가 현재 사용자의 profile community가 아니라면 작성 form을 열지 않는다.

타인의 internal profile target을 `CreatePostForm defaultSubreddit`으로 전달해서는 안 된다.

### ensureProfileCommunity

이미 같은 이름의 `u_*` community가 발견됐을 때도 owner를 확인한다.

다른 사용자가 소유하고 있으면 그대로 반환하지 않는다.

---

# P0-2 — Turnstile result를 browser canonical write와 연결

기존 security tunnel을 재설계하지 않는다.

현재:

```text
passBotCheck
→ /api/security/bot-check
→ Turnstile verification
→ signed red_human cookie 발급
```

까지 존재한다.

문제는 이 human proof가 post/media canonical write에서 확인되지 않는다는 것이다.

### 요구사항

Browser tunnel request인 경우에만:

```text
POST /api/posts
POST /api/media
```

가 유효한 `red_human` cookie를 요구해야 한다.

Direct public API key traffic은 기존 API-key authentication을 유지하고 browser Turnstile cookie를 요구하지 않는다.

`getTunnelContext()?.verified`로 browser/internal tunnel 여부를 구분할 수 있다.

`dispatchInternalApi()`가 원래 request headers/cookies를 inner NextRequest에 복사하는 현재 동작을 보존한다.

새 보안 체계를 만들지 말고 기존:

* `HUMAN_COOKIE`
* `openHumanToken()`
* `getTunnelContext()`
* `AuthError`

를 재사용한다.

테스트:

1. tunnel post + valid human cookie → success
2. tunnel post + missing/expired/invalid human cookie → 403
3. tunnel media + valid human cookie → success
4. tunnel media + missing cookie → 403
5. direct public API key path가 기존 contract대로 동작함
6. `/i/api` signature/challenge/PoW가 그대로 유지됨

---

# P0-3 — JPEG/PNG decode 전 dimension limit

현재 JPEG/PNG는:

```text
compressed bytes
→ decode RGBA
→ resize 2048
```

순서다.

resize 전에 decode memory가 할당되므로 방어가 늦다.

`processUploadedImage()`에서 JPEG/PNG 전체 decode 전에 header만 parse하여:

* width
* height
* width * height

를 확인한다.

권장 hard limits:

```text
MAX_SOURCE_DIMENSION = 8192
MAX_SOURCE_PIXELS = 40_000_000
```

둘 중 하나라도 초과하면 400.

### WebP 주의

WebP는 현재 서버에서 RGBA decode하지 않는다.

따라서 JPEG/PNG decode-memory 문제와 동일하게 설명하거나 처리하지 마라.

대신 WebP container의 dimension을 header에서 안전하게 얻을 수 있으면 같은 logical dimension limit을 적용한다.

무거운 WebP decoder/encoder dependency를 새로 추가하지 않는다.

---

# P1-1 — post payload type validator

현재 TypeScript cast는 runtime validation이 아니다.

`POST /api/posts` 입구에서 clean object를 명시적으로 검증한다.

허용 타입:

```text
subreddit: required string
title: required string
body: optional string
url: optional string
mediaKey: optional string
requestId: optional string
```

null 허용 여부는 현재 action contract와 일치시킨다.

다음은 반드시 400:

```json
{"title":{}}
{"subreddit":[]}
{"body":123}
{"url":{}}
{"mediaKey":[]}
```

JSON syntax 자체는 기존 tunnel/guard가 이미 400 처리하므로 중복 parser를 만들지 않는다.

---

# P1-2 — canonical content limits

server가 authoritative하다.

```text
title: 3..300
body: max 20,000 characters
URL: max 2,048 characters
```

Create와 Edit 양쪽에 동일하게 적용한다.

UI에도 동일한 `maxLength`를 넣는다.

URL protocol 검증 `http:` / `https:`는 유지한다.

---

# P1-3 — media ownership + existence

현재 regex-only `isAllowedMediaKey()`는 충분하지 않다.

post create에서 mediaKey가 있으면:

1. key syntax valid
2. R2 object exists
3. object `customMetadata.uploadedBy === current user id`

모두 만족해야 한다.

아니면 400/403.

타인의 mediaKey나 존재하지 않는 mediaKey로 post를 생성할 수 없어야 한다.

R2 전체 list를 하지 말고 exact object lookup/head를 사용한다.

---

# P1-4 — canonical INSERT가 성공 응답의 경계

Invariant:

```text
posts INSERT 성공
= post creation 성공
```

현재 INSERT 뒤 `bumpUserActivity()`가 실패하면 API 전체가 500이 될 수 있다.

activity/achievement/translation 등 derived side effect가 canonical post 성공 응답을 뒤집지 않게 한다.

단:

* canonical validation
* authorization
* moderation
* rate limit
* media ownership
* INSERT

는 성공 전에 끝나야 한다.

side effect 실패는 log/background best-effort로 처리한다.

duplicate requestId가 기존 post를 찾은 경우에도 duplicate post를 만들지 않는다.

---

# P1-5 — image upload/post retry state

현재 문제:

```text
R2 upload A 성공
post response 유실
retry
R2 upload B 생성
same requestId
existing post A 반환
B orphan
```

한 logical submission 동안 성공한 `mediaKey`를 보존하고 retry 때 재업로드하지 않는다.

CreatePostForm에 logical submission state를 명시적으로 둔다.

최소 보존:

```text
requestId
uploadedMediaKey
submission snapshot/fingerprint
```

규칙:

```text
동일 submission의 uncertain/network retry
→ 같은 requestId + 같은 mediaKey

서버가 명확한 validation rejection을 반환했고 사용자가 내용 변경
→ 새로운 logical submission
```

단순히 모든 `onChange`마다 requestId를 무조건 폐기하여 response-lost idempotency를 깨뜨리지 않는다.

테스트로 명확히 증명한다.

---

# P1-6 — network failure recovery

`CreatePostForm.submit()` 전체 async 작업을 outer try/catch/finally로 감싼다.

다음 throw를 사용자에게 복구 가능한 오류로 보여준다.

* `passBotCheck/apiFetch`
* media upload
* post create

실패 시 draft를 지우지 않는다.

uncertain failure에서는 requestId와 이미 성공한 mediaKey를 유지한다.

---

# P1-7 — Turnstile token lifecycle

Turnstile token을 Siteverify에서 성공적으로 사용한 뒤 동일 token을 다시 제출하지 않는다.

`passBotCheck()` 성공 후 token/widget state를 새 challenge를 받을 수 있는 상태로 reset한다.

후속 upload/post 실패 후 사용자가 retry할 때 consumed token 때문에 영구 실패하지 않아야 한다.

기존 `turnstileReset` ref를 재사용한다.

---

# P1-8 — detail body duplication

현재 detail:

```text
PostCard
→ body preview 포함

PostBodyPanel
→ body 전체 다시 표시
```

이므로 body가 두 번 나온다.

상세 페이지에서 body는 정확히 한 번만 표시한다.

Feed의 `PostCard` behavior는 회귀시키지 않는다.

가장 작은 수정으로:

* PostCard에 detail/body-preview suppression mode를 넣거나
* detail 전용 presentation을 사용

한다.

translation 표시 상태도 body가 두 군데에서 따로 존재하지 않게 한다.

---

# P1-9 — compose shortcut

Home composer:

```text
Text
Image
Link
```

각 action은 실제 해당 mode로 `/submit`을 열어야 한다.

사용:

```text
/submit?type=text
/submit?type=image
/submit?type=link
```

`SubmitPage`에서 값을 검증하고 `CreatePostForm initialPostType`으로 전달한다.

invalid type은 `text`.

세 버튼 모두 같은 `/submit`으로 보내지 않는다.

---

# P1-10 — edit type invariant

현재 edit UI는 title/body만 제공하고 original post의:

* url
* mediaKey

를 알지 못한다.

그 결과 link/image post에서 text body를 추가하는 등 create UI의 exclusive type model과 어긋날 수 있다.

post type을:

```text
text
link
image
```

중 하나로 명확히 계산한다.

Edit에서:

* text → title/body 편집
* link → title/url 편집
* image → title 편집, 기존 image 유지

로 한다.

이번 작업에서 image replacement/removal 기능을 새로 추가하지 않는다.

Create의 invariant:

```text
url && mediaKey 금지
```

를 유지한다.

---

# P1-11 — anonymous /submit

`/submit`과 `/r/[name]/submit`은 session이 없으면 form을 렌더한 뒤 마지막에 401을 보여주지 않는다.

server page에서 즉시:

```text
/login?next=...
```

로 redirect한다.

---

# 이번 작업에서 수정하지 않을 것

다음은 이번 correctness 작업에서 건드리지 마라.

### R2 soft-delete lifecycle

`softDeletePost()` 후 media object를 즉시 삭제하지 않는다.

soft delete는 moderation/recovery 때문에 원본 보존이 의도일 수 있다.

명시적 hard-delete/retention policy가 없는 상태에서 R2 object 삭제를 추가하지 않는다.

### architecture

추가 금지:

* Redis
* queue
* new Durable Object
* new database
* new image service
* third-party validation framework
* new security protocol

작은 helper는 허용.

---

# P2 — profile community creation robustness

P0/P1 완료 후만 처리한다.

`ensureProfileCommunity()`의:

```text
SELECT
INSERT subreddit
INSERT subscription
INSERT moderator
recount
```

multi-write가 concurrent call에서 partial/race가 되지 않게 한다.

가능하면 기존 D1 primitive와 idempotent `INSERT OR IGNORE`/reselect 방식을 사용한다.

새 transaction abstraction을 만들지 않는다.

---

# 필수 regression tests

최소 다음을 추가한다.

### Authorization

```text
Alice owns u_alice
Bob post to u_alice
=> 403
```

```text
Bob /r/u_alice/submit
=> form must not target Alice profile
```

```text
Alice profile post
=> success
```

### Validation

```text
title={}
=> 400

body > 20,000
=> 400

URL > 2,048
=> 400
```

### Media

```text
foreign mediaKey
=> reject

missing R2 object
=> reject

own existing mediaKey
=> success
```

### Image safety

```text
small compressed JPEG/PNG declaring excessive dimensions
=> rejected before full RGBA decode
```

### Idempotency

```text
same requestId twice
=> one posts row
```

```text
image upload succeeded + post response uncertain + retry
=> one post + same mediaKey + no second R2 object
```

### Side effects

```text
post insert succeeds
bumpUserActivity forced to fail
=> post creation remains successful
```

### UI

```text
post detail body occurs once
```

```text
Image composer shortcut
=> image tab active
```

```text
Link composer shortcut
=> link tab active
```

---

# 반드시 실행

repository에 존재하는 명령 기준으로:

```text
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:e2e:chromium
npm run build
```

환경 문제로 실행 불가능한 명령은 정확한 실패 원인과 명령을 보고한다.

테스트를 삭제하거나 약화해서 통과시키지 않는다.

---

# 작업 완료 보고 형식

반드시 아래 순서로 보고한다.

1. `VERIFIED BUGS`
2. `FALSE/OVERSTATED ITEMS FROM PREVIOUS AUDIT`
3. `FILES CHANGED`
4. `INVARIANTS NOW ENFORCED`
5. `TESTS ADDED`
6. `COMMAND RESULTS`
7. `REMAINING RISKS`

`NEEDS DECISION`으로 넘기지 말고 위 contract 안에서 가장 단순한 구현을 선택한다.

새 기능은 추가하지 않는다.
