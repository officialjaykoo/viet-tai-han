# Việt tại Hàn P0 구현 경로

## 목표

`red`의 Cloudflare/OpenNext/D1 기반을 유지하되, 베트남 거주 한인과 베트남 현지 사용자가 바로 이해할 수 있는 `Việt tại Hàn` 서비스로 전환한다. P0의 완료 기준은 다음과 같다.

- `vth.kr` 제품 identity가 문서·metadata·header·seed·배포 설정에 일관되게 반영된다.
- UI는 Vietnamese(`vi`), Korean(`ko`), English(`en`), Russian(`ru`) 네 언어를 지원한다. 기본값은 English이며 cookie/account preference, 브라우저 언어, Cloudflare 국가 순서로 자동 감지하고 SSR/client locale을 일치시킨다.
- 390px 기준 가로 overflow 없이 header, feed, create, profile, settings를 사용할 수 있다.
- 화면의 Reddit 전용 표기(`r/`, `u/`, subreddit, karma, Reddit clone)가 사용자 노출 영역에서 사라진다. 기존 내부 route/DB는 호환기간 유지한다.
- Better Auth, D1, R2, `/i/api`, rate limit, Turnstile 경계가 vth 운영값으로 검증된다.
- unit/worker/integration/e2e/preview smoke가 통과한다.

## 현재 계약

- 저장소: `upstream` = `https://github.com/koval01/red.git`
- fork: `origin` = `https://github.com/officialjaykoo/viet-tai-han.git`
- 기본 브랜치: `main`
- 앱 runtime: Next.js 16 + React 19 + OpenNext Cloudflare
- persistence: D1 + Kysely-D1, media R2
- auth: Better Auth social-only Facebook/Zalo/Kakao + username plugin; no credential/password or passkey entry point
- browser API: POST `/i/api` Protobuf tunnel
- direct API: `/api/*` + `Authorization: Bearer <personal_api_key>`
- local DB: migrations `0001`~`0029`, `seed.sql`

## P0-1 identity와 환경

| 단계 | 파일/경로 | 구현 |
|---|---|---|
| 1 | `package.json` | package name, scripts description을 `viet-tai-han` 기준으로 정리. 기존 `dev`, `build`, `test` 계약은 유지. |
| 2 | `wrangler.jsonc` | Worker를 `vth`로 변경. D1/R2/Vectorize 이름을 `vth-*`로 지정하고 zero D1 ID는 실제 계정 생성 전까지 placeholder로 남긴다. 운영 deploy는 placeholder를 거부한다. |
| 3 | `.dev.vars.example` | 로컬 `BETTER_AUTH_URL`과 운영 secret 설정 방법을 vth 기준으로 갱신. 실제 secret은 `.dev.vars`/Wrangler secret에만 둔다. |
| 4 | `src/app/layout.tsx` | metadata `applicationName`, apple title, default description을 `Việt tại Hàn`으로 변경. `lang`은 resolved locale을 계속 사용. |
| 5 | `src/components/layout/site-header.tsx`, `site-footer.tsx` | logo/aria/title/link copy를 `Việt tại Hàn` 또는 `VTH`로 교체. logo link는 `/` 유지. |
| 6 | `README.md`, `seed.sql`, fixtures | 원본 red/Reddit 샘플을 vth 설명·샘플 community로 교체. 운영 seed 실행은 금지. |

## P0-2 i18n: four UI locales with automatic detection

