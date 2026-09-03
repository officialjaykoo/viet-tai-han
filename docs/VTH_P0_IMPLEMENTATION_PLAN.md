# Việt tại Hàn P0 구현 경로

## 목표

`red`의 Cloudflare/OpenNext/D1 기반을 유지하되, 베트남 거주 한인과 베트남 현지 사용자가 바로 이해할 수 있는 `Việt tại Hàn` 서비스로 전환한다. P0의 완료 기준은 다음과 같다.

- `vth.kr` 제품 identity가 문서·metadata·header·seed·배포 설정에 일관되게 반영된다.
- UI는 Vietnamese(`vi`)가 기본이고 Korean(`ko`)이 보조 언어다. SSR/client locale이 일치한다.
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
- auth: Better Auth + username plugin
- browser API: POST `/i/api` Protobuf tunnel
- direct API: `/api/*` + `Authorization: Bearer <personal_api_key>`
- local DB: migrations `0001`~`0022`, `seed.sql`

## P0-1 identity와 환경

| 단계 | 파일/경로 | 구현 |
|---|---|---|
| 1 | `package.json` | package name, scripts description을 `viet-tai-han` 기준으로 정리. 기존 `dev`, `build`, `test` 계약은 유지. |
| 2 | `wrangler.jsonc` | Worker를 `vth`로 변경. D1/R2/Vectorize 이름을 `vth-*`로 지정하고 zero D1 ID는 실제 계정 생성 전까지 placeholder로 남긴다. 운영 deploy는 placeholder를 거부한다. |
| 3 | `.dev.vars.example` | 로컬 `BETTER_AUTH_URL`과 운영 secret 설정 방법을 vth 기준으로 갱신. 실제 secret은 `.dev.vars`/Wrangler secret에만 둔다. |
| 4 | `src/app/layout.tsx` | metadata `applicationName`, apple title, default description을 `Việt tại Hàn`으로 변경. `lang`은 resolved locale을 계속 사용. |
| 5 | `src/components/layout/site-header.tsx`, `site-footer.tsx` | logo/aria/title/link copy를 `Việt tại Hàn` 또는 `VTH`로 교체. logo link는 `/` 유지. |
| 6 | `README.md`, `seed.sql`, fixtures | 원본 red/Reddit 샘플을 vth 설명·샘플 community로 교체. 운영 seed 실행은 금지. |

## P0-2 i18n: Vietnamese 기본, Korean 보조

| 단계 | 파일/경로 | 구현 |
|---|---|---|
| 1 | `src/lib/i18n/config.ts` | `LOCALES = ["vi", "ko"]`, `PREFERRED_LANGUAGES = ["unknown", "vi", "ko"]`, `DEFAULT_LOCALE = "vi"`, cookie `vth_lang`. `isLocale`/`isPreferredLanguage`를 동일 계약으로 변경. |
| 2 | `src/lib/i18n/messages/vi.ts`, `ko.ts` | `messages/en.ts`의 `Messages` key를 빠짐없이 구현. 사용자 노출 title/nav/auth/feed/post/comment/settings/error copy를 우선 번역. key 누락은 typecheck에서 실패하게 한다. |
| 3 | `src/lib/i18n/translate.ts` | catalog를 `vi`/`ko`로 교체. 원본 `en`/`ru`는 전환기간에만 별도 fallback으로 둘지 결정하고 사용자 선택지에서는 제거. |
| 4 | `src/lib/i18n/errors.ts` | 화면에 노출되는 API canonical error에 vi/ko 문구를 추가하고, 미등록 오류는 locale별 안전한 generic fallback으로 표시. server는 stable code/message key를 유지하고 display만 locale화. |
| 5 | `src/components/i18n/language-switcher.tsx` | 하드코딩 `en/ru` 배열 제거 후 `vi/ko` 배열을 사용. 버튼명은 각각 `Tiếng Việt`, `한국어`. |
| 6 | `src/components/i18n/language-prompt.tsx` | Vietnamese 우선 prompt와 Korean 선택지를 제공. modal은 mobile bottom sheet, desktop dialog로 유지. |
| 7 | `src/app/api/me/language/route.ts`, `src/lib/user-language.ts`, `migrations/0019_migrate_legacy_languages.sql` | validation/error copy를 vi/ko 기준으로 변경. 기존 DB `preferredLanguage` 값 en/ru는 forward migration으로 vi/ko에 매핑한다. |
| 8 | `src/lib/i18n/server.ts`, `i18n-provider.tsx` | cookie 우선 SSR 계약 유지. signed-in preference가 없을 때 vi, cookie 선택 시 account preference를 동기화. |

## P0-3 공통 mobile-first layout

| 단계 | 파일/경로 | 구현 |
|---|---|---|
| 1 | `src/components/layout/site-header.tsx` | 390px에서 logo/search/menu가 충돌하지 않게 intrinsic width를 제한. menu panel은 viewport-safe padding과 focus return을 보장. |
| 2 | `src/components/layout/mobile-nav.tsx` 신규 또는 기존 layout component | 모바일 하단 5개 primary action: 홈, 탐색, 만들기, 알림, 프로필. signed-out 상태는 로그인/가입 진입으로 대체. 현재 desktop nav는 보조로 유지. |
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
4. Facebook/Zalo OAuth, WebAuthn/passkey, account linking.
5. push notification, DM moderation, unread fanout.
6. Vietnamese content translation, multilingual embedding/recommendation.
7. 광고/Pro/결제/ledger는 policy·consent·anti-fraud 이후 활성화.

## 외부 blocker

- Cloudflare account ID와 실제 D1/R2/Vectorize/KV/rate-limit resource.
- `vth.kr` DNS/Worker route.
- production `BETTER_AUTH_SECRET`, Turnstile key pair.
- Facebook/Zalo OAuth credentials와 callback allowlist.
- SMTP/email provider.
- WebAuthn RP ID/origin.
- push VAPID/FCM/APNs credentials.
- 지도·예약 provider 및 결제 provider credentials.

이 값이 없는 동안에는 로컬 D1, OpenNext local preview, 코드·schema·보안 검증까지만 수행하고 원격 production deploy는 실행하지 않는다.
