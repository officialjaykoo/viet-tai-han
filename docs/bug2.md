다시 관계 기능만 기준으로 실제 코드를 따라가 봤습니다. 결론부터 말하면 **친구/팔로우 자체보다 `차단 ↔ DM 요청 ↔ 기존 대화방` 경계가 더 위험합니다.** 특히 단순 UX 문제가 아니라 **명시적으로 거절한 메시지가 나중에 전달될 수 있는 버그**까지 있습니다.

## 현재 확인된 핵심 버그

| 등급          | 문제                                       | 영향                   |
| ----------- | ---------------------------------------- | -------------------- |
| **P0**      | 거절했던 DM 첫 메시지가 나중에 다시 전달됨                | 동의/프라이버시 침해          |
| **P0**      | block과 메시지 send가 동시에 일어나면 차단 후 메시지 저장 가능 | 차단 invariant 위반      |
| **P0**      | DM accept가 원자적이지 않음                      | accepted인데 채팅 불가능 상태 |
| **P0**      | 차단된 숨은 대화방의 unread가 전역 카운트에 남음           | 메시지 숫자 유령 현상         |
| **P0**      | A→B / B→A 동시 첫 DM 요청 시 pending 2개 가능     | 대화 상태 꼬임             |
| **P1**      | block해도 pending DM request 자체는 취소 안 됨    | unblock 후 요청 부활      |
| **P1**      | 친구수락/팔로우 성공 후 DM 자동승격 실패 시 부분 성공         | 친구인데 요청은 pending     |
| **P1**      | 나를 먼저 차단한 사람을 내가 맞차단할 수 없음               | 프라이버시 제어 부족          |
| **P1**      | 첫 DM 재시도 ID가 상대/본문 변경 후에도 유지             | 엉뚱한 기존 요청 반환 가능      |
| **P1**      | 보낸 DM 요청을 sender가 볼 수도, 취소할 수도 없음        | 요청 상태 UX 단절          |
| **P1 후보**   | block→unblock하면 기존 active DM이 자동 부활      | 다른 관계 삭제 정책과 불일치     |
| **P2**      | 친구가 된 시각이 실제 수락시각이 아님                    | 표시 데이터 오류            |
| **P2**      | 프로필의 친구/팔로우/차단 버튼 네트워크 실패 처리 부족          | 오류 UX                |
| **Privacy** | 로그인 안 해도 최근 온라인 사용자 목록 조회 가능             | presence 노출          |

---

# 1. P0 — **거절한 DM 메시지가 나중에 살아난다**

이게 이번 감사에서 가장 나쁩니다.

현재 첫 DM 요청은:

```text
chat_requests
status = pending

chat_messages
delivery_status = pending
```

두 개를 만듭니다.

그런데 B가 거절하면:

```text
chat_requests.status = declined
recipient membership = declined
```

만 바꿉니다.

**pending `chat_messages`는 안 지웁니다.**

문제는 나중에 다른 요청을 수락할 때입니다.

현재 수락 코드는:

```sql
UPDATE chat_messages
SET delivery_status = 'delivered'
WHERE room_id = ?
  AND delivery_status = 'pending'
  AND is_shadow_hidden = 0
```

입니다.

즉 **현재 수락한 요청에 해당하는 메시지가 아니라 그 방의 모든 옛날 pending 메시지**를 배달합니다.

실제로:

```text
1. A → B
   "안녕하세요. 이야기해요."

2. B → 거절

3. 며칠 뒤 A → B
   "질문 하나만 할게요."

4. B → 이번 요청은 수락

현재 가능 결과:

"안녕하세요. 이야기해요."  ← 예전에 거절한 것
"질문 하나만 할게요."      ← 이번에 수락한 것
```

둘 다 나타날 수 있습니다.

### 반드시 고쳐야 할 invariant

```text
declined/cancelled request
→ 그 request의 pending opener는 절대로 이후 delivered가 되면 안 됨
```

VTH 규모라면 복잡한 시스템 필요 없습니다.

**가장 단순한 방법:**

```text
decline/cancel
→ 해당 room의 현재 pending opener 삭제

accept
→ 현재 request sender의 현재 pending만 delivered
```

