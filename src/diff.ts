import type {
  CaseState,
  GeneralData,
  ProgressData,
  ProgressItem,
  SubmissionDoc,
} from "./types.js";

export interface Changes {
  newProgressItems: ProgressItem[];
  newSubmissions: SubmissionDoc[];
  generalChanges: Array<{ field: string; from: unknown; to: unknown }>;
}

const TRACKED_GENERAL_FIELDS = [
  "csNm",
  "cortNm",
  "jdbnNm",
  "csAuctnSuspStatCd",
  "clmAmt",
  "dlvrfAcntStatCdNm",
  "csUltmtDvsNm",
  "csUltmtDvsCdNm",
] as const;

function formatDoc(doc: SubmissionDoc): string {
  return `${doc.ofdocRcptYmd}|${doc.content1}${doc.content2}${doc.content3}`;
}

function formatProg(item: ProgressItem): string {
  return `${item.progYmd}|${item.progCtt}`;
}

export function detectChanges(
  prev: CaseState | undefined,
  general: GeneralData,
  progress: ProgressData,
): Changes | null {
  if (!prev?.general || !prev?.progress) {
    return null; // 최초 실행 시 변경 없음 처리
  }

  const changes: Changes = {
    newProgressItems: [],
    newSubmissions: [],
    generalChanges: [],
  };

  // 진행내용 비교
  const prevProgKeys = new Set(
    (prev.progress.dlt_csProgCtt ?? []).map(formatProg),
  );
  for (const item of progress.dlt_csProgCtt ?? []) {
    if (!prevProgKeys.has(formatProg(item))) {
      changes.newProgressItems.push(item);
    }
  }

  // 제출서류 비교
  const prevDocKeys = new Set(
    (prev.general.dlt_rcntSbmsnDocmtLst ?? []).map(formatDoc),
  );
  for (const doc of general.dlt_rcntSbmsnDocmtLst ?? []) {
    if (!prevDocKeys.has(formatDoc(doc))) {
      changes.newSubmissions.push(doc);
    }
  }

  // 일반내용 주요 필드 비교
  for (const field of TRACKED_GENERAL_FIELDS) {
    const prevVal = prev.general.dma_csBasCtt[field];
    const currVal = general.dma_csBasCtt[field];
    if (prevVal !== undefined && prevVal !== currVal) {
      changes.generalChanges.push({ field, from: prevVal, to: currVal });
    }
  }

  const hasChanges =
    changes.newProgressItems.length > 0 ||
    changes.newSubmissions.length > 0 ||
    changes.generalChanges.length > 0;

  return hasChanges ? changes : null;
}
