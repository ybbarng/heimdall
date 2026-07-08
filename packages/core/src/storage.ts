import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export interface Storage<T> {
  load(): Promise<T>;
  save(state: T): Promise<void>;
}

/**
 * JSON 파일 하나에 상태를 저장하는 범용 저장소.
 * 파일이 없거나 깨졌으면 fallback을 돌려준다 (최초 실행 대비).
 *
 * @param statePath 상태 파일 경로. 앱이 `new URL("../data/state.json", import.meta.url)` 식으로 주입
 * @param fallback 파일이 없을 때 돌려줄 초기값
 */
export function createStorage<T>(statePath: URL, fallback: T): Storage<T> {
  return {
    async load() {
      try {
        const raw = await readFile(statePath, "utf-8");
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    },
    async save(state: T) {
      await mkdir(dirname(statePath.pathname), { recursive: true });
      await writeFile(statePath, JSON.stringify(state, null, 2), "utf-8");
    },
  };
}