그리고 아래 5번에서 설명할 **한 room에 pending request 최대 1개**를 DB에서 보장하면 훨씬 단순해집니다.

---

# 2. P0 — 차단과 메시지 전송 race

일반 메시지는 먼저 block 상태를 SELECT 합니다.

```text
block 없음?
sender active?
recipient active?
```

를 확인합니다.

그다음:

```text
rate limit
moderation
```

을 거치고 마지막 INSERT는 그냥:

```sql
INSERT INTO chat_messages (...)
VALUES (...)
```

입니다.

**최종 INSERT에 block 조건이 없습니다.**

그러면 이런 순서가 가능합니다.

```text
A send 시작
↓
block 없음 확인

B가 A block
↓
user_blocks INSERT 성공

A send 계속
↓
chat_messages INSERT 성공
```

즉 **차단이 먼저 DB에 기록됐는데 메시지가 그 뒤 저장될 수 있습니다.**

친구/팔로우 쪽은 오히려 이걸 이미 잘 처리했습니다.

`followUser`는 최종 INSERT 자체에:

```sql
WHERE NOT EXISTS (
    SELECT 1 FROM user_blocks ...
)
```

를 넣습니다.

친구 요청도 같은 식입니다.

**DM도 똑같이 하면 됩니다.**

최종 메시지 INSERT가:

```text
sender active
recipient active
AND NOT EXISTS block
```

일 때만 성공하도록 해야 합니다.

> 사전 SELECT는 편의 검사이고, 최종 INSERT가 authoritative해야 합니다.

---

# 3. P0 — DM 수락이 반쪽짜리 transaction

현재 수락은:

```text
① chat_requests
   pending → accepted
```

를 먼저 단독으로 실행합니다.

그 뒤:

```text
② members → active
③ pending messages → delivered
```

를 `batch()`합니다.

그러면:

```text
① 성공
↓
Cloudflare/D1 일시 오류
↓
②③ 실패
```

가 가능합니다.

DB:

```text
request       accepted
sender        active
recipient     pending
message       pending
```

이 됩니다.

UI에서는:

> 요청 수락됨

인데 실제 방은 안 열릴 수 있습니다.

더 문제인 것은 재시도입니다.

`respondToChatRequest()`는 이미:

```text
status === accepted
```

이면 성공으로 그냥 반환할 수 있습니다.

그러면 망가진 membership/message를 복구하지 않습니다.

### 고쳐야 하는 것

다음이 **하나의 상태전이**여야 합니다.

```text
pending request
        ↓
+---------------------------+
| request = accepted        |
| sender member = active    |
| recipient member = active |
| current opener = delivered|
+---------------------------+
```

하나가 실패하면 전부 실패.

---

# 4. P0 — 차단한 방은 안 보이는데 unread는 계속 센다

이건 사용자가 전에 말한:

> 메시지 확인했는데 숫자가 안 없어짐

계열과 직접 연결될 수 있는 구조입니다.

대화방 목록은 양방향 block을 검사해서 숨깁니다.

```sql
WHERE NOT EXISTS (
  SELECT 1 FROM user_blocks ...
)
```

그런데 block을 해도 chat membership은 삭제하지 않고 `active` 그대로 둡니다.

테스트도 일부러:

```text
block 후 active membership = 2
```

를 확인합니다.

그런데 전역 unread는:

```text
membership_status = active
unread message인가?
```

만 확인하고 **block은 확인하지 않습니다.**

따라서:

```text
A가 보낸 unread 3개
↓
B가 A를 차단
↓
대화방 목록에서는 A 방 사라짐
↓
전역 메시지 숫자 = 3
```

이 가능합니다.

B는 일반 UI로 방을 열 수도 없으므로 **3을 지울 수도 없습니다.**

### 수정

canonical unread query에도:

```sql
NOT EXISTS (
  block between me and peer
)
```

가 들어가야 합니다.

그리고 block 직후 derived `unread_fanout`도 reconcile해야 합니다.

---

# 5. P0 — 서로 동시에 첫 DM 보내면 pending 요청이 2개 생길 수 있음

DB에는 한 DM room당:

```text
pair_key UNIQUE
```

