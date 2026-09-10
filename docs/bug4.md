# VTH Repository Root + Documentation Consolidation

## 0. 작업 경계

이 작업은 기능 개발이 아니다.

목표:

```text
1. GitHub root를 단순화
2. 중복 문서를 하나로 합침
3. 과거 계획 문서가 AI를 오도하지 않게 제거
4. 현재 architecture/invariant를 canonical 문서 하나로 고정
5. agent instructions 강화
6. CI가 실제 production Cloudflare build까지 검증하도록 보강
```

### 매우 중요

현재 bug2-1 relationship/DM 변경사항이 아직 working tree에 있다면 이 작업과 섞지 않는다.

먼저 bug2-1을:

```text
검증
→ 별도 commit
```

한 다음 이 작업을 시작한다.

이번 root cleanup은 별도 commit:

```text
chore: consolidate repository docs and project contracts
```

으로 만든다.

기능 코드 수정과 섞지 않는다.

---

# 1. 최종 목표 root

작업 후 repository root는 대략 다음 구조를 유지한다.

```text
.dev.vars.example
.gitattributes                 NEW
.github/
.gitignore
AGENTS.md
CLAUDE.md
LICENSE
README.md
SECURITY.md
cloudflare-env.d.ts
components.json
docs/
eslint.config.mjs
migrations/
next.config.ts
open-next.config.ts
package-lock.json
package.json
playwright.config.ts
postcss.config.mjs
public/
scripts/
seed.sql
src/
tests/
tsconfig.json
vitest.config.mts
vitest.workers.config.mts
wrangler.jsonc
wrangler.test.jsonc
```

다음은 root에서 제거한다.

```text
ABOUT.md
GITHUB_POST.md
```

---

# 2. DELETE — `ABOUT.md`

`ABOUT.md`의 대부분은 현재 `README.md`와 중복이다.

삭제 전에 아래 유효한 내용만 README에 흡수한다.

* people-first identity
* immutable `user.id`
* mutable public username
* explicit privacy/block rules
* retry-safe social actions
* edge-first architecture
* multilingual product principle

전체 문장을 그대로 복사하지 않는다.

README에 짧은:

```text
## Design principles
```

섹션으로 4~6개 bullet 정도만 합친다.

그 후:

```text
DELETE ABOUT.md
```

Git history가 있으므로 archive copy를 만들지 않는다.

---

# 3. DELETE — `GITHUB_POST.md`

이 파일은 repository runtime/documentation contract가 아니다.

GitHub repository description과 posting text를 저장하기 위한 임시 문서다.

현재 GitHub About description과 website가 실제 repository metadata에 이미 존재하므로 파일로 중복 유지하지 않는다.

```text
DELETE GITHUB_POST.md
```

내용을 `docs/`로 이동하지 않는다.

README에도 “Show HN / Discord / posting kit” 내용을 넣지 않는다.

---

# 4. ADD — `.gitattributes`

Windows + PowerShell + AI editor 환경에서 CRLF/LF diff가 반복되고 있으므로 추가한다.

내용:

```gitattributes
* text=auto

*.ts   text eol=lf
*.tsx  text eol=lf
*.js   text eol=lf
*.mjs  text eol=lf
*.mts  text eol=lf
*.json text eol=lf
*.jsonc text eol=lf
*.md   text eol=lf
*.sql  text eol=lf
*.yml  text eol=lf
*.yaml text eol=lf
*.css  text eol=lf

*.png  binary
*.jpg  binary
*.jpeg binary
*.webp binary
*.ico  binary
*.woff binary
*.woff2 binary
```

### 금지

이번 commit에서:

```text
git add --renormalize .
```

로 repository 전체를 재작성하지 않는다.

대규모 line-ending-only diff를 만들지 않는다.

이번 작업에서 실제 수정한 파일만 LF로 저장한다.

---

# 5. MODIFY — `.gitignore`

현재:

```text
.dev.vars
!.dev.vars.example
```

만 막고 있다.

다음처럼 변경한다.

```gitignore
# cloudflare / wrangler local state
.wrangler/
.dev.vars*
!.dev.vars.example
```

목적:

```text
.dev.vars
.dev.vars.local
.dev.vars.production
.dev.vars.preview
```

같은 private file이 실수로 commit되지 않도록 한다.

기존:

```text
.env*
!.env.example
```

은 유지한다.

기존 `.tmp`, `.open-next`, `.next`, Playwright result ignore도 유지한다.

---

# 6. MODIFY — `README.md`

README를 repository의 **사람용 canonical entry point**로 만든다.

