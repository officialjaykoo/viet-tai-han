맞습니다. **사이트 규모에 비해 버그가 많은 편**입니다. 원인은 기능 수보다, 원래 `red` 구조 위에 인증·보안·번역·미디어·프로필 글쓰기 등을 덧대면서 **“정상 화면에서 한 번 동작하면 끝” 수준의 경로는 있는데 경계조건이 빠진 것**에 가깝습니다.

현재 `main`의 **글쓰기 경로를 작성 화면 → API → D1 → R2 → 상세화면 → 수정/삭제**까지 훑었고, 지금까지 **확정적으로 잡힌 것만** 정리하면 이렇습니다.

## 글쓰기 1차 감사 결과

| 우선순위   | 문제                                     | 판정                        |
| ------ | -------------------------------------- | ------------------------- |
| **P0** | 다른 사람 프로필 피드에 직접 글 작성 가능               | **권한 버그**                 |
| **P0** | Turnstile이 실제 글쓰기 endpoint에서 강제되지 않음   | **보안 버그**                 |
| **P0** | 대형 해상도 이미지의 decode 메모리 방어 없음           | **안정성/DoS 위험**            |
| **P1** | 글 저장 후 부가 작업 실패 시 500 반환 가능            | **쓰기 일관성 버그**             |
| **P1** | 본문 길이 제한 없음                            | **검증 누락**                 |
| **P1** | malformed JSON field가 400 대신 500 유발 가능 | **API 검증 버그**             |
| **P1** | 이미지 게시 재시도 시 R2 고아 파일 생성 가능            | **idempotency 불완전**       |
| **P1** | 실패 후 글 내용을 바꿔도 예전 requestId 재사용        | **idempotency 버그**        |
| **P1** | 존재하지 않는/타인 mediaKey를 게시물에 연결 가능        | **미디어 무결성 버그**            |
| **P1** | 네트워크 오류를 작성폼이 잡지 못함                    | **복구 UX 버그**              |
| **P1** | 상세 페이지에서 글 본문이 두 번 나옴                  | **렌더링 버그**                |
| **P1** | Turnstile 사용 후 실패하면 같은 token으로 재시도     | **재시도 버그**                |
| **P2** | 홈의 이미지/링크 작성 버튼이 실제로는 모두 텍스트 작성으로 감    | **UX 버그**                 |
| **P2** | 편집기가 글 종류와 불일치                         | **모델/UI 불일치**             |
| **P2** | 이미지 삭제 게시물의 R2 lifecycle 불명확           | **저장소/삭제 정책 문제**          |
| **P2** | 프로필용 community 최초 생성이 여러 D1 write로 분리  | **race/partial-write 위험** |

### 1. 가장 심각함 — 남의 프로필에 글쓰기 가능

이게 지금 글쓰기에서 **1순위로 고쳐야 할 것**입니다.

개인 프로필 글은 실제로:

```text
Alice → u_alice 라는 내부 community
Bob   → u_bob
```

구조입니다.

작성 UI에서는 `u_*` community를 숨기고 있지만, 그건 화면 필터일 뿐입니다.

서버는:

```text
subreddit === "profile"
→ 내 프로필

그 외
→ 이름에 해당하는 community가 존재하면 OK
```

라고만 검사합니다.

따라서 Bob이 직접:

```json
{
  "subreddit": "u_alice",
  "title": "..."
}
```

를 보내면 **Alice 프로필용 community에 Bob 글이 들어갈 수 있습니다.**

서버에서 반드시:

```text
u_* community
→ created_by === currentUser.id
```

를 강제해야 합니다.

---

### 2. Turnstile이 실질적으로 우회 가능

현재 순서가 이상합니다.

```text
브라우저
→ Turnstile
→ /api/security/bot-check
→ HUMAN_COOKIE 발급
→ /api/posts
```

그런데 실제 `/api/posts`는 **HUMAN_COOKIE를 확인하지 않습니다.**

대신 클라이언트 JSON의 `_red`:

```text
dwellMs
moves
keys
trusted
webdriver
...
```

를 검사합니다.

이 값들은 암호학적으로 증명된 값이 아니라 클라이언트가 보내는 숫자/boolean입니다.

즉 공격자가 직접 만들어낼 수 있습니다.

Cloudflare도 Turnstile은 **실제 보호할 서버 작업에서 Siteverify 검증이 필수**라고 명시합니다. 토큰은 300초 유효하며 한 번만 사용할 수 있습니다. ([Cloudflare Docs][1])

현재 상태는 좋지 않습니다.

> 정상 사용자는 Turnstile을 거치는데, 직접 API 호출하는 쪽에는 실제 Turnstile 증명이 연결되어 있지 않음.

복잡한 `HUMAN_COOKIE` 체계를 더 키우기보다 **실제 post write와 서버 검증 관계를 단순하고 명확하게 다시 연결하는 것**이 낫습니다.

---

### 3. 이미지 압축 폭탄 방어가 제대로 안 됨

