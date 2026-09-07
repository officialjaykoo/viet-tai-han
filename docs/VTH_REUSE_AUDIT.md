# Việt tại Hàn 재사용 감사

기준 저장소: `koval01/red` (`7363d6e`)  
대상 프로젝트: `officialjaykoo/viet-tai-han` (`vth.kr`)  
감사 기준: 2026-08-01 호환성 설정, 로컬 D1 `0035_write_idempotency`까지 적용된 상태.

## 결론

- **KEEP**: Cloudflare/OpenNext 실행 경계, D1 migration 누적 이력, Better Auth 세션, posts/comments/likes, R2 이미지 정규화, `/i/api` 보안 터널, 테스트 골격.
- **MODIFY**: 브랜드/도메인, UI locale, 커뮤니티 용어, 인증 origin/OAuth, 검색 도메인, 모바일 공통 layout, D1 도메인 확장, 배포 리소스 설정.
- **KEEP WITH GATES**: 광고·분석과 결제 기반은 데이터/코드를 보존하되 동의·정책·anti-fraud·운영 secret이 확인될 때까지 기본 비활성화.
- **REMOVE LATER**: `users` 레거시 테이블, `subreddits`/`/r/*` Reddit 명칭, 호환기간이 끝난 legacy translation columns와 vote compatibility columns. 마이그레이션·호환기간 후 제거한다.
- **NEW**: Q&A, 마켓/구인, business profile, 북마크, 신고/정책 센터, WebAuthn/OAuth, push, 지도/예약, consent/Pro/billing webhook, transaction·reputation ledger.

## KEEP

| 영역 | 현재 코드 경로 | 판단 근거 | 조치 |
|---|---|---|---|
| Cloudflare 실행 | `src/worker.ts`, `next.config.ts`, `open-next.config.ts` | OpenNext handler 앞에서 edge IP 제한을 적용하고 HTML에 speculation rule을 설정한다. | Worker 진입점은 유지. `vth` 리소스명과 custom worker 빌드 검증만 수행. |
| D1 access | `src/lib/db.ts`, `migrations/0001_init.sql`~`0035_write_idempotency.sql` | Kysely-D1/쿼리 builder와 keyset cursor, visibility filter, 좋아요·idempotency 인덱스가 있다. 로컬 migration 누적 이력이 적용된다. | 기존 migration은 수정하지 않고 후속 migration만 추가. |
| 인증/세션 | `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/permissions.ts` | Better Auth 세션과 banned 차단, role/status 입력 차단, admin/moderator 경계가 있다. | Social-only Facebook/Zalo/Kakao OAuth, provider/account canonical identity, onboarding, optional contact email, explicit linking을 유지한다. email/password와 passkey entry point는 비활성화. |
| 게시물/댓글/좋아요 | `src/lib/actions.ts`, `src/lib/content.ts`, `src/lib/likes.ts`, `src/app/api/posts/**`, `src/app/api/comments/**` | 생성/수정/삭제/댓글/좋아요/신고/숨김 및 reputation/rate limit/visibility filter가 연결되어 있다. | 핵심 피드 흐름은 유지. Vietnamese 커뮤니티·Q&A 도메인만 확장. |
| 커뮤니티 | `src/lib/communities.ts`, `src/app/communities/page.tsx`, `src/app/r/[name]/page.tsx` | 커뮤니티 생성·구독·피드·moderator 경계가 구현되어 있다. | 내부 데이터는 호환 유지하고 사용자 노출 명칭을 `community`/`cộng đồng`로 변경. `/r/*`는 호환 redirect로 전환. |
| 미디어 | `src/lib/media.ts`, `src/lib/image-process.ts`, `src/app/api/media/**`, `src/components/media/tunneled-media.tsx` | 1 MiB 제한, JPEG/PNG/WebP signature 검사, 메타데이터 제거, trailing payload 검사, R2 metadata, `/i/api` blob 로딩이 있다. | MIME/픽셀·quota·ownership 정책을 보강하되 터널 로딩 구조는 유지. |
| 보안 터널 | `src/lib/security/**`, `src/lib/internal-api/dispatch.ts`, `src/app/i/api/route.ts` | Protobuf route sealing, HMAC, timestamp/nonce, PoW, IP 제한, public API Bearer 경계를 분리한다. | 기본 모델 유지. challenge atomicity와 KV/Durable Object 저장소를 보강. |
| **DM/알림** | `src/lib/messages.ts`, `src/lib/notifications.ts`, `src/app/api/messages/**`, `src/app/api/notifications/route.ts` | 요청→수락→활성 멤버십, 차단, DM preference, unread/read timestamp가 있다. | Vietnamese UX, VAPID Web Push, D1 unread fanout, DM 신고·운영 검토 큐와 race-safe transition을 `0024_messaging_delivery.sql` 및 관련 API/UI에 추가했다. |
| 테스트/CI | `tests/unit/**`, `tests/workers/**`, `tests/integration/**`, `tests/e2e/**`, `.github/workflows/ci.yml` | 현재 unit 28개 파일/118 tests, worker 16개 파일/66 tests, integration 15개 파일/64 tests가 통과했다. | Phase 계약에 맞는 i18n/mobile/branding/좋아요/idempotency 회귀 테스트를 유지한다. |

