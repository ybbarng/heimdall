# easy-scourt

나의사건검색(ssgo.scourt.go.kr) 소송 진행상황을 주기적으로 확인하고, 변경이 감지되면 Discord로 알림을 보내는 모니터링 도구.

## 동작 방식

1. 사건별 암호화 토큰으로 ssgo API를 호출하여 일반내용/진행내용을 조회
2. 이전 조회 결과(`data/state.json`)와 비교하여 변경 감지
3. 새로운 진행내용, 제출서류, 일반내용 변경 시 Discord 웹훅으로 알림 발송

세션이나 로그인 없이, 최초 사건 검색 시 발급받은 암호화 토큰만으로 조회할 수 있다.

## 설정

### 1. 환경변수

```bash
cp .env.example .env
```

`.env` 파일에 Discord 웹훅 URL을 입력한다.

### 2. 사건 등록 (cases.json)

브라우저에서 나의사건검색 후 네트워크 탭에서 curl 복사 → 요청 바디의 암호화 토큰을 추출하여 `cases.json`에 등록한다.

```json
[
  {
    "id": "case1",
    "label": "2025가합12345 손해배상",
    "type": "apply",
    "endpoint": "https://ssgo.scourt.go.kr/ssgo/ssgo105/selectHmpgAplyCsGnrlCtt.on",
    "progressEndpoint": "https://ssgo.scourt.go.kr/ssgo/ssgo105/selectHmpgAplyCsProgCtt.on",
    "params": {
      "cortCd": "(암호화된 값)",
      "csYear": "2025",
      "csSerial": "(암호화된 값)",
      "btprtNm": "홍길동",
      "csDvsNm": "가합",
      "prwlKey": "(암호화된 값)",
      "atho": "(암호화된 값)",
      "nrlnmDvsCd": "(암호화된 값)"
    }
  }
]
```

- `type: "apply"` → 신청사건 (ssgo105)
- `type: "cmexec"` → 민사집행사건 (ssgo109)

## 실행

```bash
pnpm install

# 1회 조회
pnpm check

# 데몬 모드 (폴링 간격은 .env의 POLL_INTERVAL_MINUTES)
pnpm start
```

## 서버 배포 (cron)

```bash
# run.sh로 실행 (PATH 설정 포함)
crontab -e

# 매시 정각 실행
0 * * * * /path/to/easy-scourt/run.sh >> /path/to/easy-scourt/logs/cron.log 2>&1
```

`logs/` 디렉토리를 미리 생성해야 한다.
