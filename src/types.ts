export interface CaseConfig {
  id: string;
  label: string;
  type: "apply" | "cmexec";
  endpoint: string;
  progressEndpoint: string;
  params: {
    cortCd: string;
    csYear: string;
    csSerial: string;
    btprtNm: string;
    csDvsNm: string;
    prwlKey: string;
    atho: string;
    nrlnmDvsCd: string;
  };
}

export interface SsgoResponse<T> {
  status: number;
  message: string;
  timestamp: number;
  errors: unknown;
  data: T;
  token: unknown;
}

export interface ProgressItem {
  progYmd: string;
  progCtt: string;
  progRslt?: string;
  progCttDvs: string;
}

export interface SubmissionDoc {
  ofdocRcptYmd: string;
  content1: string;
  content2: string;
  content3: string;
}

export interface GeneralData {
  dma_csBasCtt: Record<string, unknown>;
  dlt_rcntDxdyLst: unknown[];
  dlt_rcntSbmsnDocmtLst: SubmissionDoc[];
  dlt_btprtCttLst: unknown[];
  [key: string]: unknown;
}

export interface ProgressData {
  dma_csBasCtt: Record<string, unknown>;
  dlt_csProgCtt: ProgressItem[];
  [key: string]: unknown;
}

export interface CaseState {
  general: GeneralData | null;
  progress: ProgressData | null;
  lastChecked: string;
}

export type AppState = Record<string, CaseState>;
