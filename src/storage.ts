import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AppState } from "./types.js";

const STATE_PATH = new URL("../data/state.json", import.meta.url);

export async function loadState(): Promise<AppState> {
  try {
    const raw = await readFile(STATE_PATH, "utf-8");
    return JSON.parse(raw) as AppState;
  } catch {
    return {};
  }
}

export async function saveState(state: AppState): Promise<void> {
  const dir = dirname(STATE_PATH.pathname);
  await mkdir(dir, { recursive: true });
  await writeFile(STATE_PATH, JSON.stringify(state, null, 2), "utf-8");
}
