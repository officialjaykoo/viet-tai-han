현재 main의 relationship/DM hardening은 대부분 유지한다.

기존 `29a7271 fix: harden auth comments and chat integrity`를 롤백하거나 DM 시스템을 재설계하지 않는다.

다음 잔여 correctness 결함만 수정한다.

## 1. P0 — block과 direct-room activation을 원자적으로 안전하게 만들 것

`src/lib/messages.ts`

현재 final `chat_messages INSERT`의 block guard는 유지한다.

추가로 다음 mutation에도 authoritative bidirectional block guard를 넣는다.

* 새 direct `chat_rooms` 생성
* 새 direct room의 두 `chat_room_members` 생성
* 기존 room membership을 `active`로 되돌리는 UPDATE
* 새 request room/member 최초 생성

규칙:

```text
block이 DB에 먼저 commit
→ 그 뒤 room/member가 active로 생성되거나 재활성화될 수 없음

room/direct write가 먼저 commit
→ 이후 block이 memberships를 left로 만들음
```

pre-check `assertNotBlocked()`만으로 해결했다고 간주하지 않는다.

최종 membership mutation 자체에서 DB invariant를 강제한다.

특히 기존:

```sql
UPDATE chat_room_members
SET membership_status='active'
WHERE room_id=? AND user_id IN (?,?)
```

에는 반드시 bidirectional `NOT EXISTS user_blocks` 조건을 추가한다.

새 room 생성도 block 이후 빈/active orphan room을 남기지 않게 한다.

기존 `/i/api`, rate limit, moderation, final message INSERT는 유지한다.

## 2. accepted repair는 revoked membership을 되살리지 말 것

`acceptedChatRepairStatements()` 수정.

허용:

```text
pending → active
active → active
```

금지:

```text
left → active
declined → active
```

`joined_at`은 repeated repair마다 덮지 말고 `COALESCE(joined_at, now)`를 사용한다.

테스트:

```text
request accepted
→ block
→ unblock
→ same old request accept replay
=> memberships remain left
=> old room does not become direct
```

기존 legacy partial repair test:

```text
accepted request + recipient pending
=> retry accept repairs to active
```

는 계속 통과해야 한다.

## 3. migration 0038은 수정/삭제하지 말고 후속 migration 추가

`0038_chat_request_integrity.sql`은 이미 적용됐을 가능성이 있으므로 내용 변경으로 해결하지 않는다.

새 migration을 추가한다.

목적:

```text
status='pending'인 chat_request
인데
그 request와 대응하는 pending chat_message가 없음
→ request를 cancelled
```

이유:

legacy `request_id IS NULL` 데이터에서 0038 cleanup이 현재 pending opener까지 삭제할 수 있다.

누락 opener를 `opener_body`로 임의 복원하지 않는다.

원래 opener가 moderation/shadow-hidden이었는지 DB에서 확실히 복원할 수 없기 때문이다.

orphan pending request는 안전하게 cancel한다.

필요하면 recipient pending membership도 `declined`로 reconcile한다.

테스트 fixture:

```text
old declined request request_id=NULL
new pending request request_id=NULL
same room/sender

0038-style cleanup 이후 opener missing
후속 migration
=> broken pending request cancelled
=> recipient에게 opener가 새로 노출되지 않음
```

## 4. listIncomingRequests는 실제 current visible opener를 요구할 것

현재 단순:

```text
NOT EXISTS shadow pending message
```

만으로는 message가 아예 없는 broken request도 표시된다.

incoming request는 반드시 현재 request에 매칭되는:

```text
delivery_status='pending'
AND is_shadow_hidden=0
AND matching request_id
```

message가 존재해야 표시한다.

legacy NULL matching도 명시적으로 처리한다.

다른 request의 shadow message가 현재 request를 숨기거나, message 없는 request가 opener_body만으로 노출되면 안 된다.

## 5. block 후 오래된 unread가 미래 reconnect에서 부활하지 않게 할 것

History는 삭제하지 않는다.

