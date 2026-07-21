/** 감시 지점 하나. markets.json 배열의 원소 */
export interface Market {
  /** 롯데마트 매장 코드 (p_market 파라미터) */
  code: string;
  /** 지점명 (지도 표시·네이버지도 검색어) */
  name: string;
  /** 도로명주소 (지도 팝업 표시용) */
  address?: string;
  /** 위도 (지도 마커). 지오코딩 결과 */
  lat?: number;
  /** 경도 (지도 마커) */
  lng?: number;
  /** 스위치2 본체 취급 여부. false면 폴링에서 제외(지도엔 '미취급') */
  hasBody?: boolean;
}

/** 상품 하나의 재고 상태 */
export interface Stock {
  /** 재고 있음 여부. "품절"이면 false */
  inStock: boolean;
  /** 표시된 재고 수량. "품절"이거나 수량 미표시면 null */
  qty: number | null;
}

/** 지점 하나의 마지막 조회 상태 */
export interface MarketState {
  /** 상품명 → 재고 */
  products: Record<string, Stock>;
  /** 연속 조회 실패 횟수. 성공 시 0으로 리셋 */
  failCount: number;
  lastChecked: string;
}

/** 지점코드 → 상태 */
export type AppState = Record<string, MarketState>;
