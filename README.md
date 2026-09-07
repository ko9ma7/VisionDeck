# VisionDeck 3.0 — Local-first Visual AI Workbench

VisionDeck은 **API 키가 없어도 실제 파일을 처리하는** 브라우저 기반 OCR/Vision 워크벤치입니다. 기본 기능은 Tesseract.js + PDF.js로 로컬에서 실행하고, 사용자가 원할 때만 Transformers.js 로컬 AI 또는 OpenAI-compatible Cloud AI를 추가합니다.

## 핵심 원칙

- Demo 고정 결과 없음
- 이미지/스크린샷: 브라우저에서 실제 Tesseract OCR
- PDF: PDF.js로 실제 페이지 렌더링 후 OCR
- Video: 브라우저에서 대표 프레임 추출 후 OCR/Vision
- Compare: 원본/대비/이진화 Tesseract 파이프라인의 실제 결과 비교
- Confidence: Tesseract 내부 confidence로 명확히 표시 (정답 정확도와 다름)
- Consensus: 결과 간 토큰 overlap/diff이며 정확도라고 부르지 않음
- Local Vision/TrOCR: Transformers.js 모델을 선택적으로 다운로드
- Cloud AI: API 설정 후에만 파일 전송
- API Key는 소스/LocalStorage에 저장하지 않음

## 기본 사용

```bash
npm run dev
```

브라우저에서 `http://localhost:5173` 접속 후 샘플 또는 자신의 파일을 넣고 `Run local test`를 누릅니다.

`npm install`은 필요하지 않습니다. 앱 코드는 정적이며 오픈소스 런타임/모델은 브라우저가 CDN에서 내려받습니다.

## Build

```bash
npm run check
npm run build
```

`dist/`가 생성됩니다.

## Local Core

### Tesseract.js 7

- `kor+eng` 언어
- Original / Contrast / Threshold 3개 실제 파이프라인
- `blocks` 출력으로 word bounding box 표시
- 첫 실행 시 WASM 및 언어 데이터 다운로드

### PDF.js

- PDF를 브라우저에서 Canvas로 렌더링
- 기본 비교에서는 최대 3페이지를 처리해 과도한 메모리 사용을 막음
- 페이지 탐색 가능

### Table / Document

AI 없이도 기본 테스트가 되도록 OCR 결과에서 규칙 기반 후처리를 수행합니다.

- Table: 공백/숫자 열 패턴으로 행·열 후보 추출 → Markdown
- Document: 날짜, 금액, 전화, 이메일, URL, 숫자 값 → JSON

이는 로컬 기본 기능이며, 복잡한 표/문서는 Cloud/Local AI를 추가하면 품질을 높일 수 있습니다.

## Optional Local AI

상단 `Local AI`에서 모델을 준비합니다.

- `Xenova/vit-gpt2-image-captioning`: 브라우저 Image Caption
- `Xenova/trocr-small-printed`: 영문 인쇄물 TrOCR

Transformers.js는 WebGPU가 있으면 우선 사용하고, 아니면 WASM을 사용합니다. 모델은 수백 MB 이상일 수 있습니다.

## Optional Cloud AI

상단 톱니바퀴에서 OpenAI-compatible endpoint를 설정합니다.

기본 예시 모델 ID:

- `glm-ocr`
- `deepseek-ocr-2`
- `dots.mocr`
- `qwen3.5-0.8b`

Cloud 모델을 체크하기 전에는 파일이 외부로 전송되지 않습니다. 브라우저에서 외부 API를 직접 호출하므로 해당 API가 CORS를 허용해야 합니다. 비밀 API 키를 공개 GitHub Pages에서 장기간 보관해야 한다면 Serverless Proxy를 사용하세요.

## GitHub Pages

Repository를 만들고 이 프로젝트를 push한 뒤:

1. `Settings → Pages`
2. Source를 `GitHub Actions`로 선택
3. `main` 브랜치에 push
4. `.github/workflows/deploy.yml`가 `npm run check → npm run build → deploy-pages` 실행

모든 내부 asset 경로는 상대 경로라 `https://USERNAME.github.io/REPOSITORY/`에서도 동작합니다.

## 구조

```text
/
├─ index.html
├─ src/
│  ├─ config.js
│  ├─ main.js
│  ├─ styles.css
│  ├─ engines/
│  │  ├─ tesseract-engine.js
│  │  ├─ pdf-engine.js
│  │  ├─ transformers-engine.js
│  │  └─ cloud-engine.js
│  └─ utils/
├─ public/
│  ├─ sample-document.png
│  ├─ favicon.svg
│  ├─ manifest.webmanifest
│  ├─ sw.js
│  └─ 404.html
├─ scripts/
├─ .github/workflows/deploy.yml
└─ README.md
```

## 주의

- “Tesseract confidence”는 Ground Truth 기반 정확도가 아닙니다.
- 실제 정확도(CER/WER)를 표시하려면 정답 텍스트를 별도로 넣는 Benchmark 기능을 추가해야 합니다.
- 브라우저 로컬 모델은 메모리/VRAM 한계가 있으므로 대형 모델은 순차 실행을 권장합니다.
- PDF는 보안상 브라우저에서 렌더링 후 이미지로 처리합니다.

## License

VisionDeck 코드는 MIT. 사용되는 오픈소스 엔진/모델은 각 프로젝트/모델의 라이선스를 따릅니다.
