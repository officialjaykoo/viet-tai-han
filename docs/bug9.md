# bug9.md — Global Layout Tier & Content Density Consistency

## 목적

VTH 주요 페이지의 레이아웃 폭과 콘텐츠 밀도를 통일한다.

이번 Bug9에서는 gradient는 작업 대상이 아니다.

현재 리로드 후 gradient가 정상 표시되고 있으므로:

> **gradient 관련 코드는 건드리지 마라.**

이번 작업의 핵심은 두 가지다.

1. 페이지 폭을 `Wide / Standard / Compact` 3단계로 통일
2. 게시물의 `좋아요 / 댓글 / 공유` 영역이 세로로 너무 넓은 문제를 줄여 전체 feed density를 개선

---

# 1. 최종 Page Size Tier

Desktop은 3단계만 사용한다.

```text
Wide
Standard
Compact
```

Mobile은 각 tier가 공통 responsive 규칙으로 수렴한다.

즉:

```text
Desktop
├─ Wide
├─ Standard
└─ Compact

Mobile
└─ Shared responsive layout
```

---

# 2. 최종 페이지 배정

## Wide

```text
홈
인기
```

## Standard

```text
커뮤니티
질문답변
장터
추천
메시지
프로필
```

## Compact

```text
설정
글작성
알림
```

이 배정을 canonical product rule로 본다.

임의로 다른 tier를 만들지 마라.

---

# 3. PageShell 통일

현재 top-level 페이지에 직접 박혀 있는:

```text
max-w-*
w-[...]
mx-auto
px-*
container
```

를 전수 조사한다.

가능하면 다음처럼 공통화한다.

```tsx
<PageShell size="wide">
<PageShell size="standard">
<PageShell size="compact">
```

또는 프로젝트 구조상 더 단순하면:

```css
.page-wide
.page-standard
.page-compact
```

중 하나로 통일한다.

두 체계를 중복으로 만들지 마라.

---

# 4. Width 값을 새로 임의 정의하지 마라

현재 사용자가 이미 만족하는 페이지를 기준으로 actual width를 추출한다.

## Wide 기준

```text
홈
인기
```

의 현재 폭을 기준으로 결정.

확인:

```text
max-width
horizontal padding
content/sidebar ratio
grid gap
```

둘이 다르면 한 값으로 통일.

---

## Standard 기준

기준:

```text
커뮤니티
질문답변
장터
추천
```

현재 이쪽 크기가 만족스럽다.

이 페이지들을 비교해 canonical Standard width를 정한다.

그리고:

```text
메시지
프로필
```

에도 같은 Standard PageShell을 적용한다.

---

## Compact 기준

```text
설정
글작성
알림
```

은 form/readability 중심이므로 Standard보다 좁게 한다.

이 셋은 같은 Compact shell을 사용한다.

---

# 5. Mobile

390px 등 모바일에서는:

```text
Wide
Standard
Compact
```

구분 때문에 horizontal width가 달라지지 않게 한다.

모바일에서는 공통:

```text
horizontal padding
safe area
vertical spacing
```

을 사용한다.

금지:

```text
Wide mobile
Compact mobile
```

같이 별도 모바일 폭 체계를 만드는 것.

---

# 6. Gradient는 Bug9 범위에서 제외

다음 작업 금지:

```text
gradient 추가
gradient 제거
gradient 변경
gradient 색상 수정
gradient hero 높이 수정
```

현재 정상 표시되는 gradient를 그대로 유지한다.

Bug9의 목적은 layout/density다.

---

# 7. 좋아요 / 댓글 / 공유 영역 세로 밀도 축소

현재 게시물 하단 action 영역이 세로로 너무 넓다.

대상:

```text
좋아요
댓글
공유
```

이 action row가 게시물 하나당 많은 vertical space를 차지한다.

이번 Bug9에서 반드시 줄인다.

---

# 8. 무엇을 줄일 것인가

다음 요소를 실제 소스에서 확인한다.

```text
action row top padding
action row bottom padding
button vertical padding
button min-height
icon size
text line-height
button gap
row gap
separator margin
count row spacing
```

현재보다 compact하게 만든다.

---

# 9. 목표

게시물 한 개의 구조가 현재:

```text
본문
↓ 큰 여백
좋아요/댓글/공유
↓ 큰 여백
다음 게시물
```

처럼 느껴진다면:

```text
본문
↓ 적당한 여백
좋아요 · 댓글 · 공유
↓ 적당한 여백
다음 게시물
```

정도로 조밀하게 만든다.

목표는 SNS feed density다.

---

# 10. Action row 높이

`좋아요 / 댓글 / 공유` 버튼은 접근성을 유지하되 시각적으로 너무 높지 않게 한다.

Desktop에서는 실제 button visual height를 줄일 수 있다.

단 모바일 touch target을 망치지 마라.

권장 원칙:

