# bug8.md — Messaging / Realtime DM Reliability & Convergence Audit

## 0. 이번 작업의 기준

이 문서는 **Bug7 완료 이후 최신 `main`** 을 기준으로 한다.

과거 bug8 문서를 기계적으로 다시 구현하지 마라.

먼저 최신 코드를 읽고:

```text
Bug7에서 이미 해결됨
현재도 실제로 남아 있음
Bug7 때문에 새로 생긴 cross-domain 문제
Clonagram에서 참고할 가치 있음
의심했으나 현재 코드에서는 이미 안전함
```

을 구분한 뒤 수정한다.

이번 작업의 최종 질문은 다음이다.

> HTTP, D1, Durable Object, WebSocket, Push, React client가 서로 다른 순서와 속도로 동작해도 최종적으로 하나의 canonical DM state로 수렴하는가?

단순 정상 경로 테스트가 아니다.

다음을 일부러 망가뜨린다.

```text
HTTP response loss
HTTP timeout
same request retry
WebSocket duplicate
WebSocket reversed order
WebSocket delayed event
WebSocket event completely missing
disconnect/reconnect
D1 success + DO failure
D1 success + Push failure
block during broadcast
read during new message arrival
multiple browser tabs
room switch during fetch
moderation change during open chat
background task order reversal
```

---

# 1. 절대 유지할 VTH architecture

다음 구조를 변경하지 마라.

```text
D1
= canonical persistent state

HTTP API
= canonical mutation/write path

Durable Object / WebSocket
= committed event를 빠르게 전달하는 best-effort realtime layer

Push
= best-effort secondary notification

React state
= 언제든 D1에서 복구 가능한 projection
```

금지:

```text
WebSocket을 message write path로 사용
DO에 canonical history 저장
D1 + DO 이중 message database
polling으로 회귀
client state를 authoritative state로 취급
```

---

# 2. Bug7 완료 상태를 baseline으로 인정하라

Bug7에서 이미 구현된 다음 사항을 다시 새 구조로 만들지 마라.

## Block / relationship

현재 block은 이미 D1 batch에서:

```text
bilateral follow 제거
friendship 제거
pending friend/chat request 취소
pending chat opener 제거
room membership left
관련 notification read
unread reconciliation
```

을 수행한다.

또 send/create/activation SQL은 현재 block 및 active membership을 conditional write에서 다시 확인한다.

따라서 이번 bug8의 핵심은:

> block 자체의 relational teardown을 다시 만드는 것

이 아니다.

핵심은:

> **D1 block이 commit된 뒤 이미 실행 중인 비동기 transport/side effect가 그 권한 경계를 넘어가는가**

이다.

---

# 3. 이미 강한 기존 DM invariant는 보존

현재 이미 존재하는 것을 제거하거나 단순화하지 마라.

```text
pair_key 기반 canonical DM room
(room_id, sender_id, client_message_id) idempotency
request/opener integrity
pending request uniqueness
signed before/after cursor
(created_at, id) deterministic ordering
monotonic server read boundary
shadow-hidden recipient exclusion
block-aware conditional send
request accept repair
declined/cancelled opener cleanup
```

관련 migration도 최신 전체를 읽는다.

최소:

```text
0035_write_idempotency.sql
0036_chat_reliability.sql
0038_chat_request_integrity.sql
0039_cancel_orphan_pending_chat_requests.sql
0040_notification_request_identity.sql
```

0039/0040을 빼먹고 과거 bug8 기준으로 분석하지 마라.

---

# 4. Clonagram 비교를 먼저 수행

다음 실제 Clonagram 구현을 읽고 비교한다.

```text
src/actions/dm/sendMessage.ts
src/actions/dm/markChatRead.ts
src/actions/dm/acceptRequest.ts
src/actions/dm/blockAndDeleteRequest.ts
src/actions/dm/createConversation.ts
src/actions/dm/findOrCreateDirectConversation.ts

src/hooks/useSendMessage.ts

src/pageComponents/DirectMessages/components/ChatView/
src/pageComponents/DirectMessages/components/ChatView/hooks/
  useRealtimeChat.ts
  useMessageWindow.ts
  useChatScrollAndRead.ts

e2e/direct-messages.spec.ts
```

분류:

```text
ADOPT
ADAPT
VTH ALREADY STRONGER
REJECT
OUT OF SCOPE
```

### 예상 방향

#### ADOPT concept

```text
realtime event를 canonical truth가 아니라
projection 갱신 / canonical resync 신호로 보는 사고방식

chat UI responsibility를 hook 단위로 분리

viewport/read handling 분리
```

#### ADAPT

Clonagram은 realtime INSERT/UPDATE 시 React Query invalidate로 DB를 다시 읽는다.

VTH는 이것을 그대로 하지 마라.

VTH는:

```text
정상 live event
→ 즉시 local projection

reconnect / refocus / uncertain transport / revocation
→ D1 authoritative catch-up/resync
```

구조로 유지한다.

매 메시지마다 room 전체 refetch 금지.

#### VTH ALREADY STRONGER

```text
clientMessageId idempotency
conditional D1 writes
signed tuple cursor
server monotonic read tuple
request state machine
block/write race protection
```

Clonagram 방식으로 단순화 금지.

#### REJECT

```text
Supabase Auth
Supabase RLS를 VTH authorization으로 대체
Supabase Realtime
Supabase Storage
simple INSERT-only message send
현재 시각만 이용한 read model
```

#### OUT OF SCOPE

```text
group chat
voice call
video call
stickers
voice message
image DM
```