라 방은 하나입니다.

좋습니다.

그런데 pending request unique는:

```sql
(from_user_id, to_user_id)
WHERE status = 'pending'
```

입니다.

따라서:

```text
A → B pending
B → A pending
```

은 서로 다른 tuple이라 둘 다 DB상 허용됩니다.

코드에서는 INSERT 전에:

```sql
WHERE room_id = ? AND status='pending'
```

을 검사하지만 SELECT와 INSERT 사이가 원자적이지 않습니다.

동시에 보내면 둘 다:

```text
pending 없음
```

을 읽고 둘 다 INSERT할 수 있습니다.

그 결과:

```text
room 1개
pending request 2개
pending opener 2개
membership last-write-wins
```

가 됩니다.

그리고 1번 버그와 결합하면 어느 요청 하나를 수락하면서 **둘의 pending message가 같이 delivered**될 수도 있습니다.

### 해결은 아주 단순

DM room이 pair당 하나니까:

```sql
CREATE UNIQUE INDEX ...
ON chat_requests(room_id)
WHERE status = 'pending';
```

이면 됩니다.

> **1 room = maximum 1 pending request**

이 invariant 하나가 필요합니다.

---

# 6. P1 — 차단해도 pending DM 요청을 실제로 취소하지 않는다

현재 `blockUser()`가 제거하는 것은:

```text
user_follows 양방향
user_friendships
```

입니다.

`chat_requests`는 건드리지 않습니다.

요청 목록에서는 block을 검사해서 pending request를 잠시 숨깁니다.

따라서:

```text
A → B DM request
↓
B blocks A

DB request = pending  ← 그대로

화면 = 안 보임

B unblocks A

DB request = pending
↓
다시 화면에 나타남
```

이 됩니다.

**차단은 단순 UI filter가 아니라 outstanding contact permission을 폐기해야 합니다.**

block할 때:

```text
pending chat request → cancelled
pending opener → 폐기
```

까지 해야 합니다.

`chat_requests.status`에는 이미 `cancelled` 상태가 정의돼 있습니다.

그걸 쓰면 됩니다.

---

# 7. P1 — 친구수락/팔로우 성공과 DM 승격 성공이 묶여 있음

예를 들어 follow:

```text
user_follows INSERT 성공
↓
await promotePendingChatRequestsForPair(...)
```

입니다.

승격에서 D1 오류가 나면:

```text
follow는 이미 됨
HTTP는 실패
```

가 됩니다.

그런데 사용자가 다시 Follow를 누르면 `INSERT OR IGNORE`의 변화량이 0이므로:

```text
이미 following
→ 성공 반환
```

하고 **DM 승격은 재시도하지 않습니다.**

친구 수락도 동일합니다.

```text
friendship = accepted
↓
await promotePendingChatRequestsForPair
```

결국:

```text
친구 관계는 성립
그런데 옛날 DM request는 pending
```

같은 상태가 생길 수 있습니다.

### 원칙

```text
friend/follow canonical write 성공
≠
chat promotion 실패 때문에 관계 action 전체 실패
```

승격은 **idempotent + 재조정 가능**해야 합니다.

---

# 8. P1 — 상대가 날 차단하면 나는 상대를 차단할 수 없다

프로필 UI가:

```tsx
showBlock && !blockedByThem
```

일 때만 Block 버튼을 렌더합니다.

즉 Alice가 Bob을 먼저 차단하면 Bob은 Alice 프로필에서:

```text
친구 X
팔로우 X
메시지 X
차단 X
```

입니다.

Bob도 Alice를 차단하고 싶어도 못 합니다.

이게 왜 문제냐면 Alice가 나중에 unblock하면 Bob은 원치 않아도 다시 Alice와 관계가 열립니다.

**양방향 block은 독립적이어야 합니다.**

```text
Alice blocks Bob
Bob blocks Alice
```

둘 다 동시에 존재할 수 있어야 합니다.

서버 DB 구조는 이미 가능합니다. **UI만 막고 있습니다.**

---

# 9. P1 — 첫 DM의 idempotency ID가 다른 사람에게까지 재사용됨

클라이언트:

