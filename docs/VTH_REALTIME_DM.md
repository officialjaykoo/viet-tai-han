# VTH 실시간 DM

## 1. 계약

VTH DM의 canonical state와 write path는 D1과 HTTP API입니다. Cloudflare Durable Object는 연결된 사용자에게 이미 commit된 이벤트를 전달하는 역할만 합니다.

- D1: 대화방, 멤버, 요청, 메시지, unread/read state의 source of truth
- HTTP API: 인증, active-user 확인, rate limit, moderation, 권한, idempotency, D1 canonical write
- ChatRoom DO: room별 hibernatable WebSocket 연결과 realtime fan-out만 담당
- Web Push: 화면 밖 사용자에 대한 선택적 알림

Durable Object 내부에 history를 저장하거나 WebSocket을 메시지 작성 API로 사용하지 않습니다.

## 2. 전체 흐름

```mermaid
flowchart LR
  BrowserA[DM 브라우저 A] -->|logical POST /api/messages| Tunnel[/i/api tunnel]
  Tunnel --> API[Next route handler]
  API -->|검증·moderation·canonical write| D1[(D1 chat_messages)]
  API -->|committed event| Room[ChatRoom DO<br/>roomId별 1개]
  Room -->|WebSocket delivery| BrowserA
  Room -->|WebSocket delivery| BrowserB[DM 브라우저 B]
  API -->|best-effort| Push[Web Push]
```

브라우저의 일반 API 호출은 `/i/api` signed Protobuf tunnel을 사용하고, route handler에서는 logical `/api/messages` 경로로 처리됩니다. 메시지 history는 항상 D1에서 읽습니다.

## 3. WebSocket 연결

대화방을 선택하면 custom Worker entry가 다음 upgrade를 처리합니다.

```text
ws://localhost:3000/api/messages/realtime?room=<roomId>
wss://vth.kr/api/messages/realtime?room=<roomId>
```

`src/worker.ts`의 순서:

1. `GET`과 `Upgrade: websocket`을 확인합니다.
2. Better Auth session cookie를 검증합니다.
3. 로그인하지 않았거나 banned 상태인 사용자를 거절합니다.
4. `CHAT_ROOM.idFromName(roomId)`로 room Durable Object를 찾습니다.
5. 검증한 immutable user ID를 내부 헤더로 전달합니다.
6. `ChatRoom`이 D1에서 양쪽 `chat_room_members`가 `active`인지 재검증합니다.
7. 양방향 block이 없을 때만 hibernatable WebSocket을 수락합니다.

클라이언트가 보낸 user ID나 membership을 신뢰하지 않습니다. Worker session 검증과 DO의 D1 membership/block 검사를 모두 통과해야 연결됩니다.

## 4. 메시지 작성

새 대화 시작과 기존 대화 메시지 작성은 HTTP canonical path입니다.

```text
logical POST /api/messages
logical POST /api/messages/<roomId>
POST /api/messages/<requestId>  # request action: accept, decline, cancel
```

실제 browser transport는 `/i/api`이며, direct `/api/*` 호출은 기존 public API Bearer 경계를 먼저 통과해야 합니다.

작성 경로는 다음을 서버에서 수행합니다.

- Better Auth session과 active-user 검증
- room, membership, recipient, request 상태 확인
- bilateral block 및 DM relationship 확인
- body와 client ID 검증
- rate limit과 moderation
- D1 canonical insert 또는 idempotent existing-row 반환
- delivered message의 unread/read state 갱신
- commit 후 best-effort realtime broadcast와 Push 알림

D1 write가 성공한 뒤 `broadcastChatMessage()`가 room DO에 이벤트를 전달합니다. delivery나 Push 실패가 이미 성공한 canonical write를 실패로 바꾸지 않습니다. WebSocket은 이 검증·moderation·D1 경로를 우회하지 않습니다.

`clientMessageId`가 같은 재시도는 기존 canonical message를 반환하며 message row, unread side effect, notification, broadcast를 중복 생성하지 않습니다. `requestId`는 기존 클라이언트 호환 alias로 허용됩니다.

알림 source identity는 client idempotency token이 아닙니다. Friend request는 `user_friendships.id`, chat request는 `chat_requests.id`를 `notifications.source_request_id`에 저장하며, chat의 `chat_requests.request_id`는 client idempotency token으로만 사용합니다.

## 5. Request와 room 불변식

- room은 immutable 두 사용자 ID의 정렬된 pair key로 식별합니다.
- 한 사용자 pair에는 하나의 DM room만 존재합니다.
- 한 room에는 최대 하나의 `pending` request만 존재합니다.
- request opener는 그 request의 `request_id`, sender, room과 일치하는 held message여야 합니다.
- request-specific opener가 없거나 다른 request에 속하면 request를 열거나 전달할 수 없습니다.
- `declined` 또는 `cancelled` request의 opener는 나중에 자동으로 release되지 않습니다.
- 오래된 opener, stale notification, stale retry로 decline/cancel 상태를 우회할 수 없습니다.
- accept는 recipient가 해당 request를 대상으로 수행할 때만 유효합니다.
- sender의 cancel은 그 sender가 만든 pending request에만 적용됩니다.
- direct message는 양쪽 active membership과 현재 block 상태를 다시 확인합니다.

관련 D1 제약과 정리는 다음 migration에 있습니다.

- `migrations/0036_chat_reliability.sql`: `client_message_id`, read message boundary, tuple index
- `migrations/0038_chat_request_integrity.sql`: request opener 정리와 room pending unique index
- `migrations/0039_cancel_orphan_pending_chat_requests.sql`: orphan request/membership 정리
- `migrations/0040_notification_request_identity.sql`: actionable notification의 request identity

## 6. Block과 unread

