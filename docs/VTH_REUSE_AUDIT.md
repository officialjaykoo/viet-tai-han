# Việt tại Hàn 재사용 감사

기준 저장소: `koval01/red` (`7363d6e`)  
대상 프로젝트: `officialjaykoo/viet-tai-han` (`vth.kr`)  
감사 기준: 2026-08-01 호환성 설정, 로컬 D1 `0024_messaging_delivery`까지 적용된 상태.

## 결론

- **KEEP**: Cloudflare/OpenNext 실행 경계, D1 migration 누적 이력, Better Auth 세션, posts/comments/votes, R2 이미지 정규화, `/i/api` 보안 터널, 테스트 골격.
- **MODIFY**: 브랜드/도메인, UI locale, 커뮤니티 용어, 인증 origin/OAuth, 검색 도메인, 모바일 공통 layout, D1 도메인 확장, 배포 리소스 설정.
- **DISABLE**: MVP 초기에는 광고 노출과 원격 AI/Vectorize 자동 호출을 기본 비활성화. 데이터/코드는 보존하고 명시적 feature flag 뒤에 둔다.
- **REMOVE LATER**: `users` 레거시 테이블, `subreddits`/`/r/*` Reddit 명칭, 호환기간이 끝난 legacy translation columns, 사용되지 않는 PostObject 투표 경로. 마이그레이션·호환기간 후 제거한다.
- **NEW**: Q&A, 마켓/구인, business profile, 북마크, 신고/정책 센터, WebAuthn/OAuth, push, 지도/예약, ledger/정산.

## KEEP

| 영역 | 현재 코드 경로 | 판단 근거 | 조치 |
|---|---|---|---|
| Cloudflare 실행 | `src/worker.ts`, `next.config.ts`, `open-next.config.ts` | OpenNext handler 앞에서 edge IP 제한을 적용하고 HTML에 speculation rule을 설정한다. | Worker 진입점은 유지. `vth` 리소스명과 custom worker 빌드 검증만 수행. |
| D1 access | `src/lib/db.ts`, `migrations/0001_init.sql`~`0025_multilingual_content.sql` | Kysely-D1/쿼리 builder와 keyset cursor, visibility filter, 인덱스가 이미 있다. 로컬 migration 누적 이력이 적용된다. | 기존 migration은 수정하지 않고 후속 migration만 추가. |
| 인증/세션 | `src/lib/auth.ts`, `src/lib/session.ts`, `src/lib/permissions.ts` | Better Auth email/password, 세션 캐시, banned 차단, role/status 입력 차단, admin/moderator 경계가 있다. | `vth.kr` trusted origin, OAuth, WebAuthn을 추가하고 secret을 운영값으로 교체. |
| 게시물/댓글/투표 | `src/lib/actions.ts`, `src/lib/content.ts`, `src/lib/votes.ts`, `src/app/api/posts/**`, `src/app/api/comments/**` | 생성/수정/삭제/댓글/투표/신고/숨김 및 karma/rate limit/visibility filter가 연결되어 있다. | 핵심 피드 흐름은 유지. Vietnamese 커뮤니티·Q&A 도메인만 확장. |
| 커뮤니티 | `src/lib/communities.ts`, `src/app/communities/page.tsx`, `src/app/r/[name]/page.tsx` | 커뮤니티 생성·구독·피드·moderator 경계가 구현되어 있다. | 내부 데이터는 호환 유지하고 사용자 노출 명칭을 `community`/`cộng đồng`로 변경. `/r/*`는 호환 redirect로 전환. |
| 미디어 | `src/lib/media.ts`, `src/lib/image-process.ts`, `src/app/api/media/**`, `src/components/media/tunneled-media.tsx` | 1 MiB 제한, JPEG/PNG/WebP signature 검사, 메타데이터 제거, trailing payload 검사, R2 metadata, `/i/api` blob 로딩이 있다. | MIME/픽셀·quota·ownership 정책을 보강하되 터널 로딩 구조는 유지. |
| 보안 터널 | `src/lib/security/**`, `src/lib/internal-api/dispatch.ts`, `src/app/i/api/route.ts` | Protobuf route sealing, HMAC, timestamp/nonce, PoW, IP 제한, public API Bearer 경계를 분리한다. | 기본 모델 유지. challenge atomicity와 KV/Durable Object 저장소를 보강. |
| **DM/알림** | `src/lib/messages.ts`, `src/lib/notifications.ts`, `src/app/api/messages/**`, `src/app/api/notifications/route.ts` | 요청→수락→활성 멤버십, 차단, DM preference, unread/read timestamp가 있다. | Vietnamese UX, VAPID Web Push, D1 unread fanout, DM 신고·운영 검토 큐와 race-safe transition을 `0024_messaging_delivery.sql` 및 관련 API/UI에 추가했다. |
| 테스트/CI | `tests/unit/**`, `tests/workers/**`, `tests/integration/**`, `tests/e2e/**`, `.github/workflows/ci.yml` | unit 62개, worker 9개, integration 8개, Chromium smoke 10개가 baseline에서 통과했다. | Phase1 계약에 맞는 i18n/mobile/branding 회귀 테스트만 추가. |

