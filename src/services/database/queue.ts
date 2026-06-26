/**
 * 写任务队列。
 *
 * 职责：
 * - 状态变化时立即入队（不阻塞业务）
 * - 入队即触发 flush（不 debounce）
 * - 最多并发 3 条任务（避免撞 GitHub 限流 + 控制带宽）
 * - 相同 key 后到覆盖先到（去重，最新数据为准）
 * - sha 冲突自动重试（重新拉远端 sha）
 * - 失败任务保留在队列，下次再试
 *
 * 设计权衡：
 * - 单用户 portfolio，并发极低，并发 3 足够
 * - 不做持久化队列（页面关闭丢失未 flush 任务）——由 localStorage 缓存兜底，
 *   下次启动时 hasPendingChanges 检测到本地领先会重新触发 flush
 */
import { putJson, deleteFile, getFileSha } from "./github";
import { upsertManifestEntry, removeManifestEntry, recordFilePath } from "./manifest";
import {
  writeRecordCache,
  removeRecordCache,
  readRecordSha,
  updateRecordSha,
  readRecordCache
} from "./cache";
import type { DatabaseRecord, ManifestEntry, QueueTask, RecordId } from "./types";

const MAX_RETRY = 3;
/** 单个任务内部 sha 冲突重试次数（含首次尝试） */
const SHA_RETRY = 2;
/** 最大并发任务数 */
const MAX_CONCURRENCY = 3;

const queue: Map<string, QueueTask> = new Map();
let seq = 0;
let running = false;
let statusListeners: Array<(running: boolean) => void> = [];

/** 订阅队列状态变化（UI 可用于显示"保存中"指示） */
export const onQueueStatus = (fn: (running: boolean) => void): (() => void) => {
  statusListeners.push(fn);
  return () => {
    statusListeners = statusListeners.filter((f) => f !== fn);
  };
};

const setStatus = (running: boolean) => {
  statusListeners.forEach((fn) => fn(running));
};

/** 入队一个写任务。相同 key 后到覆盖先到。入队即触发 flush。 */
export const enqueueWrite = (
  id: RecordId,
  type: string,
  data: unknown,
  singleton: boolean
): void => {
  const task: QueueTask = {
    key: id,
    op: "write",
    type,
    data,
    singleton,
    seq: seq++
  };
  queue.set(task.key, task);
  void flush();
};

/** 入队一个删除任务。入队即触发 flush。 */
export const enqueueDelete = (id: RecordId): void => {
  const task: QueueTask = {
    key: id,
    op: "delete",
    seq: seq++
  };
  queue.set(task.key, task);
  void flush();
};

/** 立即触发 flush（用于 beforeunload 等关键时刻） */
export const flushNow = async (): Promise<void> => {
  await flush();
};

/** 当前队列是否还有待处理任务 */
export const hasPending = (): boolean => queue.size > 0 || running;

/**
 * 执行队列：并发处理所有任务，最多并发 MAX_CONCURRENCY。
 * 相同 key 的任务在入队时已去重（Map 后到覆盖先到）。
 */
const flush = async (): Promise<void> => {
  if (running) return;
  if (queue.size === 0) return;

  running = true;
  setStatus(true);

  // 循环处理：每轮取最多 MAX_CONCURRENCY 条并发执行
  while (queue.size > 0) {
    const batch = Array.from(queue.values())
      .sort((a, b) => a.seq - b.seq)
      .slice(0, MAX_CONCURRENCY);
    // 从队列移除（执行期间新入队的会留下）
    for (const t of batch) queue.delete(t.key);

    // 并发执行本批
    const results = await Promise.all(
      batch.map(async (task) => {
        for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
          try {
            const result =
              task.op === "write" ? await executeWrite(task) : await executeDelete(task);
            if (result.ok) return { ok: true, retryable: false };
            // 永久错误（no-pat）直接放弃，不再重试
            if (!result.retryable) return { ok: false, retryable: false };
          } catch {
            // 网络错重试
          }
        }
        return { ok: false, retryable: true };
      })
    );

    // 失败且可重试的重新入队（no-pat 等永久错误丢弃）
    results.forEach((r, i) => {
      if (!r.ok && r.retryable) queue.set(batch[i].key, { ...batch[i], seq: seq++ });
    });
  }

  running = false;
  setStatus(false);
};