| 단계 | 파일/경로 | 구현 |
|---|---|---|
| 1 | `src/lib/i18n/config.ts` | `LOCALES = ["vi", "ko", "en", "ru"]`, `DEFAULT_LOCALE = "en"`, cookie `vth_lang`. Explicit cookie/account preference가 우선하고 `Accept-Language`와 Cloudflare country를 fallback으로 사용한다. |
| 2 | `src/lib/i18n/messages/{vi,ko,en,ru}.ts` | `messages/en.ts`의 `Messages` key를 네 언어로 구현한다. |
| 3 | `src/lib/i18n/translate.ts` | 네 언어 catalog를 로드한다. |
| 4 | `src/lib/i18n/errors.ts` | 네 언어 오류 문구와 locale별 안전한 generic fallback을 제공한다. |
| 5 | `src/components/i18n/language-switcher.tsx`, `settings-client.tsx` | 설정에서 Vietnamese, Korean, English, Russian을 선택할 수 있다. |
| 6 | `src/components/i18n/language-prompt.tsx` | 자동 감지를 사용하므로 언어 선택 modal은 제거한다. |
| 7 | `src/app/api/me/language/route.ts`, `src/lib/user-language.ts` | 네 언어만 저장하도록 validation한다. |
| 8 | `src/lib/i18n/server.ts`, `i18n-provider.tsx` | 서버의 브라우저 언어·Cloudflare 국가 감지 결과를 초기 UI에 유지하고, 사용자가 설정한 cookie/account preference는 계속 동기화한다. |

## P0-3 공통 mobile-first layout

| 단계 | 파일/경로 | 구현 |
|---|---|---|
| 1 | `src/components/layout/site-header.tsx` | Facebook-style social shell: desktop logo/search·center tab navigation·action menu, mobile hamburger·VTH logo·글쓰기·검색·메시지 순서. 모바일 hamburger가 기존 account menu를 연다. |
| 2 | `src/components/layout/mobile-nav.tsx`, `src/components/feed/feed-composer.tsx`, `src/components/feed/feed-shortcut-rail.tsx` | desktop은 left navigation·center feed·right context의 3단 구조, mobile은 composer·가로 shortcut rail·하단 navigation을 사용한다. 글쓰기는 상단 composer/header로 이동하고 스크롤 방향에 따라 header/footer chrome을 자동 표시·숨김한다. |
| 3 | `src/app/layout.tsx` | body에 mobile nav를 한 번만 배치하고 `pb-[safe-area]`/bottom padding을 적용. footer와 겹치지 않게 한다. |
| 4 | `src/app/globals.css` | `env(safe-area-inset-bottom)`, tap highlight, focus-visible, min touch target, text wrap 규칙 추가. global horizontal overflow hidden은 문제를 가리는 용도로 사용하지 않는다. |
| 5 | page surfaces | `/`, `/communities`, `/search`, `/submit`, `/post/[id]`, `/u/[username]`, `/settings`를 390/768/1280에서 확인. table/analytics는 mobile horizontal scroll container로 처리. |

## P0-4 Reddit terminology cutover

### 사용자 노출 변경

- `red`, `Reddit clone` → `Việt tại Hàn`, `VTH`.
- `r/<name>` → community name 또는 `Cộng đồng <name>`.
- `u/<username>` → display name 또는 `@username`.
- `subreddit` → community/cộng đồng/커뮤니티.
- `karma` → reputation/신뢰 점수; DB column은 호환기간 보존.
- `Hot/New/Top` → 추천/최신/인기 등 Vietnamese catalog key.
- `Create post` → 글쓰기/게시물 작성.

### 경계

- 내부 compatibility route `/r/[name]`, `/u/[username]`, `/api/subreddits/**`는 P0에서 즉시 삭제하지 않는다.
- canonical URL을 추가할 때는 기존 경로에서 308 redirect하고 canonical URL만 metadata/link에 사용한다.
- SQL table/column rename은 data migration, rollback, external API versioning 이후 별도 작업이다.

## P0-5 보안·배포 준비

