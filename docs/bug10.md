# bug10.md — DM 안정성 고도화 및 Clonagram 실용 패턴 채용

## 0. 작업 성격

Bug8은 완료된 것으로 본다.

Bug8에서 이미 해결한:

* D1 canonical message state
* HTTP canonical write
* Durable Object / WebSocket realtime
* reconnect catch-up
* `clientMessageId` idempotency
* `(created_at, id)` ordering
* monotonic read boundary
* block 이후 기존 socket revoke
* delayed broadcast authorization barrier
* canonical `sent → failed` 방지
* established room `canMessage`
* malformed read payload

를 다시 설계하지 마라.

이번 작업은 새로운 대형 아키텍처 프로젝트가 아니다.

> **현재 DM을 실제 서비스 기준으로 한 단계 더 안정적으로 다듬는 고도화 작업이다.**

목표는:

1. Bug8 이후 남은 현실적인 edge case 제거
2. client의 일시적인 잘못된 projection이 D1 canonical state로 빠르게 수렴하도록 강화
3. Clonagram에서 VTH에 실제 도움이 되는 안정성 패턴을 선별 채용
4. 지나치게 커진 client 책임은 필요한 만큼만 분리
5. 기존 realtime 성능과 구조는 유지

---

# 1. 먼저 최신 main 재검사

Bug9 완료 후 최신 `main`에서 시작한다.

Bug9는 UI 작업이므로 DM logic을 수정하지 않았어야 한다.

먼저 다음 파일을 실제 최신 source 기준으로 다시 읽는다.

```text
src/components/messages/messages-client.tsx
src/lib/chat-room-state.ts
src/lib/chat-message-state.ts
src/lib/messages.ts
src/lib/unread.ts
src/lib/chat-realtime.ts
src/workers/ChatRoom.ts
src/lib/dm-relationships.ts
src/lib/notifications.ts
src/lib/dm-moderation.ts
```

그리고 관련 tests도 읽는다.

기존 Bug8 완료 보고서만 믿고 수정하지 마라.

실제 최신 source와 tests를 기준으로 판단한다.

---

# 2. 이번 작업에서 하지 않을 것

다음은 이번 범위가 아니다.

```text
대규모 distributed-state-machine 연구
1000개 random fault sequence fuzzing
event sourcing
새 message broker
React Query 전면 도입
Redux/Zustand 전면 도입
Supabase 도입
DM database 재설계
WebSocket write path
주기적 polling
모든 live event마다 전체 room refetch
group chat
media DM
voice/video call
```

현재 구조를 최대한 유지한다.

---

# 3. 현재 architecture invariant

유지:

```text
D1
= canonical truth

HTTP
= canonical mutation

Durable Object / WebSocket
= realtime delivery

React state
= disposable projection

Push
= secondary notification
```

WebSocket이 D1보다 authoritative해지면 안 된다.

---

# 4. P0 — 256-message dedupe를 correctness에서 제거

Bug8 현재 구현에는 room별 canonical message ID Set이 있고 최대 약 256개만 기억한다.

이 bounded cache 자체는 문제 아니다.

문제는:

> **unread 정확성이 이 bounded cache에 의존하면 안 된다.**

극단적으로 오래 지연된 duplicate event가 256개 이후 다시 오면 client가 새 message라고 오판할 가능성이 있다.

잘못된 해결:

```text
256 → 512
256 → 1024
256 → 10000
```

금지.

숫자만 늘리지 마라.

---

# 5. dedupe cache의 역할 재정의

bounded message-ID cache는:

```text
빠른 live duplicate 억제
```

용도로만 사용한다.

다음의 최종 정확성 authority가 되어서는 안 된다.

```text
unread exact count
canonical message existence
read state
```

즉:

> **bounded cache miss가 발생해도 결국 D1 unread와 정확히 수렴해야 한다.**

---

# 6. Clonagram 방식 중 이 부분은 적극 ADAPT

Clonagram의 좋은 개념:

> realtime event는 화면을 빠르게 업데이트하지만, 필요하면 canonical DB state를 다시 확인한다.

VTH에서는 그대로 매 event DB invalidate를 하지 않는다.

