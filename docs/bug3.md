맞습니다. **지금 VTH는 기능별 디자인이 다른 게 아니라, 페이지를 만들 때마다 같은 디자인을 다시 손으로 만들어서 조금씩 어긋난 상태**입니다.

코드를 전체적으로 대조해 보니 **Q&A + 장터 + 비즈니스 목록 화면이 현재 가장 완성된 VTH 기본 UX**입니다. 이 셋을 소비자 화면의 기준 디자인으로 삼는 게 맞습니다. 셋 모두 `brand radial wash → eyebrow → 큰 제목 → 설명 → pill CTA → rounded card` 흐름이 거의 같습니다.

# 1. 현재 VTH 기본 디자인은 이거다

기준은 대략 이 패턴입니다.

```text
SiteHeader
↓
brand radial gradient
↓
PageShell
↓
eyebrow
큰 제목
설명
CTA
↓
rounded-3xl 주요 패널
↓
rounded-2xl 목록 카드
```

기본 backdrop도 사실상:

```text
h-64
brand 16%
transparent 68%
```

입니다. Q&A와 장터가 정확히 동일합니다.

그리고 폼은 `/ask`, `/submit`, `/r/[name]/submit`이 비교적 잘 맞습니다. 좁은 `PageShell`을 쓰되 같은 그라데이션과 hero를 유지하고 실제 폼만 rounded-3xl surface에 넣습니다.

**이게 VTH의 기본 디자인이어야 합니다.**

---

# 2. 전체 페이지 감사 결과

| 화면                      | 현재 판정    | 핵심 문제                               |
| ----------------------- | -------- | ----------------------------------- |
| `/questions`            | ✅ 기준     | 그대로 기준화                             |
| `/marketplace`          | ✅ 기준     | 그대로 기준화                             |
| `/businesses`           | ✅ 기준     | Q&A/장터 계열                           |
| `/ask`                  | ✅ 좋음     | narrow form 변형                      |
| `/submit`               | ✅ 좋음     | narrow form 변형                      |
| `/r/[name]/submit`      | ✅ 좋음     | 같은 form 패턴                          |
| `/questions/[id]`       | 🟡 거의 좋음 | 14% detail 변형                       |
| `/marketplace/[id]`     | 🟡 거의 좋음 | Q&A detail과 거의 동일                   |
| `/businesses/[id]`      | 🟡 거의 좋음 | detail 계열                           |
| `/marketplace/new`      | 🟠       | hero까지 카드 안에 넣어 `/ask`와 다름          |
| `/search`               | 🟠       | h-56/14%, hero 높이 별도                |
| `/messages`             | 🟠       | h-56/14%, spacing·폼·모바일 구조 별도       |
| `/u/[username]`         | 🟠       | h-56/12%, 별도 profile visual system  |
| `/friends`              | 🔴       | h-40/10% + 내부에 또 박스형 hero           |
| `/communities`          | 🔴       | page gradient 없음                    |
| `/r/[name]`             | 🔴       | community 목록과 상세 모두 기본 shell 불일치    |
| `/notifications`        | 🔴       | gradient 없음                         |
| `/recommended`          | 🔴       | gradient 없음                         |
| `/settings`             | 🔴       | gradient 없음                         |
| `/marketplace/saved`    | 🔴       | **같은 장터인데 gradient 없음**             |
| `/marketplace/alerts`   | 🔴       | **같은 장터인데 gradient 없음**             |
| `/businesses/new`       | 🔴       | gradient도 form surface도 없음          |
| `/businesses/mine`      | 🔴       | gradient 없음                         |
| `/businesses/[id]/edit` | 🔴       | gradient/form surface 없음            |
| `/post/[id]`            | 🔴       | gradient 없음, feed용 compact card 그대로 |
| `/post/[id]/stats`      | 🔴       | gradient 없음                         |
| `/`                     | 🟡 특수    | feed라 큰 hero는 필요 없지만 공통 wash는 필요    |
| `/login`, `/signup`     | ✅ 예외     | Auth 디자인 유지                         |
| `/onboarding`           | 🟠 예외    | Auth 디자인인데 mobile nav가 노출됨          |
| 404/405                 | ✅ 예외     | 별도 branded error 디자인 적절             |
| `/admin/**`             | 별도       | 통일 대상 아님                            |
| `developers.vth.kr`     | 별도       | 문서 사이트라 통일 대상 아님                    |

