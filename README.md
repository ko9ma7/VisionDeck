# MotionFrame Studio v9

여러 웹 URL을 **입력 순서대로 제품 데모의 챕터**로 해석하고, 각 화면에서 실제로 보이는 제목·제품/UI 표면·버튼만 골라 강한 카메라 모션과 클릭을 연결한 뒤 WebM으로 렌더링하는 GitHub Pages 정적 웹앱입니다.

## v9에서 바뀐 기준

v8까지의 문제는 페이지 전체 DOM을 너무 많이 선택해 `Scene → 좌표`가 먼저 나왔다는 점입니다. v9는 다음 순서로 동작합니다.

```text
URL 목록
  ↓
각 URL을 하나의 Chapter로 해석
  ↓
같은 문서의 #hash URL은 중복 페이지가 아니라 별도 Viewpoint로 처리
  ↓
현재 viewport에서 실제로 보이는 DOM만 선택
  ↓
Chapter당 핵심 2~4개 자동 선택
  - H1 / section title
  - product UI / canvas / preview / input surface
  - primary action
  - 다음 URL을 가리키는 menu / CTA
  ↓
AI Storyboard
  ↓
Punch / Chapter Slam / Spotlight / Cursor Impact / Page Impact
  ↓
Scene + camera keyframes
  ↓
Sound + WebM
```

## 예: MotionFrame 자체를 입력할 때

```text
https://ko9ma7.github.io/motionframe/
https://ko9ma7.github.io/motionframe/#capture
https://ko9ma7.github.io/motionframe/#templates
https://ko9ma7.github.io/motionframe/#studio
```

기본 Storyboard는 대략 다음처럼 압축됩니다.

```text
01 Intro 전체 Reveal
02 Hero H1 Punch
03 Hero 제품 프리뷰 Spotlight
04 "URL로 시작하기" Cursor Click → #capture
05 #capture 제목 Chapter Slam
06 URL 입력 영역 Spotlight
07 Auto Director 버튼 Cursor Impact
08 "모션 스타일" Click → #templates
09 #templates 제목 Chapter Slam
10 Impact Product Flow 집중
11 "편집기" Click → #studio
12 #studio 제목 Chapter Slam
13 실시간 미리보기 Orbit
14 Resolve
```

기존처럼 같은 페이지의 H1과 버튼을 모든 hash URL에서 반복하지 않습니다.

## 핵심 기능

### AI Story capture

기본 캡처 방식은 `AI 쇼릴 · URL별 뷰포인트`입니다. hash URL을 열면 해당 위치로 스크롤된 viewport를 캡처하고 DOM 분석 결과에 `scrollY`도 저장합니다.

따라서 `#capture`의 화면을 분석할 때 문서 맨 위 H1을 다시 선택하지 않고 실제 #capture 화면 안에 보이는 요소를 기준으로 판단합니다.

### Chapter-first Director

Auto Director 상단에는 원본 DOM 수백 개를 바로 펼치지 않습니다. 먼저 챕터별 AI 추천 항목만 보여줍니다.

원본 후보는 `고급 · 분석 후보 보기`를 열었을 때만 표시됩니다.

### Strong motion grammar

기본 Impact Product Flow는 다음 모션을 사용합니다.

- Reveal
- Punch Zoom
- Chapter Slam
- Spotlight Push
- Sweep / Arc Orbit
- Cursor Impact
- Page Impact
- Resolve

Page Impact는 이전 화면이 빠르게 뒤로 빠지고 다음 챕터가 크게 들어온 뒤 정착하도록 구성되어 있습니다.

### Sound

- Ambient Flow
- Soft Corporate
- Lo-fi Product
- Minimal Keys
- Glass Motion
- Focus Drive
- Launch Drive
- 사용자 MP3/WAV/OGG
- click accent
- punch / chapter / spotlight whoosh
- page transition whoosh

오디오는 Web Audio track으로 만들어 Canvas video track과 함께 MediaRecorder에 전달됩니다.

### Editor

AI Storyboard를 Scene으로 변환한 뒤 필요한 장면만 세밀하게 수정합니다.

- 직선 / 곡선 / 자유 path
- 시작/끝 zoom
- cursor
- transition
- 16:9 / 9:16 / 1:1
- 720p / 1080p

## URL capture

공개 웹사이트는 Microlink browser capture API를 우선 사용합니다. 브라우저 함수는 1024-byte 제한 안에서 다음을 수집합니다.

- viewport/document size
- scrollX / scrollY
- H1/H2/H3
- navigation links
- buttons / links
- image / video / canvas / textarea
- preview / browser-like product surfaces
- element bounding rect
- href / hash target coordinates

Microlink 실패 시 mShots image fallback을 시도합니다. fallback은 DOM geometry가 없으므로 자동 연출 정확도는 낮아집니다.

## Local verification

Dependency 설치가 필요 없습니다.

```bash
node scripts/verify.mjs
```

검증에는 4개의 같은-document hash URL을 넣었을 때:

- 4 chapters 유지
- 11~16 cinematic beats로 압축
- 3개의 chapter navigation 연결
- #capture / #templates / #studio에서 각각 실제 viewport title 선택
- offscreen root H1 재선택 방지
- impact camera / sound / WebM 경로

가 포함됩니다.

## GitHub Pages

1. 프로젝트 파일 전체를 repository root에 업로드합니다.
2. `main` branch에 push합니다.
3. GitHub → Settings → Pages → Source를 `GitHub Actions`로 지정합니다.
4. 포함된 workflow가 검증 후 Pages artifact를 배포합니다.

```text
https://USERNAME.github.io/REPOSITORY/
```

## Important limitation

GitHub Pages 자체는 다른 origin의 DOM을 직접 읽을 수 없습니다. 공개 URL DOM geometry를 얻으려면 browser capture API가 필요합니다. 로그인 session을 포함한 완전 자동 클릭/탐색까지 필요하면 capture 계층만 Playwright/Chromium serverless worker로 분리하는 것이 적합합니다.

## License

MIT
