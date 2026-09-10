bug2-2는 아직 commit/push하지 않는다.

현재 구현을 유지하면서 아래 최종 결함만 수정·검증한다.

## 1. Friend request attempt identity를 실제로 unique하게 만들 것

현재 legacy behavior에서 declined `user_friendships` row를 다시 pending으로 만들 때 기존 row `id`를 재사용할 수 있다.

이 상태에서는 notification source identity로 friendship id를 사용해도:

R1 → decline → R2

가 같은 ID를 공유할 수 있다.

### invariant

```text
각 logical friend-request attempt는 서로 다른 request entity ID를 가진다.
```

declined → pending으로 다시 여는 경우 새 `createPublicId()`를 만들고 해당 friendship row의 `id`도 새 ID로 갱신한다.

pair_key는 그대로 유지한다.

기존 declined request ID는 이후 accept/decline할 수 없어야 한다.

테스트:

```text
R1 friend request
→ decline

R2 friend request same pair

R1.id != R2.id

old R1 accept
=> 404/not available

R2
=> pending 정상
```

repository에서 `REFERENCES user_friendships` FK가 없는 것을 다시 확인한 뒤 수행한다.

## 2. notification request identity의 의미를 명확히 할 것

notification에 저장하는 identity는 client idempotency token이 아니다.

Friend:

```text
user_friendships.id
```

Chat:

```text
chat_requests.id
```

를 저장한다.

절대로 chat의:

```text
chat_requests.request_id
```

를 notification source identity로 사용하지 않는다.

0040이 production에 아직 적용되지 않았다면 column 이름도 가능하면:

```text
source_request_id
```

처럼 의미가 분명한 이름으로 변경한다.

먼저 read-only로 확인:

```powershell
npx wrangler d1 migrations list DB --remote
```

0039/0040이 remote에서 아직 pending이면 현재 uncommitted migration은 정리 가능하다.

이미 remote applied라면 기존 migration을 rewrite하지 말고 forward migration을 사용한다.

production migration은 이번 작업에서 실행하지 않는다.

## 3. delayed actionable notification race를 막을 것

request notification 생성은 background이므로 terminal transition과 경쟁할 수 있다.

다음 순서를 테스트한다.

```text
R1 request committed
→ notification background work delayed
→ R1 accepted/declined/cancelled
→ delayed notification work resumes
```

결과:

```text
R1 actionable notification INSERT = 0
unread fanout increment = 0
push = 0
```

이어야 한다.

따라서 friend_request/chat_request notification의 최종 INSERT 자체에서 source request가 현재도 `pending`인지 확인한다.

Friend:

```text
source_request_id와 일치하는 user_friendships row
AND status='pending'
AND requester/addressee 일치
```

Chat:

```text
source_request_id와 일치하는 chat_requests row
AND status='pending'
AND from/to 일치
```

를 final SQL guard로 사용한다.

사전 SELECT만 사용하지 않는다.

## 4. stale notification cleanup과 unread_fanout를 함께 검증할 것

현재 terminal transition:

```text
accept
decline
cancel
```

에서 actionable notification을 read 처리한다면 `unread_fanout.notification_count`도 반드시 canonical count와 일치해야 한다.

추가 test:

```text
R1 notification unread
R2 notification unread
fanout = 2

R1 terminal transition

R1 notification read
R2 notification unread
fanout = 1

SELECT COUNT(*)
FROM notifications
WHERE user_id=? AND is_read=0
= unread_fanout.notification_count
```

friend_request와 chat_request 양쪽 테스트한다.

단순 notification row 상태만 검사하고 badge fanout을 검사하지 않는 테스트는 불충분하다.

## 5. 0039/0040을 fresh D1에서 다시 검증할 것

현재 local D1의:

```text
No migrations to apply
```

는 수정된 0039 SQL이 실행됐다는 증거가 아니다.

기존 local dev DB를 파괴하지 말고 별도 빈 persistence directory에서 전체 migration chain을 실행한다.

예:

```powershell
Remove-Item -Recurse -Force .tmp\d1-migration-audit -ErrorAction SilentlyContinue

npx wrangler d1 migrations apply DB `
  --local `
  --persist-to .tmp/d1-migration-audit
```

실제 Wrangler 버전에서 `--persist-to` syntax가 다르면 `--help`를 확인해서 동일 목적의 isolated local D1을 사용한다.

검증 대상:

```text
0001 → ... → 0038 → 수정된 0039 → 0040
```

전부 처음부터 적용 성공.

그리고 fixture로:

### legacy missing opener

```text
pending request
matching pending opener 없음
→ 0039
→ cancelled
```

### shadow opener

```text
pending request
matching pending opener 존재
is_shadow_hidden=1
→ 0039
→ pending 유지
```

### visible opener

```text
pending request
matching visible opener 존재
→ pending 유지
```

