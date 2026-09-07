export const motionPresets = {
  custom: { label: '직접 설정' },
  overview: { label: '전체 → 중심', startZoom: 100, endZoom: 116, startX: 50, startY: 50, endX: 50, endY: 48, cursorEnabled: false },
  heroDive: { label: 'Hero Dive', startZoom: 100, endZoom: 148, startX: 50, startY: 22, endX: 50, endY: 28, cursorEnabled: false },
  focus: { label: '디테일 포커스', startZoom: 108, endZoom: 158, startX: 50, startY: 50, endX: 68, endY: 48, cursorEnabled: true, cursorX: 69, cursorY: 50 },
  pullout: { label: '줌아웃', startZoom: 152, endZoom: 100, startX: 56, startY: 48, endX: 50, endY: 50, cursorEnabled: false },
  panRight: { label: '좌 → 우', startZoom: 130, endZoom: 130, startX: 25, startY: 50, endX: 75, endY: 50, cursorEnabled: false },
  panLeft: { label: '우 → 좌', startZoom: 130, endZoom: 130, startX: 75, startY: 50, endX: 25, endY: 50, cursorEnabled: false },
  scrollDown: { label: '위 → 아래 스크롤', startZoom: 112, endZoom: 112, startX: 50, startY: 12, endX: 50, endY: 88, cursorEnabled: false },
  scrollUp: { label: '아래 → 위 스크롤', startZoom: 112, endZoom: 112, startX: 50, startY: 88, endX: 50, endY: 12, cursorEnabled: false },
  cursorChase: { label: '커서 추적', startZoom: 112, endZoom: 144, startX: 38, startY: 40, endX: 70, endY: 58, cursorEnabled: true, cursorX: 72, cursorY: 60 },
  snapDetail: { label: '빠른 디테일', startZoom: 100, endZoom: 178, startX: 50, startY: 50, endX: 62, endY: 45, cursorEnabled: true, cursorX: 64, cursorY: 47 },
  calmFloat: { label: '잔잔한 플로트', startZoom: 108, endZoom: 118, startX: 46, startY: 48, endX: 54, endY: 52, cursorEnabled: false },
  mobileFocus: { label: '모바일 포커스', startZoom: 104, endZoom: 134, startX: 50, startY: 45, endX: 50, endY: 58, cursorEnabled: true, cursorX: 50, cursorY: 60 },
  topToFeature: { label: '상단 → 기능', startZoom: 104, endZoom: 142, startX: 50, startY: 18, endX: 50, endY: 52, cursorEnabled: false },
  featureToCta: { label: '기능 → CTA', startZoom: 130, endZoom: 138, startX: 50, startY: 55, endX: 50, endY: 88, cursorEnabled: true, cursorX: 52, cursorY: 86 },
  diagonal: { label: '대각선 이동', startZoom: 122, endZoom: 136, startX: 28, startY: 30, endX: 72, endY: 68, cursorEnabled: false },
  microPulse: { label: '미세 펄스', startZoom: 116, endZoom: 126, startX: 50, startY: 50, endX: 52, endY: 49, cursorEnabled: false }
};

const s = (motion, duration, transition = 'crossfade', override = {}) => ({ motion, duration, transition, ...override });