다음처럼 적용한다.

```text
normal realtime
→ 즉시 local projection

uncertain / convergence-needed state
→ D1 authoritative refresh
```

---

# 7. Canonical unread reconciliation

현재 `unreadDelta +1`은 빠른 UI 반응을 위해 유지할 수 있다.

하지만 그것을 영구적인 truth로 간주하지 않는다.

적절한 시점에서:

```text
/api/messages
또는
/api/unread
```

의 canonical unread를 다시 받아 정확하게 보정한다.

### 반드시 검토할 trigger

```text
reconnect 완료
catch-up 완료
browser visibility hidden → visible
network offline → online
revoked
transport uncertainty
duplicate/ordering uncertainty
여러 live event가 짧은 시간에 몰린 경우
```

---

# 8. 매 메시지마다 DB 조회 금지

다음은 하지 마라.

```text
message event
→ GET inbox
message event
→ GET inbox
message event
→ GET inbox
```

대신 필요하면 짧은 burst를 coalesce한다.

개념:

```text
M1
M2
M3
M4

↓ realtime local 반영

한 번의 canonical reconciliation
```

정확한 debounce/coalescing 값은 기존 UX와 test를 보고 결정한다.

숫자를 과도하게 튜닝하지 마라.

---

# 9. 최종 목표

`seenMessageIds` 256 제한이 남아 있어도 괜찮다.

단:

```text
256 밖의 오래된 duplicate 발생
↓
잠깐 client projection이 흔들릴 수 있음
↓
canonical reconciliation
↓
D1 unread와 일치
```

해야 한다.

256 cache가 correctness boundary가 아니게 만드는 것이 목표다.

---

# 10. P0 — HTTP transport uncertainty 개선

Bug8은 다음을 해결했다.

```text
WS canonical message 도착
↓
HTTP 늦게 실패
↓
sent → failed 금지
```

좋다.

하지만 반대 상황도 검토한다.

```text
D1 commit 성공
↓
HTTP response 유실
↓
WS event도 일시 유실
↓
client는 failed로 판단
```

서버에는 실제 message가 존재한다.

현재 `clientMessageId` retry가 이를 안전하게 복구할 수 있으므로 이 invariant를 적극 활용한다.

---

# 11. uncertain send의 canonical resolution

HTTP network error/timeout 시 바로 영구 `failed`로 결정하기 전에:

```text
동일 clientMessageId retry
또는
room canonical catch-up
```

중 현재 architecture에 가장 싼 방법으로 canonical existence를 확인할 수 있는지 검토한다.

목표:

```text
server에는 성공
client에는 실패
```

상태가 오래 지속되지 않게 한다.

단 무한 retry 금지.

---

# 12. retry invariant

반드시 유지:

```text
same clientMessageId
→ canonical row 최대 1개
→ 최초 canonical body 유지
→ unread 1회
→ push 최대 1회
→ realtime creation side effect 1회
```

Bug8 reliability를 깨지 마라.

---

# 13. P0 — reconnect + catch-up + live overlap 재검사

현재 구조는:

```text
WebSocket reconnect
+
after cursor catch-up
```

을 사용한다.

다음 현실적인 순서를 다시 테스트한다.

### Case A

```text
M1 놓침
disconnect
M2 commit
reconnect
catch-up 시작
M3 live 도착
catch-up에서 M2/M3 반환
```

결과:

```text
M1/M2/M3 canonical set 정확
중복 없음
preview 정확
unread 최종 D1과 일치
```

### Case B

```text
catch-up 응답이 늦음
live M4 먼저 도착
catch-up M2/M3 나중 도착
```

preview가 뒤로 가지 않아야 한다.

---

# 14. P0 — multi-tab 실제 동작 audit

브라우저 탭 2개 정도는 현실적인 사용 사례다.

먼저 현재 unread synchronization 구조를 조사한다.

다음이 이미 안전하면 수정하지 말고 `[ALREADY SAFE]`로 보고한다.

검토:

```text
Tab A: room 읽음
Tab B: inbox 열려 있음
```

Tab B unread가 계속 stale하게 남는지.

그리고:

```text
Tab A: block
Tab B: 같은 room socket open
```

