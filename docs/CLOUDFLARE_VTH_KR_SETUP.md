# vth.kr Cloudflare 운영 설정

이 문서는 `viet-tai-han`을 `vth.kr`에서 운영하기 위해 필요한 Cloudflare 설정과 배포 절차를 정리한 문서입니다.

## 현재 상태

### 목표 Cloudflare 계정

- Account: `viet-tai-han`
- Account ID: `8cbaf5bd93f2cfcf2a01bcae16cdf2d8`
- Worker: `vth`
- Worker URL: <https://vth.viet-tai-han.workers.dev>
- Custom Domain: <https://vth.kr>
- Current Version ID: `051f6467-fba1-4379-8395-99e2be4a6b3c`
- D1: `vth-db` — 생성 및 원격 migration 적용 완료
- R2: `vth-media` — 생성 및 Worker binding 완료
- Vectorize: `vth-posts` — 768 dimensions, cosine
- Vectorize metadata index:
  - `embeddingVersion`
  - `authorId`
- Turnstile widget: `vth.kr production`
  - 허용 도메인: `vth.kr`
  - mode: Managed
- 운영 Worker secret:
  - `BETTER_AUTH_SECRET`
  - `TURNSTILE_SECRET_KEY`
- 운영 Worker 변수:
  - `BETTER_AUTH_URL=https://vth.kr`
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `NEXTJS_ENV=production`

운영 D1에는 로컬 데모 데이터와 `seed.sql`을 넣지 않았습니다. 첫 운영 계정은 실제 가입으로 생성해야 합니다.

### 배포 완료 상태

`wrangler.jsonc`에 `vth.kr` Custom Domain 자동 연결 설정이 들어 있으며, 목표 계정에서 최종 배포가 성공했습니다.

```jsonc
"routes": [
  {
    "pattern": "vth.kr",
    "custom_domain": true,
    "zone_name": "vth.kr"
  }
]
```

`https://vth.kr/`, `/login`, `/signup`은 Cloudflare edge에 대한 HTTPS 요청으로 `200`을 확인했습니다. 이 검증은 Cloudflare edge IP를 `vth.kr`에 지정한 HTTPS 요청으로 수행했습니다. 현재 작업 환경의 ISP DNS resolver가 A 응답을 아직 반환하지 않아 일반 `curl https://vth.kr`은 일시적으로 `ENOTFOUND`가 될 수 있습니다. 공용 DNS 조회에서는 `vth.kr` 레코드가 확인됩니다.

---

## 0. 목표 계정에서 R2 활성화 (완료)

Cloudflare Dashboard에서 R2 subscription을 활성화한 뒤 아래 명령으로 버킷을 생성했습니다. Worker를 Dashboard에서 수동 생성하지 않았습니다.

```bash
npx wrangler r2 bucket create vth-media
```

생성 결과:

- R2 bucket: `vth-media`
- Worker binding: `MEDIA_BUCKET`
- 최종 Worker 배포에서 R2 binding 연결 확인

## 1. vth.kr을 Cloudflare Zone으로 추가
이미 `vth.kr` Zone이 `Active`이면 이 단계는 건너뛰고 2단계로 진행합니다.


1. Cloudflare Dashboard에 운영 계정으로 로그인합니다.
2. **Websites → Add a site**를 선택합니다.
3. 도메인으로 `vth.kr`을 입력합니다.
4. 요금제는 처음에는 Free로 선택해도 됩니다.
5. Cloudflare가 지정한 두 개의 Nameserver를 확인합니다.
6. 도메인을 구매한 등록기관의 DNS/네임서버 화면에서 기존 네임서버를 Cloudflare 네임서버로 교체합니다.
7. Cloudflare Dashboard에서 Zone 상태가 `Active`가 될 때까지 기다립니다.

등록기관에서 네임서버를 바꾸는 작업은 Cloudflare Dashboard가 아니라 도메인 등록기관에서 해야 합니다.

### DNS 레코드 주의

Custom Domain을 연결하면 Cloudflare가 `vth.kr`용 DNS 레코드와 인증서를 관리합니다. 기존에 `vth.kr`에 CNAME이 있다면 Custom Domain을 배포하기 전에 제거해야 합니다.

현재 운영 주소는 `vth.kr` 하나만 사용합니다. `www.vth.kr`은 이번 배포에 포함하지 않았습니다.

## 2. Worker에 Custom Domain 연결

Zone이 `Active`라는 전제에서 `wrangler.jsonc`의 설정으로 자동 연결합니다.

```jsonc
"routes": [
  {
    "pattern": "vth.kr",
    "custom_domain": true,
    "zone_name": "vth.kr"
  }
]
```

다음 배포 명령이 Custom Domain을 생성합니다.

```powershell
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>"
$env:BETTER_AUTH_URL="https://vth.kr"
$env:NEXTJS_ENV="production"
npm run deploy
```