특히 **장터 내부에서도** 메인은 기준 디자인인데 Saved/Alerts는 갑자기 평범한 흰 페이지가 됩니다.

비즈니스도 메인은 기준 디자인인데 New/Mine/Edit로 들어가면 배경 wash가 전부 사라집니다.

이건 확실히 잘못됐습니다.

---

# 3. 근본 원인 — `PageShell`만 있고 `PageHero`가 없다

현재 공통 layout에는 사실상 이것밖에 없습니다.

```text
PageShell
 ├─ wide      1240
 ├─ standard  1024
 └─ narrow     768
```

**폭만 공통화했습니다.**

그러니까 페이지마다 직접:

```text
h-40
h-56
h-64

brand 10%
brand 12%
brand 14%
brand 16%

transparent 68%
transparent 70%

space-y-6
space-y-8
space-y-10
```

을 써버린 겁니다.

그래서 Friends는:

```text
h-40 / 10%
```

Messages는:

```text
h-56 / 14%
```

Search는:

```text
h-56 / 14%
```

Q&A/Marketplace는:

```text
h-64 / 16%
```

입니다.

**디자인 시스템이 없는 게 아니라 반쪽만 있는 상태**입니다.

---

# 4. Friends 화면은 특히 잘못됐다

Friends는 page 자체에서 약한 gradient:

```text
h-40
brand 10%
```

를 깔고, 그 안의 `FriendsClient`가 다시:

```text
rounded-2xl
border
bg-card/90
shadow
아이콘
eyebrow
title
description
```

형태의 **별도 hero card**를 만듭니다.

Q&A/장터는 hero를 열린 공간에 둡니다.

따라서 Friends도:

```text
[gradient]

Friends
친구 요청과 친구를 관리하세요
                         ...

[받은 요청] [보낸 요청] [친구]
```

로 가야지,

```text
약한 gradient
┌───────────────┐
│ 또 하나의 hero │
└───────────────┘
```

로 가면 안 됩니다.

---

# 5. 폼 디자인도 primitive부터 서로 다르다

이건 꽤 명확합니다.

### Input

```text
rounded-xl
border-input
bg-background
```

### Textarea

```text
rounded-2xl
border-transparent
bg-input/50
```

같은 Q&A 폼에서:

```text
제목       → Input
내용       → Textarea
```

인데 둘이 아예 다른 디자인입니다.

장터도 똑같습니다.

### 수정해야 함

Input / Select / Textarea 기본 shell을 하나로 맞춰야 합니다.

```text
rounded-xl
border border-input
bg-background
focus:border-ring
focus:ring-3
```

Textarea는 높이만 다르면 됩니다.

---

# 6. Select도 공통 컴포넌트가 없다

현재 `components/ui`에는:

* Button
* Card
* Dropdown
* Input
* Separator
* Textarea

만 있습니다. **Select가 없습니다.**

그래서 Q&A:

```tsx
<select className="flex h-11 w-full rounded-xl ...">
```

장터:

```tsx
<select className="flex h-11 w-full rounded-xl ...">
```

검색 필터:

```tsx
<select className="flex h-10 w-full rounded-xl ...">
```

처럼 매번 복사합니다.

결국 또 달라질 수밖에 없습니다.

**`ui/select.tsx` 하나 필요합니다.**

---

# 7. Card primitive도 대표 화면과 안 맞는다

공용 `Card` 기본값은:

```text
rounded-4xl
shadow-md
ring
```

입니다.

그런데 대표 디자인인 Q&A/장터는:

### 주요 panel

```text
rounded-3xl
border/60
bg-card/75~80
shadow-sm
```

### 목록 item

```text
rounded-2xl
border/60
bg-card/70~75
```

입니다.

그래서 개발 코드가 Card 컴포넌트를 안 쓰고 매번 raw `<section className="rounded-3xl ...">`를 만듭니다.

반대로 Feed PostCard는 공용 Card를 가져와서 다시:

```text
rounded-xl
shadow...
```

로 덮어씁니다.

즉 현재:

```text
Card primitive = 실제 디자인 시스템이 아님
```

입니다.

---

# 8. Radius도 역할별로 정의해야 한다