DO revoke와 이후 inbox reconciliation이 Tab B에서도 정상인지.

---

# 15. multi-tab 때문에 새 framework 만들지 마라

필요하다면 기존:

```text
unread changed event
storage event
BroadcastChannel
기존 app-level event
```

등 현재 구조와 가장 가까운 방법을 사용한다.

multi-tab 때문에 전역 state manager를 새로 도입하지 마라.

---

# 16. P0 — read UI projection 조금 더 정확하게

Bug8 현재 구현은 안전하다.

예:

```text
M1 M2 M3 unread
M4 도착
M3 read ack 도착
```

에서 M4를 잘못 읽음 처리하지 않는다.

다만 현재 client unread가 canonical inbox refresh 전까지 잠깐 오래된 숫자를 유지할 수 있다.

이 동작이 사용자에게 실제로 보이는 수준인지 확인한다.

---

# 17. 부분 read reconciliation

가능하면 server가 반환한:

```text
readThrough {
  messageId
  createdAt
}
```

를 활용해서 local projection을 더 정확하게 보정한다.

하지만:

```text
복잡한 per-message unread ledger
```

를 새로 만들 필요가 생긴다면 하지 마라.

원칙:

> 단순하게 개선 가능하면 개선, 아니면 현재 safe behavior + 빠른 canonical refresh 유지.

정확성을 위해 복잡도를 지나치게 올리지 않는다.

---

# 18. P1 — Clonagram selective invalidate 패턴 채용

Clonagram의 다음 패턴은 VTH에 유용하다.

```text
optimistic UI
+
realtime event
+
canonical reconciliation
```

하지만 VTH는 D1 + DO 구조이므로 그대로 복제하지 않는다.

다음 상황에서만 authoritative refresh를 검토한다.

```text
reconnect
transport error
revoked
visibility restore
network restore
uncertain optimistic message
moderation state change
```

---

# 19. 정상 realtime fast path 유지

평상시:

```text
WS message
→ local merge
→ 즉시 화면
```

이어야 한다.

DB round-trip을 기다렸다가 메시지를 표시하면 안 된다.

---

# 20. P1 — conversation list와 active room convergence 분리

Clonagram에서 참고할 좋은 구조다.

현재:

```text
inbox room projection
active room message history
global unread
```

은 관련되어 있지만 같은 state는 아니다.

각각 필요할 때 독립적으로 canonical refresh 가능해야 한다.

예:

```text
message send
→ active room full reload 필요 없음

unread reconcile
→ history full reload 필요 없음

room preview refresh
→ 전체 message history reload 필요 없음
```

불필요한 DB read를 줄인다.

---

# 21. P1 — messages-client.tsx 책임 분리 검토

현재 `messages-client.tsx`가:

```text
room selection
history
catch-up
WebSocket
read
send
optimistic state
requests
scroll
```

를 너무 많이 담당한다면 필요한 부분만 분리한다.

Clonagram의 hook separation을 참고할 수 있다.

후보:

```text
useDmRealtime
useDmReadState
useDmHistory
```

전부 만들 필요 없다.

실제로 복잡성을 줄이는 1~3개만 분리한다.

---

# 22. 리팩터링 기준

다음 조건일 때만 분리한다.

```text
race handling이 한 파일에 얽혀 correctness 이해가 어려움
동일 logic이 중복됨
test하기 어려움
```

단순히 파일을 예쁘게 나누기 위해 리팩터링하지 마라.

---

# 23. P1 — moderation convergence 확인

메시지가 관리자 moderation으로 hidden/removed 되었을 때:

```text
열려 있는 room
inbox preview
unread
reconnect history
```

가 결국 동일한 canonical state로 수렴하는지 확인한다.

현재 이미 충분히 안전하면 `[ALREADY SAFE]`.

실제 gap이 있으면 최소한의 reconciliation만 추가한다.

---

# 24. P1 — ban/account revoke 확인

Bug8에서 existing socket revoke가 추가됐다.

다시 확인:

```text
user banned
↓
open socket revoked
↓
reconnect 불가
↓
기존 selected room stale UI 정리
```

