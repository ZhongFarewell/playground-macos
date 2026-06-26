/**
 * localStorage 缓存层。
 *
 * 职责：状态变化时立即写本地，避免用户秒关页面丢配置。
 * GitHub 是异步副本，localStorage 是同步真相源。
 *
 * 缓存内容：
 * - manifest：启动时先读本地立即渲染，后台拉远端 diff
 * - records：按 id 缓存，避免每次都打 GitHub
 *
 * 命名空间：所有 key 以 "mdb:" 开头（macos-database）
 */
import type { DatabaseRecord, Manifest, RecordId } from "./types";

const PREFIX = "mdb";
const MANIFEST_KEY = `${PREFIX}:manifest`;
const RECORD_KEY = (id: RecordId) => `${PREFIX}:record:${id}`;

/** 安全 stringify，循环引用时降级 */
const safeStringify = (value: unknown): string => {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify(String(value));
  }
};

/** 安全 parse，失败返回 null */
const safeParse = <T>(text: string | null): T | null => {
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
};

/** localStorage 写入，配额满静默失败（不阻塞业务） */
const safeSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // 配额满或被禁用，静默降级
  }
};

const safeRemove = (key: string): void => {
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  }
};

// ── manifest 缓存 ──────────────────────────────────────────

export const readManifestCache = (): Manifest | null => {
  return safeParse<Manifest>(localStorage.getItem(MANIFEST_KEY));
};

export const writeManifestCache = (manifest: Manifest): void => {
  safeSet(MANIFEST_KEY, safeStringify(manifest));
};

// ── record 缓存 ────────────────────────────────────────────
//
// record 缓存包装结构：附带文件 sha，避免每次 PUT 前都 GET 拿 sha。
// 外部读取 record 时透明（拆包返回），写 sha 由 queue.ts 在 PUT 成功后更新。

interface CachedRecord<T = unknown> {
  record: DatabaseRecord<T>;
  /** record 文件最近的 git sha，PUT 时用作乐观锁凭证 */
  sha?: string;
}

export const readRecordCache = <T = unknown>(id: RecordId): DatabaseRecord<T> | null => {
  const cached = safeParse<CachedRecord<T>>(localStorage.getItem(RECORD_KEY(id)));
  return cached?.record ?? null;
};

/** 读 record 缓存的 sha（用于 PUT 前的乐观锁，避免 GET） */
export const readRecordSha = (id: RecordId): string | undefined => {
  const cached = safeParse<CachedRecord>(localStorage.getItem(RECORD_KEY(id)));
  return cached?.sha;
};

export const writeRecordCache = (record: DatabaseRecord, sha?: string): void => {
  const cached: CachedRecord = { record, sha };
  safeSet(RECORD_KEY(record.id), safeStringify(cached));
};

/** 只更新 record 缓存里的 sha（PUT 成功后调用，不重写 record 本身） */
export const updateRecordSha = (id: RecordId, sha: string): void => {
  const cached = safeParse<CachedRecord>(localStorage.getItem(RECORD_KEY(id)));
  if (cached) {
    cached.sha = sha;
    safeSet(RECORD_KEY(id), safeStringify(cached));
  }
};

export const removeRecordCache = (id: RecordId): void => {
  safeRemove(RECORD_KEY(id));
};

/**
 * 批量读取多条 record 缓存。
 * 用于 queryByType 时从本地先捞一拨。
 */
export const readRecordsCache = <T = unknown>(ids: RecordId[]): DatabaseRecord<T>[] => {
  const out: DatabaseRecord<T>[] = [];
  for (const id of ids) {
    const r = readRecordCache<T>(id);
    if (r) out.push(r);
  }
  return out;
};

// ── 缓存与远端合并 ──────────────────────────────────────────

/**
 * 合并远端 manifest 与本地缓存。
 * 远端为准，但本地可能比远端新（用户刚改还没 flush）——这种情况下
 * 保留本地的 updatedAt 较新的条目，避免回退用户未保存的修改。
 *
 * 简化策略：远端条目 + 本地独有条目（本地有但远端 manifest 还没同步的）。
 * updatedAt 取较大值。
 */
export const mergeManifest = (remote: Manifest, local: Manifest | null): Manifest => {
  if (!local) return remote;

  const remoteMap = new Map(remote.records.map((r) => [r.id, r]));
  const localMap = new Map(local.records.map((r) => [r.id, r]));

  const merged = new Map(remoteMap);

  for (const [id, localEntry] of localMap) {
    const remoteEntry = remoteMap.get(id);
    if (!remoteEntry) {
      // 本地有但远端没有：可能是新增还没 flush，保留
      merged.set(id, localEntry);
    } else {
      // 两边都有：取 updatedAt 较新的
      const lu = localEntry.updatedAt;
      const ru = remoteEntry.updatedAt;
      if (lu > ru) merged.set(id, localEntry);
    }
  }

  return { ...remote, records: Array.from(merged.values()) };
};

/**
 * 判断本地缓存是否"领先"于远端 manifest（有未 flush 的写入）。
 * 用于启动时决定是否要立即触发 flush。
 */
export const hasLocalOnlyChanges = (
  local: Manifest | null,
  remote: Manifest
): boolean => {
  if (!local) return false;
  for (const localEntry of local.records) {
    const remoteEntry = remote.records.find((r) => r.id === localEntry.id);
    if (!remoteEntry) return true;
    if (localEntry.updatedAt > remoteEntry.updatedAt) return true;
  }
  return false;
};
