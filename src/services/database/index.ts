/**
 * macos-database 持久化系统对外 API。
 *
 * 数据模型：所有数据都是 DatabaseRecord，靠 type 字段分类。
 * - 单例数据（系统设置等）：id === type，用 writeSingleton / getSingleton
 * - 集合数据（历史记录、书签等）：id = ULID，用 insertRecord / queryByType
 *
 * 读取流程：manifest（本地缓存优先）→ 按 id/type 查 → 按需拉 record 文件
 * 写入流程：入队 → debounce 2s → 串行 flush（写 record + 更新 manifest + 更新缓存）
 *
 * 关键时刻（beforeunload 等）调用 flushNow() 立即刷盘。
 */
import { getJsonWithSha } from "./github";
import {
  fetchManifest,
  getManifestLocal,
  findEntry,
  findEntriesByType,
  findSingleton,
  recordFilePath,
  blobFilePath
} from "./manifest";
import {
  readRecordCache,
  readRecordSha,
  writeRecordCache,
  removeRecordCache,
  readManifestCache,
  writeManifestCache
} from "./cache";
import { enqueueWrite, enqueueDelete, flushNow, onQueueStatus } from "./queue";
import {
  getBlob,
  putBlob,
  deleteBlob,
  getFileSha,
  getBlobBytes,
  putBlobBytes
} from "./github";
import { upsertManifestEntry, removeManifestEntry } from "./manifest";
import type {
  DatabaseRecord,
  Manifest,
  ManifestEntry,
  RecordId,
  RecordType,
  BlobRef
} from "./types";

// ── ULID 生成（Crockford base32，时间序可排序） ──────────────────────────

const ULID_ENCODING = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ULID_TIME_LEN = 10;
const ULID_RAND_LEN = 16;

/** 生成 ULID（26 位，时间序可排序） */
export const generateUlid = (): string => {
  const now = Date.now();
  let time = now;
  const timeChars = new Array<string>(ULID_TIME_LEN);
  for (let i = ULID_TIME_LEN - 1; i >= 0; i--) {
    timeChars[i] = ULID_ENCODING[time & 0x1f];
    time = Math.floor(time / 32);
  }

  const randChars = new Array<string>(ULID_RAND_LEN);
  const randomValues = crypto.getRandomValues(new Uint8Array(ULID_RAND_LEN));
  for (let i = 0; i < ULID_RAND_LEN; i++) {
    randChars[i] = ULID_ENCODING[randomValues[i] & 0x1f];
  }

  return timeChars.join("") + randChars.join("");
};

// ── 初始化 ──────────────────────────────────────────────────

let initialized = false;
let initPromise: Promise<void> | null = null;

/**
 * 初始化数据库：拉取远端 manifest + 合并本地缓存。
 * 应用启动时调用一次。可重复调用，只初始化一次。
 */
export const initDatabase = async (): Promise<void> => {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    await fetchManifest();
    initialized = true;
  })();
  return initPromise;
};

// ── 本地 manifest 缓存即时登记 ──────────────────────────────
//
// 入队写任务后，远端 manifest 要等 flush 完成才会更新。但 queryByType
// 走本地 manifest 查找——会漏掉刚入队的 record。这里在入队时同步更新
// 本地 manifest 缓存，让 queryByType 立即能看到新 record。
// flush 完成后 manifest.ts 会用远端 sha 覆盖，不会冲突。

const upsertLocalManifestEntry = (
  id: RecordId,
  type: RecordType,
  singleton: boolean,
  updatedAt: string
): void => {
  const local = readManifestCache();
  if (!local) return; // 本地无缓存，等 fetchManifest 时再拉
  const entry: ManifestEntry = {
    id,
    type,
    singleton,
    file: recordFilePath(id),
    updatedAt
  };
  const idx = local.records.findIndex((r) => r.id === id);
  const records =
    idx === -1
      ? [...local.records, entry]
      : local.records.map((r, i) => (i === idx ? entry : r));
  writeManifestCache({ ...local, records });
};

const removeLocalManifestEntry = (id: RecordId): void => {
  const local = readManifestCache();
  if (!local) return;
  writeManifestCache({
    ...local,
    records: local.records.filter((r) => r.id !== id)
  });
};