```text
Desktop
→ visual compact

Mobile
→ minimum 44px touch target 유지 가능
```

필요하면 실제 clickable area와 visual padding을 분리한다.

---

# 11. 아이콘 크기

현재 icon이 과도하게 크다면 한 단계 줄인다.

예:

```text
20–22px
→ 18px 전후
```

단 정확한 값은 현재 디자인 시스템 기준으로 맞춘다.

임의로 모든 아이콘을 한꺼번에 작게 만들지 마라.

대상은 post action row.

---

# 12. Text / line-height

좋아요/댓글/공유 text가:

```text
text-base
leading-loose
```

처럼 과도하게 크다면 줄인다.

목표:

```text
compact action control
```

예:

```text
text-sm
leading-tight/normal
```

수준을 검토.

---

# 13. Action button 간격

현재:

```text
justify-around
large gap
large internal padding
```

때문에 퍼져 보인다면 정리한다.

가로 폭은 자연스럽게 분배하되 세로 padding을 줄이는 것이 우선이다.

가로 폭까지 과도하게 좁게 만들지 마라.

---

# 14. 좋아요 수 / 댓글 수 영역도 함께 확인

게시물에 별도:

```text
좋아요 12
댓글 4
```

카운트 row가 있다면 action row와의 vertical gap을 줄인다.

예:

```text
count row
큰 margin
action row
```

구조가 있으면 compact하게 한다.

---

# 15. 댓글 미리보기/댓글 버튼 사이 여백

댓글 preview 또는 comment count와:

```text
댓글 버튼
공유 버튼
```

사이의 vertical spacing도 확인한다.

같은 정보 영역인데 section처럼 크게 떨어져 있으면 줄인다.

---

# 16. 게시물 card 자체 vertical density

좋아요/댓글/공유만 줄였는데 여전히 게시물이 너무 길면 다음도 확인한다.

```text
post footer padding
content → footer margin
footer → card bottom padding
card → next card gap
```

하지만 본문 readability까지 희생하지 마라.

우선순위는:

```text
action/footer area compact
```

이다.

---

# 17. 적용 범위

동일 Post UI를 사용하는 모든 feed에서 같은 action density를 사용해야 한다.

최소 확인:

```text
홈
인기
커뮤니티 feed
질문답변 관련 post card
프로필 post tab
추천 feed
```

같은 Post component를 재사용한다면 공통 component 하나를 고친다.

페이지마다 별도 padding override를 추가하지 마라.

---

# 18. Like / Comment / Share 공통 component 조사

먼저 repo 전체에서 다음을 검색한다.

```text
like
comment
share
PostActions
PostFooter
PostCard
Vote
Reaction
```

실제 canonical action component를 찾는다.

같은 역할의 UI가 여러 개 중복 구현되어 있다면:

```text
canonical PostActions
```

로 통합 가능한지 검토한다.

단 기능 로직을 대규모 재작성하지 마라.

---

# 19. 기능 로직은 변경 금지

이번 작업은 visual density다.

다음은 손대지 않는다.

```text
좋아요 mutation
댓글 mutation
댓글 count
share behavior
optimistic update
notification
permissions
moderation
```

CSS/layout만 수정한다.

---

# 20. Wide 페이지

## 홈

```text
PageShell = Wide
```

현재 만족하는 전체 폭 유지.

post action density는 compact하게 적용.

---

## 인기

```text
PageShell = Wide
```

홈과 동일 tier.

post action density도 동일.

---

# 21. Standard 페이지

## 커뮤니티

```text
Standard
```

현재 만족 크기 유지.

---

## 질문답변

```text
Standard
```

현재 만족 크기 유지.

---

## 장터

```text
Standard
```

---

## 추천

```text
Standard
```

---

## 메시지

```text
Standard
```

메시지는 Compact가 아니다.

PageShell width = Standard.

메신저 내부 column/bubble density는 별도 compact 조정 가능하지만 이번 Bug9의 필수 작업은 아니다.

Bug8 realtime logic 절대 변경 금지.

---

## 프로필

```text
Standard
```

프로필도 Compact가 아니다.

다만 profile 내부가 과도하게 크다면:

```text
avatar
header padding
stats gap
action buttons
tabs
```

정도를 가볍게 compact할 수 있다.

Bug7 relationship logic은 수정 금지.

---

# 22. Compact 페이지

## 설정

```text
Compact
```

forms가 너무 넓어지지 않게 한다.

---

## 글작성

```text
Compact
```

editor/form 중심 폭.

---

## 알림

```text
Compact
```

notification list readability 중심.

---

# 23. 공통 spacing token

Top-level page에서 반복되는:

```text
py-*
px-*
gap-*
space-y-*
```

를 semantic한 기준으로 통일한다.

예:

```text
page top spacing
section spacing
card spacing
action spacing
```

같은 역할이면 같은 값을 사용.

---

# 24. Card spacing

같은 PostCard에서:

```text
p-4
p-5
py-6
```