## MODIFY

| 영역 | 현재 상태 | 변경 경로 | 우선순위 |
|---|---|---|---|
| 제품 identity | metadata/worker/D1/R2가 `vth` 리소스와 `Việt tại Hàn` 표기를 사용한다. | `src/app/layout.tsx`, `site-header.tsx`, `site-footer.tsx`, `package.json`, `wrangler.jsonc`, README를 함께 검증한다. | P0 완료 |
| UI locale | `vi/ko/en/ru` 네 locale, cookie/account/browser/country 감지, default `en`이 구현되어 있다. | `config.ts`, `server.ts`, `translate.ts`, `messages/*`, locale UI를 동일 key로 유지한다. | P0 완료 |
| 메시지 catalog | `messages/en.ts` 기준 key가 `vi.ts`, `ko.ts`, `ru.ts`에 대응하고 좋아요·추천·관리자 copy가 단순화되었다. | 오류/화면 copy 추가 시 네 locale 계약을 함께 갱신한다. | P0 완료 |
| Reddit 용어 | 사용자 노출은 community/reputation/likes 중심으로 전환했다. `/r/*`, `/u/*`, `subreddits`, legacy vote columns는 호환 경계로 남아 있다. | 내부 호환 경계는 유지하고 신규 사용자 노출·문서에서는 VTH 용어만 사용한다. | P0 완료, 호환 경계 유지 |
| route naming | 페이지는 `/r/[name]`, `/u/[username]`; logical API는 `/api/subreddits/**`다. | 신규 canonical route를 별도 도입할 때 기존 경로는 308/서버 redirect로 유지한다. | P1 |
| 인증 origin | `src/lib/auth.ts`가 base URL origin과 `VTH_AUTH_ORIGINS`를 trusted origins에 포함한다. | production OAuth callback 및 실제 secret으로 운영 smoke를 실행한다. | P0 코드 완료·운영 전 |
| 검색 | `src/lib/search.ts`가 community/account/post/Q&A/listing LIKE 검색과 limit/query escaping을 제공한다. | Vietnamese diacritic normalization, FTS, report/booking 검색은 별도 우선순위로 검토한다. | P1 |
| content translation | `src/lib/translation.ts`, `migrations/0015_content_translation.sql`, `0025_multilingual_content.sql` | vi/ko/en/ru 감지, Workers AI 번역, locale-aware toggle, background job, admin backfill을 적용했다. | P1 완료 |
| 광고/분석 | `src/lib/ads.ts`, `src/lib/post-analytics.ts`가 feed inline 광고와 D1 impression/click/view를 제공한다. | ads 기본 off, 동의·active-window·dedupe·rate limit·Pro 게이트를 유지한다. provider/정책 승인 전 운영 활성화는 금지. | P1 기반 완료·운영 승인 대기 |
| AI 추천 | `src/lib/content.ts`, `/api/recommendations` | D1 기반 최신순·활동 기반 추천이며 외부 벡터 인덱스에 의존하지 않는다. Workers AI는 번역 전용으로 유지한다. | P0 완료 |
| 배포 resource | `wrangler.jsonc`가 `vth` Worker, `vth-db`, `vth-media`, ChatRoom, Workers AI binding을 사용한다. | remote migration/deploy 전 backup·pending migration·secret·OAuth 운영값을 별도 확인한다. | P0 코드/dry-run 완료·운영 전 |
| 모바일 layout | 390px 기준 header/feed/create/profile/settings가 overflow 없이 동작하고 safe-area/touch target 규칙을 유지한다. | 실제 장치/브라우저 smoke를 release 전 반복한다. | P0 완료 |
| CI/e2e 명령 | Playwright config가 실제 `npm run dev`를 사용한다. | 변경된 인증·좋아요·idempotency 경로에 smoke를 추가한다. | P0 완료 |
| root layout typing | Next generated global `LayoutProps` 의존 없이 명시적 `ReactNode` props를 사용한다. | Next 업그레이드 시 local Next guide와 typecheck를 함께 확인한다. | P0 완료 |

