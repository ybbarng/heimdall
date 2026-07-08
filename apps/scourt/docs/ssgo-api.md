# ssgo.scourt.go.kr API 분석

나의사건검색 시스템의 사건 상세 조회 API에 대한 분석 문서.

## 인증

- **세션 불필요**: JSESSIONID 없이도, 잘못된 세션으로도 정상 응답 반환
- 요청 바디의 암호화 토큰(`cortCd`, `csSerial`, `atho`, `prwlKey`, `nrlnmDvsCd`)이 인증 역할
- 토큰은 전자소송포털(ecfs.scourt.go.kr) 홈 > 사건검색 후 사건 상세 조회 시 네트워크 탭에서 추출 가능
- 토큰 만료 여부는 미확인 (장기간 유효할 가능성 있음)

## 엔드포인트

### 사건 유형별 API 경로

| 사건 유형 | 모듈 | 일반내용 | 진행내용 |
|-----------|------|----------|----------|
| 신청사건 (카임 등) | ssgo105 | `selectHmpgAplyCsGnrlCtt.on` | `selectHmpgAplyCsProgCtt.on` |
| 민사집행 (타경 등) | ssgo109 | `selectHmpgCmexecCsGnrlCtt.on` | `selectHmpgCmexecCsProgCtt.on` |
| 회생·파산 (개회 등) | ssgo107 | `selectHmpgRhblBnkpCsGnrlCtt.on` | `selectHmpgRhblBnkpCsProgCtt.on` |

> 회생·파산(도산) 사건도 세션/쿠키 없이 암호화 토큰만으로 조회된다. 단 `nrlnmDvsCd`는 검색 단계(`srchCsDetail.on`)가 돌려주는 값과 상세 조회가 쓰는 값이 다를 수 있으니, 토큰은 반드시 실제 `selectHmpg...` 요청에서 추출한다.

기본 URL: `https://ssgo.scourt.go.kr/ssgo/{모듈}/{엔드포인트}`

### 요청 형식

- Method: `POST`
- Content-Type: `application/json;charset=UTF-8`
- Origin: `https://ssgo.scourt.go.kr`

### 일반내용 요청 바디

```json
{
  "dma_search": {
    "cortCd": "(암호화) 법원 코드",
    "csNo": "",
    "encCsNo": "",
    "csYear": "2025",
    "csDvsCd": "",
    "csSerial": "(암호화) 사건 일련번호",
    "btprtNm": "당사자 이름 (평문)",
    "captchaAnswer": "",
    "callDomain": "ecfs.scourt.go.kr",
    "csDvsNm": "타경",
    "prwlKey": "(암호화) 열람 키",
    "preProgYn": "",
    "typ": "0",
    "atho": "(암호화) 인증 토큰",
    "dcRgstNoIndctYn": "",
    "myCslistLinkYn": "N",
    "mode": "",
    "mcsDomain": "",
    "callTyp": "",
    "ckiStrgYn": "",
    "link": "",
    "linkValue": "",
    "srchDvs": "",
    "nrlnmDvsCd": "(암호화) 실명 구분 코드",
    "inqScop": "",
    "inUseCallDomain": "",
    "etc1": "",
    "etc2": "",
    "etc3": ""
  }
}
```

### 진행내용 요청 바디

일반내용 바디에 아래 필드가 추가됨:

```json
{
  "dma_search": {
    "...일반내용과 동일...",
    "progCttDvs": "0",
    "pageNo": 1,
    "totalYn": "Y"
  },
  "dma_pageInfo": {
    "pageNo": "",
    "pageSize": "",
    "bfPageNo": "",
    "startRowNo": "",
    "totalCnt": "",
    "totalYn": "",
    "maxPageSize": ""
  }
}
```

## 응답 형식

### 공통 래퍼

```json
{
  "status": 200,
  "message": "{} 조회가 완료되었습니다.",
  "timestamp": 1775463378955,
  "errors": null,
  "data": { ... },
  "token": null
}
```

### 일반내용 응답 (data)

```json
{
  "dma_csBasCtt": {
    "cortCd": "000123",
    "cortNm": "서울중앙지방법원",
    "csNo": "20250100012345",
    "userCsNo": "2025가합12345",
    "csNm": "손해배상(기)",
    "csRcptYmd": "20250301",
    "clmAmt": "100000000",
    "jdbnNm": "민사1부",
    "telNo": "(전화: 1234-5678)",
    "lwstDvsCdNm": "전자소송",
    "...": "..."
  },
  "dlt_rcntDxdyLst": [],
  "dlt_rcntSbmsnDocmtLst": [
    {
      "ofdocRcptYmd": "20250501",
      "content1": "원고 ",
      "content2": "홍OO",
      "content3": " 준비서면 제출"
    }
  ],
  "dlt_btprtCttLst": [
    {
      "btprtDvsCd": "01",
      "btprtNm": "1. 홍OO ",
      "btprtDvsCdNm": "원고",
      "btprtDvsNm": "원고"
    }
  ],
  "dlt_reltCsLst": []
}
```

### 진행내용 응답 (data.dlt_csProgCtt)

```json
{
  "dlt_csProgCtt": [
    {
      "progYmd": "20250301",
      "progCtt": "소장접수",
      "progCttDvs": "0"
    },
    {
      "progYmd": "20250315",
      "progCtt": "소장부본송달",
      "progCttDvs": "2"
    },
    {
      "progYmd": "20250315",
      "progCtt": "피고 김OO에게 소장부본 송달",
      "progRslt": "2025.03.16 도달",
      "progCttDvs": "4"
    }
  ]
}
```

### 주요 필드 설명

| 필드 | 설명 |
|------|------|
| `cortCd` | 법원 코드 (예: 000123) |
| `userCsNo` | 사용자용 사건번호 (예: 2025가합12345) |
| `csNm` | 사건명 |
| `csRcptYmd` | 접수일 (YYYYMMDD) |
| `clmAmt` | 청구금액 |
| `jdbnNm` | 재판부명 |
| `progCttDvs` | 진행내용 구분 (0=접수, 2=결정, 3=서류제출, 4=송달) |
| `progYmd` | 진행일자 (YYYYMMDD) |
| `progCtt` | 진행내용 요약 텍스트 |

## 토큰 추출 방법

1. 브라우저에서 전자소송포털(ecfs.scourt.go.kr) 홈 > 사건검색 (법원 선택 + 사건번호 + 당사자명 입력 후 조회 → CAPTCHA 입력)
2. 사건 상세보기 클릭
3. 개발자 도구 > Network 탭에서 `selectHmpg...` 요청 찾기
4. 우클릭 > "Copy as cURL" 로 복사
5. 요청 바디에서 `cortCd`, `csSerial`, `atho`, `prwlKey`, `nrlnmDvsCd` 추출
6. `cases.json`에 등록