현재보다 더 길게 만들지 않는다.

## 첫 문단

VTH의 실제 목적을 명확히 한다.

핵심 의미:

```text
Việt tại Hàn is a community and social platform for Vietnamese people living in Korea.
```

Cloudflare 기술 설명보다 제품 대상이 먼저 나와야 한다.

## Core product

과장 없이 현재 핵심을 묶는다.

```text
Posts / comments / likes
Communities
Q&A
Marketplace
Local businesses
Profiles
Follow / friends / block
1:1 chat and message requests
Notifications
Vietnamese/Korean multilingual experience
```

Facebook/Instagram은 architecture 설명으로 사용하지 않는다.

필요하면:

```text
familiar social UX
```

정도로만 표현한다.

## Architecture

현재 canonical 구조로 정확히 교체한다.

```text
Next.js UI
    |
VTH Worker
    |
    +-- D1          canonical persistent state
    +-- R2          media
    +-- ChatRoom DO realtime DM delivery only
    +-- Workers AI  translation only
```

다음처럼 애매한 문구는 사용하지 않는다.

```text
Durable Objects where required
```

대신:

```text
ChatRoom Durable Object — realtime direct-message WebSocket fan-out only
```

라고 명시한다.

다음도 명시한다.

```text
D1 = source of truth
R2 = media
ChatRoom DO = realtime delivery, not message persistence
Workers AI = translation only
```

README에서 PostObject, Vectorize 등을 장황하게 설명할 필요는 없다.

## Documentation links

README에서 active docs만 링크한다.

```text
docs/ARCHITECTURE.md
docs/CLOUDFLARE_VTH_KR_SETUP.md
docs/VTH_REALTIME_DM.md
docs/USER_ID_REKEY_RUNBOOK.md
docs/README.md
SECURITY.md
```

## Commands

다음 command도 포함한다.

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e:chromium
npm run build:worker
npm run preview
```

`npm run build`와 Cloudflare production build가 다르다는 점을 명확히 한다.

```text
npm run build
= Next.js build

npm run build:worker
= OpenNext Cloudflare production bundle
```

## Attribution

현재 fork attribution과 MIT license 문구는 유지한다.

LICENSE 내용을 중복 복사하지 않는다.

---

# 7. MODIFY — `AGENTS.md`

파일 상단의 Next.js 자동 생성 block:

```text
<!-- BEGIN:nextjs-agent-rules -->
...
<!-- END:nextjs-agent-rules -->
```

은 **한 글자도 제거하지 않는다.**

그 아래에 VTH 고유 규칙을 추가한다.

추가할 내용:

```markdown
# VTH project rules

## Product scope

VTH is a small social/community service for Vietnamese people living in Korea.

Core product:

- posts, comments, likes
- communities
- Q&A
- marketplace
- local businesses
- follow, friends, block
- 1:1 messaging

Do not turn Facebook/Threads UX references into Facebook-scale architecture.

## Canonical architecture

- D1 is the persistent source of truth.
- R2 stores media.
- ChatRoom Durable Object is realtime DM delivery only.
- Workers AI is translation only.
- Browser application API traffic uses `/i/api`.
- Direct `/api/*` access follows the existing public API authentication boundary.

Do not add or restore:

- PostObject
- Vectorize
- Redis
- Kafka
- generic queues
- graph databases
- microservices
- general-purpose Durable Objects
- separate feed/recommendation infrastructure

unless a concrete approved requirement cannot be satisfied by the current architecture.

## Identity

- `user.id` is immutable canonical identity.
- username is a mutable public handle.
- authentication is social-first/social-only.
- Facebook, Kakao, and Zalo provider identity must not be merged solely by matching email.
- block overrides ordinary social/contact permissions.

## D1 migrations

Never edit or delete an already-applied migration to repair production state.

Always add a forward migration.

Before destructive production data work:

- backup
- dry run
- migration verification
- foreign key check

## Write correctness

For user-created writes:

- authorization is enforced server-side
- retry/idempotency must not create duplicate canonical rows
- state-changing race conditions must be protected at the final SQL write
- client UI checks are never authorization
- derived side effects must not invalidate an already successful canonical write

## Messaging

- D1 stores rooms, membership, requests, messages, and read state.
- WebSocket is delivery only.
- message history must be recoverable from D1.
- block revokes contact permission.
- retries must not duplicate messages or side effects.
- ordering/read boundaries use `(created_at, id)`.

## UX

Consumer pages use Q&A / Marketplace as the baseline VTH visual language:

- VTH radial brand backdrop
- eyebrow → title → description
- consistent card hierarchy
- shared button/input/select primitives
- mobile-first touch targets

Do not invent a different hero/gradient/card language per page.

Auth, admin, and developer documentation may use their own intentional layout systems.

## Verification

For normal code changes run relevant tests.

For broad/core changes run:

- `npm run lint`
- `npm run typecheck`
- `npm test`
- `npm run test:integration`
- relevant Playwright tests

For Worker, bindings, Durable Objects, deployment, or OpenNext changes also run:

- `npm run build:worker`

Do not report a command as passing unless it was actually executed.
```

이 section은 Next-generated block **아래**에 둔다.

---

# 8. KEEP — `CLAUDE.md`

현재:

```text
@AGENTS.md
```

그대로 유지한다.

별도 Claude용 architecture 내용을 복사하지 않는다.

`AGENTS.md` 하나를 canonical agent instruction으로 사용한다.

`CODEX.md`, `GEMINI.md`, `LUNA.md` 같은 추가 root agent 문서를 만들지 않는다.

---

# 9. ADD — `docs/ARCHITECTURE.md`

과거 계획서 대신 **현재 상태만 설명하는 canonical architecture 문서**를 만든다.

길이 목표:

```text
약 150~250 lines 이하
```

구성:

```text
# VTH Architecture