## DISABLE

| 기능 | 현재 경로 | 초기 정책 | 해제 조건 |
|---|---|---|---|
| feed 광고 노출 | `src/lib/ads.ts`의 `withFeedAds`/`injectAdsIntoFeed` | `ads_enabled=0` 기본값, analytics consent 없이는 impression/click을 저장하지 않으며 Pro 활성 entitlement는 광고를 제거한다. | 정책·상품·anti-fraud 운영 승인 및 `ads_enabled=1` 전환 |
| 원격 Workers AI | `src/lib/translation.ts`, `wrangler.jsonc` | Workers AI는 번역 요청에서만 사용하며 로컬·preview에서 자동 원격 호출하지 않는다. | 실제 model cost budget과 번역 품질·장애 fallback 검증 후 on. |
| production seed/demo | `seed.sql` | 운영 D1에 demo 계정이나 credential/password seed를 넣지 않는다. | 운영 초기화 절차에서 별도 관리자 bootstrap으로 대체. |

## REMOVE LATER

| 대상 | 현재 경로 | 제거 전 조건 |
|---|---|---|
| 레거시 identity tables | `migrations/0001_init.sql`의 `users`, `subreddits`와 Better Auth `"user"` 공존 | 모든 사용자/community FK와 데이터가 canonical model로 이동하고 backup/rollback 검증 완료. |
| Reddit URL/표기 | `/r/[name]`, `/u/[username]`, `/api/subreddits/**` 및 노출 문자열 | canonical route/API가 안정되고 외부 링크 redirect 기간 종료. |
| legacy translation storage | `src/lib/translation.ts`의 `posts/comments` 번역 필드 | 다국어 target metadata와 backfill이 안정화되고 translation table로 확장할 필요가 확인될 때 정리. |
| legacy vote compatibility | legacy `votes` table와 posts/comments의 기존 vote columns | `post_likes`/`comment_likes` backfill 및 D1 like_count 검증과 rollback 기간 종료. |
| 원본 demo copy | `README.md`, `seed.sql`, fixture의 red/Reddit/Cloudflare 샘플 | Việt tại Hàn용 seed/문서/fixture로 교체 후 baseline fixture가 새 계약을 검증. |

## NEW