export const builtinTemplates = [
  {
    id: 'impact-flow', title: 'Impact Product Flow', category: 'website', badge: '기본', motion: 'zoom', durationLabel: 'Auto', audioPreset: 'launchDrive',
    description: '전체 Reveal → 강한 Punch-in → 확대 상태 Scroll Track → 커서 클릭 → 다음 페이지 Impact 전환을 기본으로 쓰는 자동 연출 스타일.',
    sequence: [s('overview',1.5,'cut'),s('snapDetail',1.75,'cut'),s('scrollDown',2.15,'cut',{startY:22,endY:62,startZoom:138,endZoom:140}),s('cursorChase',1.75,'page-flow'),s('pullout',1.45,'cut')]
  },
  {
    id: 'hero-dive', title: 'Hero Dive', category: 'website', badge: 'Hero', motion: 'zoom', durationLabel: '8.8 sec', audioPreset: 'ambientFlow',
    description: '첫 화면 전체에서 Hero 카피와 핵심 제품 영역으로 천천히 빨려 들어가는 인트로형 구성.',
    sequence: [s('overview',2.0),s('heroDive',2.8,'zoom-out'),s('focus',2.2),s('pullout',1.8)]
  },
  {
    id: 'landing-scroll', title: 'Landing Page Scroll', category: 'website', badge: 'Scroll', motion: 'scroll', durationLabel: '13.0 sec', audioPreset: 'softCorporate',
    description: '긴 랜딩 페이지를 상단→중단→하단으로 흐르며 필요한 지점에서만 잠시 확대합니다.',
    sequence: [s('scrollDown',3.0,'slide',{startY:10,endY:38}),s('focus',2.2),s('scrollDown',3.2,'slide',{startY:40,endY:72}),s('focus',2.1,'crossfade',{endX:40,endY:76,cursorX:41,cursorY:78}),s('pullout',2.5)]
  },
  {
    id: 'section-hopper', title: 'Section Hopper', category: 'website', badge: 'Dynamic', motion: 'cut', durationLabel: '9.2 sec', audioPreset: 'focusDrive',
    description: '섹션 사이를 빠르게 건너뛰며 핵심 블록만 보여주는 템포 있는 제품 소개.',
    sequence: [s('overview',1.5,'cut'),s('snapDetail',1.8,'crossfade',{endX:30,endY:34}),s('snapDetail',1.8,'crossfade',{endX:70,endY:52}),s('snapDetail',1.8,'crossfade',{endX:48,endY:76}),s('pullout',2.3,'zoom-out')]
  },
  {
    id: 'cta-finale', title: 'CTA Finale', category: 'website', badge: 'Ending', motion: 'zoom', durationLabel: '8.6 sec', audioPreset: 'ambientFlow',
    description: '제품을 한 번 훑은 뒤 마지막 CTA 영역으로 자연스럽게 모아주는 엔딩 중심 템플릿.',
    sequence: [s('overview',1.8),s('topToFeature',2.4),s('featureToCta',2.7,'crossfade'),s('pullout',1.7,'zoom-out')]
  },
  {
    id: 'portfolio-glide', title: 'Portfolio Glide', category: 'calm', badge: 'Calm', motion: 'pan', durationLabel: '13.6 sec', audioPreset: 'ambientFlow',
    description: '포트폴리오·브랜드 사이트에 어울리는 느린 이동과 여백 중심의 시네마틱 쇼케이스.',
    sequence: [s('calmFloat',3.2),s('panRight',3.3),s('diagonal',3.3),s('pullout',3.8)]
  },
  {
    id: 'product-tour', title: 'Product Tour', category: 'product', badge: '추천', motion: 'zoom', durationLabel: '10.0 sec', audioPreset: 'focusDrive',
    description: '전체 화면 → 기능 → 클릭 → 결과 → 줌아웃 순서의 전형적인 SaaS 제품 데모.',
    sequence: [s('overview',2.0),s('focus',2.4),s('cursorChase',2.2,'zoom-out'),s('focus',1.8,'crossfade',{endX:56,endY:66,cursorX:58,cursorY:68}),s('pullout',1.6)]
  },
  {
    id: 'cursor-walkthrough', title: 'Cursor Walkthrough', category: 'cursor', badge: 'Cursor', motion: 'zoom', durationLabel: '9.6 sec', audioPreset: 'focusDrive',
    description: '커서가 주요 UI 포인트를 따라 이동하고 클릭하는 듯한 인터랙션 중심 설명 영상.',
    sequence: [s('cursorChase',2.4,'crossfade',{endX:28,endY:36,cursorX:29,cursorY:38}),s('cursorChase',2.4,'crossfade',{endX:70,endY:42,cursorX:72,cursorY:44}),s('cursorChase',2.4,'zoom-out',{endX:58,endY:72,cursorX:60,cursorY:74}),s('pullout',2.4)]
  },
  {
    id: 'dashboard-scan', title: 'Dashboard Scan', category: 'product', badge: 'Dashboard', motion: 'pan', durationLabel: '10.0 sec', audioPreset: 'softCorporate',
    description: '좌측 내비게이션, 상단 지표, 차트, 테이블을 순서대로 스캔하는 대시보드용 연출.',
    sequence: [s('panRight',2.2),s('focus',2.1,'crossfade',{endX:68,endY:28,cursorEnabled:false}),s('scrollDown',2.5,'slide',{startY:35,endY:72}),s('focus',1.8,'crossfade',{endX:62,endY:70}),s('pullout',1.4)]
  },
  {
    id: 'feature-spotlight', title: 'Feature Spotlight', category: 'product', badge: 'Feature', motion: 'zoom', durationLabel: '8.9 sec', audioPreset: 'softCorporate',
    description: '하나의 핵심 기능을 충분히 크게 보여주고 세부 상태와 결과까지 이어지는 집중형 템플릿.',
    sequence: [s('overview',1.7),s('heroDive',2.1),s('focus',2.6),s('microPulse',1.5),s('pullout',1.0)]
  },
  {
    id: 'form-flow', title: 'Form Flow', category: 'cursor', badge: 'Form', motion: 'zoom', durationLabel: '9.0 sec', audioPreset: 'focusDrive',
    description: '입력 필드 → 옵션 → 제출 버튼 순서로 커서를 이동해 폼 사용 흐름을 설명합니다.',
    sequence: [s('cursorChase',2.2,'crossfade',{endX:38,endY:40,cursorX:38,cursorY:42}),s('cursorChase',2.2,'crossfade',{endX:62,endY:52,cursorX:62,cursorY:54}),s('cursorChase',2.2,'zoom-out',{endX:64,endY:72,cursorX:65,cursorY:74}),s('pullout',2.4)]
  },
  {
    id: 'settings-tour', title: 'Settings Tour', category: 'product', badge: 'UI', motion: 'pan', durationLabel: '10.4 sec', audioPreset: 'softCorporate',
    description: '사이드바 메뉴와 설정 패널을 오가며 옵션 변화가 많은 제품 화면을 정돈해서 보여줍니다.',
    sequence: [s('panRight',2.2,'crossfade',{startX:24,endX:46}),s('focus',2.2,'crossfade',{endX:40,endY:42}),s('panRight',2.2,'crossfade',{startX:44,endX:74}),s('focus',2.0,'crossfade',{endX:70,endY:62}),s('pullout',1.8)]
  },
  {
    id: 'table-focus', title: 'Data Table Focus', category: 'product', badge: 'Data', motion: 'pan', durationLabel: '9.4 sec', audioPreset: 'focusDrive',
    description: '큰 표에서 행·열·상태 값으로 카메라를 이동해 데이터 제품의 핵심을 읽기 쉽게 보여줍니다.',
    sequence: [s('overview',1.7),s('panRight',2.2,'crossfade',{startY:62,endY:62}),s('focus',2.0,'crossfade',{endX:70,endY:64}),s('panLeft',2.0,'crossfade',{startY:70,endY:70}),s('pullout',1.5)]
  },
  {
    id: 'mobile-app-demo', title: 'Mobile App Demo', category: 'mobile', badge: '9:16', motion: 'mobile', durationLabel: '9.6 sec', audioPreset: 'softCorporate', aspect: '9:16', frameStyle: 'floating',
    description: '모바일 화면을 세로 숏폼 비율로 구성하고 화면 이동과 클릭 지점을 강조합니다.',
    sequence: [s('mobileFocus',2.2),s('scrollDown',2.5,'slide',{startY:18,endY:62}),s('mobileFocus',2.3,'crossfade',{endY:70,cursorY:72}),s('pullout',2.6)]
  },
  {
    id: 'launch-cuts', title: 'Launch Cuts', category: 'fast', badge: 'Fast', motion: 'cut', durationLabel: '6.5 sec', audioPreset: 'launchDrive',
    description: '빠른 줌과 컷을 연결해 제품 런칭 티저나 발표 오프닝에 쓰기 좋은 강한 템포.',
    sequence: [s('overview',1.1,'cut'),s('snapDetail',1.25,'cut'),s('panRight',1.2,'cut'),s('snapDetail',1.25,'zoom-out'),s('pullout',1.7,'cut')]
  },
  {
    id: 'quick-demo', title: 'Quick Demo', category: 'fast', badge: 'Short', motion: 'zoom', durationLabel: '5.0 sec', audioPreset: 'launchDrive',
    description: '한 기능을 5초 안에 전체 → 클릭 → 결과 → 아웃으로 정리하는 짧은 데모.',
    sequence: [s('overview',1.0,'cut'),s('snapDetail',1.8,'zoom-out'),s('cursorChase',1.2,'cut'),s('pullout',1.0,'cut')]
  },
  {
    id: 'social-punch', title: 'Social Punch', category: 'fast', badge: 'Social', motion: 'cut', durationLabel: '7.2 sec', audioPreset: 'launchDrive', aspect: '9:16', frameStyle: 'floating',
    description: '세로형 SNS 영상에서 첫 2초에 시선을 잡고 세 가지 포인트를 빠르게 강조합니다.',
    sequence: [s('heroDive',1.4,'cut'),s('snapDetail',1.4,'cut',{endX:36,endY:40}),s('snapDetail',1.4,'cut',{endX:68,endY:50}),s('snapDetail',1.4,'zoom-out',{endX:52,endY:70}),s('pullout',1.6,'cut')]
  },
  {
    id: 'feature-trio', title: 'Feature Trio', category: 'fast', badge: '3 Features', motion: 'cut', durationLabel: '8.2 sec', audioPreset: 'focusDrive',
    description: '서로 다른 세 기능을 각기 다른 포커스 위치로 소개하는 발표·세일즈용 구성.',
    sequence: [s('overview',1.4),s('focus',1.8,'crossfade',{endX:28,endY:42,cursorX:29,cursorY:44}),s('focus',1.8,'crossfade',{endX:50,endY:62,cursorX:50,cursorY:64}),s('focus',1.8,'zoom-out',{endX:74,endY:42,cursorX:74,cursorY:44}),s('pullout',1.4)]
  },
  {
    id: 'before-after', title: 'Before / After', category: 'fast', badge: 'Compare', motion: 'pan', durationLabel: '7.4 sec', audioPreset: 'ambientFlow',
    description: '두 개 이상의 화면을 좌우 이동과 짧은 컷으로 비교할 때 사용하는 변화 강조 템플릿.',
    sequence: [s('panRight',2.4,'crossfade'),s('panLeft',2.4,'crossfade'),s('overview',1.4,'zoom-out'),s('pullout',1.2)]
  },
  {
    id: 'release-notes', title: 'Release Notes', category: 'fast', badge: 'Update', motion: 'cut', durationLabel: '8.0 sec', audioPreset: 'focusDrive',
    description: '업데이트된 UI 포인트를 연속으로 찍어 보여주는 릴리즈 노트·업데이트 공지용.',
    sequence: [s('overview',1.3,'cut'),s('snapDetail',1.5,'crossfade',{endX:30,endY:36}),s('snapDetail',1.5,'crossfade',{endX:70,endY:48}),s('snapDetail',1.5,'crossfade',{endX:55,endY:72}),s('pullout',2.2,'zoom-out')]
  },
  {
    id: 'calm-showcase', title: 'Calm Showcase', category: 'calm', badge: 'Calm', motion: 'zoom', durationLabel: '12.5 sec', audioPreset: 'ambientFlow',
    description: '느린 줌과 페이드로 제품 자체의 화면 완성도를 살리는 차분한 소개 영상.',
    sequence: [s('calmFloat',3.0),s('panRight',3.0),s('focus',3.0,'crossfade',{cursorEnabled:false}),s('pullout',3.5)]
  },
  {
    id: 'editorial-drift', title: 'Editorial Drift', category: 'calm', badge: 'Editorial', motion: 'pan', durationLabel: '13.2 sec', audioPreset: 'ambientFlow',
    description: '텍스트와 이미지 비중이 큰 사이트를 대각선·수평 이동으로 읽듯이 흘려 보여줍니다.',
    sequence: [s('diagonal',3.3),s('panLeft',3.2),s('scrollDown',3.2,'crossfade',{startY:34,endY:68}),s('pullout',3.5)]
  },
  {
    id: 'luxury-scroll', title: 'Luxury Scroll', category: 'calm', badge: 'Premium', motion: 'scroll', durationLabel: '14.4 sec', audioPreset: 'ambientFlow',
    description: '긴 페이지의 공간감을 유지하면서 천천히 내려가는 프리미엄 브랜드용 스크롤 연출.',
    sequence: [s('heroDive',3.0),s('scrollDown',4.0,'slide',{startY:14,endY:52}),s('scrollDown',4.0,'slide',{startY:52,endY:88}),s('pullout',3.4)]
  },
  {
    id: 'slow-product-film', title: 'Slow Product Film', category: 'calm', badge: 'Film', motion: 'zoom', durationLabel: '15.0 sec', audioPreset: 'ambientFlow',
    description: '미세한 카메라 움직임과 긴 호흡으로 고급스러운 소프트웨어 필름처럼 구성합니다.',
    sequence: [s('microPulse',3.5),s('calmFloat',3.5),s('diagonal',3.5),s('focus',2.5,'crossfade',{cursorEnabled:false}),s('pullout',2.0)]
  }
];

export const templateCategories = [
  ['all', '전체'],
  ['website', 'Website'],
  ['product', 'Product'],
  ['cursor', 'Cursor'],
  ['fast', 'Fast / Social'],
  ['calm', 'Calm'],
  ['mobile', 'Mobile'],
  ['custom', '내 템플릿']
];

export function hydrateMotion(scene, presetId, overrides = {}) {
  const preset = motionPresets[presetId] || motionPresets.overview;
  return {
    ...scene,
    motionPreset: presetId,
    startZoom: preset.startZoom ?? scene.startZoom ?? 100,
    endZoom: preset.endZoom ?? scene.endZoom ?? 120,
    startX: preset.startX ?? scene.startX ?? 50,
    startY: preset.startY ?? scene.startY ?? 50,
    endX: preset.endX ?? scene.endX ?? 50,
    endY: preset.endY ?? scene.endY ?? 50,
    cursorEnabled: preset.cursorEnabled ?? scene.cursorEnabled ?? false,
    cursorX: preset.cursorX ?? scene.cursorX ?? 66,
    cursorY: preset.cursorY ?? scene.cursorY ?? 52,
    ...overrides
  };
}
