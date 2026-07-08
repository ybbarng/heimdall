import type {
  CaseConfig,
  GeneralData,
  ProgressData,
  SsgoResponse,
} from "./types.js";

const HEADERS = {
  Accept: "application/json",
  "Content-Type": "application/json;charset=UTF-8",
  Origin: "https://ssgo.scourt.go.kr",
  Referer: "https://ssgo.scourt.go.kr/ssgo/srchCsDetail.on",
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36",
};

function buildGeneralBody(params: CaseConfig["params"]) {
  return {
    dma_search: {
      cortCd: params.cortCd,
      csNo: "",
      encCsNo: "",
      csYear: params.csYear,
      csDvsCd: "",
      csSerial: params.csSerial,
      btprtNm: params.btprtNm,
      captchaAnswer: "",
      callDomain: "ecfs.scourt.go.kr",
      csDvsNm: params.csDvsNm,
      prwlKey: params.prwlKey,
      preProgYn: "",
      typ: "0",
      atho: params.atho,
      dcRgstNoIndctYn: "",
      myCslistLinkYn: "N",
      mode: "",
      mcsDomain: "",
      callTyp: "",
      ckiStrgYn: "",
      link: "",
      linkValue: "",
      srchDvs: "",
      nrlnmDvsCd: params.nrlnmDvsCd,
      inqScop: "",
      inUseCallDomain: "",
      etc1: "",
      etc2: "",
      etc3: "",
    },
  };
}

function buildProgressBody(params: CaseConfig["params"]) {
  return {
    dma_search: {
      ...buildGeneralBody(params).dma_search,
      progCttDvs: "0",
      pageNo: 1,
      totalYn: "Y",
    },
    dma_pageInfo: {
      pageNo: "",
      pageSize: "",
      bfPageNo: "",
      startRowNo: "",
      totalCnt: "",
      totalYn: "",
      maxPageSize: "",
    },
  };
}

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  }

  const json = (await res.json()) as SsgoResponse<T>;

  if (json.status !== 200) {
    throw new Error(`API error ${json.status}: ${json.message}`);
  }

  return json.data;
}

export async function fetchGeneral(
  caseConfig: CaseConfig,
): Promise<GeneralData> {
  const body = buildGeneralBody(caseConfig.params);
  return post<GeneralData>(caseConfig.endpoint, body);
}

export async function fetchProgress(
  caseConfig: CaseConfig,
): Promise<ProgressData> {
  const body = buildProgressBody(caseConfig.params);
  return post<ProgressData>(caseConfig.progressEndpoint, body);
}
