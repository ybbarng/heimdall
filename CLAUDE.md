# CLAUDE.md

## 프로젝트 개요

나의사건검색(ssgo.scourt.go.kr) API를 폴링하여 소송 진행 변경 시 Discord 웹훅으로 알림을 보내는 TypeScript 도구.

## 기술 스택

- TypeScript (strict), tsx로 실행
- pnpm 패키지 매니저
- Node.js 내장 fetch 사용 (외부 HTTP 라이브러리 없음)

## 주요 구조

```
src/
├── index.ts    # 메인 진입점. --once 플래그로 1회 실행 / 기본은 폴링 데몬
├── api.ts      # ssgo API 호출 (일반내용, 진행내용)
├── diff.ts     # 이전 상태와 비교하여 변경 감지
├── notify.ts   # Discord 웹훅 알림 (신규/변경/오류/시작)
├── storage.ts  # data/state.json으로 상태 저장/로드
└── types.ts    # 타입 정의
```

## 설정 파일 (gitignore 대상)

- `.env` — DISCORD_WEBHOOK_URL, POLL_INTERVAL_MINUTES
- `cases.json` — 사건별 암호화 토큰 및 API 엔드포인트
- `data/state.json` — 마지막 조회 결과 (자동 생성)

## 핵심 참고사항

- ssgo API는 **세션/쿠키 없이** 암호화 토큰만으로 조회 가능
- 토큰은 브라우저에서 나의사건검색 후 네트워크 탭에서 추출
- 사건 타입별 API 경로가 다름: ssgo105(신청사건), ssgo109(민사집행), ssgo107(회생·파산, 개회 등)
- 토큰 만료 시 API 오류가 Discord로 통보됨

## 빌드 & 실행

```bash
pnpm check    # 1회 조회
pnpm start    # 데몬 모드
```

## 배포

Ubuntu 서버에서 `run.sh` + cron으로 매시 정각 실행.
cron 환경에서는 PATH 문제로 run.sh 래퍼 스크립트가 필요.
