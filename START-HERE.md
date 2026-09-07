# MotionFrame Studio v9 시작하기

## GitHub Pages 배포

1. `motionframe-studio-v9` 폴더 안의 파일 전체를 GitHub repository root에 올립니다.
2. GitHub `Settings → Pages`로 이동합니다.
3. Source를 `GitHub Actions`로 선택합니다.
4. Actions의 `Deploy MotionFrame Studio to GitHub Pages`가 성공하면 배포 완료입니다.

## 가장 먼저 시험할 입력

아래 4줄을 그대로 넣습니다.

```text
https://ko9ma7.github.io/motionframe/
https://ko9ma7.github.io/motionframe/#capture
https://ko9ma7.github.io/motionframe/#templates
https://ko9ma7.github.io/motionframe/#studio
```

설정은 기본값 그대로 두는 것을 권장합니다.

```text
캡처 방식: AI 쇼릴 · URL별 뷰포인트
페이지 범위: 입력 URL 우선 · 최대 5개
페이지당 요소: AI 추천 6개
모션 스타일: Impact Product Flow
사운드: Launch Drive
```

`Auto Director로 쇼릴 만들기`를 누릅니다.

정상이라면 Auto Director에 수십 개의 좌표 장면이 아니라 **4개의 Chapter 카드와 약 12~14개의 Story beat**가 먼저 나타납니다.

## 이전 v8 프로젝트가 남아 있다면

브라우저 LocalStorage에 예전 Scene이 남아 있을 수 있습니다. v9 배포 후 새 URL Storyboard를 만들면 v9 Director 장면으로 교체됩니다. 테스트 데이터가 필요 없다면 `초기화` 후 다시 생성하는 것이 가장 확실합니다.

## 검증

Node가 있는 환경에서는:

```bash
node scripts/verify.mjs
```

을 실행할 수 있습니다. npm install은 필요 없습니다.