/**
 * 执行单个写任务：写 record 文件 + 更新 manifest。
 *
 * sha 缓存策略（避免每次写都 GET 拿 sha）：
 * - 第一次尝试：用本地缓存的 sha 直接 PUT
 * - sha 冲突时：GET 拉远端最新 sha 重试一次
 * - PUT 成功后：从响应拿新 sha 更新本地缓存
 *
 * 返回 retryable=false 表示永久错误（如 no-pat），不应重新入队。
 */
const executeWrite = async (
  task: QueueTask
): Promise<{ ok: boolean; retryable: boolean }> => {
  if (task.op !== "write" || !task.type) return { ok: false, retryable: false };

  const id = task.key;
  const now = new Date().toISOString();

  // 读本地缓存拿 createdAt（更新场景保留原创建时间）+ sha
  const cachedRecord = readRecordCache(id);
  const createdAt = cachedRecord?.createdAt ?? now;
  let sha = readRecordSha(id); // 本地 sha（可能 undefined = 新建）

  // 构造 record
  const record: DatabaseRecord = {
    id,
    type: task.type,
    data: task.data,
    createdAt,
    updatedAt: now
  };

  // PUT record 文件，sha 冲突时拉远端重试
  let writeResult;
  for (let attempt = 0; attempt < SHA_RETRY; attempt++) {
    writeResult = await putJson(
      recordFilePath(id),
      record,
      `Update ${task.type} ${id}`,
      sha
    );
    if (writeResult.ok) break;

    if (writeResult.error === "sha-conflict") {
      // 本地 sha 过期，拉远端最新 sha 重试
      sha = await getFileSha(recordFilePath(id));
      continue;
    }
    // no-pat 是永久错误，不重试；network/unknown 也直接放弃（外层 MAX_RETRY 会重试）
    return { ok: false, retryable: writeResult.error !== "no-pat" };
  }
  if (!writeResult?.ok) return { ok: false, retryable: true };

  // 更新 manifest
  const entry: ManifestEntry = {
    id,
    type: task.type,
    singleton: task.singleton ?? false,
    file: recordFilePath(id),
    sha: writeResult.sha,
    updatedAt: now
  };
  const manifest = await upsertManifestEntry(entry, `Index ${task.type} ${id}`);
  if (!manifest) return { ok: false, retryable: true };

  // 同步本地缓存（用 PUT 响应里的新 sha）
  writeRecordCache(record, writeResult.sha);
  return { ok: true, retryable: false };
};

/**
 * 执行单个删除任务：删 record 文件 + 移除 manifest 条目。
 *
 * sha 缓存策略：本地 sha 优先，冲突时拉远端重试。
 *
 * 返回 retryable=false 表示永久错误（如 no-pat），不应重新入队。
 */
const executeDelete = async (
  task: QueueTask
): Promise<{ ok: boolean; retryable: boolean }> => {
  if (task.op !== "delete") return { ok: false, retryable: false };

  const id = task.key;
  const path = recordFilePath(id);

  // 本地 sha 优先，没有则拉远端
  let sha = readRecordSha(id);
  if (!sha) sha = await getFileSha(path);

  if (sha) {
    let delOk = false;
    let retryable = true;
    for (let attempt = 0; attempt < SHA_RETRY; attempt++) {
      const delResult = await deleteFile(path, `Delete record ${id}`, sha);
      if (delResult.ok) {
        delOk = true;
        break;
      }
      if (delResult.error === "sha-conflict") {
        // 文件已被改，拉最新 sha 重试
        sha = await getFileSha(path);
        if (!sha) {
          // 文件已不存在（别人已删），视为成功
          delOk = true;
          break;
        }
        continue;
      }
      // no-pat 是永久错误；其他错也放弃（外层 MAX_RETRY 会重试）
      retryable = delResult.error !== "no-pat";
      break;
    }
    if (!delOk) return { ok: false, retryable };
  }

  // manifest 移除条目
  const manifest = await removeManifestEntry(id, `Unindex ${id}`);
  if (!manifest) return { ok: false, retryable: true };

  removeRecordCache(id);
  return { ok: true, retryable: false };
};