를 검증한다.

## 6. block read boundary를 양쪽 participant에 대해 검증할 것

block으로 room이 양쪽에서 사라지므로 old unread resurrection 방지는 blocker 한 사람만 보면 안 된다.

테스트:

```text
A has unread from B
B has unread from A

B blocks A
→ both old unread logically closed

B unblocks A
→ new relationship/request
→ room becomes active again

A old unread = 0
B old unread = 0
```

새 epoch 메시지만 unread가 될 수 있다.

boundary는 두 membership 모두:

```text
(created_at, id)
```

tuple을 monotonic하게 advance한다.

최신 row는:

```sql
ORDER BY created_at DESC, id DESC
LIMIT 1
```

으로 하나의 row에서 timestamp/id를 같이 취득한다.

## 7. image safety cap을 더 보수적으로 할 것

현재 browser upload는 정상 경로에서 이미 최대 dimension 2048로 preprocess한다.

따라서 server safety limit을:

```text
MAX_SOURCE_IMAGE_PIXELS = 8_000_000
```

으로 낮춘다.

`MAX_SOURCE_IMAGE_DIMENSION`은 현재 header parser safety와 충돌하지 않으면 유지 가능하다.

테스트:

```text
8,000,000 pixels 이하
=> dimension gate 통과 가능

8,000,000 초과
=> full JPEG/PNG decode 전에 reject
```

정상 browser-prepared 2048px image가 계속 통과함을 확인한다.

12MP를 유지하려면 단순 `pixels × 4` 계산이 아니라 workerd/Workers-compatible runtime에서 decoder+resize+encode peak memory가 안전하다는 측정 근거가 필요하다.

그 근거가 없으면 8MP를 선택한다.

## 8. E2E stale tests를 이번 commit 전에 정리할 것

현재 3개 stale assertion을 “known failure”로 남기지 않는다.

### Communities

현재 실제 UI가 `CreateCommunityForm`을 render하지 않는 것이 의도라면 hydration marker expectation을 삭제하고 실제 현재 사용자-visible behavior를 assert한다.

테스트를 통과시키기 위해 CreateCommunityForm을 억지로 복구하지 않는다.

### Header scroll

현재 SiteHeader/MobileNav에 scroll-direction hide/show 기능이 의도적으로 없다면 해당 과거 class assertion을 제거/현재 behavior로 수정한다.

테스트 때문에 과거 UX를 복구하지 않는다.

### Guest FeedModeTabs

guest에서 `FeedModeTabs`가 의도적으로 null이면 guest tablist expectation을 제거하고 실제 default guest feed behavior를 검증한다.

## 9. CI E2E parallelism 수정

현재 local Next + `/i/api` + Better Auth test environment는 병렬 E2E에서 429/challenge race가 재현됐다.

작은 VTH suite에서는 안정성이 속도보다 중요하다.

`playwright.config.ts`를 당분간:

```ts
workers: 1
```

로 고정한다.

CI와 local의 behavior를 다르게 만들지 않는다.

rate limit을 테스트 통과용으로 완화하지 않는다.

production security limits를 낮추지 않는다.

향후 worker-isolated DB/auth fixture를 구축했을 때만 parallelism을 다시 올린다.

## 10. Public API 문구는 현재 구현 그대로만 보고할 것

현재 verified contract가:

```text
direct route
= Bearer API key guard
+ Better Auth session

browser tunnel
= tunnel security
+ session
+ browser human gate where required
```

라면 그대로 보고한다.

“API key만 있으면 write 가능”이라고 쓰지 않는다.

public API redesign은 이번 bug fix 범위가 아니다.

## 11. 최종 명령

수정 후:

```powershell
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npx opennextjs-cloudflare build
npx wrangler deploy --dry-run
git diff --check
```

추가로 isolated fresh D1 migration chain을 실행한다.

최종 요구:

```text
Chromium E2E = 0 failed
unit = 0 failed
worker/integration = 0 failed
fresh migration chain = PASS
OpenNext build = PASS
Wrangler dry-run = PASS
```

flaky도 가능한 한 0으로 만든다.

## 12. 완료 후

이번에는 commit한다.

아직 push하지 않는다.

commit message:

```text
fix: complete relationship and messaging integrity hardening
```

보고:

```text
COMMIT SHA
FILES CHANGED
MIGRATIONS
FRIEND REQUEST ATTEMPT ID TEST
DELAYED NOTIFICATION TEST
UNREAD FANOUT CONSISTENCY TEST
FRESH MIGRATION RESULT
FULL E2E RESULT
OPENNEXT RESULT
WRANGLER DRY-RUN RESULT
```

commit SHA를 알려준 뒤 멈춘다.

그 commit을 GitHub에서 최종 diff audit한 후 push 여부를 결정한다.
