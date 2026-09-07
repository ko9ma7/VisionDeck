export const DEMO_OUTPUTS = {
  'zai-org/glm-ocr': `# 영수증\n\n상호: 비전카페 강남점\n사업자번호: 120-88-02104\n일시: 2026-09-06 18:42\n\n| 품목 | 수량 | 금액 |\n|---|---:|---:|\n| 아메리카노 | 2 | 9,000원 |\n| 치즈케이크 | 1 | 6,500원 |\n\n합계: **15,500원**\n부가세: 1,409원`,
  'deepseek-ai/deepseek-ocr-2': `# 영수증\n\n판매자: 비전카페 강남점\n사업자 번호: 120-88-02104\n날짜: 2026.09.06 18:42\n\n- 아메리카노 × 2 — 9,000원\n- 치즈 케이크 × 1 — 6,500원\n\n결제금액: **15,500원**\nVAT: 1,409원`,
  'rednote-hilab/dots.mocr': `<document page="1">\n# 비전카페 강남점\n사업자번호 120-88-02104\n2026-09-06 18:42\n\n| 상품명 | Qty | Amount |\n|---|---:|---:|\n| 아메리카노 | 2 | 9,000 |\n| 치즈케이크 | 1 | 6,500 |\n\n**TOTAL 15,500 KRW**\n</document>`,
  'qwen/qwen3.5-0.8b': `사진에는 카페의 카드 영수증이 보입니다. 상단에 “비전카페 강남점”이 있고, 아메리카노 2잔과 치즈케이크 1개가 결제되었습니다. 총액은 15,500원이며 문서 하단에 승인 관련 정보가 이어집니다.`,
};
export const DEMO_LATENCY = { 'zai-org/glm-ocr': 1810, 'deepseek-ai/deepseek-ocr-2': 2380, 'rednote-hilab/dots.mocr': 2120, 'qwen/qwen3.5-0.8b': 940 };
export const DEMO_COST = { 'zai-org/glm-ocr': 0.0009, 'deepseek-ai/deepseek-ocr-2': 0.0014, 'rednote-hilab/dots.mocr': 0.0008, 'qwen/qwen3.5-0.8b': 0.0006 };