그러나 block 이전 unread가 이후 새 relationship/새 request를 통해 room이 다시 active가 되었을 때 unread badge로 다시 나타나면 안 된다.

block 시 해당 room의 current delivered history까지 read boundary를 닫거나, 동등한 방식으로 새로운 membership epoch 이전 메시지를 unread 계산에서 제외한다.

다음 invariant를 테스트한다.

```text
old unread messages
→ block
=> unread 0

→ unblock
→ new request
→ accept

=> old messages remain history
=> old messages are NOT unread again
=> only new epoch message may count unread
```

새 message/history deletion 금지.

## 6. unread.ts peer join 수정

현재:

```sql
peer.user_id != cm.sender_id
```

는 incoming message에서 현재 user 자신을 peer로 선택한다.

peer는 current membership의 반대 participant여야 한다.

canonical unread query들의 peer join을 모두:

```text
peer.user_id != rm.user_id
```

또는 의미상 동등한 정확한 조건으로 수정한다.

notification unread에는 영향 주지 않는다.

`listChatRooms()`의 올바른 peer logic과 의미를 맞춘다.

## 7. block-aware notification final guard

actor가 있는 notification은 notification INSERT 직전/SQL 자체에서 현재 bidirectional block을 확인한다.

최소 대상:

* follow
* friend_request
* friend_accepted
* chat_request
* chat_accepted

block이 먼저 commit했다면 그 뒤 해당 actor의 social/chat notification 또는 push가 생성되면 안 된다.

사전 SELECT만으로 끝내지 말고 final write에 조건을 둔다.

notification을 조건부 INSERT로 바꾸면 unread_fanout를 무조건 +1 하지 않도록 같이 수정한다.

새 notification service나 queue를 만들지 않는다.

취소된 friend/chat request의 명백히 stale한 unread actionable notification도 가능한 가장 작은 방식으로 reconcile한다.

## 8. relationship mutation API runtime validation

다음 route의 JSON boundary를 실제 runtime type check한다.

* `src/app/api/friends/route.ts`
* `src/app/api/users/[username]/route.ts`
* `src/app/api/messages/requests/[id]/route.ts`

`null`, array, object-valued requestId 등의 malformed payload는 500이 아니라 400.

새 validation library를 추가하지 않는다.

작은 local/helper validator면 충분하다.

## 반드시 보존

현재 잘 된 다음 기능을 롤백하지 않는다.

* room-level single pending request unique index
* request-specific decline/cancel opener deletion
* D1 batch-based atomic accept
* final delivered-message block guard
* block → follow/friend delete
* block → pending request cancel
* block → membership left
* outgoing requests + cancel UI
* compose recipient/body fingerprint
* server recipient/body idempotency matching
* mutual block UI
* friend accepted timestamp
* authenticated-only presence
* existing established chat survives ordinary unfollow/privacy-setting change
* block만 established chat permission을 revoke

Redis, Queue, 새 DO, 새 DB, 새 messaging framework를 추가하지 않는다.

## 새 필수 테스트

다음을 추가한다.

```text
A. first direct-room creation vs block race invariant
B. existing-room activation vs block invariant
C. accepted → block → unblock → old accept replay does not reactivate
D. legacy NULL request-id migration orphan
E. incoming request requires matching visible pending opener
F. block → reconnect does not resurrect old unread
G. blocked actor cannot create delayed social/chat notification
H. malformed relationship payloads => 400
```

기존:

```text
tests/integration/dm-integrity.test.ts
tests/integration/dm-policy.test.ts
tests/integration/messaging-reliability.test.ts
tests/integration/friends.test.ts
```

를 삭제하거나 약화하지 않는다.

## 완료 보고

1. REMAINING BUGS FIXED
2. FILES CHANGED
3. DB INVARIANTS
4. MIGRATION SAFETY
5. RACE TESTS
6. REGRESSION TEST RESULTS
7. REMAINING RISKS

`NEEDS DECISION` 없이 현재 구조에서 가장 작은 수정으로 완료한다.
