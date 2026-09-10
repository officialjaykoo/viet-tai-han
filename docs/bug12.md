# bug12.md — Quality Gate Recovery, D1 Legacy Cleanup & Critical E2E Hardening

## 0. Mission

Bug12는 새 기능 개발 단계가 아니다.

현재 VTH를 대략 89점 수준에서:

```text
Target:
≈ 92/100 production-quality level
```

로 올리는 품질 수렴 작업이다.

Bug12의 핵심 목표는 정확히 세 가지다.

```text
1. Full lint를 실제 0-error 상태로 복구
2. D1 legacy/schema debt를 안전하게 정리
3. 핵심 사용자 journey를 실제 browser E2E로 강화
```

이 세 가지 외에 새로운 대형 기능을 추가하지 않는다.

---

# 1. Baseline

Bug12는 Bug11 완료 이후 최신 `main`에서 시작한다.

현재 기준:

```text
Bug10:
b6209c1
fix: harden DM convergence and transport recovery

Bug11:
c9ff778
feat: harden public content and feed architecture
```

Bug11 이후 확정된 canonical architecture를 baseline으로 한다.

---

# 2. 현재 known baseline

Bug11 완료 보고 기준:

```text
typecheck PASS

unit:
51 files / 233 tests PASS

workers:
22 files / 131 tests PASS

integration:
21 files / 127 tests PASS

build PASS
build:worker PASS

changed-file ESLint:
0 error / 0 warning

full lint:
20 errors / 15 warnings

DB migrations:
42

counter drift:
0

comment orphan:
0

Popular indexes:
working
```

Bug12는 이 상태보다 후퇴하면 안 된다.

---

# 3. Bug12 성공 조건

최종적으로 최소:

```text
npm run lint
PASS

npm run typecheck
PASS

npm test
PASS

npm run test:integration
PASS

npm run test:e2e:chromium
PASS

npm run build
PASS

npm run build:worker
PASS

npm run db:reset:local
PASS
```

이어야 한다.

---

# 4. 중요한 추가 성공 조건

Bug12는 단순히 command가 PASS하는 것으로 끝내지 않는다.

다음도 달성해야 한다.

```text
lint rule suppression 증가 없음

legacy runtime DB dependency 감소

canonical schema 더 명확

critical browser flow coverage 증가

flaky E2E 증가 없음

새 permanent adapter 없음

새 infrastructure 없음

Bug10/11 canonical architecture 유지
```

---

# 5. 이번 Bug에서 하지 않을 것

```text
새 social feature
새 recommendation engine
ML ranking
Vector DB
새 global state manager
Supabase
ORM/repository architecture
React Query 전면 도입
DM redesign
Feed redesign
UI redesign
DB migration squash
기존 migration rewrite
```

Bug12는 품질 작업이다.

---

# 6. Reference Projects

Bug12에서는 Clonagram만 보지 않는다.

다음 mature project들을 문제별 reference source로 활용한다.

```text
Discourse
github.com/discourse/discourse

Lemmy
github.com/LemmyNet/lemmy

Apache Answer
github.com/apache/answer

Bluesky social-app
github.com/bluesky-social/social-app

GoToSocial
github.com/superseriousbusiness/gotosocial

WriteFreely
github.com/writefreely/writefreely
```

---

# 7. Reference 사용 원칙

이 프로젝트들을 fork하거나 architecture를 혼합하려는 것이 아니다.

각 프로젝트에서:

```text
우리 문제를 이미 더 잘 해결한 패턴
```

만 찾아 사용한다.

분류:

```text
ADOPT-PATTERN
ADAPT
VTH-ALREADY-STRONGER
REJECT
```

---

# 8. Bug12에서 우선 볼 외부 구현

## Discourse

우선 확인:

```text
.github/workflows/linting.yml
.github/workflows/migration-tests.yml
```

참고 목적:

```text
lint = optional report가 아니라 hard gate

migration = 별도 검증 대상

clean DB migration

schema drift detection

migration failure diagnostics
```

---

# 9. Lemmy

Bug12에서는 Lemmy의 기능을 포팅하지 않는다.

다음만 본다.

```text
migrations/*
ranking/index evolution
aggregate column evolution
forward migration pattern
```

특히:

```text
hot rank
ranking index
aggregate field
```

같은 DB object를 장기간 어떻게 migration으로 진화시켰는지 참고한다.

VTH의:

```text
votes
score
hot_score
post_likes
like_count
```

역사 정리에 참고한다.

Postgres-specific SQL은 복사하지 않는다.

---

# 10. Apache Answer

다음 관점으로 본다.