// ── 读取 API ──────────────────────────────────────────────────

/**
 * 按 ID 读取单条 record。
 * 流程：本地缓存 → 本地 manifest 定位 → 远端拉 record 文件。
 */
export const getRecord = async <T = unknown>(
  id: RecordId
): Promise<DatabaseRecord<T> | null> => {
  // 1. 本地缓存
  const cached = readRecordCache<T>(id);
  if (cached) return cached;

  // 2. 远端拉取（同时拿 sha，写进缓存供下次 PUT 用）
  const result = await getJsonWithSha<DatabaseRecord<T>>(recordFilePath(id));
  if (result) {
    writeRecordCache(result.data, result.sha);
    return result.data;
  }
  return null;
};

/**
 * 按 type 读取单例 record。
 * 单例 id === type，直接按 id 取。
 */
export const getSingleton = async <T = unknown>(
  type: RecordType
): Promise<DatabaseRecord<T> | null> => {
  return getRecord<T>(type);
};

/**
 * 按 type 查询集合所有 record。
 * 流程：manifest 按 type 过滤 → 并发拉取各 record 文件 → 合并本地缓存。
 *
 * @param forceRemote 是否强制拉远端（默认 false，优先本地缓存）
 */
export const queryByType = async <T = unknown>(
  type: RecordType,
  forceRemote = false
): Promise<DatabaseRecord<T>[]> => {
  const manifest = forceRemote ? await fetchManifest() : getManifestLocal();
  const entries = findEntriesByType(manifest, type);

  if (entries.length === 0) return [];

  // 并发拉取，本地缓存优先
  const records = await Promise.all(
    entries.map(async (entry) => {
      const cached = readRecordCache<T>(entry.id);
      if (cached && !forceRemote) return cached;
      const result = await getJsonWithSha<DatabaseRecord<T>>(entry.file);
      if (result) {
        writeRecordCache(result.data, result.sha);
        return result.data;
      }
      return null;
    })
  );

  return records.filter((r): r is DatabaseRecord<T> => r !== null);
};

/**
 * 按 type 查询集合的 manifest 条目（不拉具体 record，只拿元信息）。
 * 用于列表展示（标题/时间排序）等不需要业务数据的场景。
 */
export const queryMetaByType = (type: RecordType) => {
  const manifest = getManifestLocal();
  return findEntriesByType(manifest, type);
};

// ── 写入 API ──────────────────────────────────────────────────

/**
 * 写单例 record（id === type）。
 * 状态变化时调用，立即入队 + 立即写本地缓存，立即登记本地 manifest。
 */