이번 bug8에서 추가하지 마라.

---

# 5. 구현 전에 State / Event / Authority 표를 작성

최소 다음 entity를 작성한다.

```text
ChatRoom
ChatRoomMember
ChatRequest
ChatMessage
ReadBoundary
UnreadProjection
RealtimeConnection
LocalOptimisticMessage
BlockRelationship
```

각 필드마다:

```text
canonical authority
projection/cache
mutation path
recovery path
```

를 적는다.

예:

| State             | Canonical                  | Projection                | Recovery                        |
| ----------------- | -------------------------- | ------------------------- | ------------------------------- |
| message existence | D1                         | React                     | history/catch-up                |
| message ordering  | `(created_at,id)`          | sorted React list         | D1                              |
| unread            | D1 predicate/read boundary | room/nav counters         | authoritative refresh           |
| socket permission | D1 membership/block/status | open WS                   | revoke/reconnect validation     |
| sending state     | D1 message existence       | local sending/sent/failed | clientMessageId lookup/catch-up |

이 표 없이 바로 리팩터링하지 마라.

---

# P0-1 — CONFIRMED BUG: out-of-order live unread

현재 `applyIncomingRoomMessage()`는:

```text
이 message가 room preview 최신인가?
```

와

```text
이 message가 처음 보는 unread인가?
```

를 같은 조건으로 취급한다.

이것은 잘못된 모델이다.

## 재현

Canonical:

```text
M1
M2
```

WebSocket arrival:

```text
M2
M1
```

M2가 먼저 room latest가 된다.

그 뒤 M1은 preview보다 오래됐다는 이유로 무시될 수 있다.

그러나 M1은:

```text
새로운 canonical message
recipient message
아직 read boundary 뒤
```

라면 unread 1개를 추가해야 한다.

## 수정 원칙

다음 세 가지를 분리하라.

```text
1. message deduplication

2. room preview ordering

3. unread accounting
```

### Preview

```text
max(createdAt, id)
```

만 사용.

### Deduplication

canonical message identity로 판단.

```text
message.id
own optimistic message라면 clientMessageId reconciliation
```

### Unread

최소:

```text
new unique canonical inbound message
AND after read boundary
AND viewer가 이미 읽고 있는 것으로 확정되지 않음
```

이어야 한다.

## 중요

단순히:

```text
Set<all seen message ids>
```

를 영원히 유지하는 식으로 메모리를 무한 증가시키지 마라.

가능한 구조:

```text
현재 loaded message window 기반 dedupe
merge 결과에서 "new canonical insertion" metadata 반환
bounded room state
```

등을 평가한다.

예를 들어 pure state helper를:

```ts
mergeMessagesWithResult(...)
```

처럼 만들어:

```text
mergedMessages
insertedCanonicalIds
replacedOptimisticIds
duplicates
```

를 반환하는 것도 가능하다.

정확성을 우선하고 가장 단순한 bounded 구조를 선택한다.

## 필수 테스트

```text
M1 → M2
M2 → M1

M1 → M1
M2 → M1 → M2

REST M1 → WS M1
WS M1 → REST M1

catch-up M1 → WS M1
WS M1 → catch-up M1

optimistic local M1 → WS canonical M1
```

최종:

```text
canonical messages exactly once
correct deterministic order
unread exactly once per logical inbound unread message
```

---

# P0-2 — CONFIRMED BUG: Read acknowledgment race

서버의 read state는 이미:

```text
(created_at, message_id)
```

tuple로 monotonic하게 관리된다.

이 서버 모델은 유지한다.

문제는 client다.

현재 client는 사실상:

```text
room.lastMessageId === acknowledgedMessageId
```

일 때만 unread를 제거한다.

## 재현

```text
unread:
M1 M2 M3

POST read(M3)

응답 전:
M4 arrives

room latest = M4

read(M3) server success
```

실제 canonical state:

```text
M1 M2 M3 = read
M4 = unread
```

현재 client가 M3 acknowledgment 전체를 버리면:

```text
unread = 4
```

같은 과대계상이 가능하다.

## 서버 response 개선

가능하면 다음처럼 authoritative boundary를 반환한다.

```json
{
  "roomId": "...",
  "readThrough": {
    "messageId": "...",
    "createdAt": "..."
  },
  "updated": true
}
```

이름은 현재 코드 style에 맞게 결정.

핵심은:

> messageId 하나가 아니라 logical tuple boundary를 client가 알 수 있어야 한다.

`updated:false`이어도 현재 canonical boundary를 반환하는 것이 유용한지 검토한다.

## Client reconciliation

```text
message <= readThrough
→ read

message > readThrough
→ unread 가능
```

으로 계산한다.

M4를 보존하면서 M1–M3만 제거할 수 있어야 한다.

room unreadCount 하나만으로 부분 제거가 불가능하다면 live unread에 대한 최소한의 tuple metadata를 유지하도록 state model을 보강한다.

단순 global count decrement 추측 금지.

## 필수 테스트

```text
read M3
→ M4 arrives
→ read response M3
= M4 only unread
```

추가:

```text
read(M4) response 먼저
read(M3) response 나중

Tab A read M3
Tab B read M4

read M3 × 100

이미 읽은 M2 read

동일 timestamp:
M3 < M4 by id
```

read boundary는 절대로 뒤로 이동하면 안 된다.

---

# P0-3 — CONFIRMED SECURITY GAP: Existing WebSocket revocation

현재 `ChatRoom` DO는 connect 시:

```text
membership
peer membership
block
```

을 확인한다.

그러나 이미 열린 socket은 이후 D1 상태가 바뀌어도 남는다.

`/broadcast` 역시 현재 room socket들에게 전달할 때 membership/block/status를 다시 확인하지 않는다.

## 반드시 해결할 상태 변화

```text
block
membership active → left
user active → banned
```

## 가장 중요한 race

```text
1. B sends M1
2. D1 M1 commit
3. realtime broadcast task pending
4. A blocks B
5. D1 block/membership-left commit
6. delayed broadcast M1 runs
```

질문:

> block API가 성공했다고 사용자에게 반환된 뒤 기존 A socket으로 M1이 전달될 수 있는가?

최종 답은 **No**여야 한다.

---

# 6. Revoke protocol을 명시적으로 설계

가장 단순하면서 보안 경계가 확실한 방식을 선택한다.

후보:

```text
POST /revoke
room DO socket close by user tag

membership generation/epoch

broadcast-level one-room authorization check
```

무조건 socket마다 DB query하지 마라.

## 권장 방향

Block/revoke state가 D1에 commit된 후:

```text
D1 canonical revoke
→ room DO revoke command
→ matching sockets close
```

를 지원한다.

그러나:

> DO revoke가 best-effort이기만 하면 보안 invariant가 되지 않는다.

따라서 delayed broadcast가 block 이후 새 payload를 내보내지 못하도록 추가 방어가 필요하다.

예:

```text
broadcast 전에 room-level current authorization 확인
```

또는:

```text
membership generation / authorization version
```

등.

성능을 측정하고 가장 단순한 것을 선택한다.

---

# 7. Realtime terminal event

필요하면 protocol을:

```text
ready
message
revoked
```

로 확장한다.

예:

```json
{
  "type": "revoked",
  "roomId": "...",
  "reason": "membership_revoked"
}
```

client는 terminal revoke를 받으면:

```text
socket close
reconnect backoff 중단
selected room 종료
inbox authoritative refresh
unread refresh
```

해야 한다.

block된 room에 1s→2s→4s로 영구 재접속하는 loop를 만들지 마라.

---

# P0-4 — CONFIRMED BUG: canonical sent → failed downgrade

현재 optimistic message state:

```text
sending
sent
failed
```

가 존재한다.

올바른 단방향 규칙:

```text
sending → sent
sending → failed

failed → sending
sending → sent
```

그러나 canonical evidence가 생긴 뒤에는:

```text
sent → failed
```

이 일어나면 안 된다.

## 재현

```text
1. optimistic M1 = sending
2. server D1 commit 성공
3. WS canonical echo M1 먼저 도착
4. merge → M1 sent
5. HTTP transport timeout/error
6. catch handler → same clientMessageId failed
```

결과가 failed가 되면 버그다.

## 핵심 invariant

> **Canonical server evidence dominates transport outcome.**

canonical evidence:

```text
canonical message id
successful HTTP canonical response
D1 catch-up result
WebSocket committed message event
```

중 하나를 이미 받은 경우 늦은 transport error가 이를 downgrade할 수 없다.

## 수정

`updateLocalDeliveryState()` 또는 caller가:

```text
local optimistic row인지
이미 canonical row로 교체됐는지
```

구분한다.

예:

```text
id starts local:
vs
canonical id
```

만으로 처리할지 더 명시적인 field를 둘지 결정한다.

중요한 것은 state invariant다.

## uncertain HTTP 결과

HTTP 결과를 잃었지만 canonical evidence가 아직 없다면:

```text
즉시 영구 failed 확정
```

보다:

```text
uncertain → same clientMessageId retry
또는 D1 catch-up
```

가 더 정확한지 검토한다.

새 UI state를 반드시 추가하라는 뜻은 아니다.

기존 UX를 유지하면서 logical correctness를 확보한다.

## 필수 테스트

```text
WS canonical → HTTP timeout
WS canonical → HTTP 5xx transport ambiguity
HTTP canonical → duplicate WS
HTTP response lost → retry same clientMessageId
retry response → original canonical body/id
```

어떤 경우에도 canonical message가 failed로 내려가지 않아야 한다.

---

# P0-5 — Bug7 cross-domain mismatch: canMessage vs established room

현재 backend 정책을 먼저 확인하라.

`startConversation()`에는 기존 active room에 대해:

```text
Existing active rooms survive privacy changes and unfollows.
```

라는 semantics가 있다.

즉:

```text
A와 B existing active room
→ unfollow
→ allowDms 변경
```

이 있어도 기존 active conversation은 계속 가능할 수 있다.

그러나 Bug7 `RelationshipProjection.canMessage`는:

```text
directAllowed || requestAllowed
```

중심이라 active room 자체를 고려하지 않는다.

## 결과 가능성

```text
backend:
대화 가능

profile:
Message 버튼 없음
```

같은 불일치가 생길 수 있다.

## 해결 원칙

DM authorization semantics를 하나만 둔다.

가능하면 server helper에서 다음을 함께 계산한다.

```text
blocked
relationship directAllowed
relationship requestAllowed
activeEstablishedRoom
canMessage
messageMode
```

예:

```ts
type DmAccessProjection = {
  blocked: boolean;
  activeRoomId: string | null;
  directAllowed: boolean;
  requestAllowed: boolean;
  canMessage: boolean;
  mode: "existing" | "direct" | "request" | "none";
};
```

정확한 naming은 현재 코드 convention에 맞춘다.

## 기본적으로 보존할 현재 backend 정책

