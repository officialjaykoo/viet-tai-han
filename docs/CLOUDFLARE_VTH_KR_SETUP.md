# vth.kr Cloudflare 운영 runbook

이 문서는 `vth.kr` 운영 리소스, 환경 계약, migration, 배포, smoke test, 백업과 rollback 절차를 정의합니다. 운영 명령은 대상 계정과 대상 리소스를 확인한 뒤 실행합니다.

## 1. Resource inventory

| 항목 | 값 | 역할 |
| --- | --- | --- |
| Cloudflare account | `viet-tai-han` (`8cbaf5bd93f2cfcf2a01bcae16cdf2d8`) | 운영 계정 |
| Worker | `vth` | Next.js/OpenNext 애플리케이션과 API |
| Public host | `vth.kr` | 사용자 서비스 |
| Developer host | `developers.vth.kr` | 개발자 문서 라우팅 |
| D1 | `vth-db` (`DB`) | canonical persistent state |
| R2 | `vth-media` (`MEDIA_BUCKET`) | media object storage |
| Durable Object | `CHAT_ROOM` → `ChatRoom` | DM realtime delivery only |
| Workers AI | `AI` | translation only |
| Turnstile | `vth.kr production` | bot/human verification |

`wrangler.jsonc`가 Worker entry, D1 database, R2 bucket, Durable Object, AI binding, custom domain을 선언합니다. 운영 D1에는 `seed.sql`을 실행하지 않습니다. `seed.sql`은 로컬 개발 데이터 전용입니다.

Cloudflare Dashboard 확인 경로:

- **Workers & Pages → vth → Settings → Domains & Routes**
- **Workers & Pages → vth → Settings → Variables and Secrets**
- **D1 → vth-db**
- **R2 → vth-media**
- **Workers & Pages → vth → Logs**

## 2. Public vars

Production public vars are non-secret configuration. Keep the values consistent with the domain being deployed.

| Variable | Production use |
| --- | --- |
| `BETTER_AUTH_URL` | `https://vth.kr` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | public Turnstile site key for the `vth.kr` widget |
| `NEXTJS_ENV` | `production` |
| `FACEBOOK_CLIENT_ID` | Facebook OAuth client ID, when enabled |
| `KAKAO_CLIENT_ID` | Kakao OAuth client ID, when enabled |
| `ZALO_APP_ID` | Zalo OAuth app ID, when enabled |
| `VTH_AUTH_ORIGINS` | optional comma-separated additional trusted origins |
| `VAPID_PUBLIC_KEY` | public Web Push key, when push is enabled |

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` is public but must also be available to the production build process because Next.js client code reads it at build time. Never place secret values in `wrangler.jsonc`, `README.md`, or this runbook.

Inspect configured public vars without treating the output as a secret store:

```bash
npx wrangler whoami
npx wrangler deployments list
```

Review `wrangler.jsonc` and the Dashboard Variables section for the actual deployed values. Do not copy a production public client ID into another deployment without changing its OAuth configuration.

## 3. Secrets

Set secrets through Wrangler or the Cloudflare Dashboard. Values must not be committed or pasted into issue comments, chat, logs, or documentation.

Required for the production authentication and bot paths:

- `BETTER_AUTH_SECRET`
- `TURNSTILE_SECRET_KEY`

Provider secrets are required only for enabled providers:

- `FACEBOOK_CLIENT_SECRET`
- `ZALO_APP_SECRET`
- `KAKAO_CLIENT_SECRET`

Optional operational secrets:

- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT`
- `BILLING_WEBHOOK_SECRET` when the billing webhook contract is enabled

List secret names without printing their values:

```bash
npx wrangler secret list
```