## MODIFY

| 영역 | 현재 상태 | 변경 경로 | 우선순위 |
|---|---|---|---|
| 제품 identity | title/applicationName/worker/D1/R2가 `red`이고 preview title이 `red — edge Reddit clone`이다. | `src/app/layout.tsx`, `src/components/layout/site-header.tsx`, `src/components/layout/site-footer.tsx`, `package.json`, `wrangler.jsonc`, `README.md`, `.dev.vars.example` | P0 |
| UI locale | `src/lib/i18n/config.ts`가 `en/ru`, cookie가 `red_lang`, default가 `en`이다. switcher/prompt도 English/Russian 전용이다. | `config.ts`, `server.ts`, `translate.ts`, `messages/*`, `language-switcher.tsx`, `language-prompt.tsx`, `/api/me/language` | P0 |
| 메시지 catalog | `messages/en.ts`가 기준 타입이며 `messages/ru.ts`만 대응한다. | 모든 동일 key를 `vi.ts`와 `ko.ts`로 제공하고 Vietnamese를 default로 지정. | P0 |
| Reddit 용어 | 화면에 `r/<name>`, `u/<username>`, karma, Hot/New/Top, subreddit, Reddit clone이 노출된다. 내부 route/DB는 그대로다. | header/feed/profile/community/post/settings/README의 사용자 노출 문자열 교체. 내부 API/migration 명칭은 호환기간 보존. | P0 |
| route naming | 페이지는 `/r/[name]`, `/u/[username]`; logical API는 `/api/subreddits/**`다. | 신규 canonical `/c/[name]`, `/@/[username]` 여부를 확정하고 기존 경로는 308/서버 redirect. API는 versioned public schema로 분리. | P1 |
| 인증 origin | `src/lib/auth.ts` trustedOrigins가 localhost 3000/3100뿐이다. | `https://vth.kr`, 운영 preview origin, OAuth callback origin을 환경별로 허용. | P0 운영 전 |
| 검색 | `src/lib/search.ts`가 community/account/post LIKE 검색만 제공하고 limit/query escaping은 적용한다. | Q&A/answer/business/listing/report/booking 대상과 Vietnamese diacritic normalization, FTS 검토. | P1 |
| content translation | `src/lib/translation.ts`, `migrations/0015_content_translation.sql`, `0025_multilingual_content.sql` | vi/ko/en/ru 감지, vi/ko target 기록, M2M100 번역, locale-aware toggle, background job, admin backfill을 적용했다. | P1 완료 |
| 광고/분석 | `src/lib/ads.ts`, `src/lib/post-analytics.ts`가 feed inline 광고와 raw impression/click/view를 제공한다. | MVP 기본 off, 동의/anti-fraud/active-window/rate limit/owner stats를 추가한 후 재활성화. | P1 |
| AI 추천 | `src/lib/embeddings.ts`, `/api/recommendations` | EmbeddingGemma multilingual 768차원 모델, embedding version metadata filter, stale preference re-embedding과 일반 feed fallback을 적용했다. | P1 완료 |
| 배포 resource | `wrangler.jsonc`가 `red-db`, `red-media`, `red-posts`와 zero D1 ID를 사용한다. | `vth` 명칭과 실제 계정 리소스 ID로 교체. placeholder 상태 deploy 금지. | P0 운영 전 |
| 모바일 layout | 기존 390px preview는 horizontal overflow 없이 렌더링되고 touch target/header menu가 있다. bottom navigation과 safe-area 정책은 없다. | `src/components/layout/*`, `src/app/globals.css`에 mobile-first bottom nav, safe-area, keyboard/focus 규칙 추가. | P0 |
| CI/e2e 명령 | Playwright config가 존재하지 않는 `npm run dev:next`를 호출했다. | `playwright.config.ts`를 실제 `npm run dev`로 수정했다. | P0 완료 |
| root layout typing | Next generated global `LayoutProps`가 없어 typecheck가 실패했다. | `src/app/layout.tsx`가 명시적 `ReactNode` props를 사용하도록 수정했다. | P0 완료 |

## DISABLE