```text
Question
Answer
Notification
Permission

service tests
repo tests
table-driven boundary tests
```

Bug12 E2E/통합테스트 scenario matrix를 만들 때 참고한다.

Go architecture 자체는 포팅하지 않는다.

---

# 11. Bluesky

필요한 경우에만:

```text
block
moderation
feed visibility
```

의 사용자 observable behavior를 참고한다.

VTH protocol이나 federation을 추가하지 않는다.

---

# 12. GoToSocial / WriteFreely

코드 port 목적이 아니다.

이 프로젝트들의:

```text
small operational surface
minimal runtime dependencies
simple ownership
```

철학을 Bug12 최종 complexity review에 참고한다.

---

# 13. External Source Gate

외부 프로젝트를 보고 새 abstraction을 추가하기 전에:

```text
이것이 실제 VTH bug/debt를 없애는가?

기존 코드를 제거할 수 있는가?

dependency가 늘어나는가?

VTH-native 구현보다 단순한가?
```

를 판단한다.

새 dependency를 추가하려면 명백한 이익이 있어야 한다.

Bug12에서는 가급적 dependency 추가 0을 목표로 한다.

---

# 14. PHASE A — Full Quality Audit

수정 전에 최신 main에서 모든 baseline command를 실행한다.

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
npm run build:worker
npm run db:reset:local
```

각 실패를 기록한다.

---

# 15. Lint baseline capture

현재 보고된:

```text
20 errors
15 warnings
```

을 실제 최신 main에서 다시 확인한다.

각 lint issue에 대해:

```text
file
line
rule
category
actual risk
fix
```

를 분류한다.

---

# 16. Lint category 예시

실제 결과 기준으로 분류한다.

예:

```text
React hook correctness
React purity
state update in effect
unused import
unused variable
prefer-const
dependency array
accessibility
TypeScript issue
other
```

보고서의 이전 분류를 그대로 믿지 말고 실제 lint output을 기준으로 한다.

---

# 17. P0 — Full lint 0 errors

Bug12의 첫 번째 완료 조건:

```text
npm run lint
→ exit code 0
```

이다.

---

# 18. lint를 통과시키는 잘못된 방법 금지

금지:

```text
ESLint rule global off

