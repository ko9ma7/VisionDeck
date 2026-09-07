# VisionDeck

**문서 하나 · 여러 AI · 가장 좋은 결과**

PDF, 이미지, 스크린샷을 한 번 넣고 여러 OCR/Vision 모델의 결과를 나란히 비교해 가장 좋은 결과를 선택하는 정적 웹앱입니다.

## 무엇을 하는 앱인가요?

1. 파일을 넣습니다.
2. `텍스트 읽기 / 표 추출 / 정보 추출 / 이미지 이해` 중 목적을 고릅니다.
3. GLM-OCR, DeepSeek OCR 2, dots.mocr, Qwen 계열 모델을 같은 입력으로 비교합니다.
4. 결과·처리시간·비용을 보고 하나를 선택하거나 JSON/CSV로 내보냅니다.

처음 실행하면 Demo Mode라서 API Key 없이 전체 흐름을 체험할 수 있습니다. `실제 AI 연결`에서 OpenAI-compatible Gateway를 설정하면 로컬 이미지에 대해 Live 요청을 보낼 수 있습니다.

## Features

- Drag & Drop / File picker
- Image / PDF / Video preview
- Auto Router
- OCR / Table / Document / Vision task selection
- Multi-model comparison
- Demo benchmark scoring
- Consensus difference review
- JSON / CSV export
- Light / Dark theme
- Responsive UI
- GitHub Pages deployment workflow

## Tech Stack

- HTML5
- CSS3
- JavaScript ES Modules
- Node.js build scripts (external dependencies 없음)

## Local Development

```bash
npm run dev
```

`http://localhost:5173/` 접속.

## Check & Build

```bash
npm run check
npm run build
```

빌드 결과는 `dist/`에 생성됩니다.

## GitHub Pages Deployment

1. GitHub에 새 Repository를 만듭니다.
2. 프로젝트 전체를 `main` 브랜치에 push합니다.
3. Repository → **Settings → Pages**로 이동합니다.
4. **Source: GitHub Actions**를 선택합니다.
5. 이후 `main` push마다 `.github/workflows/deploy.yml`이 자동으로 배포합니다.

GitHub Actions의 `GITHUB_REPOSITORY_OWNER`와 `GITHUB_REPOSITORY`를 사용해 canonical URL, OG URL, sitemap URL을 자동 생성합니다.

## Live Gateway

정적 GitHub Pages에 API Secret을 하드코딩하지 않습니다. 입력한 API Key는 페이지 메모리에만 유지되고 새로고침하면 사라집니다.

공개 배포에서 장기 비밀 키가 필요하면 Cloudflare Workers, Vercel Functions 등의 Serverless Proxy를 앞에 두는 방식을 권장합니다.

## Custom Domain

GitHub Pages에서 Custom Domain을 설정한 뒤 `SITE_URL` 환경변수를 빌드에 전달하도록 workflow를 수정하면 canonical/OG/sitemap 주소도 해당 도메인으로 생성할 수 있습니다.

## License

MIT로 공개하기 적합한 구조입니다. 실제 공개 전 원하는 라이선스를 `LICENSE` 파일로 추가하세요.