| 기능 | 현재 경로 | 초기 정책 | 해제 조건 |
|---|---|---|---|
| feed 광고 노출 | `src/lib/ads.ts`의 `withFeedAds`/`injectAdsIntoFeed` | MVP에서는 사용자 feed에 기본 미삽입. campaign/analytics 코드는 보존. | 동의/정책/anti-fraud/targeting 범위와 광고주 운영 화면 확정 후 flag on. |
| 원격 Workers AI/Vectorize | `src/lib/embeddings.ts`, `src/lib/translation.ts`, `wrangler.jsonc` | 로컬·preview에서 remote 호출을 자동 실행하지 않음. 추천은 hot/new/top fallback. | 실제 model cost budget, multilingual quality, Vectorize index와 장애 fallback 검증 후 on. |
| production seed/demo | `seed.sql` | 운영 D1에 `alice/password123` 등 seed 금지. | 운영 초기화 절차에서 별도 관리자 bootstrap으로 대체. |

## REMOVE LATER

| 대상 | 현재 경로 | 제거 전 조건 |
|---|---|---|
| 레거시 identity tables | `migrations/0001_init.sql`의 `users`, `subreddits`와 Better Auth `"user"` 공존 | 모든 사용자/community FK와 데이터가 canonical model로 이동하고 backup/rollback 검증 완료. |
| Reddit URL/표기 | `/r/[name]`, `/u/[username]`, `/api/subreddits/**` 및 노출 문자열 | canonical route/API가 안정되고 외부 링크 redirect 기간 종료. |
| legacy translation storage | `src/lib/translation.ts`의 `posts/comments` 번역 필드 | 다국어 target metadata와 backfill이 안정화되고 translation table로 확장할 필요가 확인될 때 정리. |
| 미사용 PostObject 투표 경로 | `src/workers/PostObject.ts`, `src/lib/votes.ts` | 현재 실제 vote write path가 D1 직접 갱신인지 확인하고, DO로 일원화하거나 binding/code를 제거. |
| 원본 demo copy | `README.md`, `seed.sql`, fixture의 red/Reddit/Cloudflare 샘플 | Việt tại Hàn용 seed/문서/fixture로 교체 후 baseline fixture가 새 계약을 검증. |

## NEW

| 영역 | 신규 산출물/경로 | 목적 |
|---|---|---|
| Q&A | `questions`, `answers`, accepted answer API/UI | 질문·답변·채택·투표·검색. |
| Marketplace/Jobs | listings, categories, location, saved/alert API/UI | 중고거래·구인·서비스 게시. 사기/연락처 노출 정책 포함. |
| Business profile | business verification/profile/services/hours | 업체·서비스 디렉터리와 예약 진입점. |
| Reports/policy | report center, appeals, policy pages, moderation queues | 신고·이의제기·운영 투명성. |
| Identity | Facebook/Zalo OAuth, WebAuthn passkey, account linking | 가입 장벽과 계정 보안 개선. |
| Messaging delivery | push subscription, unread fanout, notification preference | DM/알림의 모바일 전달. |
| Trust ledger | karma/reputation/transaction ledger | 기존 집계 karma를 감사 가능한 event/ledger로 확장. |
| Vietnamese discovery | diacritic-aware search, location/category index, multilingual embeddings | 다국어 임베딩·추천은 P1에서 완료했고 검색 정규화와 location/category index는 후속 작업. |
| Observability | Sentry/Workers logs/health checks/security events | 오류·rate-limit·abuse·비용 모니터링. |

## 보안 이슈 우선순위