| 경로 | 변경 |
|---|---|
| `src/lib/auth.ts` | env 기반 trusted origins. `https://vth.kr`와 명시된 운영 preview만 허용. secret 미설정·짧은 secret은 startup/deploy check에서 실패. |
| `src/lib/security/challenge.ts` | production에서는 KV/DO 등 serialized store를 필수화. `consumeChallenge`는 atomic consume으로 재생을 차단. local memory fallback은 `NODE_ENV !== production`에서만 허용. |
| `src/lib/messages.ts` | pair creation unique conflict를 409로 변환. request response는 `UPDATE ... WHERE status='pending'` 후 affected row를 검사하고 notification을 한 번만 발행. |
| `src/lib/ads.ts`, ads routes | 공통 http/https URL validator, active-window/placement 검증, impression dedupe·rate limit. P0에서는 광고 flag off. |
| `src/lib/media.ts`, image pipeline | content type을 client header가 아닌 decoded format으로 결정. user/media quota, pixel/decompression limit, orphan cleanup 정책 추가. direct `/api/media`는 public API key 경계를 유지. |
| `src/worker.ts`, `wrangler.jsonc`, package preview/deploy | custom worker가 실제 OpenNext generated handler와 `PostObject` export를 포함하는지 `wrangler deploy --dry-run` artifact로 확인. 현재 preview에서 DO export warning이 관찰되므로 해결 전 운영 deploy 금지. |
| `src/lib/rate-limit.ts`, `src/worker.ts` | Cloudflare trusted IP header 정책을 production에서 assert. route별 edge/tunnel/expensive limit과 D1 fallback의 비용을 계측. |
| `src/app/api/**`, `src/lib/public-api-auth.ts` | public API error code/status/JSON schema를 문서화. API key는 hash-only 저장, revoke/last-used는 유지. |

## P0-6 D1 변경 원칙

- 기존 migration SQL의 데이터 구조/적용 순서는 유지하고, legacy locale 치환은 forward migration으로만 추가한다.
- `0001`의 legacy `users`/`subreddits`와 Better Auth `"user"`의 공존을 먼저 inventory하고 canonical model을 정한다.
- P0에서는 UI/API 용어만 바꾸고, 신규 domain migration은 다음 테이블을 우선한다.
  - `communities` 또는 compatibility view/alias strategy
  - `questions`, `answers`, accepted answer state
  - `listings`, category/location/status
  - `business_profiles`, verification/services
  - `bookmarks`, `reports`, `report_events`
  - `push_subscriptions`, `notification_preferences`
  - `reputation_ledger`, `transaction_ledger`
- 모든 user/content FK는 canonical Better Auth user와 `ON DELETE` 정책을 명시한다.
- destructive rename 전 `wrangler d1 export`/backup, migration dry-run, rollback procedure를 기록한다.

## P0-7 검증 순서

1. `npm run db:reset:local`
2. `npm run typecheck`
3. `npm test`
4. `npm run test:integration`
5. E2E webServer가 실제 `npm run dev`를 사용하도록 유지하고 `npm run test:e2e:chromium` 실행
6. `npm run build`
7. `npm run preview`를 Worker process로 기동
8. Browser에서 390px/1280px root, login, feed, community, create, profile, settings를 확인
9. `wrangler deploy --dry-run`으로 custom worker/DO/binding/resource names 확인
10. 운영 resource/secret/domain이 입력된 경우에만 Cloudflare preview/deploy와 `vth.kr` smoke 실행

## P0 완료 후 P1 연결 순서