서버는 안전한데 client 화면만 오래 남아 있는 문제가 없는지 확인한다.

---

# 25. P1 — Push / notification 중복 확인

새로운 Push architecture를 만들지 않는다.

다만 다음을 테스트한다.

```text
same clientMessageId retry
HTTP response retry
background task retry
```

상황에서 같은 logical send가:

```text
push 2번
notification 2번
```

발생하지 않는지.

이미 DB condition/idempotency로 안전하면 `[ALREADY SAFE]` 처리.

---

# 26. P1 — block 후 queued side effect 재검사

Bug8에서 realtime은 안전해졌다.

다음도 현실적으로 한 번 더 확인한다.

```text
message commit
↓
push/background pending
↓
block
↓
old side effect 실행
```

block 이후 허용되지 않는 notification/push가 발생하지 않아야 한다.

기존 guard가 충분하면 코드 수정하지 마라.

test만 보강할 수 있다.

---

# 27. P1 — room switch late-result 확인

다음 정도는 실제 UI에서 흔하다.

```text
Room A load
↓
사용자가 Room B 클릭
↓
A response 늦게 도착
```

다음이 B를 오염시키면 안 된다.

```text
message list
cursor
read timer
socket state
error state
preview state
```

현재 `activeRoomRef` 방어가 충분한지 source + test로 확인한다.

---

# 28. Clonagram에서 이번에 채용할 범위

## 적극 ADAPT

```text
realtime → fast local projection
uncertain state → canonical reconciliation

optimistic state → server state precedence

conversation list / active conversation 책임 분리

scroll/read responsibility 분리

error 이후 selective revalidation
```

---

# 29. Clonagram에서 가져오지 않을 것

```text
Supabase Auth
Supabase RLS
Supabase Realtime
Supabase Storage
React Query 도입 자체
current-time read model
simple INSERT-only send
request folder model
매 event full invalidation
group/media/call
```

VTH가 이미 더 강한 부분을 Clonagram 방식으로 퇴행시키지 마라.

---

# 30. Bug8 invariants 전부 regression 유지

반드시 유지:

```text
one logical send ≤ one canonical D1 row

same clientMessageId retry idempotent

canonical sent never becomes failed

preview order = max(createdAt, id)

history order = (created_at, id)

read boundary monotonic

block 이후 new send 불가

block 이후 new socket 불가

block 이후 existing socket payload 불가

reconnect catch-up recovers missed messages

no polling

D1 success independent from WS/Push failure
```

---

# 31. 테스트 — 필요한 만큼만

이번 작업은 수백 개 테스트 프로젝트가 아니다.

기존 test suite에 **실제 가치 있는 케이스만 약 10~20개 수준으로 추가**한다.

최소 후보:

```text
1. >256 event 이후 오래된 duplicate → 최종 unread canonical 수렴
2. duplicate burst → canonical unread 정확
3. reconnect 후 unread refresh
4. visibility restore 후 unread refresh
5. HTTP commit 성공 + response loss + WS loss → canonical recovery
6. HTTP timeout + WS canonical arrival
7. catch-up 중 live newer event
8. live event 후 catch-up duplicate
9. multi-tab read synchronization
10. multi-tab block/revoke
11. late Room A response after Room B selected
12. late read ack after room switch
13. moderation hidden message convergence
14. ban → selected room revoke
15. retry same clientMessageId → push/notification duplicate 없음
16. block before queued notification/push execution
```

실제 source에서 이미 안전한 항목은 중복 테스트를 억지로 만들지 않아도 된다.

---

# 32. flaky test 금지

금지:

```text
sleep(1000)
setTimeout 기다린 뒤 운 좋으면 성공
network timing에 기대는 race test
```

가능하면:

```text
fake timers
explicit Promise barrier
mocked transport
controlled response order
```

사용.

---

# 33. Performance 기준

이번 안정성 개선 때문에 DM이 무거워져서는 안 된다.

### 금지

```text
live message마다 full inbox GET
live message마다 history GET
socket마다 D1 query
주기적 polling
무제한 ID Set
무한 retry
```

---

# 34. 권장 방향

```text
local realtime fast path
+
coalesced selective canonical reconciliation
```

