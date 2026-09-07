# AI Expert Default Storyboard

다음 입력을 기준으로 한 v9 기본 연출 의도입니다.

```text
https://ko9ma7.github.io/motionframe/
https://ko9ma7.github.io/motionframe/#capture
https://ko9ma7.github.io/motionframe/#templates
https://ko9ma7.github.io/motionframe/#studio
```

예상 기본 길이: 약 16~18초

| Beat | Chapter | Target | Motion | Purpose |
|---|---|---|---|---|
| 01 | Intro | 전체 | Reveal | 제품 화면의 맥락을 1초 안에 확립 |
| 02 | Intro | H1 | Punch Zoom | 핵심 가치 제안을 강하게 읽힘 |
| 03 | Intro | Hero product preview | Spotlight Push | 실제 제품/UI가 있다는 신호 |
| 04 | Intro | URL로 시작하기 | Cursor Impact → Page Impact | 다음 단계의 원인 제공 |
| 05 | #capture | section title | Chapter Slam | 새 단계 진입을 명확히 구분 |
| 06 | #capture | URL input surface | Spotlight Push | 사용자가 무엇을 넣는지 보여줌 |
| 07 | #capture | Auto Director button | Cursor Impact | 입력 다음 행동을 설명 |
| 08 | #capture | 모션 스타일 nav | Cursor Impact → Page Impact | 다음 챕터 연결 |
| 09 | #templates | section title | Chapter Slam | 스타일 선택 단계임을 명시 |
| 10 | #templates | Impact Product Flow | Sweep / Punch | 대표 템플릿 하나만 강조 |
| 11 | #templates | 편집기 nav | Cursor Impact → Page Impact | 실제 편집 단계 연결 |
| 12 | #studio | section title | Chapter Slam | 편집 단계 진입 |
| 13 | #studio | live preview | Arc Orbit / Spotlight | 최종 제작 화면을 가장 크게 보여줌 |
| 14 | #studio | 전체 | Resolve | 영상 마무리 |

## Director rules

1. 사용자가 여러 URL을 주면 입력 순서를 스토리 순서로 우선합니다.
2. origin + pathname이 같고 hash만 다른 URL은 같은 페이지를 반복 분석하지 않고 각각의 viewport chapter로 취급합니다.
3. 각 chapter에서 기본 선택은 2~4개입니다. DOM 요소를 많이 보여주는 것이 목적이 아닙니다.
4. 다음 입력 URL을 가리키는 실제 href가 있으면 그 링크/버튼을 transition trigger로 사용합니다.
5. 현재 viewport 밖의 요소는 기본 선택하지 않습니다.
6. 제목 → UI surface → action 순서를 우선합니다.
7. navigation은 목적 없이 보여주지 않고 다음 chapter를 여는 경우에만 사용합니다.
8. 같은 기능을 가리키는 중복 CTA는 하나만 사용합니다.
9. 기본 Impact 스타일은 120~194% adaptive zoom 범위와 overshoot/recoil을 사용합니다.
10. Scene 좌표는 결과물이며, Storyboard가 편집의 최상위 레이어입니다.