Cloudflare Dashboard에서는 **Workers & Pages → vth → Settings → Domains & Routes**에서 생성 결과만 확인하면 됩니다. 자동 생성이 실패한 경우에만 **Add → Custom Domain → vth.kr**을 사용합니다.

완료 후 아래 주소를 확인합니다.

- <https://vth.kr>

`wrangler.jsonc`의 `BETTER_AUTH_URL`은 이미 `https://vth.kr`로 설정되어 있습니다. Custom Domain을 다른 주소로 정하면 이 값을 바꾸고 다시 배포해야 합니다.

---


## 3. SSL/TLS 설정

Cloudflare Dashboard에서 다음을 확인합니다.

1. **SSL/TLS → Overview**
2. 암호화 모드를 `Full (strict)`로 설정
3. **SSL/TLS → Edge Certificates**
4. `Always Use HTTPS` 활성화
5. `Automatic HTTPS Rewrites` 활성화

원본 서버를 따로 운영하지 않고 Worker가 직접 응답하므로 Cloudflare 앞단에서 HTTPS를 종료합니다.

---

## 4. 운영 환경 변수와 Secret

### 현재 설정된 값

`wrangler.jsonc`에 다음 공개 변수가 설정되어 있습니다.

```jsonc
"vars": {
  "BETTER_AUTH_URL": "https://vth.kr",
  "NEXT_PUBLIC_TURNSTILE_SITE_KEY": "<Turnstile site key>",
  "NEXTJS_ENV": "production"
}
```

Turnstile site key는 공개값이므로 프론트엔드에 포함되어도 됩니다. Turnstile secret과 Better Auth secret은 절대 Git에 저장하지 않습니다.

현재 Worker에 저장된 secret 목록은 다음 명령으로 확인합니다. 값 자체는 출력되지 않습니다.

```bash
npx wrangler secret list
```

Secret을 갱신할 때만 다음 명령을 사용합니다.

```bash
npx wrangler secret put BETTER_AUTH_SECRET
npx wrangler secret put TURNSTILE_SECRET_KEY
```

`BETTER_AUTH_SECRET`을 바꾸면 기존 세션이 무효화될 수 있습니다.

### 추가 OAuth를 사용할 경우

기본 인증은 이메일/사용자명 + 비밀번호로 동작합니다. Facebook과 Zalo는 ID와 secret을 모두 설정한 경우에만 활성화됩니다.

Cloudflare Dashboard의 **Worker → Settings → Variables and Secrets**에서 다음 공개 변수를 추가합니다.

- `FACEBOOK_CLIENT_ID`
- `ZALO_APP_ID`
- `VTH_AUTH_ORIGINS` — preview/custom origin이 추가로 필요할 때만, 쉼표로 구분

`wrangler.jsonc`에 공개 변수를 추가하는 방식도 사용할 수 있습니다. 파일을 변경했다면 아래 배포 절차를 다시 실행합니다.

Secret은 다음 명령으로 등록합니다.

```bash
npx wrangler secret put FACEBOOK_CLIENT_SECRET
npx wrangler secret put ZALO_APP_SECRET
```

OAuth callback URL:

```text
https://vth.kr/api/auth/callback/facebook
https://vth.kr/api/auth/oauth2/callback/zalo
```

OAuth를 사용하지 않으면 아무것도 설정하지 않아도 됩니다.

### Web Push를 사용할 경우

다음 세 값이 모두 있어야 Push가 활성화됩니다.