1. Product boundary
2. Runtime topology
3. Persistent state
4. Identity/auth
5. Content
6. Social graph
7. Messaging
8. Media
9. Translation
10. Security ingress
11. Deployment
12. Invariants
13. Explicit non-goals
```

## 반드시 포함

```text
D1 = persistent source of truth
R2 = media
ChatRoom DO = realtime DM only
Workers AI = translation only
```

Browser:

```text
browser
→ /i/api
→ VTH application API
```

Direct external API:

```text
/api/*
→ existing Bearer/public API authentication boundary
```

단, 현재 public API가 API-key-only identity인지 session을 추가로 요구하는지는 실제 코드를 확인해서 사실대로 기록한다.

추측하지 않는다.

## Explicit non-goals

```text
PostObject
Vectorize
Redis
Kafka
microservices
generic background queue architecture
separate recommendation service
federation
```

현재 사용하지 않는 것을 미래 TODO처럼 적지 않는다.

---

# 10. ADD — `docs/README.md`

docs directory에 index를 만든다.

예:

```markdown
# VTH technical documentation

Active documents:

- ARCHITECTURE.md — current system architecture and invariants
- CLOUDFLARE_VTH_KR_SETUP.md — production deployment/runbook
- VTH_REALTIME_DM.md — messaging/realtime design
- USER_ID_REKEY_RUNBOOK.md — dangerous one-off user-ID maintenance procedure

Historical implementation plans are intentionally not kept as active documentation.
Use Git history when historical context is needed.
```

중요:

`docs/README.md`에서 각 문서의 역할을 한 문장으로 설명한다.

---

# 11. DELETE — `docs/VTH_P0_IMPLEMENTATION_PLAN.md`

현재 구현 완료/과거 계획/후속 TODO가 한 문서에 섞여 있다.

현재 architecture contract로 사용하지 않는다.

다음 정보 중 현재도 맞는 invariant만:

```text
docs/ARCHITECTURE.md
AGENTS.md
```

로 이동한다.

그 후:

```text
DELETE docs/VTH_P0_IMPLEMENTATION_PLAN.md
```

`docs/archive/`로 복사하지 않는다.

Git history가 archive다.

---

# 12. DELETE — `docs/VTH_REUSE_AUDIT.md`

이 문서도 특정 과거 commit과 `red` 재사용 판단을 기준으로 한 감사 기록이다.

현재 코드 계약과 과거 계획이 섞여 있으므로 active docs에서 제거한다.

현재도 유효한 내용:

```text
D1 source of truth
R2 media
current auth model
current DM architecture
current migration policy
```

만 `ARCHITECTURE.md`에 반영한다.

그 후:

```text
DELETE docs/VTH_REUSE_AUDIT.md
```

Git history 외에 별도 보존하지 않는다.

---

# 13. MODIFY — `docs/CLOUDFLARE_VTH_KR_SETUP.md`

현재 문서는 운영 runbook으로 유용하므로 유지한다.

하지만 **시간이 지나면 바로 틀리는 상태 기록을 제거**한다.

삭제할 종류:

```text
Current Version ID
과거 secret이 노출돼 rotation했다는 역사
초기 ISP DNS resolver 문제 기록
“이 단계 완료” 식의 과거 작업 일지
특정 날의 deployment 결과
```

유지할 것:

```text
Cloudflare account/project resource names
vth.kr
developers.vth.kr
vth Worker
vth-db
vth-media
CHAT_ROOM
Workers AI binding
Turnstile
OAuth callback URLs
required vars
required secrets
D1 migration procedure
backup procedure
deployment procedure
smoke tests
```

구조를:

```text
1. Resource inventory
2. Public vars
3. Secrets
4. OAuth callbacks
5. D1 migrations
6. R2
7. Durable Object
8. Build
9. Deploy
10. Post-deploy smoke
11. Backup/rollback
```

순서로 단순화한다.

### Production build

반드시:

```bash
npm run build:worker
```

를 deploy 전 단계에 넣는다.

`npm run build`만으로 Cloudflare production bundle 검증이 끝났다고 쓰지 않는다.

---

# 14. MODIFY — `docs/VTH_REALTIME_DM.md`

문서 자체는 유지한다.

현재 bug2 final code가 commit된 **후 실제 코드와 다시 대조하여** 갱신한다.

최소한 다음 invariant를 문서화한다.

```text
D1 = canonical messages/history
DO = realtime fanout only

one room per pair
maximum one pending request per room
request-specific pending opener
decline/cancel cannot later deliver old opener

block:
- follow/friend removed as defined by current code
- pending request cancelled
- pending opener cannot later deliver
- direct membership permission revoked
- old unread does not resurrect after a new contact epoch

read ordering:
(created_at, id)

retry:
clientMessageId/requestId cannot duplicate canonical message
```

migration 목록도 현재 상태로 갱신한다.

bug2에서 `0039`가 추가되었다면 포함한다.

문서보다 실제 code/schema가 우선한다.

---

# 15. KEEP — `docs/USER_ID_REKEY_RUNBOOK.md`

위험한 production maintenance operation이므로 독립 runbook으로 유지한다.

단, 다음을 실제 repository와 확인한다.

```text
scripts/rekey-users.mjs 존재
package.json id:rekey:* scripts 존재
현재 FK 목록과 runbook 설명 일치
```

불일치가 있을 때만 수정한다.

architecture document에 이 위험한 procedure 전체를 합치지 않는다.

---

# 16. MODIFY — `package.json`

dependency는 이번 작업에서 추가/삭제하지 않는다.

다음 scripts를 추가한다.

```json
"lint": "eslint .",
"build:worker": "opennextjs-cloudflare build",
"check": "npm run lint && npm run typecheck && npm test"
```

기존:

```text
build
preview
deploy
test
test:unit
test:workers
test:integration
test:e2e*
```

은 유지한다.

Node requirement가 README의 Node 22+와 일치하도록:

```json
"engines": {
  "node": ">=22"
}
```

를 추가한다.

dependency 변경이 없으므로 package-lock을 불필요하게 전체 rewrite하지 않는다.

`npm`이 package-lock을 대규모 재작성하면 원인을 확인한다.

---

# 17. MODIFY — `.github/workflows/ci.yml`

CI를 현재 project contract에 맞춘다.

현재 CI에는 lint와 OpenNext production build가 없다.

또 Playwright CI webServer가 이미 DB migration + seed를 수행하므로 CI 앞의 별도 local migration + seed 실행은 중복이다.

최종 구조:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - run: npm ci

      # src/worker.ts imports the OpenNext generated worker.
      # Keep a minimal stub for typecheck before the production bundle exists.
      - run: mkdir -p .open-next && printf '%s\n' 'export default { fetch() { return new Response("stub"); } };' > .open-next/worker.js

      - run: npm run lint
      - run: npm run typecheck
      - run: npm test

      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e:chromium
        env:
          CI: true

      - run: npm run build:worker
```

### 제거

CI 상단에서 별도로 실행하던:

```text
wrangler d1 migrations apply DB --local
wrangler d1 execute DB --local --file=./seed.sql
```

은 제거한다.

이유:

Playwright CI webServer가 이미:

```text
npm run db:migrate:local
npm run db:seed:local
npm run dev
```

를 수행한다.

Worker/integration tests는 `tests/workers/setup.ts`의 `applyD1Migrations()`를 사용한다.

중복 DB 초기화를 유지하지 않는다.

---

# 18. ENV CONTRACT AUDIT

다음 네 곳을 서로 비교한다.

```text
.dev.vars.example
cloudflare-env.d.ts
wrangler.jsonc
실제 process/env 사용 코드
```

모든 env/binding을 분류한다.

```text
public var
secret
Cloudflare binding
local-only test var
obsolete/unused
```

규칙:

### public var

예:

```text
BETTER_AUTH_URL
NEXT_PUBLIC_TURNSTILE_SITE_KEY
FACEBOOK_CLIENT_ID
KAKAO_CLIENT_ID
```

필요 시 `wrangler.jsonc`에 둘 수 있다.

### secret

예:

```text
BETTER_AUTH_SECRET
TURNSTILE_SECRET_KEY
FACEBOOK_CLIENT_SECRET
KAKAO_CLIENT_SECRET
ZALO_APP_SECRET
VAPID_PRIVATE_KEY
```

실제 값을:

```text
wrangler.jsonc
.dev.vars.example
README
docs
```

에 절대 넣지 않는다.

### 불일치

`.dev.vars.example`에 있지만 코드에서 전혀 사용하지 않는 variable은 확인 후 제거한다.

코드가 사용하는데 example/type에 없는 값은 추가한다.

추측으로 environment variable을 추가하지 않는다.

---

# 19. KEEP — 건드리지 않을 root config

다음 파일은 삭제하거나 `config/` 폴더로 이동하지 않는다.

```text
LICENSE
SECURITY.md
cloudflare-env.d.ts
components.json
eslint.config.mjs
next.config.ts
open-next.config.ts
package-lock.json
playwright.config.ts
postcss.config.mjs
seed.sql
tsconfig.json
vitest.config.mts
vitest.workers.config.mts
wrangler.jsonc
wrangler.test.jsonc
```

이유:

각 framework/tool이 root 위치를 직접 사용하거나 현재 build/test 계약이 그 위치를 전제로 한다.

특히:

```text
wrangler.jsonc
wrangler.test.jsonc
```

을 합치지 않는다.

production Worker config와 Worker-test config의 책임이 다르다.

또:

```text
vitest.config.mts
vitest.workers.config.mts
```

도 합치지 않는다.

Node unit tests와 Cloudflare Workers pool tests가 다른 runtime을 사용한다.

`open-next.config.ts`가 현재 내용이 거의 비어 있어도 삭제하지 않는다.

---

# 20. SECURITY.md

이번 cleanup에서 전체 rewrite하지 않는다.

현재 responsible disclosure와 secret handling 정책은 유지한다.

Public API authentication contract가 별도 작업에서 확정될 경우에만 해당 부분을 정확한 구현에 맞춰 업데이트한다.

---

# 21. 금지 사항

이번 작업에서 하지 않는다.

```text
기능 코드 리팩터링
DB schema 변경
migration 수정
auth 구조 변경
DM 로직 변경
UI 디자인 변경
dependency upgrade
Tailwind/shadcn 교체
config 파일을 config/ 폴더로 대량 이동
전체 repository line-ending renormalization
historical docs archive 폴더 생성
새 CHANGELOG
새 CODE_OF_CONDUCT
새 CONTRIBUTING
새 CODEX.md
새 GEMINI.md
```

필요 없는 문서를 지우는 작업을 새로운 문서 10개 만드는 작업으로 바꾸지 않는다.

---

# 22. 최종 검증

실행:

```bash
npm run lint
npm run typecheck
npm test
npm run test:integration
npm run test:e2e:chromium
npm run build:worker
git diff --check
```

`docs` 링크도 확인한다.

삭제한:

```text
ABOUT.md
GITHUB_POST.md
VTH_P0_IMPLEMENTATION_PLAN.md
VTH_REUSE_AUDIT.md
```

를 참조하는 링크가 repository에 남아 있으면 수정한다.

다음 문자열도 repo-wide 검색한다.

```text
ABOUT.md
GITHUB_POST.md
VTH_P0_IMPLEMENTATION_PLAN
VTH_REUSE_AUDIT
```

0 references가 목표다.

---

# 23. 최종 보고 형식

다음 형식만 사용한다.

```text
ROOT FILES ADDED
ROOT FILES DELETED
ROOT FILES MODIFIED
DOCS MERGED
DOCS DELETED
CANONICAL DOCS AFTER CLEANUP
AGENT CONTRACT
ENV CONTRACT AUDIT
CI CHANGES
COMMAND RESULTS
FINAL ROOT TREE
REMAINING VERIFIED RISKS
```

각 파일을 왜 유지/삭제/합병했는지 한 줄씩 적는다.

작업이 끝나면 commit하되 바로 push하지 않는다.

commit SHA를 먼저 보고한다.

권장 commit:

chore: consolidate repository docs and project contracts

```
```