즉 빠른 메시지 UX는 그대로 두고 정확성 recovery만 강화한다.

---

# 35. DB migration

가능하면 migration 없이 해결한다.

새 column/table이 정말 correctness에 필요할 때만 migration을 추가한다.

단순 client convergence 문제를 DB schema 변경으로 해결하지 마라.

---

# 36. Block → Unblock history

Bug8에서 남은 제품 결정이다.

이번 Bug10에서 임의 변경하지 않는다.

현재 정책 유지:

```text
block 중
→ history 접근 불가

unblock 후 room 재활성화
→ 기존 delivered history 다시 보일 수 있음
```

제품에서 별도로 결정하기 전까지 유지.

---

# 37. 로그/관측

새 reconciliation 또는 retry가 생기면 필요한 범위에서만 structured log를 남긴다.

예:

```text
dm_canonical_reconcile
dm_transport_uncertain
dm_reconnect_catchup
dm_realtime_revoked
```

금지:

```text
DM body
auth token
cookie
private message text
```

---

# 38. 구현 순서

## Phase A — Audit

```text
Bug8 최신 source 확인
Clonagram 최신 DM source 비교
remaining gap 분류
ALREADY SAFE 구분
```

## Phase B — 핵심 고도화

```text
bounded dedupe correctness dependency 제거
canonical unread reconciliation
uncertain send recovery
reconnect/live/catch-up overlap 강화
```

## Phase C — 실제 사용 안정성

```text
multi-tab
room switch
visibility/network restore
moderation/ban convergence
notification/push duplicate audit
```

## Phase D — 필요한 만큼만 구조 정리

```text
messages-client 책임 분리
중복 helper 제거
docs 업데이트
```

---

# 39. 완료 보고에서 반드시 분류

각 조사 항목을 다음 중 하나로 보고한다.

```text
[FIXED]
실제 버그였고 수정

[HARDENED]
버그는 아니었지만 안정성 강화

[ALREADY SAFE]
현재 코드가 이미 안전

[ADOPTED FROM CLONAGRAM]
Clonagram 패턴을 VTH 방식으로 채용

[REJECTED FROM CLONAGRAM]
VTH에는 부적절

[OUT OF SCOPE]
이번 고도화 범위를 넘음
```

---

# 40. 완료 보고

최종 보고에는:

1. 실제 발견한 bug
2. 실제 hardening 항목
3. 이미 안전했던 항목
4. Clonagram에서 채용한 패턴
5. Clonagram에서 거절한 패턴
6. `>256 delayed duplicate` 문제의 최종 해결 방식
7. canonical unread reconciliation 방식
8. uncertain HTTP send recovery 방식
9. reconnect/catch-up 개선
10. multi-tab 결과
11. 변경 파일
12. migration 여부
13. 새 tests
14. 전체 test/build 결과
15. DB read 증가 여부
16. 남은 현실적 risk

를 명시한다.

---

# 41. Validation

최소:

```powershell
npm run typecheck
npm test
npm run test:integration
npm run build
npm run build:worker
```

변경 파일 lint 수행.

가능하면 messaging 관련 targeted E2E도 수행.

전체 E2E 기존 flaky가 있으면 Bug10 failure와 분리해서 보고한다.

---

# 42. 최종 성공 기준

이번 Bug10이 끝난 뒤 DM은:

```text
정상 상황
→ WebSocket으로 즉시 반응

중복/역순
→ local merge가 처리

일시적인 client 오차
→ D1 canonical state로 빠르게 수렴

HTTP 응답 유실
→ clientMessageId 기반으로 canonical 결과 회복

reconnect
→ after cursor catch-up

multi-tab
→ unread/권한 상태가 오래 갈라지지 않음

block/ban
→ 기존 realtime 권한 즉시 종료
```

가 되어야 한다.

핵심은:

> **Bug8의 강한 realtime 구조는 그대로 유지하면서, client-side 임시 상태가 정확성을 책임지지 않게 만드는 것.**

그리고 이 목표를 위해 시스템 전체를 다시 설계하지 마라.

**실제 서비스 안정성에 도움이 되는 부분까지만 고도화한다.**