1. Q&A와 답변 채택/검색 — **완료**. `0020_questions_answers.sql`, `/questions`, `/ask`, 답변·채택 API를 적용했다.
2. 중고거래·구인·서비스 listing과 scam/report workflow — **완료**. `0021_marketplace.sql`, `/marketplace`, listing/save/alert/report API, 운영 리포트 큐와 통합 회귀 테스트를 적용했다.
3. business profile, verification, 지도/예약 — **완료**. `0022_business_profiles.sql`, `/businesses`, 인증 심사 큐, 지도 링크, 예약 요청/상태 변경 API와 통합 테스트를 적용했다.
4. Facebook/Zalo/Kakao OAuth, social-first onboarding, account linking — **완료**. `0023_identity_providers.sql`, `0029_social_first_identity.sql`, Better Auth provider/PKCE 구성, 공통 소셜 로그인·가입 화면, 최초 프로필 설정, nullable contact email, 설정의 명시적 계정 연결과 마지막 social account 보호를 적용했다. Better Auth 호환용 synthetic email은 provider/account ID에서 결정적으로 만들며 UI/API에는 노출하지 않는다. Passkey login은 비활성화되어 있다.
5. push notification, DM moderation, unread fanout — **완료**. `0024_messaging_delivery.sql`, pure Web Push/VAPID subscription API, unread badges, DM 신고·운영 큐와 race-safe request transitions를 적용했다.
6. Vietnamese content translation, multilingual embedding/recommendation — **완료**. `0025_multilingual_content.sql`의 translation target metadata, vi/ko/en/ru 감지·M2M100 번역, EmbeddingGemma 기반 768차원 추천, stale-vector guard, 운영 backfill을 적용했다.
7. 광고/Pro/결제/ledger — **기반 구현 완료, 운영 결제 활성화 대기**. `0026_monetization_foundations.sql`의 동의·Pro 구독·청구 이벤트·transaction/reputation ledger, `/api/me/consent`, `/api/me/pro`, 서명된 provider-neutral `/api/billing/webhook`, 광고 기본 off·동의·active-window·dedupe·rate-limit 게이트를 적용했다. 실제 결제 provider checkout/credentials와 정책 승인 전에는 운영 결제를 켜지 않는다.

## UI 방향 보정

기존 구현은 원본 `red`의 Reddit-style 피드를 유지한 채 VTH 브랜드와 다국어·반응형만 적용했다. 베트남 사용자의 익숙한 사용 패턴을 우선해, 다음 UI 계약을 추가한다.

- 게시물 카드는 Facebook-style의 작성자 헤더, 본문 중심 흰색 카드, 가로형 반응·댓글 action row를 사용한다. 내부 vote API와 reputation 계산은 변경하지 않는다.
- 색상은 Facebook blue가 아니라 베트남 국기 컨셉의 `flag red`·`white`·`flag gold`를 사용한다. 배경은 중립 회색, 카드는 흰색, primary와 focus는 red, 선택 상태의 보조 강조는 gold다.
- PC root는 기존 feed 데이터를 재사용하는 left navigation·center feed·right context의 3단 shell로 정리한다. 새 backend 기능은 추가하지 않는다.
- 상단 header와 feed는 Facebook-style social shell을 따르되 VTH 로고·베트남어 콘텐츠·기존 domain 기능으로 치환한다. desktop은 logo/search·center navigation·action menu와 left/center/right 3단 feed, mobile은 hamburger·VTH logo·글쓰기·검색·메시지·composer·가로 shortcut rail 순서다. account menu는 hamburger에서 열고, 하단 navigation의 글쓰기는 제거하며 스크롤 방향에 따라 header/footer chrome을 자동 표시·숨김한다.
- 사용자 노출 Reddit 시각 잔재는 제거하되, `/r/*`, `/u/*`, `subreddits`, `upvote/downvote` 내부 호환 계약은 유지한다.
- 광고·Pro·결제 등 직접적인 commercial surface는 제품 규모가 커질 때까지 보류하고 기본 비활성 상태를 유지한다.

## 외부 blocker

- Cloudflare account ID와 실제 D1/R2/Vectorize/KV/rate-limit resource.
- `vth.kr` DNS/Worker route.
- production `BETTER_AUTH_SECRET`, Turnstile key pair.
- Facebook/Zalo/Kakao OAuth credentials와 callback allowlist(외부 OAuth 활성화·운영 smoke에 필요).
- SMTP/email provider.
- 운영 WebAuthn RP domain과 HTTPS origin.
- Web Push VAPID credentials; native FCM/APNs remains outside the web phase.
- 지도·예약 provider 및 결제 provider credentials.
- 결제 상품·환불·세금 정책 승인, `BILLING_WEBHOOK_SECRET`, provider webhook 서명/사용자 매핑 값.

이 값이 없는 동안에는 로컬 D1, OpenNext local preview, 코드·schema·보안 검증까지만 수행하고 원격 production deploy는 실행하지 않는다.