무조건 전부 같은 radius로 만들 필요는 없습니다.

오히려 이렇게 고정하면 됩니다.

```text
Page/major surface   rounded-3xl
List/content item    rounded-2xl
Input/select         rounded-xl
Feed compact card    rounded-xl
Button/CTA           rounded-4xl (pill)
Avatar               full
```

이렇게 **용도별 규칙**이 있으면 됩니다.

지금은 용도가 아니라 파일마다 결정합니다.

---

# 9. 버튼 터치 크기도 통일이 깨졌다

공용 Button은:

```text
default = h-9  = 36px
sm      = h-8  = 32px
xs      = h-6  = 24px
```

입니다.

그런데 글로벌 CSS에는 이미:

```css
.touch-target {
  min-width: 44px;
  min-height: 44px;
}
```

라고 해놨습니다.

서로 모순입니다.

특히 Messages에서 요청:

```text
Accept  xs
Decline xs
Report  xs
Retry   xs
```

를 실제 액션에 씁니다.

24px 버튼은 모바일에서 너무 작습니다.

### 기준

모바일:

```text
최소 44px
```

데스크톱에서만:

```text
sm 32
xs 24~28
```

허용.

예:

```text
default: min-h-11 sm:h-9
sm:      min-h-11 sm:h-8
```

처럼 해야 합니다.

---

# 10. CTA도 공용 Button을 안 쓰고 계속 재작성한다

공용 Button은 이미 pill입니다.

```text
rounded-4xl
```

그런데 Q&A, 장터, 비즈니스 상세, header 등에서:

```tsx
<Link className="inline-flex ... rounded-full bg-primary ...">
```

를 계속 손으로 만듭니다.

따라서 hover opacity도:

```text
/80
/85
```

섞여 있습니다.

Link CTA는:

```tsx
className={buttonVariants(...)}
```

로 통일해야 합니다.

---

# 11. Empty State도 서로 다르다

Q&A:

```text
rounded-2xl
dashed border
center
py-8
```

장터:

```text
rounded-2xl
dashed border
center
py-10
```

Notifications도 비슷한 dashed card입니다.

그런데 Search의 카테고리 결과 0개는:

```text
plain text
```

입니다.

Messages의 no chats도:

```text
plain text
```

입니다.

Communities는 목록이 0이면 아예 별도 empty UI도 없습니다.

이것도 하나의 `EmptyState` 형태로 맞추는 게 낫습니다.

---

# 12. 네비게이션에는 실제 UX 모순이 있다

### `/`의 이름이 다르다

Desktop 상단:

```text
/ = Popular
```

Mobile 하단:

```text
/ = Home
```

그런데 실제 home page 코드는:

```ts
no ?feed=
→ popular
```

입니다.

따라서 모바일 사용자가 **Home**을 누르면 사실 기본 Popular로 들어갑니다.

이건 고쳐야 합니다.

---

# 13. 메뉴 활성 상태도 desktop/mobile이 다르다

Desktop:

```ts
const active = pathname === href;
```

그래서:

```text
/questions       Q&A active
/questions/123   아무것도 active 아님

/marketplace       active
/marketplace/123   active 아님
```

Mobile은 `startsWith()`를 사용합니다.

또 Community 상세은:

```text
/r/vietnam
```

이라 `/communities`의 하위 URL도 아닙니다.

결과:

```text
Communities → /r/foo
```

에 들어가면 Communities 메뉴 활성 상태가 사라집니다.

### 하나의 route→nav mapping 필요

```text
/communities
/r/*
    → communities

/questions/*
    → questions

/marketplace/*
    → marketplace

/businesses/*
    → businesses
```

Desktop/Mobile 둘 다 **같은 함수**를 써야 합니다.

---

# 14. 모바일 Bottom Nav 7개는 너무 많다

현재:

```text
Home
Communities
Questions
Marketplace
Businesses
Notifications
Profile
```

7개를 64px 높이 한 줄에 넣고 label은 `10px`입니다.

390px 폰에서는 한 항목당 실질적으로 50px 남짓입니다.

이건 지나치게 빽빽합니다.

**5개 정도가 낫습니다.**

VTH라면 예를 들면:

```text
Home
Q&A
Marketplace
Messages
Profile
```

나머지:

```text
Communities
Businesses
Notifications
```