export const writeSingleton = <T>(type: RecordType, data: T): void => {
  const now = new Date().toISOString();
  const existing = readRecordCache<T>(type);
  const record: DatabaseRecord<T> = {
    id: type,
    type,
    data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  // 保留原有 sha（仅更新 data，文件 sha 未变，PUT 时仍用作乐观锁凭证）
  writeRecordCache(record, readRecordSha(type));
  upsertLocalManifestEntry(type, type, true, now);
  enqueueWrite(type, type, data, true);
};

/**
 * 新建集合 record（自动生成 ULID）。
 * 立即入队 + 立即写本地缓存 + 立即登记本地 manifest。
 * 返回 id（调用方可立即用此 id 绑定 UI）。
 */
export const insertRecord = <T>(type: RecordType, data: T): RecordId => {
  const id = generateUlid();
  const now = new Date().toISOString();
  const record: DatabaseRecord<T> = {
    id,
    type,
    data,
    createdAt: now,
    updatedAt: now
  };
  writeRecordCache(record);
  upsertLocalManifestEntry(id, type, false, now);
  enqueueWrite(id, type, data, false);
  return id;
};

/**
 * 按 id 更新 record（集合或单例通用）。
 * 立即入队 + 立即写本地缓存 + 立即更新本地 manifest 的时间戳。
 */
export const updateRecord = <T>(
  id: RecordId,
  type: RecordType,
  data: T,
  singleton = false
): void => {
  const now = new Date().toISOString();
  const existing = readRecordCache<T>(id);
  const record: DatabaseRecord<T> = {
    id,
    type,
    data,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now
  };
  // 保留原有 sha（仅更新 data，文件 sha 未变，PUT 时仍用作乐观锁凭证）
  writeRecordCache(record, readRecordSha(id));
  upsertLocalManifestEntry(id, type, singleton, now);
  enqueueWrite(id, type, data, singleton);
};

/**
 * 按 id 删除 record。
 * 立即入队 + 立即清本地缓存 + 立即从本地 manifest 移除。
 */
export const deleteRecord = (id: RecordId): void => {
  removeRecordCache(id);
  removeLocalManifestEntry(id);
  enqueueDelete(id);
};

// ── Blob API（大文本，如笔记正文） ──────────────────────────

/**
 * 读取 blob 文本。
 * @param id record id
 * @param ext 文件扩展名（如 "md"）
 */
export const readBlob = async (id: RecordId, ext: string): Promise<string | null> => {
  return getBlob(blobFilePath(id, ext));
};

/**
 * 写入 blob 文本（立即入队，不走 debounce 队列——大文本通常用户主动保存）。
 * 返回 BlobRef（含 file 和 sha），调用方需把 BlobRef 存到 record.data 里。
 *
 * 注意：blob 写入是同步的（await），不走队列。如果失败由调用方处理。
 */
export const writeBlob = async (
  id: RecordId,
  ext: string,
  content: string,
  message: string,
  existingSha?: string
): Promise<BlobRef | null> => {
  const path = blobFilePath(id, ext);
  let sha = existingSha;
  // 最多重试 3 次：409 sha 冲突时拉远端 sha 重试
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await putBlob(path, content, message, sha);
    if (result.ok) {
      return { file: path, sha: result.sha };
    }
    if (result.error === "sha-conflict") {
      // 文件已存在但本地 sha 过期/缺失，拉远端最新 sha 重试
      sha = await getFileSha(path);
      continue;
    }
    // no-pat / network / unknown：不重试
    return null;
  }
  console.error("[database] writeBlob sha-conflict retry exhausted:", path);
  return null;
};

/**
 * 删除 blob 文件。
 */
export const removeBlob = async (ref: BlobRef, message: string): Promise<boolean> => {
  const result = await deleteBlob(ref, message);
  return result.ok;
};

// ── 二进制 blob（ Finder 任意类型文件用） ─────────────────────

/**
 * 读取 blob 的原始 bytes（二进制安全，不经过 TextDecoder）。
 * 用于图片/音频/视频等非文本文件。文本文件请用 readBlob。
 */
export const readBlobBytes = async (
  id: RecordId,
  ext: string
): Promise<Uint8Array | null> => {
  return getBlobBytes(blobFilePath(id, ext));
};

/**
 * 写入 blob 的原始 bytes（二进制安全，不经过 TextEncoder）。
 * 用于图片/音频/视频等非文本文件。文本文件请用 writeBlob。
 * 返回 BlobRef（含 file 和 sha），调用方需把 BlobRef 存到 record.data 里。
 */
export const writeBlobBytes = async (
  id: RecordId,
  ext: string,
  bytes: Uint8Array,
  message: string,
  existingSha?: string
): Promise<BlobRef | null> => {
  const path = blobFilePath(id, ext);
  let sha = existingSha;
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = await putBlobBytes(path, bytes, message, sha);
    if (result.ok) {
      return { file: path, sha: result.sha };
    }
    if (result.error === "sha-conflict") {
      sha = await getFileSha(path);
      continue;
    }
    return null;
  }
  console.error("[database] writeBlobBytes sha-conflict retry exhausted:", path);
  return null;
};

// ── 关键时刻 flush ──────────────────────────────────────────

/** 立即刷盘所有待处理任务（beforeunload / 页面隐藏时调用） */
export const flushAll = flushNow;

/** 订阅队列状态（用于 UI 显示"保存中"指示） */
export { onQueueStatus };

/** 是否有未刷盘任务 */
export { hasPending } from "./queue";

// ── PAT 管理（与原 typora.ts 共用） ──────────────────────────

export { getPat, setPat, clearPat, hasPat, rawUrl } from "./github";

// ── Manifest 直查（高级 API，慎用） ──────────────────────────

export { fetchManifest, getManifestLocal, findSingleton };
