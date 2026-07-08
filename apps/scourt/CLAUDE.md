# CLAUDE.md (scourt)

나의사건검색(ssgo.scourt.go.kr) API를 폴링하여 소송 진행 변경 시 Discord 웹훅으로 알림을 보내는 워처. heimdall 모노레포의 앱. 공용 인프라(상태 저장·Discord 전송·로거)는 `@heimdall/core`에서 가져온다.

## 주요 구조

```
apps/scourt/src/
├── index.ts    # 진입점. --once 1회 조회 / --dry-run 미전송·미저장 / 기본은 폴링 데몬
├── api.ts      # ssgo API 호출 (일반내용, 진행내용)
├── diff.ts     # 이전 상태와 비교하여 변경 감지
├── notify.ts   # 법원 알림 embed 빌드 (core sendDiscord로 전송)
└── types.ts    # 타입 정의
```

core에서 쓰는 것: `createStorage`(상태 저장), `sendDiscord`(전송), `createLogger`(로그).

## 설정 파일 (gitignore 대상, apps/scourt/ 아래)

- `.env` — DISCORD_WEBHOOK_URL, POLL_INTERVAL_MINUTES
- `cases.json` — 사건별 암호화 토큰 및 API 엔드포인트
- `data/state.json` — 마지막 조회 결과 (자동 생성)

## 핵심 참고사항

- ssgo API는 **세션/쿠키 없이** 암호화 토큰만으로 조회 가능
- 토큰은 브라우저에서 나의사건검색 후 네트워크 탭에서 추출
- 사건 타입별 API 경로가 다름: ssgo105(신청사건), ssgo109(민사집행), ssgo107(회생·파산, 개회 등)
- 토큰 만료 시 API 오류가 Discord로 통보됨

## 실행

```bash
pnpm check    # 1회 조회
pnpm start    # 데몬 모드
pnpm dry      # dry-run (실제 데이터 조회, 미전송·미저장)
```