은 header/menu로.

다만 이건 기능 우선순위 결정이라, 그라데이션 통일 작업과 섞지 말고 별도 P1 UX 정리로 하는 게 좋습니다.

---

# 15. Messages 모바일은 구조 자체가 desktop 축소판이다

현재:

```tsx
grid
lg:grid-cols-[20rem_minmax(0,1fr)]
```

입니다.

`lg` 미만에서는:

```text
chat 목록
↓
chat request 목록
↓
대화창
```

으로 그냥 세로로 쌓입니다.

모바일에서 대화를 눌렀으면:

```text
← 상대 이름
----------------
messages
----------------
composer
```

만 보여야 합니다.

즉:

```text
모바일:
selectedRoom 없음 → inbox
selectedRoom 있음 → thread

desktop:
inbox + thread
```

로 바꿔야 합니다.

이건 디자인보다 **실제 UX P0급**으로 봅니다.

---

# 16. Onboarding인데 모바일 메뉴가 뜬다

`OnboardingForm`은 `AuthShell`을 씁니다. 즉 로그인과 같은 집중형 flow입니다.

그런데 `MobileNav`는 숨김 조건이:

```ts
/login
/signup
```

뿐입니다.

Root layout은 admin 외에는 항상 MobileNav를 넣습니다.

따라서 모바일 onboarding에는 bottom nav가 나타납니다.

이건 바로 수정:

```text
/login
/signup
/onboarding
```

모두 auth chrome.

---

# 17. Home은 예외지만 완전히 다른 페이지처럼 보일 필요는 없다

Home은 feed 밀도가 중요하므로 Q&A처럼:

```text
큰 4xl hero
큰 빈 공간
```

까지 넣으면 안 됩니다.

현재 compact heading 자체는 적절합니다.

다만 **공통 PageBackdrop은 깔아야 합니다.**

즉:

```text
Q&A
  backdrop + full hero

Home
  same backdrop + compact feed header
```

이면 됩니다.

---

# 18. Profile도 구조는 유지하고 backdrop만 통일

Profile은 avatar/actions/banner 성격 때문에 Q&A hero를 그대로 쓰면 안 됩니다.

현재 custom ProfileHeader 자체는 유지해도 됩니다.

다만:

```text
h-56 / 12%
```

처럼 별도 배경값을 직접 갖는 건 없애고 공용 backdrop을 쓰는 게 맞습니다.

**동일한 UX ≠ 동일한 레이아웃**입니다.

---

# 19. Auth는 오히려 그대로 두는 게 맞다

Login/Signup/Onboarding은 독립 Auth 디자인을 갖고 있습니다.

금색/빨간 blur와 가운데 card입니다.

이건 Q&A형으로 바꾸면 안 됩니다.

정확한 경계는:

```text
Consumer VTH
→ Q&A/Marketplace visual language

Auth
→ AuthShell

Admin
→ Admin design

Developers
→ Documentation design
```

입니다.

---

# 20. Light theme 토큰도 확인 필요

여기 하나 이상합니다.

앱의 light `:root`에는:

```text
--foreground
--card
--primary
...
```

는 있는데 **`--background` 선언이 없습니다.**

dark에는 있습니다.

그런데:

```css
--color-background: var(--background);

body {
  background-image:
    linear-gradient(... var(--background) ...)
}
```

으로 사용합니다.

repo-local CSS 끝까지 봐도 추가 선언은 없습니다.

`shadcn/tailwind.css` import가 실제 built CSS에서 값을 공급하는지는 별도 확인해야 하므로 **렌더링 장애라고 단정하진 않겠습니다.**

하지만 앱 자체 theme token으로는 잘못된 상태입니다.

특히 light theme intended color가 viewport에서 이미:

```text
#faf9f7
```

로 설정돼 있으니, app `--background`도 명시해야 합니다.

---

# 21. 언어별 글꼴도 체크해야 한다

VTH는 베트남어/한국어 사이트인데 현재:

```ts
Manrope({
  subsets: ["latin", "cyrillic"]
})
```

입니다.

`vietnamese` subset을 명시하지 않았고, Manrope 자체가 한글 글꼴은 아니므로 한국어는 fallback을 사용합니다.

그래서 언어를 바꾸면:

```text
VI → Manrope 중심
KO → fallback 중심
```