현재 코드가 명확히 기존 room 지속을 의도하므로 특별한 제품 결정이 없다면:

```text
active existing room
AND not blocked
AND users eligible
→ canMessage = true
```

가 profile projection에도 반영되어야 한다.

DM permission change가 과거 room까지 revoke해야 한다는 새로운 정책을 임의로 만들지 마라.

---

# P0-6 — Block → Unblock → old history lifecycle

Bug7 block은:

```text
membership = left
```

로 만들지만 기존 `delivered` history 자체를 삭제하지 않는다.

그리고 pair에는 canonical room 하나만 존재한다.

따라서:

```text
A/B active room + old messages
→ A blocks B
→ memberships left
→ unblock
→ 새 request/direct relationship
→ 기존 pair room 재활성화
```

될 경우 과거 delivered history가 다시 표시될 가능성이 있다.

이것은 현 시점에서 자동으로 버그라고 단정하지 마라.

## 반드시 product invariant로 결정할 것

다음 둘 중 현재 VTH 의도를 코드/docs/test에서 판별한다.

### Policy A — History preserved

```text
block 중에는 접근 불가
unblock + 새로운 canonical relationship으로 room 재활성화
→ 과거 history 다시 표시 가능
```

### Policy B — New conversation generation

```text
block 이전 history와
unblock 이후 새 대화를 논리적으로 분리
```

## 중요

결정 근거가 없다면:

```text
NEEDS PRODUCT DECISION
```

으로 남긴다.

임의로 과거 DM을 삭제하지 마라.

특히 block 순간 delivered messages를 물리 삭제하는 구현은 금지.

## 반드시 보장

어느 정책이든:

```text
block 상태
membership left
```

동안 history GET은 접근 불가여야 한다.

---

# P0-7 — Malformed read API

chat request action API는 Bug7 이후 runtime parser를 사용하므로 과거 bug8의 해당 문제를 다시 고치지 마라.

반면:

```text
POST /api/messages/:roomId/read
```

는 아직 raw unknown JSON을 cast한 뒤 `body.messageId`에 접근하는지 확인한다.

다음을 보내라.

```text
null
[]
42
"foo"
{}
{"messageId":123}
{"messageId":[]}
```

client input 때문에 500이 나면 버그다.

## 권장 contract

browser route는 현재 실제 client 사용과 맞춰:

```text
messageId: required string
```

으로 만드는 것을 우선 검토한다.

service 내부의 optional latest-read 기능이 필요하면 별도로 유지할 수 있다.

API payload omission이 암묵적으로 “latest message 전체 read”로 바뀌는 것은 피한다.

malformed client payload:

```text
400
```

이어야 한다.

---

# P0-8 — Post-commit side-effect boundary

Bug7 이후 DB write race 자체는 상당 부분 보호되었다.

이제 다음을 집중 검증한다.

```text
D1 message commit
→ unread background
→ push background
→ realtime background
```

각 task는 서로 다른 순서로 실행될 수 있다.

## Fault matrix

| D1      | HTTP    | WS        | Push    | Block                         | Expected                     |
| ------- | ------- | --------- | ------- | ----------------------------- | ---------------------------- |
| success | success | success   | success | no                            | exactly one                  |
| success | lost    | success   | success | no                            | retry returns same canonical |
| success | timeout | WS first  | success | no                            | sent, never failed           |
| success | success | fail      | success | no                            | reconnect catch-up           |
| success | success | duplicate | success | no                            | UI exactly one               |
| success | success | reversed  | success | no                            | ordered + exact unread       |
| success | success | delayed   | n/a     | commits after                 | normal delivery allowed      |
| success | success | delayed   | n/a     | block commits before delivery | no post-block realtime leak  |
| success | success | fail      | fail    | no                            | D1 history survives          |
| fail    | error   | none      | none    | no                            | no ghost side effects        |

자동 테스트 가능한 항목은 모두 자동화한다.

---

# 8. Happens-before semantics를 문서화

특히 block/send race는 모호하게 “race-safe”라고 쓰지 마라.

최소 다음을 정의한다.

## Case A

```text
send canonical commit
happens-before
block canonical commit
```

메시지 row는 존재할 수 있다.

그러나 block 완료 이후 realtime/push/unread가 어떻게 처리되는지 명확히 한다.

## Case B

```text
block canonical commit
happens-before
send canonical write condition
```

새 send는 실패해야 한다.

## Security boundary

사용자가 성공한 block response를 받은 시점을 기준으로:

```text
new message write 금지
new WS connection 금지
old WS payload 금지
chat notification/push 금지
```

가 어떤 수준까지 보장되는지 테스트로 증명한다.

---

# P1-1 — Reconnect / D1 convergence

현재 좋은 구조:

```text
initial history
WebSocket ready
signed after cursor catch-up
```

를 유지한다.

다음 timeline을 deterministic하게 테스트한다.

```text
T1 initial GET start
T2 M1 commit
T3 WS message M1
T4 GET response
T5 WS ready
T6 catch-up M1
```

다른 순서:

```text
GET response
M1 commit
WS disconnect
M2 commit
reconnect
ready
catch-up
```

결과는 항상:

```text
canonical messages exactly once
```

---

# 9. Clonagram식 canonical resync 원칙만 흡수

Clonagram은 realtime event마다 DB query invalidate를 한다.

VTH에서 매 message마다 그렇게 하지 않는다.

대신 다음 상황을 authoritative resync trigger 후보로 삼는다.

