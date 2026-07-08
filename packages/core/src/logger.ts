import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type LogLevel = "INFO" | "WARN" | "ERROR";

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
}

/**
 * 워처 공용 로거. console과 날짜별 파일(logDir/<name>-YYYY-MM-DD.log)에 동시에 남긴다.
 * 모든 워처가 같은 포맷·위치를 쓰도록 표준화한다.
 *
 * @param name 워처 이름. 로그 파일 접두어이자 각 줄의 태그로 쓰인다
 * @param logDir 로그 디렉토리. 보통 모노레포 루트의 logs/ 를 주입한다
 */
export function createLogger(name: string, logDir: URL): Logger {
  const dir = fileURLToPath(logDir);
  mkdirSync(dir, { recursive: true });

  const write = (level: LogLevel, msg: string) => {
    const ts = new Date().toISOString();
    const line = `[${ts}] [${name}] ${level}: ${msg}`;
    // INFO는 stdout, WARN/ERROR는 stderr로
    if (level === "INFO") console.log(line);
    else console.error(line);
    // 날짜별 파일에 append (동기라 줄 순서가 보장된다. cron 배치라 성능 부담 없음)
    const date = ts.slice(0, 10);
    appendFileSync(join(dir, `${name}-${date}.log`), `${line}\n`);
  };

  return {
    info: (msg) => write("INFO", msg),
    warn: (msg) => write("WARN", msg),
    error: (msg) => write("ERROR", msg),
  };
}