으로 자간/글자높이/굵기 느낌이 달라질 가능성이 있습니다.

이건 P2지만 **다국어 UX 일관성** 관점에서는 확인해야 합니다.

---

# 내가 잡은 핵심 원인은 6개다

```text
1. PageShell만 있고 PageBackdrop/PageHero가 없음
2. Card primitive가 실제 대표 디자인과 안 맞음
3. Input/Textarea/Select visual contract가 없음
4. Button와 raw Link/button이 혼재
5. Navigation route semantics를 desktop/mobile이 따로 구현
6. Responsive page behavior를 각 기능이 각자 구현
```

따라서 페이지를 20개씩 일일이 예쁘게 고치는 식으로 하면 **몇 달 뒤 또 똑같이 틀어집니다.**

---

# 수정 구조는 이 정도면 충분하다

새 디자인 프레임워크 필요 없습니다.

딱 이것만 추가/정리하면 됩니다.

```text
components/layout/
├─ page-shell.tsx        기존
├─ page-backdrop.tsx     추가
└─ page-hero.tsx         추가

components/ui/
├─ button.tsx            수정
├─ input.tsx             유지/미세수정
├─ textarea.tsx          Input와 통일
├─ select.tsx            추가
└─ card.tsx              surface 역할 정리
```

## `PageBackdrop`

최대 2개 variant만 허용:

```text
default
  h-64
  brand 16%
  transparent 68%

subtle
  h-64
  brand 14%
  transparent 70%
```

그리고 금지:

```text
h-40
h-56
10%
12%
페이지 내부 직접 radial-gradient
```

---

# `PageHero` 기준

```text
eyebrow
  heading
  text-sm
  brand
  uppercase

title
  text-3xl
  sm:text-4xl
  font-semibold
  tracking-tight

description
  text-sm
  sm:text-base
  muted
  max-w-2xl

actions
  Button / buttonVariants
```

Friends에서 만든 별도 boxed header 같은 것은 없앱니다.

---

# PageShell 폭은 통일하면 안 된다

여기는 현재 설계가 맞습니다.

```text
wide     → Home/Profile/Friends처럼 여러 열
standard → Q&A/Marketplace/Search
narrow   → Form/Detail/Settings
```

**일관성은 모든 페이지 폭을 같게 만드는 것이 아닙니다.**

폭은 목적에 따라 유지하되:

```text
background
hero
typography
surface
controls
interaction
```

를 통일해야 합니다.

---

# 우선순위

## UX-P0

1. **Q&A/장터형 PageBackdrop을 consumer page 기본으로**
2. `PageHero` 공통화
3. `/` = Popular/Home 이름 모순 수정
4. desktop/mobile active-nav 판정 하나로 통합
5. Messages 모바일 single-pane
6. onboarding에서 mobile nav 제거
7. 모바일 버튼 최소 44px

## UX-P1

8. Input/Textarea 통일
9. Select primitive 추가
10. Link CTA → `buttonVariants`
11. Card role 통일
12. EmptyState 통일
13. Friends boxed hero 제거
14. 장터 Saved/Alerts, Business New/Mine/Edit 등의 빠진 backdrop 전부 복구

## UX-P2

15. light `--background` 명시
16. Vietnamese/Korean font stack 검토
17. hover/focus/loading/error 상태 미세 통일

---

## 결론

사용자가 느낀 게 정확합니다.

**Q&A나 장터를 보면 “이게 VTH구나” 싶은데 다른 페이지로 가면 각각 다른 사람이 만든 사이트처럼 바뀝니다.**

현재 가장 큰 문제는 디자인 퀄리티 자체가 아닙니다.

> **이미 괜찮은 VTH 디자인이 있는데 그것을 기본 규칙으로 만들지 않은 것**

입니다.

백엔드 때 했던 것과 똑같이 가면 됩니다.

```text
백엔드:
여러 구조 제거 → D1 중심 하나로 통일

UX:
여러 페이지별 스타일 제거
→ Q&A/Marketplace 중심 visual contract 하나로 통일
```

**Q&A·장터·비즈니스의 좋은 부분은 건드리지 말고, 그것을 공용 primitive로 끌어올린 뒤 나머지 화면을 그 규칙으로 수렴시키는 것이 맞습니다.**