Block은 단순 UI 숨김이 아닙니다. D1 transaction/batch 경계에서 다음을 적용합니다.

- 양방향 follow를 삭제합니다.
- 해당 pair의 friendship을 삭제합니다.
- 양방향 pending chat request를 `cancelled`로 바꿉니다.
- pending opener message를 제거하여 재전달되지 않게 합니다.
- 해당 room의 양쪽 membership을 `left`로 바꿉니다.
- 관련 actionable notifications를 읽음 처리합니다.
- unread count를 재계산하여 과거 unread가 다시 나타나지 않게 합니다.
- 이후 send, request, room connect, unread fanout은 bilateral block을 거부/제외합니다.

기존에 열린 socket은 다음 write/connect 검증에서 계속 차단됩니다. block 이후 stale WebSocket event, old unread row, old request notification이 contact 권한을 복구하지 않습니다.

## 7. Ordering과 history

서버는 message를 `(created_at, id)` tuple로 정렬합니다. timestamp가 같은 두 message도 `id`로 결정적으로 순서가 정해집니다. read boundary와 cursor도 같은 tuple 기준을 사용합니다.

클라이언트는:

- room 선택 시 D1 history page를 로드합니다.
- `before` signed cursor로 과거 history를 prepend합니다.
- WebSocket `ready` 후 `after` signed cursor로 reconnect catch-up을 수행합니다.
- HTTP 응답과 live event를 message ID로 merge/dedupe합니다.
- live event마다 room 전체 GET을 수행하지 않습니다.
- 하단 viewport일 때만 명시적인 read endpoint를 호출합니다.
- 연결이 끊기면 jitter가 있는 exponential backoff로 reconnect합니다: 1초 → 2초 → 4초 → 8초 → 최대 10초.
- offline/hidden 상태에서 연결을 중지하고 online/visible 상태에서 복구합니다.
- room 변경 또는 페이지 이탈 시 이전 연결을 정리합니다.

`setInterval` history polling은 없습니다. reconnect `setTimeout`은 끊어진 WebSocket을 복구하는 backoff timer입니다. protocol-level ping/pong은 `setWebSocketAutoResponse()`가 처리합니다.

## 8. Push와 realtime의 차이

| 상황 | 동작 |
| --- | --- |
| DM 화면을 연 상태 | WebSocket으로 commit된 새 메시지를 즉시 전달 |
| 다른 페이지 | Push가 활성화되어 있으면 브라우저/OS 알림 |
| 사이트를 닫은 상태 | Push가 활성화되어 있으면 알림 |
| Push 미허용/실패 | 메시지는 D1에 남고 다음 history 조회에서 표시 |
| 네트워크 단절 | close 감지 후 backoff reconnect와 D1 catch-up |

Push는 VAPID key, browser permission, service-worker subscription이 모두 필요합니다. Push나 realtime delivery가 실패해도 D1 history는 영향을 받지 않습니다.

## 9. Durable Object 설정

```jsonc
{
  "durable_objects": {
    "bindings": [
      { "name": "CHAT_ROOM", "class_name": "ChatRoom" }
    ]
  },
  "migrations": [
    { "tag": "v2", "new_sqlite_classes": ["ChatRoom"] }
  ]
}
```

`src/worker.ts`는 Wrangler가 migration 대상 class를 발견하도록 `ChatRoom`을 export합니다. `ChatRoom`은 내부 token, room/user header, D1 active membership, bilateral block을 검증한 뒤 socket을 관리합니다. broadcast payload에는 이미 D1에 commit된 message ID와 `(createdAt, id)` 순서 정보만 전달합니다.

## 10. 개발·배포 확인

실제 WebSocket upgrade는 custom Worker entry에서 처리하므로 Worker bundle을 먼저 확인합니다.

```bash
npm run build:worker
npm run preview
```

`npm run build`는 Next.js application build이며 Cloudflare Worker bundle 검증을 대체하지 않습니다. `npm run dev`는 custom Worker entry의 realtime routing을 거치지 않을 수 있습니다.

배포 전 확인:

- `CHAT_ROOM` binding과 `ChatRoom` export 존재
- DO migration이 대상 계정에 반영됨
- `BETTER_AUTH_SECRET` 설정
- D1 messaging migrations 적용
- VAPID 세 값 설정(선택 기능)
- direct message request/accept/decline/cancel과 block 시나리오
- reconnect 후 D1 history와 live event dedupe

## 11. 구현 파일

- `src/worker.ts`: WebSocket upgrade, session 검증, DO 라우팅
- `src/workers/ChatRoom.ts`: room별 hibernatable WebSocket과 fan-out
- `src/lib/chat-realtime.ts`: D1 commit 후 DO broadcast
- `src/lib/messages.ts`: room/request/message canonical state transition
- `src/lib/security/chat-cursor.ts`: room/user/direction signed cursor
- `src/app/api/messages/route.ts`: room 목록, request 목록, conversation start
- `src/app/api/messages/[roomId]/route.ts`: history page와 message write
- `src/app/api/messages/requests/[id]/route.ts`: accept/decline/cancel
- `src/app/api/messages/[roomId]/read/route.ts`: monotonic read boundary
- `src/components/messages/messages-client.tsx`: history, catch-up, receive, reconnect, dedupe
- `migrations/0036_chat_reliability.sql`: retry/read reliability
- `migrations/0038_chat_request_integrity.sql`: request/room integrity
- `migrations/0039_cancel_orphan_pending_chat_requests.sql`: orphan request cleanup
- `migrations/0040_notification_request_identity.sql`: request-specific notifications
- `wrangler.jsonc`: production DO binding/migration
- `wrangler.test.jsonc`: Worker test DO binding/migration
- `tests/workers/chat-room.test.ts`: auth, auto-response, fan-out, pending/block rejection