등이 viewport/page마다 다르게 override되고 있는지 확인한다.

가능하면 card 내부 padding을 하나의 canonical style로 유지.

---

# 25. PostActions visual target

최종적으로 action 영역은 다음처럼 보여야 한다.

```text
┌─────────────────────────┐
│ post content            │
│                         │
│ 좋아요  댓글  공유      │
└─────────────────────────┘
```

현재처럼:

```text
┌─────────────────────────┐
│ post content            │
│                         │
│                         │
│    좋아요               │
│                         │
│    댓글                 │
│                         │
│    공유                 │
│                         │
└─────────────────────────┘
```

같이 세로 공간을 과도하게 쓰지 않아야 한다.

실제 버튼은 한 row를 유지한다.

---

# 26. Desktop density target

1440px / 1024px에서:

```text
Post footer
= 현재보다 명확히 얇아야 함
```

사용자가 눈으로 봐도 게시물 하나당 vertical height가 줄어야 한다.

단 본문 영역을 줄여 억지로 높이를 줄이지 마라.

---

# 27. Mobile density target

390px에서는:

```text
action row visual compact
touch target usable
text/icon overlap 없음
```

이어야 한다.

버튼이 너무 작아져 누르기 어려우면 실패다.

---

# 28. CSS hardcoding 정리

repo에서 다음을 전수 조사:

```text
max-w-
w-[...]
px-
py-
gap-
space-y-
min-h-
h-
```

특히 top-level page shell과 PostActions에서 hardcoded 값이 제각각인지 확인한다.

공통화 가능한 값만 정리.

---

# 29. 구현 우선순위

## P0

```text
1. current page width 전수 조사
2. Wide canonical 값 결정
3. Standard canonical 값 결정
4. Compact canonical 값 결정
5. PageShell 공통화
6. 페이지 tier 적용
```

## P0

```text
7. canonical PostActions component 찾기
8. 좋아요/댓글/공유 세로 padding 축소
9. icon/text/line-height 점검
10. footer margin/padding 축소
11. 모든 feed에 동일 적용
```

## P1

```text
12. card spacing 통일
13. top-level page spacing 통일
14. profile 내부 과도한 spacing 보정
```

---

# 30. 반드시 하지 말 것

```text
gradient 수정
gradient 제거
gradient 추가
new color palette
post 기능 변경
like logic 변경
comment logic 변경
share logic 변경
DM realtime 변경
profile relationship 변경
settings persistence 변경
```

---

# 31. Responsive 검증

반드시:

```text
390px
768px
1024px
1440px
```

확인.

---

# 32. Page Tier 검증표

| Page          | Tier     |
| ------------- | -------- |
| Home          | Wide     |
| Popular       | Wide     |
| Communities   | Standard |
| Q&A           | Standard |
| Marketplace   | Standard |
| Recommended   | Standard |
| Messages      | Standard |
| Profile       | Standard |
| Settings      | Compact  |
| Create Post   | Compact  |
| Notifications | Compact  |

---

# 33. Post Action 검증표

모든 relevant feed에서 확인:

| Check                         | Result |
| ----------------------------- | ------ |
| 좋아요 버튼 세로 padding 축소          | PASS   |
| 댓글 버튼 세로 padding 축소           | PASS   |
| 공유 버튼 세로 padding 축소           | PASS   |
| icon size 균형                  | PASS   |
| text line-height 균형           | PASS   |
| footer top/bottom gap 축소      | PASS   |
| mobile touch usability        | PASS   |
| functional behavior unchanged | PASS   |

---

# 34. 완료 보고

완료 후 반드시 다음을 보고한다.

## Width tier

```text
Wide actual max-width:
Standard actual max-width:
Compact actual max-width:
Mobile horizontal padding:
```

## Page assignment

각 페이지 최종 tier.

## PostActions

다음 before → after를 구체적으로 적는다.

```text
button min-height
vertical padding
icon size
font size
line-height
footer padding
content→action gap
action→card-bottom gap
```

## Shared components

```text
PageShell
PostActions
PostCard
```

중 실제 수정/통합한 것.

## Removed one-off CSS

제거한 hardcoded width/padding.

## Responsive

```text
390
768
1024
1440
```

결과.

## Regression

좋아요/댓글/공유 기능 동작 여부.

---

# 최종 성공 조건

페이지 폭은 정확히:

```text
Wide
= 홈 / 인기

Standard
= 커뮤니티 / 질문답변 / 장터 / 추천 / 메시지 / 프로필

Compact
= 설정 / 글작성 / 알림
```

으로 통일되어야 한다.

그리고 모든 Post 계열 UI에서:

> **좋아요 / 댓글 / 공유 footer가 현재보다 확실히 얇고 조밀해져야 한다.**

단 기능성과 모바일 터치성은 유지해야 한다.

Gradient는 이번 Bug9에서 전혀 건드리지 않는다.