서버에 `MAX_DIMENSION = 2048`이 있어서 처음 보면 안전해 보입니다.

하지만 실제 JPEG/PNG 처리 순서는:

```text
압축 이미지 전체 읽음
↓
JPEG/PNG decode ← 여기서 RGBA 메모리 할당
↓
2048px로 resize
```

입니다.

즉 1MB 미만으로 압축된 비정상적으로 큰 해상도 이미지가 들어오면 **resize 전에 이미 메모리를 먹습니다.**

WebP는 더 심해서 현재 서버에서 decode/resize하지 않고 metadata만 제거해서 저장합니다.

따라서 먼저 header만 읽어서:

```text
width
height
width × height
```

를 검사해야 합니다.

예를 들어:

```text
최대 한 변: 8192
최대 총 pixel: 40MP 정도
```

같은 **decode 전 hard limit**이 필요합니다.

---

### 4. 글이 이미 저장됐는데 사용자에게 실패로 보일 수 있음

`createPost()`는:

```text
INSERT posts
↓
bumpUserActivity() await
↓
achievement
↓
translation
```

순서입니다.

`bumpUserActivity()`는 별도의 D1 write입니다.

그래서:

```text
posts INSERT 성공
↓
user_activity D1 오류
↓
API 500
```

이 가능합니다.

사용자는:

> 글쓰기 실패

를 보는데 실제로는 글이 존재합니다.

그리고 재시도하면 requestId 때문에 기존 post를 바로 반환합니다. 문제는 그 경우 **실패했던 activity update를 다시 실행하지도 않습니다.**

정상 규칙은:

```text
canonical post INSERT 성공
= 글쓰기 성공
```

이어야 합니다.

activity, achievement, translation은 글쓰기 성공 응답을 망가뜨리면 안 됩니다.

---

### 5. 본문 길이 제한이 아예 없음

제목은:

```text
3~300
```

으로 서버에서도 검사합니다.

본문은:

```ts
const body = input.body?.trim() || null;
```

끝입니다.

작성 UI에도 `maxLength`가 없습니다.

따라서 터널 request 상한에 닿을 때까지 상당히 큰 텍스트를 넣을 수 있습니다.

그게 그대로:

```text
D1 저장
moderation
검색 LIKE
Workers AI 번역 chunk
feed/detail rendering
```

전체에 영향을 줍니다.

VTH라면 복잡하게 생각할 것 없이 예를 들어:

```text
title     300
body      20,000 chars
URL       2,048
```

정도로 서버와 UI를 맞추는 게 적절합니다.

---

### 6. API 입력 타입 검사가 없음

`POST /api/posts`가 실제 validation schema 없이:

```ts
const body = ... as {
  subreddit?: string;
  title?: string;
  ...
}
```

캐스팅만 합니다.

그래서 공격자가:

```json
{
  "subreddit": "abc",
  "title": {}
}
```

처럼 보내면 `{}`는 truthy라:

```ts
if (!body.title)
```

을 통과합니다.

그다음:

```ts
input.title.trim()
```

에서 TypeError가 나서 400이 아니라 **500**으로 갈 수 있습니다.

작은 API parser 하나로:

```text
subreddit = required string
title = required string
body = optional string
url = optional string
mediaKey = optional string
requestId = optional string
```

를 입구에서 끝내야 합니다.

---

### 7. 이미지 글 재시도의 idempotency가 반쪽

현재 image post:

```text
requestId 생성
↓
이미지 R2 upload → mediaKey A
↓
POST create
```

입니다.

예를 들어:

```text
R2 upload A 성공
POST create 성공
HTTP response 유실
```

했다고 합시다.

사용자가 다시 누르면:

```text
같은 requestId
↓
이미지 R2 upload B
↓
POST
↓
서버는 기존 post A 발견
↓
기존 post 반환
```

됩니다.

결과:

```text
post → media A

media B → 어디에도 연결되지 않은 고아
```

가 됩니다.

R2 업로드 성공한 `mediaKey`를 **같은 logical submission retry 동안 재사용**해야 합니다.

---

### 8. 반대로 requestId는 너무 오래 유지

현재 `requestIdRef`는 성공할 때만 null이 됩니다.

따라서 한 번 전송 실패 후 사용자가:

```text
제목 변경
본문 변경
이미지 변경
community 변경
```

을 해도 기존 requestId를 계속 쓸 수 있습니다.

이건 이제 동일한 logical write가 아닙니다.

즉:

```text
같은 내용 retry
→ 같은 requestId

draft가 실질적으로 변경됨
→ 새 requestId
```

여야 합니다.

---

### 9. 미디어 검증은 regex뿐

업로드 시에는 이미:

```text
uploadedBy: userId
```

metadata를 저장합니다.

그런데 게시물 생성할 때는:

```ts
isAllowedMediaKey(mediaKey)
```

즉 파일명 모양만 검사합니다.

따라서:

```text
media/abcdefgh.jpg
```

형태만 맞으면 R2에 없어도 post가 생성됩니다.

