bug2-1은 아직 commit/push하지 않는다.

현재 구현을 유지하면서 아래 잔여 검증과 수정만 수행한다. 관계/DM 구조를 다시 설계하지 않는다.

### 1. Guarded D1 write의 zero-change를 검사한다

chat room 생성, member 생성, existing member activation에 `NOT EXISTS user_blocks` 조건을 넣은 것만으로 완료로 간주하지 않는다.

block 때문에 conditional INSERT/UPDATE가 `changes=0`이면 함수가 계속 성공 경로로 진행해서는 안 된다.

각 race 테스트는 최종 DB state까지 검사한다.

block이 먼저 commit한 경우:

```text
active membership = 0
delivered message = 0
pending request = 0
```

이어야 한다.

기존 room activation이 block 때문에 0-row이면 즉시 403 또는 현재 canonical denial로 끝낸다.

### 2. 0039 migration에서 hidden opener와 missing opener를 구분한다

migration cancel 대상은:

```text
pending chat_request
AND matching pending chat_message가 실제로 존재하지 않음
```

뿐이다.

`is_shadow_hidden=1`인 matching pending opener는 존재하는 opener다.

그 request를 cancelled로 바꾸면 안 된다.

추가 regression:

```text
pending request
matching pending opener
is_shadow_hidden=1

0039
=> request remains pending
=> recipient incoming list에는 노출되지 않음
```

0038은 수정하지 않는다.

### 3. listIncomingRequests의 visible 조건과 migration orphan 조건을 공유하지 않는다

`listIncomingRequests()`:

```text
matching pending opener
AND is_shadow_hidden=0
```

필수.

0039:

```text
matching pending opener
```

존재 여부만 검사.

두 predicate는 목적이 다르다.

### 4. stale request notification cleanup을 request transition과 원자적으로 처리한다

friend/chat request의 terminal 상태:

```text
accepted
declined
cancelled
```

모두 더 이상 actionable notification을 남기지 않는다.

actor_id + kind만으로 늦게 background cleanup하여 새 request의 notification까지 읽음 처리하지 않는다.

가능하면 request accept/decline/cancel과 stale notification read를 같은 D1 batch 안에서 처리한다.

새 request가 concurrently 생성된 경우 그 새 notification은 unread 상태를 유지해야 한다.

추가 race test:

```text
R1 cancel/decline
concurrently R2 created
=> R1 notification stale/read
=> R2 notification remains unread
```

notification_count도 최종 canonical DB state와 일치해야 한다.

### 5. notification conditional insert 결과를 명시적으로 검사한다

blocked actor 때문에 notification INSERT가 changes=0이면:

```text
unread_fanout increment 없음
push enqueue 없음
```

을 보장한다.

단순히 두 번째 statement에도 EXISTS 조건을 넣었다는 이유만으로 push까지 안전하다고 가정하지 않는다.

createNotification()의 실제 insert result를 기준으로 push 여부를 결정한다.

### 6. 일반 delivered-message push의 block race를 감사한다

일반 DM message push는 createNotification() 경로가 아니다.

baseline:

```text
incrementChatUnread
canNotifyChat
queuePushDelivery
```

경로를 별도로 확인한다.

엄격한 block semantics를 유지한다면 push enqueue 직전에 bidirectional block을 다시 확인한다.

이미 block이 DB에 commit된 뒤 새로운 push가 생성되지 않게 한다.

### 7. block read boundary를 tuple 기준으로 업데이트한다

block 시 history는 삭제하지 않는다.

현재 delivered history의 마지막 row를:

```sql
ORDER BY created_at DESC, id DESC
LIMIT 1
```

으로 결정한다.

그 row의:

```text
created_at
id
```

를 같은 row에서 가져온다.

기존 `last_read_at,last_read_message_id`보다 boundary를 뒤로 이동시키지 않는다.

랜덤 public ID를 시간순 ID처럼 취급하지 않는다.

추가 test:

```text
multiple messages with same created_at
block
=> all pre-block messages considered read

existing later read boundary
block
=> boundary never moves backward
```

### 8. 기존 bug1 residual도 완료 전 별도 수정한다

현재 pushed main 170a337에는 아직:

```text
MAX_SOURCE_IMAGE_PIXELS = 40_000_000
```

이 남아 있다.

JPEG/PNG RGBA decode 메모리를 고려하여 Worker-safe limit으로 낮추고 테스트한다.

또 post idempotency는:

```text
same requestId + same normalized payload
=> existing post success

same requestId + different payload
=> 409
```

를 서버에서 강제한다.

author_id + request_id만 보고 payload 비교 없이 기존 post를 반환하지 않는다.

### 9. Public API auth contract는 별도 명시한다

API key, Better Auth session, `_red`, red_human의 역할을 섞어서 설명하지 않는다.

현재 실제 route behavior를 테스트로 문서화한다.

Public API를 API-key-only write로 지원하는 것이 아니라면 그렇게 주장하지 않는다.

### 10. 최종 검증

반드시 실행:

```text
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run db:migrate:local
npx opennextjs-cloudflare build
git diff --check
```

E2E failure를 unrelated라고만 보고하지 않는다.

각 failure를:

```text
real regression
stale assertion
fixture/environment defect
```

중 하나로 증명하고 가능한 것은 green으로 만든다.

ChatRoom warning은 `src/worker.ts`의 실제 export와 OpenNext production bundle을 확인한 뒤에만 remaining risk로 남긴다.

### 완료 보고

다음만 보고한다.

```text
PRE-COMMIT FIXES
MIGRATION SAFETY
RACE INVARIANTS
NOTIFICATION INVARIANTS
BUG1 RESIDUALS
FULL TEST RESULTS
OPENNEXT BUILD RESULT
REMAINING VERIFIED RISKS
```

보고가 끝날 때까지 bug2-1을 main에 push하지 않는다.