```ts
composeClientMessageIdRef.current ?? crypto.randomUUID()
```

를 쓰고 성공해야만 null로 만듭니다.

예:

```text
A에게 "안녕" 요청
↓
서버 저장 성공
↓
응답 유실
```

클라이언트는 실패한 줄 압니다.

사용자가 상대를 B로 바꾸고:

```text
B에게 "질문 있어요"
```

를 다시 보냅니다.

그런데 같은 `clientMessageId`입니다.

서버는 요청 처음에:

```text
senderId + requestId
```

만 보고 기존 conversation을 찾습니다. **현재 toUsername을 확인하기 전에** 기존 것을 반환합니다.

즉 B로 새로 보낸 행동이 A의 기존 요청 결과와 reconcile될 수 있습니다.

### 규칙

```text
같은 recipient + 같은 body의 retry
→ 같은 clientMessageId

recipient 변경
OR body 실질 변경
→ 새 clientMessageId
```

---

# 10. P1 — 내가 보낸 DM 요청은 UI에서 사라진다

`GET /api/messages`가 반환하는 request는:

```ts
listIncomingRequests(userId)
```

뿐입니다.

즉 sender의:

```text
보낸 요청
```

목록이 없습니다.

메시지 전송 성공 후 `conversationType === "request"`이면 클라이언트는:

```text
compose 비움
loadInbox()
```

만 합니다.

방으로 이동하지도 않고 별도 outgoing state도 없습니다.

그래서 사용자 입장에서는:

> 내가 보냈나?
> 상대가 아직 안 봤나?
> 거절했나?
> 취소할 수 있나?

가 전혀 안 보입니다.

친구 요청은 `/friends`에:

```text
incoming
outgoing
friends
```

세 칸을 제대로 만들어놨습니다.

DM도 최소한:

```text
받은 요청
보낸 요청
```

은 있어야 합니다.

새 시스템 만들 필요 없습니다. 기존 `chat_requests` 조회 하나면 됩니다.

---

# 11. `block → unblock` 기존 대화 자동복구는 의도적으로 구현돼 있음

이건 **코드 실수가 아니라 현재 설계 선택**입니다.

테스트에도:

```text
기존 active room
→ unfollow
→ allowDms nobody
→ 그래도 room 유지
```

가 명시되어 있습니다.

block 시에도 membership을 active로 그대로 보존합니다.

따라서:

```text
친구
↓
active chat
↓
block
```

하면:

* friendship 삭제
* follow 삭제
* chat membership 유지
* 방만 block filter로 숨김

입니다.

이후 unblock하면 friendship/follow는 자동 복구하지 않지만 **chat은 곧바로 다시 active**가 될 수 있습니다.

이건 좀 일관성이 없습니다.

### 제 추천

VTH에서는 **block을 가장 강한 관계 단절**로 정의하는 게 단순합니다.

```text
BLOCK
├─ follow 양방향 제거
├─ friendship 제거
├─ pending DM 취소
└─ active direct-chat permission도 revoke
```

단, **메시지 history 자체는 삭제하지 않는다.**

그리고 unblock:

```text
단순히 block 해제
```

만 합니다.

다시 대화하려면 현재 friend/follow/DM-request 정책을 새로 통과.

이게 가장 예측 가능합니다.

---

# 12. P2 — 친구가 된 날짜가 실제 수락 날짜가 아님

친구 요청 row:

```text
created_at = 요청 보낸 시각
updated_at = 수락 시 갱신
```

입니다.

그런데 `listFriends()`는 친구의 `since`로:

```text
f.created_at
```

을 반환합니다.

예:

```text
9월 1일 요청
9월 8일 수락
```

실제로 친구가 된 것은 9월 8일인데 UI는 9월 1일 기준 시간을 보여줄 수 있습니다.

accepted friendship에서는 `updated_at`을 써야 합니다.

---

# 13. P2 — 프로필 관계 버튼은 network exception 처리가 약함

`ProfileActions.run()`은 HTTP 4xx/5xx 응답은 처리하지만 전체 `apiFetch()`를 감싸는 `try/catch`가 없습니다.

그러므로:

```text
Follow 클릭
Wi-Fi 순간 끊김
```

