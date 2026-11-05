/** products.json 한 항목 */
export interface ProductConfig {
  /** 상태 파일 키. URL 끝 상품 코드를 쓴다 */
  id: string;
  /** 알림에 보일 이름 */
  label: string;
  /** 상품 상세 페이지 */
  url: string;
}

/** 한 번 조회한 결과 */
export interface StockResult {
  /** 장바구니에 담을 수 있으면 true */
  available: boolean;
  /** 페이지에 보인 상품명 (페이지 구조가 바뀌었는지 볼 때 쓴다) */
  title: string;
  /** 판매가(원). 못 찾으면 null */
  price: number | null;
}

export interface ProductState {
  available: boolean;
  /** 마지막으로 성공한 조회 시각 */
  lastChecked: string;
  /** 마지막으로 구매 가능 → 품절, 품절 → 구매 가능으로 바뀐 시각 */
  lastChanged?: string;
}

export interface AppState {
  products: Record<string, ProductState>;
  /** 연속 실패 횟수 (성공하면 0) */
  failures: number;
  /** 실패가 이어질 때 이 시각 전까지는 조회를 건너뛴다 */
  nextAllowedAt?: string;
  /** 연속 실패 알림을 이미 보냈는지 (복구되면 다시 false) */
  failureNotified?: boolean;
}