| 영역 | 신규 산출물/경로 | 목적 |
|---|---|---|
| Q&A | `questions`, `answers`, accepted answer API/UI | 질문·답변·채택·검색. |
| Marketplace/Jobs | listings, categories, location, saved/alert API/UI | 중고거래·구인·서비스 게시. 사기/연락처 노출 정책 포함. |
| Business profile | business verification/profile/services/hours | 업체·서비스 디렉터리와 예약 진입점. |
| Reports/policy | report center, appeals, policy pages, moderation queues | 신고·이의제기·운영 투명성. |
| Identity | `src/lib/auth.ts`, `src/lib/oauth-identity.ts`, `src/app/onboarding`, account settings | Social-only Facebook/Zalo/Kakao OAuth, provider/account canonical identity, Better Auth compatibility email, onboarding, optional contact email, explicit account linking. |
| Trust ledger | karma/reputation/transaction ledger | `0026_monetization_foundations.sql`에 `reputation_ledger` opening balance와 `transaction_ledger`를 추가하고, 신규 reputation 조정은 idempotency key로 기록한다. P1 기반 완료, 회계·정산 운영은 대기. |
| Vietnamese discovery | diacritic-aware search, location/category index, D1 activity ranking | D1 기반 추천과 검색을 운영하고 검색 정규화·location/category index를 후속 보강. |
| Observability | Sentry/Workers logs/health checks/security events | 오류·rate-limit·abuse·비용 모니터링. |

## 보안 이슈 우선순위

| 우선순위 | 이슈 | 근거 | 영향 | 조치 |
|---|---|---|---|---|
| P0 | 운영 인증 origin smoke | `src/lib/auth.ts`가 base URL origin과 `VTH_AUTH_ORIGINS`를 trusted origins에 포함한다. | production OAuth callback/secret을 연결하지 않으면 로그인 운영 경로를 검증할 수 없다. | production OAuth callback/secret을 연결한 auth smoke 전까지 운영 blocker로 유지. |
| P0 | 배포 resource 및 migration operator step | `wrangler.jsonc`는 `vth` Worker, `vth-db`, `vth-media`, ChatRoom, Workers AI binding을 가리키며 dry-run이 통과했다. | remote migration/deploy를 잘못된 순서나 대상에 실행할 위험이 있다. | backup→pending migration list→remote apply→deploy 순서를 운영자가 실행한다. |
| P1 | OpenNext 중간 ChatRoom 진단 | Next/OpenNext 내부 build 단계에서 generated handler를 먼저 분석해 ChatRoom export warning이 출력될 수 있다. 최종 Wrangler bundle은 `ChatRoom`을 export한다. | 중간 진단을 실제 production export 실패로 오인할 수 있다. | custom worker의 직접 import/export와 `wrangler deploy --dry-run` artifact를 release마다 확인한다. |
| P1 | challenge consume check-then-set 경쟁조건 | `src/lib/security/challenge.ts` `consumeChallenge()`가 load→used 검사→save | 동시 재생 요청이 같은 challenge를 통과할 가능성 | KV atomic write/DO serialization 또는 nonce consume transaction으로 교체. |
| P1 | challenge/KV fallback이 isolate memory | `kv()`가 없으면 module Map 사용, `CACHE` binding 주석 처리 | 여러 Worker isolate에서 challenge/gate 불일치·재생 방어 약화 | production KV/DO를 필수화하고 fallback은 local-only로 제한. |
| P1 | DM request 상태 전이 경쟁조건 | `src/lib/messages.ts`가 room/request/message write를 D1에서 먼저 idempotent하게 처리하고 pending transition을 조건부 갱신한다. | 동시 요청에서 중복 row/notification/broadcast가 생기지 않아야 한다. | **해결** — unique conflict 재조회와 request ID 회귀 테스트를 유지. |
| P1 | 광고 update URL 검증과 impression 무결성 | `src/lib/ads.ts`, `/api/ads/*` | create/update 공통 http/https 검증, active-window·placement 확인, 동의·dedupe·rate limit을 적용했다. | **해결** — 회귀 테스트 `tests/integration/monetization.test.ts` |
| P1 | 좋아요 source 전환 | `src/lib/likes.ts`가 D1 `post_likes`/`comment_likes`와 like_count를 갱신하고 legacy vote table을 읽지 않음 | 구 vote 경로가 남으면 이중 집계 위험 | **해결** — DO vote path와 active vote writer 제거, additive migration `0034_simple_likes.sql` 적용. |
| P2 | post view dedupe key가 caller 신뢰값 | `src/lib/post-analytics.ts` `sessionKey`를 slice해 unique index에 사용 | 임의 session key로 unique viewer/view 지표 왜곡 | 서명된 first-party cookie와 server-side rotation, abuse cap 적용. |
| P2 | IP header fallback 신뢰 범위 | `clientIpFromHeaders()`가 `cf-connecting-ip`/`x-forwarded-for`를 직접 읽음 | 비-Cloudflare 환경에서 spoofing 시 rate limit 우회 | production은 Cloudflare edge only를 assert하고 local/test만 override. |
| P2 | content language heuristic가 Latin을 English로 분류 | `src/lib/translation.ts`는 cyrillic/latin 비율로 en/ru만 분류 | Vietnamese 원문이 영어로 오분류되고 번역 방향이 잘못됨 | vi/ko/other 감지 모델과 explicit author language 우선순위 추가. |
| P2 | API 오류 상태가 일관되지 않음 | 일부 route가 DB/validation exception을 generic 500으로 반환 | 클라이언트 재시도·운영 분석·공개 API 계약이 불안정 | canonical error code/schema와 route별 validation helper 도입. |
## Baseline 증거

