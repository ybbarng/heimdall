# scourt

나의사건검색(ssgo.scourt.go.kr) 소송 진행상황을 주기적으로 확인하고, 변경이 감지되면 Discord로 알림을 보내는 워처. [heimdall](../../README.md) 모노레포의 앱 중 하나.

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

의존성 설치는 모노레포 루트에서 한 번 한다. 실행은 루트 또는 이 앱 디렉토리에서.

```bash
# 루트에서 workspace 전체 설치
pnpm install

# 1회 조회 (루트에서 pnpm check → scourt로 위임)
pnpm check

# 데몬 모드 (폴링 간격은 .env의 POLL_INTERVAL_MINUTES)
pnpm start

# dry-run: 실제 데이터는 받아오되 Discord 전송·상태 저장 없이 console 출력만
pnpm dry
```

## 로그

`console`과 함께 모노레포 루트 `logs/scourt-YYYY-MM-DD.log`에 날짜별로 표준 포맷으로 남는다(core `createLogger`). 로그 위치를 cron 리다이렉트가 아니라 앱이 직접 관리한다.

## 서버 배포 (cron)

cron은 루트 `run.sh`만 호출하면 된다(로그 리다이렉트 불필요).

```bash
crontab -e

# 매시 5분에 실행
5 * * * * /home/ybbarng/heimdall/run.sh
```