같이 fetch 자체가 throw하면 사용자에게 정상적인:

> 네트워크 오류. 다시 시도하세요.

경로가 없습니다.

DM request의 `respond()`도 동일 계열입니다.

반면 `/friends` 전용 화면은 제대로 `try/catch/finally`가 있습니다.

같은 패턴으로 통일하면 됩니다.

---

# 14. Privacy — 온라인 상태가 익명에게도 공개됨

`GET /api/presence`는 로그인 필수가 아닙니다.

```ts
const session = await getSession();
listOnlineUsers(session?.user?.id ?? null)
```

입니다.

그리고 반환 데이터에는:

```text
username
name
image
lastSeenAt
```

가 들어갑니다.

즉 익명 사용자도 최근 5분간 활동한 계정을 조회할 수 있습니다.

이건 기능 버그라기보다는 **프라이버시 노출**입니다.

VTH 같은 작은 커뮤니티라면 저는 최소한:

```text
People online
→ 로그인 사용자에게만
```

으로 하는 편을 권합니다.

다행히 로그인 사용자의 경우 **차단 양방향 필터는 제대로 되어 있습니다.**

---

# 반대로 잘 되어 있는 것도 있다

전부 엉망은 아닙니다.

친구 쪽은 상당히 고쳐져 있습니다.

* friendship `pair_key UNIQUE` → 두 사람 사이 친구 row 하나.
* duplicate/concurrent follow → 한 edge만 생성.
* concurrent friend accept → idempotent.
* friend accept ↔ block race → accepted friendship이 남지 않도록 방어.
* block하면 follow 양방향과 friendship 삭제.
* follow/friend 최종 INSERT/UPDATE에 block 조건을 다시 넣음.
* DM `followers` 방향도 틀리지 않았음.
* 온라인 목록의 차단 양방향 필터도 정상.

실제 친구 테스트도 duplicate follow, concurrent accept, block race 등을 꽤 잘 검사하고 있습니다.

**문제는 그 수준의 invariant 방어가 DM request에 아직 안 들어간 것입니다.**

---

# 왜 테스트가 통과했는데 이런 게 남았나

현재 DM 테스트는:

* 정상 request
* retry idempotency
* followers/friends 정책
* request promotion
* unfollow 후 기존 room
* 순차적인 block
* message retry
* pagination/read

은 상당히 잘 봅니다.

그런데 제가 찾은 핵심 실패 케이스는 다 빠져 있습니다.

```text
decline
→ 새 request
→ accept
→ 옛 pending opener가 살아나는가?

block
↔ send 동시 실행

A→B request
↔ B→A request 동시 실행

accept 중간 D1 failure

unread 존재
→ block
→ hidden room이 unread에 남는가?

pending request
→ block
→ unblock
→ request가 부활하는가?

response loss
→ recipient 변경
→ 같은 clientMessageId retry
```

이 테스트가 없습니다.

그래서 **정상 동작 테스트는 통과하면서 관계 상태 머신은 깨질 수 있었던 겁니다.**

---

## 지금 고칠 순서

저라면 다른 기능 손대지 않고 이 순서로 갑니다.

```text
P0-1
declined/cancelled pending message 재전달 금지

P0-2
final DM INSERT에 authoritative block 조건

P0-3
DM accept를 atomic transition으로 변경

P0-4
blocked room unread 제외 + block 시 unread reconcile

P0-5
1 room = max 1 pending request DB constraint

P1-1
block → pending chat request cancelled

P1-2
friend/follow → chat promotion 부분성공 복구

P1-3
상대가 나를 block해도 내가 맞block 가능

P1-4
conversation clientMessageId를 recipient/body와 묶음

P1-5
outgoing DM request 표시/취소
```

**새 기능 추가가 아니라 지금 있는 관계 시스템의 무결성을 완성하는 작업**입니다.

그리고 이번에 본 것 중에서는 **`거절한 메시지가 나중에 전달되는 문제`와 `차단된 숨은 방이 unread에 계속 잡히는 문제`부터 바로 고쳐야 합니다.** 이 두 개는 실제 사용자에게 바로 이상하게 보일 수 있는 버그입니다.
