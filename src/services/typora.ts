/**
 * Typora 笔记持久化（基于 macos-database 系统）。
 *
 * 数据模型：
 * - 每篇笔记 = 一条 `typora:note` 类型 record（id = ULID）
 * - record.data = { title, excerpt, blob: { file, sha } }
 * - 正文存 blobs/{id}.md（走 blob API）
 * - meta（title/excerpt/时间）存 record 文件
 *
 * PAT 兼容：检测旧 `typora_github_pat` 自动迁到 `database_github_pat`。
 *
 * macOS 对齐：真实 Typora 用本地文件系统 + 系统 Save 对话框；
 * 浏览器无文件系统，改用 GitHub 仓库做存储后端，系统对话框用自定义 modal 替代。
 */
import {
  queryByType,
  updateRecord,
  getRecord,
  readBlob,
  writeBlob,
  getPat,
  setPat,
  hasPat
} from "~/services/database";
import type { DatabaseRecord } from "~/services/database/types";
import type { TyporaNote, TyporaNoteData } from "~/types";

// ── PAT 迁移（旧 key → 新 key，一次性） ─────────────────────────

const OLD_PAT_KEY = "typora_github_pat";
const NEW_PAT_KEY = "database_github_pat";

const migratePat = (): void => {
  const old = localStorage.getItem(OLD_PAT_KEY);
  const next = localStorage.getItem(NEW_PAT_KEY);
  if (old && !next) {
    localStorage.setItem(NEW_PAT_KEY, old);
  }
  if (old) localStorage.removeItem(OLD_PAT_KEY);
};

// 模块加载时自动迁移
migratePat();

/** 读取 PAT（转发到 database 模块） */
export { getPat, setPat, hasPat };

// ── record ↔ TyporaNote 转换 ──────────────────────────────────

const toNote = (record: DatabaseRecord<TyporaNoteData>): TyporaNote => ({
  id: record.id,
  title: record.data.title,
  excerpt: record.data.excerpt,
  file: record.data.blob.file,
  blobSha: record.data.blob.sha,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

// ── 对外 API ──────────────────────────────────────────────────

/**
 * 列出所有笔记（只拉 meta，不拉正文）。
 * 走 queryByType，本地缓存优先，按 updatedAt 降序（最近改的在前）。
 */
export const listNotes = async (): Promise<TyporaNote[]> => {
  const records = await queryByType<TyporaNoteData>("typora:note");
  return records
    .map(toNote)
    .sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
};

/**
 * 读取单篇笔记正文。
 * 走 readBlob(id, "md")，内部按 blobs/{id}.md 取。
 */
export const getNoteContent = async (note: TyporaNote): Promise<string | null> => {
  return readBlob(note.id, "md");
};

/**
 * 保存已存在的笔记（覆盖更新）。
 * macOS 对齐：Cmd+S 直接覆盖，不弹框。
 *
 * 流程：
 * 1. 写 blob（正文），用缓存的 blobSha 避免每次 GET
 * 2. 更新 record（meta + 新 blob 引用）
 *
 * @returns 更新后的 note（含新 blobSha），失败返回 null
 */
export const saveNote = async (
  note: TyporaNote,
  content: string
): Promise<TyporaNote | null> => {
  // 1. 写 blob 正文（带 sha 避免每次 GET）
  const blobResult = await writeBlob(
    note.id,
    "md",
    content,
    `Update content of ${note.title}`,
    note.blobSha
  );
  if (!blobResult) return null;

  // 2. 更新 record（meta + 新 blob 引用）
  const data: TyporaNoteData = {
    title: note.title,
    excerpt: content.slice(0, 80).replace(/\n/g, " "),
    blob: blobResult
  };
  updateRecord(note.id, "typora:note", data, false);

  const now = new Date().toISOString();
  return {
    ...note,
    excerpt: data.excerpt,
    file: blobResult.file,
    blobSha: blobResult.sha,
    updatedAt: now
  };
};

/**
 * 新建笔记：生成 ULID + 写 blob + 写 record。
 * 返回创建好的 note（含 id）。
 *
 * 流程：
 * 1. 生成 ULID（立即拿到 id）
 * 2. 写 blob 正文（同步 await，确保正文已上传）
 * 3. 入队 record（meta + blob 引用）
 *
 * 注意：record 写入是异步入队的，但 ULID 立即返回，
 * 调用方可以立即用此 id 绑定 UI。
 */
export const createNote = async (
  title: string,
  content: string
): Promise<TyporaNote | null> => {
  // 1. 生成 ULID
  const { generateUlid } = await import("~/services/database");
  const id = generateUlid();

  // 2. 写 blob 正文（新建，无 sha）
  const blobResult = await writeBlob(id, "md", content, `Create ${title}`);
  if (!blobResult) return null;

  // 3. 入队 record
  const data: TyporaNoteData = {
    title,
    excerpt: content.slice(0, 80).replace(/\n/g, " "),
    blob: blobResult
  };
  updateRecord(id, "typora:note", data, false);

  const now = new Date().toISOString();
  return {
    id,
    title,
    excerpt: data.excerpt,
    file: blobResult.file,
    blobSha: blobResult.sha,
    createdAt: now,
    updatedAt: now
  };
};

/**
 * 重命名笔记：只更新 record.data.title，不动 blob。
 * macOS Finder 双击重命名风格；md 文件名与 title 解耦。
 */
export const renameNote = async (
  note: TyporaNote,
  newTitle: string
): Promise<boolean> => {
  // 拉最新 record（拿 excerpt 和 blob 引用）
  const record = await getRecord<TyporaNoteData>(note.id);
  if (!record) return false;

  const data: TyporaNoteData = {
    ...record.data,
    title: newTitle
  };
  updateRecord(note.id, "typora:note", data, false);
  return true;
};