또 다른 사용자의 key도 넣을 수 있습니다.

최소:

```text
R2 object exists
uploadedBy === current user
```

를 확인해야 합니다.

---

### 10. 네트워크 실패 처리 없음

작성 함수의 큰 async block에 `try/catch`가 없습니다.

그러므로:

```text
challenge fetch 실패
Turnstile request network error
media upload network error
post request network error
```

처럼 **HTTP response 자체를 못 받은 경우** 사용자용 오류 처리 경로가 없습니다.

정상적으로는:

```text
작성 내용 그대로 유지
이미 올린 mediaKey 유지
requestId 유지
"전송에 실패했습니다. 다시 시도하세요."
```

가 되어야 합니다.

---

### 11. 글 상세에서 본문이 두 번 나옴

이건 코드상 100%입니다.

상세 페이지가 먼저:

```tsx
<PostCard post={post} />
```

를 렌더합니다.

그런데 `PostCard`는 이미 body를 4줄까지 보여줍니다.

그 아래에서 다시:

```tsx
<PostBodyPanel body={post.body} />
```

를 렌더합니다.

따라서:

```text
제목
본문 일부

...

본문 전체
```

가 됩니다.

번역 버튼 상태까지 서로 독립이라 언어 표시도 이상해질 수 있습니다.

**feed card와 detail post header를 분리하거나**, PostCard에 `detail` mode를 넣어 상세에서는 body를 한 번만 보여야 합니다.

---

### 12. 이미지/링크 작성 버튼은 현재 눈속임에 가까움

홈 작성창:

```text
텍스트
이미지
링크
```

세 버튼이 있지만 전부 같은 `/submit`으로 갑니다.

작성폼은 항상:

```ts
postType = "text"
```

로 시작합니다.

따라서:

```text
이미지 클릭 → 텍스트 탭
링크 클릭 → 텍스트 탭
```

입니다.

간단히:

```text
/submit?type=text
/submit?type=image
/submit?type=link
```

면 끝납니다.

---

### 13. Turnstile 재시도도 깨짐

Turnstile token은 한 번 Siteverify에서 성공하면 **다시 사용할 수 없습니다.** ([Cloudflare Docs][2])

그런데 현재:

```text
Turnstile 성공
↓
bot-check에서 token 사용
↓
image/post upload 실패
↓
작성 화면 유지
↓
동일 token 유지
```

합니다.

`turnstileReset` ref까지 만들어놓고 작성 실패 시 제대로 reset하지 않습니다.

따라서 재시도할 때 `timeout-or-duplicate` 계열 실패가 날 수 있습니다.

---

## 테스트가 이걸 못 잡은 이유

현재 integration test의 post lifecycle은 주로:

```text
create
edit
soft delete
idempotency
```

정상 경로만 봅니다.

E2E도 실제로는 **일반 텍스트 community post 한 건 작성** 정도입니다.

빠져 있는 게 많습니다.

```text
anonymous /submit
profile post authorization
다른 사람 u_* target
image post
image retry
link post
malformed payload
oversized body
oversized pixel image
media ownership
network failure
response-lost retry
detail rendering
```

그래서 테스트는 통과해도 사용자가 실제 쓰면서 계속 버그를 발견하는 겁니다.

---

# 무엇부터 고쳐야 하나

지금은 **새 기능을 하나도 추가하면 안 됩니다.**

순서는 이게 맞습니다.

**1차 P0**

1. `u_*` 프로필 글쓰기 권한 차단
2. Turnstile 실제 server-write enforcement 정리
3. 이미지 decode 전 dimension/pixel hard limit

**2차 글쓰기 correctness**
4. post payload validator
5. body/URL maximum
6. canonical INSERT 이후 side-effect 실패가 post 요청을 실패시키지 않게 수정
7. image mediaKey ownership/existence
8. requestId + mediaKey retry state 정리
9. network failure recovery

**3차 UX**
10. 상세 본문 중복 제거
11. 이미지/링크 shortcut 정상 연결
12. edit UI와 post 모델 일치
13. `/submit` anonymous 즉시 redirect

그다음 테스트를 **정상 경로가 아니라 실패/race/retry 중심**으로 다시 만들어야 합니다.

여기까지 보면 사용자 말대로입니다. VTH는 기능이 많은 서비스라서 어려운 게 아니라, **핵심 글쓰기 하나에도 서버 invariant가 충분히 정의되지 않은 상태**입니다. 우선 글쓰기부터 완전히 닫아버리고 다음 기능으로 넘어가는 방식이 맞습니다.

[1]: https://codex-container-api-docs.previews.developers.cloudflare.com/turnstile/get-started/server-side-validation/?utm_source=chatgpt.com "Validate the token · Cloudflare Turnstile docs"
[2]: https://codex-container-api-docs.previews.developers.cloudflare.com/turnstile/get-started/server-side-validation/ "https://codex-container-api-docs.previews.developers.cloudflare.com/turnstile/get-started/server-side-validation/"