```text
WebSocket reconnect ready
tab hidden → visible
offline → online
terminal revoke
uncertain HTTP outcome
detected cursor gap
state invariant mismatch
```

필요한 것만 구현한다.

과도한 refetch 금지.

---

# P1-2 — Multi-tab read/unread convergence

동일 계정:

```text
Tab A
Tab B
```

가 같은 room을 연다.

시나리오:

```text
M1 arrives both
Tab A reads M1
Tab B remains open
```

Tab B unread가 영구 stale하면 안 된다.

기존 unread notification/event mechanism을 조사하고 재사용한다.

새 global state library를 도입하지 마라.

허용:

```text
BroadcastChannel
existing unread event
authoritative refresh on focus
```

가장 단순한 기존 구조를 사용.

---

# P1-3 — One unread definition

최종 canonical unread predicate를 명시한다.

현재 기준을 보존:

```text
reader membership active
peer membership active
sender != reader
delivery_status = delivered
not shadow hidden for recipient
not moderation hidden
not blocked
message tuple > read boundary
```

다음이 같은 sync point에서 일치하는지 검증한다.

```text
authoritative SQL unread
room unread sum
global message unread
client projection after reconciliation
```

`unread.ts`의 같은 SQL이 여러 함수에 중복되어 있다.

성급하게 abstraction하지 말고 먼저 invariant test를 추가한다.

실제 drift가 확인되면 helper/query consolidation을 한다.

---

# P1-4 — Push / notification post-block race

현재 notification code는 block 및 pending request validity를 다시 확인하는 방어가 있으므로 이를 부수지 마라.

새로 설계하기보다 fault test를 추가한다.

시나리오:

```text
message/request canonical commit
background notification waiting
block commit
notification task runs
```

검증:

```text
block-guarded notification 생성 안 됨
unread notification 증가 안 됨
push 안 됨
```

이미 안전하면:

```text
[NOT A BUG]
```

로 보고한다.

DM 본문을 log에 넣지 마라.

---

# P1-5 — Request state machine의 남은 concurrency

이미 존재하는 regression을 유지:

```text
declined opener not resurrected
cancelled opener removed
opposite simultaneous requests
accepted retry idempotent
accepted repair
old accept after block does not reactivate
```

중복 구현 금지.

추가로 부족한 경우에만:

```text
accept + decline simultaneously
accept + cancel simultaneously
promotion + block
follow-triggered promotion + block
friendship-triggered promotion + block
```

을 deterministic race test로 추가한다.

최종 D1 상태는 하나여야 한다.

---

# P1-6 — Signed cursor adversarial test

이미:

```text
same timestamp
large 500-message pagination
before/after tuple ordering
```

테스트가 있다.

중복하지 말고 다음 gap을 추가한다.

```text
cursor from room A → room B
cursor for user A → user B
before cursor used as after
after cursor used as before
tampered signature
truncated cursor
random cursor
catch-up > one page
live writes during catch-up
```

결과:

```text
no gap
no duplicate
no cross-room disclosure
no cross-user disclosure
```

---

# P1-7 — Moderation removal convergence

현재 moderator가 message를 hidden 처리하면 D1과 authoritative unread는 갱신된다.

그러나 열린 client에는 realtime remove event가 없는지 확인한다.

시나리오:

```text
M1
M2 = latest

client open
moderator hides M2
```

검증:

```text
history canonical
room preview
lastMessageId
lastBody
unread
open client
reconnect client
```

최소 요구:

> reconnect/resync 후 반드시 D1과 일치.

즉시 live removal이 제품 요구에 자연스럽고 저비용이면 protocol event를 추가할 수 있다.

예:

```text
message_hidden
room_invalidated
```

그러나 moderation realtime 기능 하나 때문에 거대한 generic event bus를 만들지 마라.

---

# P1-8 — Banned user consistency

현재 new WebSocket connect는 banned user를 막는다.

기존 socket이 열린 상태에서 banned가 되는 경우도 검증한다.

다음 전체 matrix:

```text
inbox GET
history GET
send
read
request accept
request decline
request cancel
report
new WS connect
existing WS
push
```

현재 moderation product policy를 기준으로 일관성을 확보한다.

banned existing socket은 revoke mechanism과 통합 가능한지 검토한다.

---

# P1-9 — WebSocket resource abuse

현재 global edge IP limiter가 realtime ingress에도 적용된다.

그러나 이것만으로 충분한지 측정/평가한다.

테스트/검토:

```text
same user + same room 10 sockets
100 sockets
rapid reconnect
invalid room probing
many room IDs
multiple tabs
hidden tab reconnect
```

필요하다면:

```text
per user per room socket cap
per user total socket cap
terminal unauthorized close
```

를 검토한다.

무조건 복잡한 distributed limiter를 추가하지 마라.

Cloudflare DO socket tag를 이용해 간단히 제한할 수 있는지 먼저 본다.

---

# P1-10 — Room switch stale work

현재 `activeRoomRef` 방어가 존재한다.

이를 회귀 테스트로 증명한다.

```text
A GET pending
switch B
B GET success
A GET late success

A WS late event
A read late response
A catch-up late response
```

결과:

```text
B messages polluted = false
B cursor overwritten = false
B badge modified by A = false
```

A room 자체의 background room list state를 올바르게 갱신하는 것과 현재 B message panel을 오염시키는 것은 구분한다.

---

# P1-11 — Content validation

현재 1–4000 contract를 유지.

다음 테스트:

```text
empty
spaces
newlines only
1 char
4000
4001
emoji
surrogate pair
combining unicode
NUL
control chars
HTML
<script>
URLs
very long single line
```

실제 “4000 characters”의 의미를 문서화한다.

```text
UTF-16 code units
Unicode code points
```

중 현재 구현과 제품 의도를 확인한다.

XSS는 React plain-text rendering으로 막혀야 한다.

---

# P1-12 — Timestamp contract

서버 canonical timestamps가:

```text
strftime('%Y-%m-%d %H:%M:%f', 'now')
```

와 어떤 형식으로 저장되는지 전수 검사한다.

client optimistic timestamp는 ISO `T...Z` 형태일 수 있다.

중요:

> optimistic timestamp가 canonical tuple ordering의 영구 기준으로 남아서는 안 된다.

canonical message가 도착하면 server timestamp로 교체되어야 한다.

검증:

```text
optimistic local timestamp
canonical D1 timestamp
same millisecond messages
timezone
lexicographic comparison
```

server-side canonical ordering format은 하나여야 한다.

---

# P1-13 — Report integrity

현재 room report와 message report를 구분해서 감사한다.

이미 message report service가:

```text
messageId
roomId
reporter active membership
sender
hidden state
```

를 검증한다면 중복 수정하지 마라.

추가 regression:

```text
message room A + forged room B
outsider report
own message
hidden message
revoked member
duplicate report
```

room report 역시 active membership을 우회할 수 없어야 한다.

---

# P2-1 — Client structure refactor

모든 P0/P1 correctness test를 먼저 통과시킨 후에만 수행한다.

Clonagram처럼 책임을 나누는 방향은 참고할 가치가 있다.

후보:

```text
useDmInbox
useDmHistory
useDmRealtime
useDmReadBoundary
useDmSend
useDmRequests
useDmReporting
```

pure state:

```text
chat-message-state.ts
chat-room-state.ts
```

는 reducer/pure functions에 가깝게 유지.

금지:

```text
React Query 신규 도입을 위한 도입
거대한 global store
새 context hierarchy
refactor와 protocol rewrite를 동시에 수행
```

현재 dependency가 없으면 Clonagram을 따라 하기 위해 React Query를 추가하지 마라.

---

# P2-2 — Server service split

`messages.ts`가 커졌다는 이유만으로 먼저 쪼개지 마라.

정확성이 확보된 뒤 후보:

```text
chat-query-service
chat-message-service
chat-request-service
chat-read-service
chat-room-service
chat-side-effect-service
```

public API contract는 가능한 한 유지.

분리로 DB round-trip 수를 증가시키지 마라.

---

# 10. 반드시 유지할 기존 regression tests

현재 이미 증명된 것은 깨뜨리지 않는다.

최소:

```text
same clientMessageId retry → one canonical row
retry body changed → original canonical body
retry does not consume logical DM rate quota
shadow-hidden recipient visibility 0
shadow-hidden unread 0

same-millisecond cursor ordering
500-message full pagination
server read boundary monotonic

accept retry idempotent
declined opener never resurrects
cancelled opener removed
opposite request concurrency

block removes active room access
block refreshes unread
block-first prevents send
block/create race closes room
block/activation race closes room
old accept replay after block does not reactivate
```

이 테스트를 새 구현을 편하게 하기 위해 삭제하거나 약화하지 마라.

---

# 11. 반드시 새로 추가할 테스트

## A. Live ordering

```text
1. M2 → M1 arrival gives correct unread
2. M2 → M1 → M2 duplicate
3. REST + WS duplicate
4. catch-up + WS duplicate
5. optimistic + canonical duplicate
```

## B. Read race

```text
6. read M3 pending + M4 arrival
7. M4 unread preserved after M3 ack
8. reversed M3/M4 read responses
9. same-timestamp read tuple
10. two-tab read convergence
```

## C. Optimistic transport

```text
11. WS echo before HTTP success
12. WS echo before HTTP timeout
13. canonical sent never becomes failed
14. HTTP response lost + retry same ID
15. retry returns original canonical
```

## D. Realtime authorization

```text
16. connected socket → block
17. block → socket terminal revoke
18. commit → block → delayed broadcast
19. membership left → existing socket
20. banned → existing socket
21. revoked socket does not reconnect forever
```

## E. Bug7/DM contract

```text
22. established room + unfollow
23. established room + allowDms change
24. Profile canMessage == backend actual ability
25. block overrides established-room access
26. unblock/new request history policy test
```

26은 제품 결정이 필요한 경우 decision test placeholder로 문서화하고 억지로 구현하지 않는다.

## F. API

```text
27. read null
28. read []
29. read primitive
30. read {}
31. numeric messageId
```

400 contract.

## G. Cursor/reconnect

```text
32. cursor wrong room
33. cursor wrong user
34. cursor wrong direction
35. tampered cursor
36. reconnect catch-up >1 page
37. GET/WS order reversal
```

## H. Side effects

```text
38. block before delayed notification
39. block before delayed push
40. block before delayed unread increment
41. broadcast failure + reconnect
42. push failure + history intact
```

## I. Moderation

```text
43. latest message hidden
44. authoritative unread corrected
45. reconnect removes hidden message
46. room preview converges
```

## J. Client races

```text
47. rapid A→B room switch
48. late A GET
49. late A WS
50. late A read response
51. hidden→visible
52. offline→online
```

## K. Security/resource

```text
53. outsider history
54. outsider send
55. outsider read
56. outsider report
57. multiple socket abuse
58. invalid room probing
59. HTML/script-like body plain-text render
60. 4001-char rejection
```