Set or rotate a secret interactively:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
npx wrangler secret put FACEBOOK_CLIENT_SECRET
npx wrangler secret put ZALO_APP_SECRET
npx wrangler secret put KAKAO_CLIENT_SECRET
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
npx wrangler secret put BILLING_WEBHOOK_SECRET
```

Only set optional secrets when the corresponding feature is configured. Rotating `BETTER_AUTH_SECRET` invalidates existing authentication and realtime signing material; plan the user impact before rotation.

## 4. OAuth callbacks

Production callback URLs:

```text
https://vth.kr/api/auth/callback/facebook
https://vth.kr/api/auth/callback/kakao
https://vth.kr/api/auth/oauth2/callback/zalo
```

Configure the exact URL in each provider console and keep the provider client ID/secret pair in the same environment. Authentication is social-first/social-only; matching email addresses do not automatically merge provider identities.

Provider checklist:

- Facebook Login: allow `vth.kr` and register the Facebook callback.
- Kakao Login: enable Kakao Login and register the Kakao callback.
- Zalo OAuth: register the Zalo callback when `ZALO_APP_ID` and `ZALO_APP_SECRET` are enabled.
- Deploy the matching public ID and secret together.
- Verify a new sign-in and the account-linking flow after provider changes.

## 5. D1 migrations

Migrations in `migrations/` are forward-only. Never edit or delete a migration that may already have been applied to production. The current messaging/relationship reliability chain includes `0036_chat_reliability.sql`, `0038_chat_request_integrity.sql`, `0039_cancel_orphan_pending_chat_requests.sql`, and `0040_notification_request_identity.sql`.

Before a production schema change:

1. Confirm the target account and database.
2. Create a D1 export backup.
3. Review the pending migration list and SQL.
4. Apply the forward migration.
5. Run foreign-key and application smoke checks.

```bash
npx wrangler whoami
npx wrangler d1 migrations list vth-db --remote
npx wrangler d1 export vth-db --remote --output="backup-$(date +%Y%m%d-%H%M).sql"
npx wrangler d1 migrations apply vth-db --remote
npx wrangler d1 execute vth-db --remote --command="PRAGMA foreign_key_check;"
```

For local development only:

```bash
npm run db:migrate:local
npm run db:seed:local
# or, when a disposable reset is intended:
npm run db:reset:local
```

Do not use the local seed command against `vth-db --remote`. For immutable user ID maintenance, follow [`USER_ID_REKEY_RUNBOOK.md`](USER_ID_REKEY_RUNBOOK.md) instead of writing ad hoc SQL.

## 6. R2

R2 bucket `vth-media` is bound as `MEDIA_BUCKET`.

```bash
npx wrangler r2 bucket list
npx wrangler r2 bucket info vth-media
```

D1 exports do not contain R2 objects. Maintain a separate media retention/export policy before relying on a rollback plan. D1 media keys, ownership, authorization, and object lifecycle must remain consistent; an object alone is not an authorized application record.

When testing uploads, verify all of the following:

- the request is authorized by the application;
- the object is written to `vth-media`;
- the corresponding D1 metadata is present;
- unauthorized reads and deleted-object paths fail as expected.

## 7. Durable Object

The `CHAT_ROOM` binding maps to the `ChatRoom` class. There is one object identity per active DM room.

ChatRoom Durable Objects:

- accept authenticated WebSocket connections;
- re-check active D1 membership and bilateral block state;
- fan out messages already committed by the HTTP/D1 write path;
- provide no canonical message persistence or history cache.

D1 remains authoritative for rooms, members, requests, messages, and read state. Offline history is recovered through the HTTP API. `wrangler.jsonc` retains the deployed Durable Object migration history; do not restore the retired `PostObject` class.

After a Worker or DO change, verify `CHAT_ROOM` is present, `ChatRoom` is exported from `src/worker.ts`, and the production bundle was built with `npm run build:worker`.

## 8. Build

Use Node.js 22 or newer and install from the lockfile.

```bash
npm ci
npm run lint
npm run typecheck
npm test
npm run build
npm run build:worker
```

Build meanings:

- `npm run build` runs the Next.js application build.
- `npm run build:worker` runs the OpenNext Cloudflare production bundle build and creates `.open-next/worker.js` and assets.
- `npm run preview` builds the Worker bundle and starts the Cloudflare preview.

`npm run build` alone does not verify the Cloudflare Worker bundle. Run `npm run build:worker` before any Worker deployment.

For a production client build, provide the public site key and canonical auth URL to the build environment when they are not already supplied by the shell:

```powershell
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>"
$env:BETTER_AUTH_URL="https://vth.kr"
$env:NEXTJS_ENV="production"
npm run build:worker
```

## 9. Deploy

Apply required migrations and configure secrets before deployment. Then build the exact Worker bundle that will be deployed and deploy it through the existing script.

PowerShell:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8"
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>"
$env:BETTER_AUTH_URL="https://vth.kr"
$env:NEXTJS_ENV="production"
npm run build:worker
npm run deploy
```

macOS/Linux:

```bash
CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8" \
NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>" \
BETTER_AUTH_URL="https://vth.kr" \
NEXTJS_ENV=production \
npm run build:worker
CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8" \
NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>" \
BETTER_AUTH_URL="https://vth.kr" \
NEXTJS_ENV=production \
npm run deploy
```

`npm run deploy` performs its own OpenNext build before upload. The explicit `npm run build:worker` is the required pre-deploy bundle check; do not replace it with `npm run build`.

## 10. Post-deploy smoke

Run these checks against the deployed hosts after every production deployment:

```bash
curl -I https://vth.kr/
curl -I https://vth.kr/login
curl -I https://vth.kr/signup
curl -I https://developers.vth.kr/
npx wrangler d1 migrations list vth-db --remote
npx wrangler secret list
npx wrangler deployments list
```

Browser and application checks:

- `vth.kr` serves the home page over HTTPS.
- `developers.vth.kr` routes to the developer surface.
- login and signup render the configured Turnstile widget;
- a configured social provider can complete callback and session creation;
- a new account can create a profile and a community/content write;
- posts, comments, likes, follow/friend/block state, and notifications persist in D1;
- an authorized media upload reaches `vth-media`;
- a DM request, acceptance, direct message, reconnect, and history reload work;
- a block prevents new contact and realtime membership delivery;
- translation works when Workers AI is configured, and content remains available if translation fails;
- direct `/api/*` requests without the required Bearer public API key are rejected by the documented auth boundary.

Record failures with the host, route, deployment, migration state, and redacted error; never record secret values.

## 11. Backup/rollback

D1 backup:

```bash
npx wrangler d1 export vth-db --remote --output="backup-$(date +%Y%m%d-%H%M).sql"
npx wrangler d1 migrations list vth-db --remote
```

PowerShell backup:

```powershell
$stamp = Get-Date -Format yyyyMMdd-HHmm
npx wrangler d1 export vth-db --remote --output="backup-$stamp.sql"
```

Rollback rules:

- Do not reverse production schema by editing or deleting an applied migration.
- For a code-only regression, deploy the last reviewed Worker bundle and then repeat the smoke checks.
- For a schema/data problem, stop further writes when appropriate, preserve a fresh backup, diagnose locally, and use an approved forward repair migration or reviewed restore procedure.
- Validate any restore against a disposable database before touching `vth-db`.
- D1 backup does not restore `vth-media`; keep a separate R2 recovery plan.
- ChatRoom state is delivery coordination, not canonical history; reconnect/history reads recover from D1 after a Worker or DO restart.

A user ID rekey is a destructive one-off operation with separate dry-run, mapping, confirmation, and foreign-key verification requirements. Use [`USER_ID_REKEY_RUNBOOK.md`](USER_ID_REKEY_RUNBOOK.md) and do not combine it with a routine deployment.