eslint config에서 src/** ignore

문제 파일 ignore

eslint-disable-file

대량 eslint-disable-next-line

core-web-vitals 제거

typescript lint 제거

lint script를 항상 success 처리
```

---

# 19. eslint.config.mjs 보존

현재 config는:

```text
Next core-web-vitals
Next TypeScript
```

를 사용한다.

Generated artifact만 ignore한다.

이 기본 구조를 약화시키지 않는다.

---

# 20. React correctness lint

React hook/purity lint는 style warning으로 취급하지 않는다.

예를 들어 실제 문제가:

```text
setState in effect
impure render
unstable dependency
derived state duplication
```

이라면 코드 흐름을 수정한다.

---

# 21. setState-in-effect 대응

단순히 rule을 끄지 않는다.

먼저 판단:

```text
이 state가 정말 state인가?

props/URL/session에서 derive 가능한가?

event handler에서 update해야 하는가?

initializer로 한 번만 계산 가능한가?
```

가능하면 불필요한 state/effect 자체를 제거한다.

---

# 22. Purity 오류

Render 중:

```text
Date.now()
Math.random()
mutable global access
```

등이 문제라면:

```text
event
initializer
server-provided value
stable memoized input
```

쪽으로 이동한다.

---

# 23. unused cleanup

단순:

```text
unused variable
unused import
prefer-const
```

는 바로 정리한다.

단 unused 코드가 실제 unfinished feature를 나타낸다면 무조건 삭제하지 말고 source path를 추적한다.

Dead면 제거한다.

---

# 24. Warning 목표

최소:

```text
errors = 0
```

을 반드시 달성한다.

Warnings도 안전하게 해결 가능한 것은 전부 해결한다.

목표:

```text
0 errors / 0 warnings
```

단 warning 숫자를 0으로 만들기 위해 코드가 더 복잡해진다면 그러지 않는다.

남는 warning은 이유를 보고한다.

Bug12 이후 warning 수는 현재 15보다 증가하면 안 된다.

---

# 25. Lint CI gate

현재 CI에 이미:

```text
npm run lint
```

가 존재한다.

따라서 새로운 복잡한 lint CI를 만들 필요 없다.

Lint green 이후 CI가 실제로 green인지 확인한다.

---

# 26. Discourse에서 채택할 lint 원칙

Discourse처럼:

```text
lint
type check
tests
```

를 독립적인 correctness gate로 본다.

한 command가 다른 실패를 숨기지 않게 한다.

현재 CI의 separate step 구조를 유지해도 좋다.

---

# 27. P0 — main CI green

가능하면 GitHub Actions에서 Bug12 commit CI가:

```text
GREEN
```

인지 확인한다.

Local PASS만 보고 끝내지 않는다.

---

# 28. PHASE B — D1 Canonical Schema Audit

Bug11에서 DB canonicality를 문서화했다.

Bug12에서는 한 단계 더 나간다.

목표:

> **logical canonicality를 실제 runtime/source/schema cleanup으로 연결한다.**

---

# 29. DB cleanup은 destructive cleanup이 아니다

목표는:

```text
예쁘게 보이는 schema
```

가 아니다.

목표:

```text
실수로 legacy 구조를 다시 사용할 가능성을 낮추는 것
```

이다.

---

# 30. Migration history 전수 확인

현재 Bug11 기준 42 migration이 있다.

하지만 Bug12 시작 시 실제 migrations directory를 다시 읽는다.

```text
migrations/*
```

기존 migration은 절대 수정하지 않는다.

---

# 31. 전체 DB object inventory

최소:

```text
tables
columns
indexes
unique constraints
foreign keys
CHECK constraints
```

를 inventory한다.

---

# 32. Classification

각 legacy candidate:

```text
CANONICAL

LEGACY-DATA-BUT-NO-RUNTIME

LEGACY-RUNTIME

MIGRATION-COMPAT

SAFE-REMOVE

UNSAFE-REMOVE
```

중 하나로 분류한다.

---

# 33. 특히 조사할 legacy reaction stack

최우선:

```text
votes
upvotes
downvotes
score
hot_score
post_likes
comment_likes
like_count
```

이다.

---

# 34. Canonical truth는 Bug11 기준 유지

현재 canonical:

```text
Post Like:
post_likes

Comment Like:
comment_likes

Post Like Count:
posts.like_count

Comment Like Count:
comments.like_count

Popular:
like_count + comment_count * 3
```

이다.

Bug12에서 다시 vote model로 회귀하지 않는다.

---

# 35. Runtime source search

각 legacy object 이름을 repository 전체에서 검색한다.

범위:

```text
src/**
tests/**
scripts/**
seed.sql
migrations/**
docs/**
```

단 migration history reference는 runtime usage로 세지 않는다.

---

# 36. runtime reference matrix

예:

```text
Object       src   test  script  seed  migration
votes        ?     ?     ?       ?     yes
hot_score    ?     ?     ?       ?     yes
score        ?     ?     ?       ?     yes
```

를 만든다.

---

# 37. Remote production은 read-only audit부터

Production D1에서 destructive command를 먼저 실행하지 않는다.

먼저 read-only로:

```text
row counts
foreign-key status
legacy table contents
canonical migration completeness
```

를 확인한다.

---

# 38. Legacy row reconciliation

예를 들어 `votes`에 production row가 남아 있다면 바로 DROP하지 않는다.

먼저 확인:

```text
positive legacy vote
→ canonical post_likes/comment_likes에 이미 존재?

missing canonical relation 존재?

negative legacy vote가 현재 제품 의미를 갖는가?
```

를 확인한다.

---

# 39. Legacy row count 0이라고 무조건 DROP하지 마라

추가 조건:

```text
runtime source reference 0
test reference 0
script reference 0
seed reference 0
FK dependency 없음
index dependency 없음
rollback requirement 없음
```

이어야 한다.

---

# 40. Safe cleanup order

권장 순서:

```text
1. runtime reference 제거

2. test/seed/script reference 제거

3. dead index 제거

4. dead table/column removal feasibility 검토

5. forward migration

6. clean migration test

7. upgrade migration test

8. remote apply
```

---

# 41. Index cleanup

현재 DB에는 여러 세대의 ranking/index가 존재할 수 있다.

최소:

```text
score index
hot_score index
public engagement index
public created index
comment indexes
```

를 비교한다.

---

# 42. Index 분류

```text
CURRENT-QUERY-USED

LEGACY

DUPLICATE

PREFIX-REDUNDANT

REQUIRED-FOR-MIGRATION

UNKNOWN
```

으로 분류한다.

---

# 43. Query plan 확인

삭제 전 주요 query:

```text
Home feed
Popular
Community
Profile
Post detail
Comment tree
Q&A
Recommended
```

에서:

```text
EXPLAIN QUERY PLAN
```

을 확인한다.

Bug11에서 추가한:

```text
idx_posts_public_engagement_rank
idx_posts_public_created
idx_comments_public_post
```

의 효과는 유지한다.

---

# 44. Lemmy에서 참고할 부분

Lemmy의 ranking/index migration에서 배울 것은:

> ranking semantics가 바뀌면 function/column/index도 명시적인 migration으로 같이 진화시킨다.

VTH에서도 legacy ranking structure와 current ranking structure를 애매하게 섞지 않는다.

Lemmy SQL 자체는 포팅하지 않는다.

---

# 45. Counter audit를 reusable하게

Bug11에서 일회성으로 확인한:

```text
posts.like_count
comments.like_count
posts.comment_count
questions.answer_count
subreddits.subscriber_count
```

drift audit를 reusable operator check로 만드는 것을 검토한다.

---

# 46. 권장 DB audit script

실익이 있다면:

```text
scripts/audit-db-integrity.mjs
```

또는 현재 audit script에 기능을 합친다.

중복 audit script를 여러 개 만들지 않는다.

---

# 47. DB audit script 최소 기능

```text
PRAGMA foreign_key_check

post like drift

comment like drift

post comment drift

question answer drift

subscriber drift

orphan relations

legacy row counts
```

를 출력하도록 한다.

---

# 48. npm script

필요하면:

```json
"db:audit:local": "..."
```

정도를 추가한다.

Remote destructive command를 자동 script에 넣지 않는다.

Remote mode가 있다면 기본은 read-only여야 한다.

---

# 49. Discourse migration-test 방식 ADAPT

VTH에서도 migration을 두 방향에서 확인한다.

## A. Clean install

```text
empty D1
→ migration 1 ... latest
→ seed
→ audit PASS
```

## B. Upgrade

```text
Bug11-compatible schema/data
→ Bug12 forward migration
→ audit PASS
```

---

# 50. 기존 migration rewrite 금지

```text
0001
...
0042
```

등 이미 적용된 migration을 수정하거나 squash하지 않는다.

새 변경은 다음 forward migration으로 한다.

Bug12 시작 시 최신 번호를 확인하고 다음 번호를 사용한다.

---

# 51. Migration rollback 접근

D1 production history를 생각해:

```text
manual DROP in production
```

하지 않는다.

모든 persistent schema change는 migration으로 기록한다.

---

# 52. SAFE physical cleanup

증거가 충분한 dead object는 실제 제거해도 된다.

특히:

```text
dead legacy indexes
```

는 우선 cleanup 후보다.

---

# 53. Column/table drop은 더 엄격

Column/table 제거는:

```text
데이터 보존
FK
SQLite/D1 behavior
rollback
production rows
```

까지 확인한다.

이익이 작으면 physical object를 유지하고 runtime reference만 0으로 만드는 편이 낫다.

---

# 54. DB cleanup 성공 기준

Bug12 완료 후:

```text
runtime legacy reaction usage = 0

seed legacy reaction usage = 0

canonical truth documented

safe dead indexes cleaned

legacy DB objects status 명확

counter drift = 0

foreign_key_check = clean
```

이어야 한다.

---

# 55. docs/VTH_DATABASE.md 업데이트

반드시 실제 결과로 업데이트한다.

각 legacy object를:

```text
REMOVED

RETAINED-MIGRATION-COMPAT

RETAINED-DATA

CANONICAL
```

로 명시한다.

---

# 56. PHASE C — Critical Browser E2E

현재 E2E에는 이미:

```text
authenticated.spec.ts
browse.spec.ts
smoke.spec.ts
```

가 있다.

기존 E2E를 버리지 않는다.

---

# 57. 기존 E2E에서 이미 되는 것

현재 authenticated flow에는 이미:

```text
login test session
post create
comment
like
hide
settings
community browse
profile
mobile keyboard UX
composer
post detail
desktop navigation
mobile chrome
```

등이 있다.

이걸 중복해서 다시 작성하지 않는다.

---

# 58. E2E의 새 목표

Bug12에서는 **서버 단위 테스트로는 잡기 어려운 실제 사용자 journey**를 추가한다.

최소 핵심:

```text
Authentication/session

Post interaction

Block

DM

Q&A

Marketplace
```

이다.

---

# 59. 실제 OAuth를 CI에서 호출하지 마라

Facebook/Kakao 같은 외부 OAuth를 Playwright CI에서 실제 수행하면:

```text
external dependency
rate limit
provider UI change
captcha
network
```

때문에 flaky해진다.

현재 test-only social session 방식은 유지한다.

---

# 60. E2E session security

현재:

```text
/api/auth/e2e-session
```

test-only session mechanism을 사용한다.

Bug12에서 multi-user E2E를 위해 확장한다면 반드시:

```text
production에서는 fail closed
E2E environment에서만 enabled
allowlisted seed users만 허용
arbitrary user impersonation 금지
```

를 보장한다.

---

# 61. Two-user E2E

Block / DM / Q&A에는 두 계정이 필요하다.

현재 seed를 확인한다.

이미 적합한 두 social user가 있으면 사용한다.

없다면 deterministic E2E seed user를 추가한다.

예:

```text
alice
bob
```

단 production auth backdoor를 만들지 않는다.

---

# 62. E2E helper generalization

현재:

```text
loginAsAlice()
```

가 있다.

필요하면:

```ts
loginAsSeedUser(page, "alice")
loginAsSeedUser(page, "bob")
```

같은 helper로 일반화한다.

하지만 기존 test를 불필요하게 대량 수정하지 않는다.

---

# 63. Critical Flow 1 — Session/Auth

검증:

```text
signed-out protected route
→ login

test social account login
→ signed-in shell

logout
→ session gone

provider callback error
→ secret/error_description URL에서 제거

login page
→ configured social providers visible
```

Real provider login 자체는 CI에서 수행하지 않는다.

---

# 64. Critical Flow 2 — Post

기존 coverage를 보완한다.

Browser 수준에서 최소:

```text
Alice creates post
→ detail renders

Alice likes
→ pressed state

Alice comments
→ comment visible

reload
→ like/comment canonical state 유지

unlike
→ canonical UI 반영
```

기존 test가 이미 충족하면 새 test를 중복 생성하지 않는다.

필요하면 기존 test를 더 좁고 독립적인 scenario로 분리한다.

---

# 65. 너무 긴 E2E test 분리 검토

현재 하나의 test가:

```text
post
comment
like
hide
settings
community
```

를 모두 수행한다.

한 초기 단계 실패가 unrelated flow를 전부 막는다면 유지보수성이 떨어진다.

적절하게:

```text
content lifecycle
settings/profile
community browse
```

정도로 분리 검토한다.

단 같은 setup을 과도하게 반복하지 않는다.

---

# 66. Critical Flow 3 — Block

두 browser context를 사용한다.

Scenario:

```text
Alice 로그인
Bob 로그인

Alice → Bob profile

Alice blocks Bob
```

검증:

```text
public Bob post direct read 가능

Alice → Bob new like 불가

Alice → Bob new comment 불가

Bob → Alice positive interaction 불가

DM new send/request 불가
```

---

# 67. Block cleanup

필요하면 마지막에 unblock해서 fixture pollution을 줄인다.

테스트가 실패해도 다음 test가 깨지지 않도록 data isolation을 고려한다.

---

# 68. Critical Flow 4 — DM

Bug10에는 매우 강한 unit/integration coverage가 있다.

Bug12 E2E에서는 모든 race를 다시 테스트하지 않는다.

실제 user journey만 확인한다.

```text
Alice opens Bob profile
→ message/request

Bob sees request
→ accept

Alice sends message
→ Bob receives

Bob opens room
→ unread/read UI convergence
```

---

# 69. DM E2E 범위 제한

Bug10에서 이미 검증한:

```text
256 dedupe
transport retry
catch-up ordering
revoke internals
```

을 browser E2E에서 다시 재현하려고 하지 않는다.

E2E는 wiring 검증이다.

---

# 70. DM WebSocket test

실제 browser WebSocket path가 동작하는지 확인한다.

Message 수신을 polling으로 테스트하지 않는다.

UI에 realtime으로 나타나는 것을 기다린다.

---

# 71. Critical Flow 5 — Q&A

두 user flow:

```text
Alice:
question 생성

Bob:
question 확인
answer 작성

Alice:
answer 확인
accept
```

검증:

```text
answer count
accepted marker
reload persistence
```

가능하면 포함한다.

---

# 72. Q&A negative path

Browser E2E에서 모든 permission edge를 검사할 필요는 없다.

Bug11 integration tests가 이미:

```text
block
requestId
lock/remove race
```

를 다룬다면 E2E는 happy journey 중심으로 둔다.

---

# 73. Apache Answer 활용

Apache Answer의 Q&A service/repository test 구조를 참고해:

```text
actor
state
action
expected result
```

matrix를 유지한다.

VTH 구현을 Apache 구조로 리팩터링하지 않는다.

---

# 74. Critical Flow 6 — Marketplace

최소 browser journey:

```text
Alice create listing
→ marketplace list에 표시
→ detail open

Bob browse listing
```

Save가 현재 핵심 UI이면:

```text
Bob save
→ reload
→ saved 유지
```

도 검토한다.

---

# 75. Popular smoke

Bug11 integration test가 ranking correctness를 책임진다.

E2E에서는:

```text
/?feed=popular
```

이 정상 렌더되고 navigation이 깨지지 않는 정도면 충분하다.

Ranking 수학을 browser test로 다시 검증하지 않는다.

---

# 76. Mobile critical smoke

기존 mobile tests를 유지한다.

최소:

```text
Home
Profile
Messages
Settings
```

에서:

```text
horizontal overflow 없음
primary navigation 사용 가능
```

를 확인한다.

Bug12에서 전체 responsive redesign은 하지 않는다.

---

# 77. Flake 금지

금지:

```ts
await page.waitForTimeout(1000)
await page.waitForTimeout(3000)
```

로 race를 해결하는 것.

---

# 78. 예외 — intentional bot dwell

현재 `warmBotGuard()`의 dwell은 제품의 anti-bot constraint를 만족시키기 위한 의도적 시간이다.

이것은 arbitrary flake sleep과 구분한다.

불필요하게 제거하지 않는다.

---

# 79. 기다림 원칙

우선:

```text
expect(locator)
expect.poll
response/event wait
URL
visible state
aria state
canonical UI state
```

로 기다린다.

---

# 80. Locator 원칙

우선:

```text
role
label
accessible name
test id
```

순으로 사용한다.

CSS implementation detail selector에 과도하게 의존하지 않는다.

---

# 81. Deterministic test data

테스트가 생성하는 데이터는:

```text
crypto/random suffix
timestamp suffix
explicit seeded IDs
```

등으로 충돌을 피한다.

단 test assertion은 timestamp ordering에 기대지 않는다.

---

# 82. Test isolation

한 test에서:

```text
block
friend
follow
message
accepted answer
```

등 persistent state를 변경하면 다른 test에 영향을 주지 않는지 확인한다.

방법:

```text
unique fixture
explicit cleanup
fresh user
```

중 가장 단순한 방법을 사용한다.

---

# 83. Test-only API 남발 금지

E2E setup을 빠르게 하려고 모든 feature에 test-only API를 만들지 않는다.

Test-only API는:

```text
session bootstrap
minimal deterministic fixture
```

정도로 제한한다.

실제 action은 UI를 통과한다.

---

# 84. Browser context

Alice/Bob flow는:

```text
browser.newContext()
```

등 독립 session context를 사용한다.

Cookie를 강제로 바꿔가며 한 context를 재활용하지 않는다.

---

# 85. E2E runtime

현재 Playwright:

```text
workers = 1
CI retries = 1
```

이다.

Next/OpenNext/tunnel 특성 때문에 이미 single-worker를 선택했다.

Bug12에서 무리하게 병렬도를 올리지 않는다.

---

# 86. Flake stress run

Critical E2E가 완료되면 최소 한 번:

```powershell
npx playwright test --project=chromium-desktop --repeat-each=3
```

또는 critical subset을 3회 반복한다.

목표:

```text
3 consecutive clean passes
```

이다.

---

# 87. Retry에 숨어 있는 flake 확인

CI retry가 1회 있다는 이유로:

```text
first run fail
retry pass
```

를 성공으로 보지 않는다.

Bug12 완료 보고에:

```text
tests passed only after retry
```

가 있는지 명시한다.

---

# 88. CI Chromium gate

현재 CI가:

```text
npm run test:e2e:chromium
```

을 실행한다.

Bug12 critical flows는 기본 Chromium CI에 포함되어야 한다.

별도의 수동-only test로 숨기지 않는다.

---

# 89. Cross-browser

Bug12 목표는 92점이지 full browser certification이 아니다.

Chromium critical suite를 먼저 완전 안정화한다.

기존 Firefox/WebKit config는 유지한다.

시간/환경이 허용하면 smoke subset만 확인한다.

Bug12 완료 조건으로 전체 5 project PASS를 강제하지 않는다.

---

# 90. CI 구조

현재 CI 흐름:

```text
checkout
npm ci
lint
typecheck
test
Playwright Chromium
build:worker
```

은 유지한다.

필요하다면:

```text
db integrity audit
```

를 추가할 수 있다.

---

# 91. CI DB audit 추가 조건

Audit script가:

```text
빠르고
deterministic하고
network dependency 없고
local D1만 사용
```

한다면 CI에 추가한다.

예:

```text
npm run db:audit:local
```

---

# 92. CI를 지나치게 느리게 만들지 마라

DB audit 때문에 migration을 여러 번 재실행해서 CI가 지나치게 무거워지면 별도 migration job을 검토한다.

Discourse의 migration-tests 분리 구조를 참고할 수 있다.

---

# 93. Recommended CI 구조

현재 규모에서는 두 방식 모두 가능하다.

## Option A — 기존 CI 유지

```text
quality
→ lint
→ typecheck
→ unit/integration
→ db audit
→ e2e
→ build
```

## Option B — DB가 무거우면 분리

```text
quality
migration
e2e
```

Luna가 실제 runtime을 보고 더 단순한 것을 선택한다.

불필요한 workflow fragmentation은 하지 않는다.

---

# 94. PHASE D — Dead Code / Complexity Cleanup

Lint와 DB audit 과정에서 dead code가 발견되면 정리한다.

특히:

```text
unused RED compatibility
legacy score helper
unused vote types
old mapper
old DB helper
dead test fixture
```

를 확인한다.

---

# 95. Dead code 삭제 조건

검색 결과:

```text
runtime usage 0
test requirement 0
migration-only 아님
public API 아님
```

일 때 삭제한다.

---

# 96. RED origin이라는 이유만으로 삭제하지 마라

현재 VTH에 잘 맞고 canonical이면 유지한다.

출처는 중요하지 않다.

---

# 97. Clonagram origin도 동일

Bug11에서 채택한:

```text
small projection
visibility helper
payload validation
```

이 현재 canonical이면 유지한다.

---

# 98. Complexity Gate

Bug12 완료 후:

```text
Files added
Files deleted

New helper
Removed helper

New script
Removed script

Permanent adapter count

Runtime legacy DB references
```

를 보고한다.

---

# 99. 목표

Bug12는 품질 작업이므로:

```text
새 파일 15개 추가
기존 파일 0개 정리
```

같은 결과는 좋지 않다.

필요한 파일만 추가한다.

---

# 100. Documentation

최소 업데이트:

```text
docs/ARCHITECTURE.md
docs/VTH_DATABASE.md
```

필요하면:

```text
docs/VTH_TESTING.md
```

추가.

---

# 101. VTH_TESTING.md를 만든다면

다음만 기록한다.

```text
CI gates

unit vs integration vs E2E responsibility

test social session

critical user journeys

multi-user fixture

flake policy

DB audit
```

거대한 테스트 교과서를 쓰지 않는다.

---

# 102. Input bug document

현재 프로젝트 관례대로:

```text
docs/bug12.md
```

는 implementation instruction artifact다.

기존 bug 문서들이 untracked 상태라면 그대로 보존하고 product commit에는 포함하지 않는다.

Durable architecture docs만 commit한다.

---

# 103. Required validation — Lint

```powershell
npm run lint
```

필수.

최종 보고:

```text
Before:
20 errors / 15 warnings

After:
X errors / Y warnings
```

---

# 104. Required validation — Type/Test

```powershell
npm run typecheck
npm test
npm run test:integration
```

필수.

---

# 105. Required validation — E2E

```powershell
npm run test:e2e:chromium
```

필수.

Critical subset 3회 반복도 수행한다.

---

# 106. Required validation — Build

```powershell
npm run build
npm run build:worker
```

필수.

---

# 107. Required validation — DB

```powershell
npm run db:reset:local
```

그리고:

```text
foreign_key_check

counter drift

legacy row audit

query plan
```

검증.

---

# 108. Remote DB verification

Migration이 존재하면 remote 적용 전:

```text
remote current migration state
legacy row counts
canonical row consistency
```

를 read-only 확인한다.

---

# 109. Remote migration 이후

다시:

```text
migration applied

index presence

FK integrity where supported

canonical counts

production smoke
```

를 확인한다.

---

# 110. Production Smoke

배포 후 최소:

```text
/
?feed=popular
/login
/questions
/marketplace
/messages
```

의 정상 접근을 확인한다.

인증이 필요한 flow는 production에서 자동 test account로 로그인하지 않는다.

---

# 111. Bug10 Regression Boundary

다음은 특별한 이유 없이는 변경하지 않는다.

```text
messages-client.tsx
use-unread-count.ts
chat-room-state.ts
chat-send-recovery.ts
ChatRoom.ts
```

Bug12 DB cleanup이 messaging schema까지 영향을 준다면 Bug10 suite 전체를 다시 확인한다.

---

# 112. Bug11 Regression Boundary

반드시 유지:

```text
canonical post projection

canonical visibility

Popular ranking

signed Popular cursor

block final-write guards

requestId conflict semantics

counter invariants
```

---

# 113. Popular formula는 Bug12 대상 아님

현재:

```text
like_count + comment_count * 3
```

을 Bug12에서 다시 튜닝하지 않는다.

Bug12 DB cleanup 때문에 ranking이 깨지지 않는지만 확인한다.

---

# 114. Acceptance Gate — Lint

PASS:

```text
npm run lint exit 0
```

FAIL:

```text
rule disable로 숨김
source ignore 확대
```

---

# 115. Acceptance Gate — DB

PASS:

```text
canonical schema 명확
runtime legacy dependency 감소
counter drift 0
FK clean
clean migration PASS
upgrade migration PASS
safe cleanup migration
```

FAIL:

```text
legacy object를 조사 없이 DROP
migration rewrite
canonical/legacy 더 혼란
```

---

# 116. Acceptance Gate — E2E

PASS:

```text
critical flows browser에서 실제 작동
3회 repeated run clean
CI Chromium PASS
```

FAIL:

```text
sleep으로 flake 숨김
real OAuth 의존
test-only bypass production 노출
```

---

# 117. 최종 보고 — Section A

## Lint

반드시:

```text
Before:
20 errors / 15 warnings

After:
...

Fixed rules:
...

Suppression added:
...
```

`Suppression added`가 있으면 각각 이유를 적는다.

---

# 118. 최종 보고 — Section B

## DB

표:

```text
Object
Before
Runtime Usage
Production Rows
Decision
After
```

최소:

```text
votes
score
hot_score
upvotes
downvotes
legacy indexes
post_likes
comment_likes
```

---

# 119. 최종 보고 — Section C

## Migrations

```text
new migration
objects removed
objects retained
reason retained
clean migration result
upgrade result
```

---

# 120. 최종 보고 — Section D

## E2E

각 critical journey:

```text
Auth
Post
Block
DM
Q&A
Marketplace
```

에 대해:

```text
covered
partially covered
not covered
```

를 명시한다.

---

# 121. 최종 보고 — Section E

## Flake

```text
repeat runs:
...

first-attempt failures:
...

retry-only passes:
...

arbitrary sleeps introduced:
0
```

을 보고한다.

---

# 122. 최종 보고 — Section F

## External Project Adoption

표:

```text
Project
Source path
Pattern inspected
Decision
VTH change
```

예:

```text
Discourse
migration-tests.yml
migration validation
ADAPT
...

Lemmy
ranking migrations
forward schema evolution
ADAPT
...

Apache Answer
Q&A tests
scenario matrix
ADAPT
...
```

---

# 123. 최종 보고 — Section G

## Complexity

```text
Files added:
Files deleted:

New abstractions:
Removed abstractions:

New permanent adapters:
Legacy runtime dependencies removed:

New dependencies:
```

---

# 124. 목표 complexity

가능하면:

```text
New permanent adapters = 0
New infrastructure = 0
New runtime dependency = 0
```

을 목표로 한다.

---

# 125. 최종 Quality Gate

Bug12 완료 후 다음을 한 번에 실행 가능한 상태여야 한다.

```powershell
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build
npm run build:worker
```

모두 green.

---

# 126. 92점 목표의 의미

Bug12의 목표는 기능을 더 많이 만드는 것이 아니다.

현재 VTH의 약점:

```text
main lint red
legacy DB physical debt
critical full-browser journey coverage 부족
```

을 제거하는 것이다.

---

# 127. 최종 방향

Bug6~11에서는:

```text
기능 correctness
security
DM
feed
architecture convergence
```

를 강화했다.

Bug12에서는:

```text
repository quality
database hygiene
real browser confidence
```

를 강화한다.

---

# 128. Luna implementation principle

분석 보고만 작성하고 끝내지 마라.

실제 source를 수정하고:

```text
lint fix
DB audit/cleanup
migration
tests
E2E
CI
docs
```

까지 완료한다.

---

# 129. 단 위험 작업은 증거부터

특히 production DB는:

```text
audit
→ evidence
→ local migration rehearsal
→ tests
→ forward migration
```

순서로 한다.

추측으로 production data를 삭제하지 않는다.

---

# 130. 최종 성공 정의

Bug12 완료 후 VTH는:

```text
main branch lint green

CI green

canonical DB가 더 명확

legacy runtime path 감소

counter drift 0

critical user flow가 실제 browser에서 검증

E2E가 retry에 의존하지 않음

Bug10/11 correctness 유지

architecture complexity 증가 없음
```

이어야 한다.

핵심:

> **Bug12는 새로운 것을 많이 만드는 작업이 아니라, 지금까지 만든 VTH를 실제로 믿고 유지보수할 수 있는 repository로 만드는 작업이다.**

그리고 외부 프로젝트를 사용할 때도:

> **Discourse/Lemmy/Apache Answer 등이 수년간 해결해 온 품질·migration·test 문제를 다시 발명하지 않는다. 패턴은 적극적으로 가져오되, VTH architecture에는 하나의 canonical 방식으로 흡수한다.**