---

# 12. Deterministic distributed-state-machine test

작은 fake transport/state-machine harness를 만드는 것을 권장한다.

Actor:

```text
User A
User B
D1
HTTP response channel
WebSocket channel
Push
Client A
Client B
```

random deterministic actions:

```text
send
commit
dropHttp
retry
broadcast
duplicateBroadcast
delayBroadcast
reverseBroadcast
read
block
unblock
disconnect
reconnect
hideMessage
switchRoom
```

seeded sequence:

```text
100–1000 actions
```

각 단계 또는 final reconciliation 후 invariant:

```text
canonical logical message duplicate = 0
read boundary never decreases
blocked pair new canonical send = 0
post-block unauthorized realtime = 0
pending request per room <= 1
canonical message ordering deterministic
unread >= 0
final client canonical messages == D1 visible messages
canonical sent message never failed
```

`setTimeout(500)` 같은 flaky race test로 만들지 마라.

controlled Promise/barrier/fake transport를 사용한다.

---

# 13. Block barrier test는 특별 취급

단순:

```ts
Promise.all([send(), block()])
```

만으로는 실제 ordering을 통제하지 못한다.

가능하면 test hook/fake background transport/barrier를 이용해 정확하게:

```text
message D1 commit
PAUSE broadcast

block D1 commit
revoke complete

RESUME old broadcast
```

순서를 만든다.

그 뒤 recipient socket에 message가 전달되지 않는 것을 검증한다.

이 테스트가 bug8의 핵심 security regression이다.

---

# 14. Server-side side effect idempotency

다시 확인:

```text
canonical message retry x10
```

이:

```text
DB row = 1
logical unread increment = 1
push = <= 1 logical notification
broadcast = first canonical creation only
```

이어야 한다.

현재 `created`/`shouldBroadcast` 구조를 제거하지 마라.

Push test가 실제 external delivery를 요구하면 queue enqueue 단위를 deterministic하게 test한다.

---

# 15. `requestId` legacy alias

현재:

```text
clientMessageId
requestId legacy alias
```

가 공존한다.

이번 audit에서 실제 호출자를 전수 검색한다.

신규 browser code가 전부 clientMessageId를 사용한다면:

```text
legacy support가 어느 boundary에 필요한지
```

문서화한다.

그러나 bug8 reliability 작업과 동시에 호환 alias를 성급하게 삭제하지 마라.

제거 가능성이 보이면 별도 technical debt로 기록.

---

# 16. Presence는 delivery state가 아니다

절대 다음을 가정하지 않는다.

```text
online = socket connected
online = message received
offline = push required
```

Presence는 advisory.

DM correctness는 presence 없이도 유지되어야 한다.

---

# 17. 관측성

필요한 structured event:

```text
chat_send_committed
chat_send_idempotent_retry
chat_broadcast_failed
chat_realtime_connected
chat_realtime_revoked
chat_realtime_revoke_failed
chat_catchup_started
chat_catchup_completed
chat_catchup_failed
chat_read_advanced
chat_read_stale_ack
chat_request_conflict
chat_state_resync
```

가능한 경우:

```text
roomId
messageId
userId
reason code
duration
```

정도.

절대 금지:

```text
DM message body
OAuth token
session cookie
authorization header
push secret/auth key
private attachment URL token
```

현재 일부 logging에 message body가 들어가는지 전수 검색한다.

---

# 18. VTH_REALTIME_DM.md도 실제 구현과 맞춰라

코드 수정 후 문서도 갱신한다.

특히 현재 문서가:

```text
block 이후 stale socket이 실질적으로 안전하다
```

고 읽힐 수 있지만 실제 구현에서 existing socket revoke가 없었던 부분을 바로잡는다.

최종 문서는 다음을 정확하게 설명해야 한다.

```text
connect authorization
existing socket revocation
broadcast authorization
block completion boundary
reconnect catch-up
read boundary
idempotent retry
canonical-vs-optimistic precedence
```

문서가 코드를 과장하면 안 된다.

---

# 19. 이번 작업에서 금지

```text
WebSocket canonical write path
DO message history
per-message full room refetch
setInterval history polling
optimistic UI 제거
clientMessageId 제거
signed cursor 제거
server tuple read → timestamp-now 방식으로 후퇴
block authorization client-only
Supabase 도입
React Query를 Clonagram 때문에 새로 추가
group chat 기능 확장
voice/image/call 기능 추가
flaky sleep race tests
보안 테스트를 통과시키기 위한 policy 완화
Bug7 relationship teardown 롤백
email/password auth 추가
username internal identity
```

---

# 20. 구현 우선순위

## Phase A — Audit only

실제 최신 코드에서 분류:

```text
[CONFIRMED BUG]
[CONFIRMED RACE]
[SECURITY GAP]
[STATE CONSISTENCY GAP]
[PRODUCT POLICY GAP]
[PERFORMANCE RISK]
[ALREADY FIXED BY BUG7]
[NOT A BUG]
```

과거 bug8 항목이라고 무조건 bug로 보고하지 마라.

---

## Phase B — P0 correctness

순서:

```text
1. out-of-order unread
2. read boundary reconciliation
3. existing WebSocket revocation
4. post-block delayed broadcast
5. canonical sent → failed downgrade
6. established-room canMessage projection
7. malformed read payload
8. block/unblock history semantics 확인
```

---

## Phase C — P1 convergence

```text
reconnect
multi-tab
unread invariant
side-effect faults
cursor adversarial tests
moderation convergence
banned socket
resource abuse
room switch
```