| 명령/표면 | 결과 |
|---|---|
| `npm run db:reset:local` | 로컬 D1 migration `0001`~`0035` 적용 및 seed 63 commands 성공. |
| `npm test` | unit 28 files / 118 tests, workers 16 files / 66 tests 통과. |
| `npm run test:integration` | 15 files / 64 tests 통과. |
| `npm run typecheck` | 통과. |
| `npm run build` | Next build, TypeScript 검사, static page generation 45/45 성공. |
| `npx opennextjs-cloudflare build` | 성공. Windows 호환성·내부 Durable Object·Workers AI 원격 호출 경고와 중간 단계 ChatRoom export 경고를 관찰했지만 build는 완료됐다. |
| `npx wrangler deploy --dry-run --outdir=.tmp/wrangler-dry-run-final` | 성공. 81 assets, 18,251.24 KiB upload / gzip 3,619.58 KiB. DB `vth-db`, R2 `vth-media`, AI, ChatRoom binding을 확인했고 최종 bundle이 ChatRoom을 export한다. 생성 bundle의 duplicate `options` warning만 남았다. |
| 로컬 SQL 무결성 | users 14, posts 49, comments 54, questions 2, answers 3, listings 3, post_likes 83, comment_likes 13. `like_count` 불일치 0건, `foreign_key_check` 결과 없음. |
| `npx playwright test --project=chromium-desktop --workers=1` | 10 tests 중 9 passed / 1 service-worker retry flaky. 390px targeted layout smoke 3 passed, horizontal overflow 없음. |

## 외부 작업 blocker

로컬 migration/seed, 단위·워커·통합 테스트, typecheck, Next/OpenNext build, Wrangler dry-run까지만 수행했다. 원격 D1 migration/apply와 production deploy는 수행하지 않았다.

production 경로를 완료하려면 다음 운영 입력과 확인이 필요하다.

- `wrangler.jsonc`의 `vth-db`, `vth-media`, ChatRoom, AI 리소스가 대상 Cloudflare account에 존재하고 현재 권한으로 접근 가능한지 확인.
- D1은 백업 후 migration 목록을 검토하고 `0034_simple_likes.sql`, `0035_write_idempotency.sql`을 운영자 단계에서 적용.
- `BETTER_AUTH_SECRET`, Turnstile site/secret, Facebook/Zalo/Kakao OAuth client/secret 및 callback URL.
- `vth.kr` DNS/Worker route와 `BETTER_AUTH_URL=https://vth.kr`.
- 이메일 발송 provider/도메인 인증, WebAuthn RP ID/origin, Web Push VAPID 값, 지도/예약 provider keys. Native FCM/APNs are outside this web phase.
- 결제 provider credentials/webhook endpoint, `BILLING_WEBHOOK_SECRET`, 상품·환불·세금 정책 승인과 provider customer→user 매핑.