- `VAPID_PUBLIC_KEY` — 공개 변수
- `VAPID_PRIVATE_KEY` — secret
- `VAPID_SUBJECT` — secret, 예: `mailto:ops@vth.kr`

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
npx wrangler secret put VAPID_SUBJECT
```

`VAPID_PUBLIC_KEY`는 Dashboard 변수 또는 `wrangler.jsonc`에 추가합니다.

### 결제/광고

결제 checkout은 구현되어 있지 않습니다. 결제 provider, 가격, 환불, 세금, fraud 정책을 확정하기 전에는 `ads_enabled`를 활성화하지 않습니다.

---

## 5. 배포 절차

### 최초 배포 또는 migration 포함 배포

```bash
npm ci
npx wrangler login
export CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8"
npx wrangler d1 migrations apply DB --remote
```

`seed.sql`은 운영 DB에 실행하지 않습니다.

### Windows PowerShell에서 배포

`NEXT_PUBLIC_*` 값은 Next.js 빌드 시점에 번들에 포함됩니다. `wrangler.jsonc`의 Worker 변수만으로는 Next.js 클라이언트 번들에 값이 들어가지 않을 수 있으므로, 배포할 때 빌드 프로세스에도 공개 Turnstile site key를 전달합니다.

```powershell
$env:CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8"
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>"
$env:BETTER_AUTH_URL="https://vth.kr"
$env:NEXTJS_ENV="production"
npm run deploy
```

### macOS/Linux에서 배포
```bash
CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8" \
NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>" \
BETTER_AUTH_URL="https://vth.kr" \
NEXTJS_ENV=production \
npm run deploy
```

`.dev.vars`의 로컬 테스트용 Turnstile key를 운영 빌드에 사용하지 않습니다.

### 일반 업데이트

코드 변경 후에도 동일한 빌드 환경을 전달합니다.

```powershell
$env:CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8"
$env:NEXT_PUBLIC_TURNSTILE_SITE_KEY="<Turnstile site key>"
$env:BETTER_AUTH_URL="https://vth.kr"
$env:NEXTJS_ENV="production"
npx wrangler d1 migrations apply DB --remote
npm run deploy
```

Migration은 이미 적용된 항목을 다시 실행하지 않습니다.

Windows에서 OpenNext 빌드가 `.open-next` 파일 잠금으로 실패하면 실행 중인 `wrangler dev` 또는 로컬 미리보기 프로세스를 먼저 종료한 뒤 다시 배포합니다. Windows 호환성 경고가 계속되면 WSL 환경에서 배포하는 편이 안전합니다.

---

## 6. 첫 운영 관리자 계정

운영 DB에 데모 관리자 계정은 없습니다.
여러 Cloudflare 계정이 로그인되어 있으면 D1 명령 전에 목표 계정을 명시합니다.

```powershell
$env:CLOUDFLARE_ACCOUNT_ID="8cbaf5bd93f2cfcf2a01bcae16cdf2d8"
```


1. `https://vth.kr/signup`에서 첫 계정을 생성합니다.
2. 계정 정보를 확인합니다.

```bash
npx wrangler d1 execute vth-db --remote --command="SELECT id, username, email, role FROM \"user\" ORDER BY createdAt ASC LIMIT 10"
```

3. 본인 계정만 관리자로 승격합니다.

```bash
npx wrangler d1 execute vth-db --remote --command="UPDATE \"user\" SET role='admin' WHERE username='본인아이디'"
```

4. 다시 로그인하고 `/admin`에 접속합니다.

운영에서 `seed.sql`을 실행하면 데모 사용자·게시글·인증 데이터가 들어가므로 사용하지 않습니다.

---

## 7. 운영 리소스 점검 명령

```bash
npx wrangler whoami
npx wrangler d1 list
npx wrangler r2 bucket list
npx wrangler vectorize list
npx wrangler secret list
npx wrangler deployments list
```

D1 migration 상태:

```bash
npx wrangler d1 migrations list DB --remote
```

D1 백업 예시:

```bash
npx wrangler d1 export vth-db --remote --output="backup-$(date +%Y%m%d).sql"
```

Windows PowerShell에서는 날짜를 자동으로 만들 수 있습니다.

```powershell
$stamp = Get-Date -Format yyyyMMdd
npx wrangler d1 export vth-db --remote --output="backup-$stamp.sql"
```

R2 미디어는 별도 백업 정책을 정해야 합니다. DB 백업만으로 R2 파일은 복구되지 않습니다.

---

## 8. 배포 후 확인 목록

### 기본 화면

- [ ] `https://vth.kr`이 200 응답
- [ ] 로그인/회원가입 화면에 Turnstile이 표시됨
- [ ] 로그인 후 세션 cookie가 HTTPS에서 동작함
- [ ] `/communities`, `/marketplace`, `/friends`, `/messages`가 열림
- [ ] 프로필의 개요·글·댓글·친구 탭이 동작함

### 데이터/파일

- [ ] 게시글·댓글·친구 관계가 D1에 저장됨
- [ ] 이미지 업로드가 `vth-media` R2에 저장됨
- [ ] Vectorize와 Workers AI가 활성화된 계정에서 추천/번역이 동작함
- [ ] AI 사용량과 비용을 Cloudflare Dashboard에서 확인함

### 보안

- [ ] `BETTER_AUTH_SECRET`가 로컬 테스트 값이 아님
- [ ] `TURNSTILE_SECRET_KEY`가 실제 `vth.kr` 위젯 secret임
- [ ] 비밀값이 Git, README, 브라우저 HTML에 노출되지 않음
- [ ] SSL/TLS가 `Full (strict)`임
- [ ] 관리자 계정이 본인 계정 하나로 제한됨
- [ ] 광고·결제 기능을 정책 검토 전에 활성화하지 않음

---

## 관련 명령 요약

```bash
# 로그인
npx wrangler login

# 운영 migration
npx wrangler d1 migrations apply DB --remote

# 운영 배포
npm run deploy

# 운영 secret 목록(값은 출력되지 않음)
npx wrangler secret list

# Worker 배포 이력
npx wrangler deployments list
```