---

## Phase D — structural cleanup

모든 reliability regression green 후:

```text
messages-client hooks 분리
messages service 분리 필요성 평가
docs 갱신
```

---

# 21. 검증

최소:

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
npm run build:worker
```

Worker/DO 변경이 있으므로 특히:

```powershell
npm run preview
```

환경에서 실제 WebSocket upgrade도 검증한다.

repository script 명을 먼저 확인하고 실제 존재하는 명령만 사용한다.

## E2E

Bug7 보고서에서 전체 Chromium E2E는 기존 timeout/flaky 문제가 있었다.

따라서 이번 작업에서는:

```text
새 Bug8 targeted E2E
Worker tests
integration tests
pure state race tests
```

를 우선 확실히 통과시킨다.

전체 E2E가 환경 문제로 실패하면:

```text
BUG8 regression failure
existing unrelated failure
environment/flaky failure
```

를 구분해 보고한다.

“전체 E2E 실패” 한 줄로 끝내지 마라.

---

# 22. Completion Report 형식

## 1. Baseline after Bug7

Bug7이 이미 해결해서 건드리지 않은 사항.

## 2. Clonagram comparison

표:

| Clonagram pattern             | Decision         | VTH action                     |
| ----------------------------- | ---------------- | ------------------------------ |
| realtime invalidates DB query | Adapt principle  | selective authoritative resync |
| separated chat hooks          | Adopt later      | correctness 후 client split     |
| optimistic + invalidate       | Adapt            | uncertain transport recovery   |
| near-bottom read hook         | Adopt structure  | tuple boundary 유지              |
| current-time read             | Reject           | VTH tuple stronger             |
| simple message insert         | Reject           | VTH idempotency 유지             |
| request folder model          | Reject/Compare   | VTH explicit state stronger    |
| block participant deletion    | Already exceeded | Bug7 teardown 유지               |
| Supabase realtime/RLS         | Reject           | DO/D1 유지                       |
| group/media/calls             | Out of scope     | 추가 안 함                         |

실제 조사 결과에 따라 갱신.

## 3. Confirmed Bugs

각 항목:

```text
Root cause
Reproduction
Why existing tests missed it
Fix
Regression test
```

## 4. Confirmed Races

실제 재현된 race만.

## 5. Security findings

특히:

```text
post-block socket/broadcast
banned existing socket
cross-room cursor/report/read
```

## 6. Product policy findings

예:

```text
block/unblock old history lifecycle
```

임의 결정하지 않은 항목.

## 7. False positives / Already fixed

반드시 기록.

예:

```text
request action malformed JSON
→ Bug7 이후 parser가 이미 방어

basic block/send D1 race
→ conditional writes + Bug7 tests로 이미 강하게 보호

notification after block
→ block guard가 이미 막는다면 NOT A BUG
```

## 8. Final invariants

최종적으로 무엇을 보장하는지.

## 9. Files changed

파일별 이유.

## 10. Migration

필요한 경우에만.

## 11. Test matrix

failure matrix 전체 결과.

## 12. Commands

실제 명령/결과.

## 13. Performance impact

특히:

```text
broadcast당 새 D1 query 수
revoke 비용
reconnect 추가 fetch
client memory
```

를 보고.

## 14. Remaining risks

실제로 증명하지 못한 것만.

---

# 23. 최종 성공 조건

## Canonical message

한 logical send는:

```text
D1 canonical message <= exactly one
```

이어야 한다.

## Idempotency

HTTP response가 유실되어 같은 clientMessageId로 retry해도:

```text
new message row 없음
duplicate unread 없음
duplicate push 없음
duplicate logical notification 없음
```

이어야 한다.

## Realtime

WebSocket:

```text
duplicate
late
reversed
missing
```

이어도 최종 client state가 정확해야 한다.

## Ordering

```text
Realtime arrival ordering
≠
Canonical message ordering
```

임을 코드가 전제로 해야 한다.

Canonical ordering:

```text
(created_at, id)
```

## Read

read boundary는:

```text
monotonic
tuple-based
partial acknowledgment capable
```

해야 한다.

새 M4 때문에 M1–M3 read 성공을 잃어서는 안 된다.

## Optimistic state

canonical message가 확인된 뒤:

```text
sent → failed
```

금지.

## Block

성공한 block boundary 이후:

```text
new canonical send
new socket
old socket payload
chat push/notification
```

이 권한을 우회해서는 안 된다.

## Recovery

WebSocket을 완전히 놓쳐도:

```text
reconnect
→ signed D1 catch-up
→ canonical convergence
```

해야 한다.

## Bug7 contract

Profile의:

```text
canMessage
```

와 실제 messaging backend permission이 모순되어서는 안 된다.

## Multi-client

여러 탭/브라우저에서 temporary projection 차이는 허용할 수 있으나:

```text
authoritative synchronization point 이후
→ same canonical state
```

로 수렴해야 한다.

---

# 최종 정의

Bug8은:

> “채팅이 잘 된다”

를 증명하는 작업이 아니다.

다음을 증명하는 작업이다.

```text
duplicate
delayed
reordered
retried
disconnected
reconnected
blocked
read-raced
multi-tab
background-task-reordered
```

상황에서도:

> **D1 canonical truth가 깨지지 않고, 모든 허가된 client가 결국 그 상태에 수렴하며, 권한이 revoke된 client에는 이후 realtime data가 전달되지 않는다.**

이 조건까지 만족해야 Bug8 완료다.