| 우선순위 | 이슈 | 근거 | 영향 | 조치 |
|---|---|---|---|---|
| P0 | 운영 인증 origin 미설정 | `src/lib/auth.ts` trustedOrigins가 localhost만 허용 | vth.kr 로그인/OAuth callback 실패 또는 잘못된 origin 설정 위험 | `VTH_AUTH_ORIGINS`를 환경별 명시하고 production auth smoke 실행. |
| P0 | 배포 resource가 원본/placeholder | `wrangler.jsonc`의 `red-*`, D1 ID `00000000-...` | 잘못된 DB/R2/Vectorize를 사용하거나 deploy 불가 | 실제 vth 리소스 생성 후 ID 검증 전 deploy 금지. |
| P1 | OpenNext preview build가 `PostObject` export 경고 | `wrangler.jsonc` binding/migration과 생성 `.open-next/worker.js` export 불일치 경고 | DO 호출이 production에서 startup/runtime 실패 가능 | custom worker entry가 실제 preview/deploy bundle에 포함되는지 dry-run artifact로 확인; 미사용이면 binding/code 제거. |
| P1 | challenge consume check-then-set 경쟁조건 | `src/lib/security/challenge.ts` `consumeChallenge()`가 load→used 검사→save | 동시 재생 요청이 같은 challenge를 통과할 가능성 | KV atomic write/DO serialization 또는 nonce consume transaction으로 교체. |
| P1 | challenge/KV fallback이 isolate memory | `kv()`가 없으면 module Map 사용, `CACHE` binding 주석 처리 | 여러 Worker isolate에서 challenge/gate 불일치·재생 방어 약화 | production KV/DO를 필수화하고 fallback은 local-only로 제한. |
| P1 | DM request 상태 전이 경쟁조건 | `src/lib/messages.ts` `startChatRequest`, `respondToChatRequest` | 동시 요청에서 500/중복 notification/잘못된 accept·decline | unique conflict를 409로 매핑하고 `WHERE status='pending'` 조건부 update + affected row 검사. |
| P1 | 광고 update URL 검증 불일치 | `src/lib/ads.ts` create는 http/https 검증, update는 `new URL()`만 수행 | admin 입력이 javascript/custom scheme redirect로 이어질 수 있음 | create/update 공통 `http:`/`https:` validator와 host/policy 검증 사용. |
| P1 | 광고 impression 무결성 부족 | `/api/ads/impression`과 `recordAdImpression`이 campaign active/placement/rate 검증 없이 insert | 봇이 지표를 부풀리고 존재하지 않는 campaign에서 500 유발 | active campaign·placement 일치 확인, visitor/session dedupe, IP/user rate limit. |
| P1 | 직접 vote와 PostObject 경로 불일치 | `src/lib/votes.ts`는 D1 직접 write, DO는 후속 `getVotes()`만 호출 | DO aggregation이 실제 score source가 아니며 향후 이중 집계 위험 | 단일 source of truth를 선택하고 dead path를 제거. |
| P2 | post view dedupe key가 caller 신뢰값 | `src/lib/post-analytics.ts` `sessionKey`를 slice해 unique index에 사용 | 임의 session key로 unique viewer/view 지표 왜곡 | 서명된 first-party cookie와 server-side rotation, abuse cap 적용. |
| P2 | IP header fallback 신뢰 범위 | `clientIpFromHeaders()`가 `cf-connecting-ip`/`x-forwarded-for`를 직접 읽음 | 비-Cloudflare 환경에서 spoofing 시 rate limit 우회 | production은 Cloudflare edge only를 assert하고 local/test만 override. |
| P2 | content language heuristic가 Latin을 English로 분류 | `src/lib/translation.ts`는 cyrillic/latin 비율로 en/ru만 분류 | Vietnamese 원문이 영어로 오분류되고 번역 방향이 잘못됨 | vi/ko/other 감지 모델과 explicit author language 우선순위 추가. |
| P2 | API 오류 상태가 일관되지 않음 | 일부 route가 DB/validation exception을 generic 500으로 반환 | 클라이언트 재시도·운영 분석·공개 API 계약이 불안정 | canonical error code/schema와 route별 validation helper 도입. |

## Baseline 증거

| 명령/표면 | 결과 |
|---|---|
| `npm ci` | 성공, 881 packages 추가. deprecated warning만 관찰. |
| `npm run db:reset:local` | migration `0001`~`0018` 적용, seed 48 commands 성공. |
| `npm test` | unit 16 files / 62 tests, workers 2 files / 9 tests 통과. |
| `npm run test:integration` | 1 file / 8 tests 통과. |
| `npm run typecheck` | 최초 `LayoutProps` 오류. explicit `ReactNode` props 수정 후 통과. |
| `npm run build` | 성공. middleware convention, Windows OpenNext, AI/Vectorize local 지원, PostObject export 관련 warning 관찰. |
| `npm run test:e2e:chromium` | Chromium 설치 후 E2E bypass 환경에서 10 tests 통과. |
| OpenNext preview | `vth-cloudflare-preview`가 8787에서 기동. 실제 브라우저 390px surface가 horizontal overflow 없이 렌더링됨. baseline title/용어는 여전히 red/Reddit/r/u/English/Russian. |

## 외부 작업 blocker

현재 GitHub fork만 생성했다. Cloudflare 원격 resource를 임의로 만들거나 운영 deploy하지 않았다. 다음 값이 있어야 production 경로를 완료할 수 있다.

- Cloudflare account 연결 및 `vth-db`, `vth-media`, `vth-posts`, optional KV 생성/ID.
- `vth.kr` DNS/Worker route와 `BETTER_AUTH_URL=https://vth.kr`.
- production `BETTER_AUTH_SECRET`, Turnstile site/secret.
- Facebook/Zalo OAuth client/secret 및 callback URL.
- 이메일 발송 provider/도메인 인증.
- WebAuthn RP ID/origin, Web Push `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`/`VAPID_SUBJECT`, 지도/예약 provider keys. Native FCM/APNs are outside this web phase.
