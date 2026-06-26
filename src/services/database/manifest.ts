/**
 * _manifest.json 清单管理。
 *
 * 仓库根目录唯一的索引文件，所有 record 的元信息（id/type/file/sha/updatedAt）登记在此。
 * 查询走 manifest（本地缓存优先），按需再拉具体 record 文件。
 *
 * 写入流程（PATCH 单条目）：
 * 1. GET _manifest.json 拿最新 sha + 内容
 * 2. 修改单条 entry
 * 3. PUT _manifest.json（带 sha）
 * 4. 409/422 冲突 → 回到第 1 步重试，最多 N 次
 *
 * 单用户 portfolio 项目并发极低，sha 重试足够兜底。
 */
import { getJson, getJsonWithSha, putJson } from "./github";
import {
  readManifestCache,
  writeManifestCache,
  mergeManifest,
  hasLocalOnlyChanges
} from "./cache";
import type { Manifest, ManifestEntry, RecordId, RecordType } from "./types";

const MANIFEST_PATH = "_manifest.json";
const MAX_RETRY = 3;

/** 空 manifest（仓库初始化时用） */
const emptyManifest = (): Manifest => ({
  version: 1,
  records: []
});

/**
 * 从远端拉取 manifest。
 * 文件不存在（仓库未初始化）返回空 manifest。
 * 同时写入本地缓存（含 sha，供后续 PUT 乐观锁用）。
 */
export const fetchManifest = async (): Promise<Manifest> => {
  const result = await getJsonWithSha<Manifest>(MANIFEST_PATH);
  if (!result || !Array.isArray(result.data.records)) {
    return emptyManifest();
  }
  // 合并本地缓存（保留可能比远端新的本地条目）
  const local = readManifestCache();
  const merged = mergeManifest(result.data, local);
  // 关键：带上远端 sha，后续 PUT 直接用，不必再 GET
  const withSha: Manifest = { ...merged, sha: result.sha };
  writeManifestCache(withSha);
  return withSha;
};

/**
 * 获取 manifest（本地缓存优先，没有则返回空）。
 * 不打网络请求，用于同步初始化场景。
 */
export const getManifestLocal = (): Manifest => {
  return readManifestCache() || emptyManifest();
};

/**
 * 更新 manifest 中的单条 entry。
 * 内部处理 sha 乐观锁 + 重试。
 *
 * sha 缓存策略（避免每次写都全量拉 manifest）：
 * - 第一次尝试：用本地缓存的 sha 直接 PUT（单用户场景几乎总是成功）
 * - sha 冲突时：全量拉远端 manifest 拿最新 sha + 内容，合并后重试
 * - PUT 成功后：从响应里拿新 sha 更新本地缓存，不需要再 GET
 *
 * @param updater 接收当前 manifest，返回更新后的 entries 数组
 * @param message commit message
 */
const updateManifest = async (
  updater: (current: Manifest) => ManifestEntry[],
  message: string
): Promise<Manifest | null> => {
  for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
    let current: Manifest;

    if (attempt === 0) {
      // 第一次尝试：优先用本地缓存，避免全量拉远端
      const local = readManifestCache();
      current = local || (await fetchManifest());
    } else {
      // 冲突重试：必须全量拉远端拿最新 sha + 内容
      current = await fetchManifest();
    }

    const newRecords = updater(current);
    const next: Manifest = { ...current, records: newRecords };

    // PUT（带 sha）。本地缓存的 sha 通常和远端一致，PUT 会成功
    const result = await putJson(MANIFEST_PATH, next, message, current.sha);
    if (result.ok) {
      // PUT 响应里带新 sha，直接用，不需要 GET
      const written: Manifest = { ...next, sha: result.sha };
      writeManifestCache(written);
      return written;
    }

    // sha 冲突 → 下次循环全量拉远端重试
    if (result.error === "sha-conflict") continue;
    // 其他错误（no-pat/network/unknown）→ 放弃
    return null;
  }
  return null;
};

/**
 * 登记/更新一条 record 到 manifest。
 * 写入 record 文件后调用此方法同步 manifest。
 */
export const upsertManifestEntry = async (
  entry: ManifestEntry,
  message: string
): Promise<Manifest | null> => {
  return updateManifest((current) => {
    const idx = current.records.findIndex((r) => r.id === entry.id);
    if (idx === -1) return [...current.records, entry];
    const next = [...current.records];
    next[idx] = entry;
    return next;
  }, message);
};

/**
 * 从 manifest 移除一条 entry。
 * 删除 record 文件后调用。
 */
export const removeManifestEntry = async (
  id: RecordId,
  message: string
): Promise<Manifest | null> => {
  return updateManifest((current) => current.records.filter((r) => r.id !== id), message);
};

// ── 查询（基于本地 manifest，不打网络） ──────────────────────────

/** 按 ID 查 entry */
export const findEntry = (
  manifest: Manifest,
  id: RecordId
): ManifestEntry | undefined => {
  return manifest.records.find((r) => r.id === id);
};

/** 按 type 查所有 entry（集合查询） */
export const findEntriesByType = (
  manifest: Manifest,
  type: RecordType
): ManifestEntry[] => {
  return manifest.records.filter((r) => r.type === type);
};

/** 按 type 查单例 entry */
export const findSingleton = (
  manifest: Manifest,
  type: RecordType
): ManifestEntry | undefined => {
  return manifest.records.find((r) => r.type === type && r.singleton);
};

/** 本地 manifest 是否有未 flush 到远端的修改 */
export const hasPendingChanges = async (): Promise<boolean> => {
  const local = readManifestCache();
  if (!local) return false;
  const remote = await getJson<Manifest>(MANIFEST_PATH);
  if (!remote) return local.records.length > 0;
  return hasLocalOnlyChanges(local, remote);
};

/** record 文件路径规则 */
export const recordFilePath = (id: RecordId): string => `records/${id}.json`;

/** blob 文件路径规则（不带扩展名，调用方自行加 .md 等） */
export const blobFilePath = (id: RecordId, ext: string): string => `blobs/${id}.${ext}`;
