/**
 * Finder 文件系统持久化（基于 macos-database 系统）。
 *
 * 数据模型：
 * - 每个文件/文件夹 = 一条 `finder:entry` 类型 record（id = ULID，集合型）
 * - record.data = FinderEntryData（name/parentId/kind/blob/...）
 * - 文件内容走 GitHub blob（存 blobs/{id}.{ext}，与 Typora 笔记同模式）
 * - 文件夹是"无 blob 的 record"
 *
 * Trash 采用软删除：trashed=true + parentId="trash" + originalParentId 保留原位。
 * 清空 Trash = 物理删除 record + removeBlob 清理文件内容。
 *
 * macOS 对齐：Finder 里文件和文件夹是同一套视图，用单 type + kind 字段区分。
 */
import {
  queryByType,
  insertRecord,
  updateRecord,
  deleteRecord,
  getRecord,
  readBlobBytes,
  writeBlobBytes,
  removeBlob
} from "~/services/database";
import type { DatabaseRecord, BlobRef } from "~/services/database/types";
import type { FinderEntry, FinderEntryData } from "~/types";

// ── 常量 ─────────────────────────────────────────────────────

/** 根目录的 parentId */
export const ROOT_PARENT_ID = "root";
/** Trash 的虚拟 parentId（trashed=true 的条目逻辑上在此） */
export const TRASH_PARENT_ID = "trash";
/** finder:entry type 字符串 */
const ENTRY_TYPE = "finder:entry";

// ── record ↔ FinderEntry 转换 ───────────────────────────────

const toEntry = (record: DatabaseRecord<FinderEntryData>): FinderEntry => ({
  id: record.id,
  name: record.data.name,
  parentId: record.data.parentId,
  kind: record.data.kind,
  blob: record.data.blob,
  ext: record.data.ext,
  size: record.data.size,
  trashed: record.data.trashed ?? false,
  trashedAt: record.data.trashedAt,
  originalParentId: record.data.originalParentId,
  createdAt: record.createdAt,
  updatedAt: record.updatedAt
});

/** 从文件名提取扩展名（小写，无点则无扩展名） */
const extractExt = (name: string): string | undefined => {
  const idx = name.lastIndexOf(".");
  if (idx <= 0 || idx === name.length - 1) return undefined;
  return name.slice(idx + 1).toLowerCase();
};

// ── 读取 ─────────────────────────────────────────────────────

/**
 * 列出某文件夹下的条目（不含 Trash 中的）。
 * 走 queryByType 全量拉取，内存过滤 parentId 且 !trashed。
 * 文件夹在前（按 name 排序），文件在后（按 name 排序）—— 对齐 macOS Finder 默认排序。
 */
export const listEntries = async (parentId: string): Promise<FinderEntry[]> => {
  const records = await queryByType<FinderEntryData>(ENTRY_TYPE);
  const entries = records
    .map(toEntry)
    .filter((e) => e.parentId === parentId && !e.trashed);
  // 文件夹优先，各自按 name 升序
  return entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
};

/**
 * 列出 Trash 中的条目（trashed === true）。
 * 按 trashedAt 降序（最近删除的在前）。
 */
export const listTrash = async (): Promise<FinderEntry[]> => {
  const records = await queryByType<FinderEntryData>(ENTRY_TYPE);
  return records
    .map(toEntry)
    .filter((e) => e.trashed)
    .sort((a, b) => (b.trashedAt || "").localeCompare(a.trashedAt || ""));
};

/** 按 id 读单条 */
export const getEntry = async (id: string): Promise<FinderEntry | null> => {
  const record = await getRecord<FinderEntryData>(id);
  return record ? toEntry(record) : null;
};

// ── 创建 ─────────────────────────────────────────────────────

/**
 * 新建文件（立即创建占位 record，后台异步上传内容）。
 * 立即返回 entry（uploading:true，无 blob），调用方刷新 UI 即可看到占位。
 * 后台异步 writeBlobBytes，完成后 updateRecord 清除 uploading 标记 + 写入 blob 引用。
 *
 * @param name 文件名（含扩展名）
 * @param parentId 父文件夹 id
 * @param content 文件内容（原始 bytes，二进制安全）
 * @param onUploaded 可选回调：上传完成后调用（传回更新后的 entry）
 * @returns 立即返回占位 entry（uploading:true），失败返回 null
 */
export const createFile = async (
  name: string,
  parentId: string,
  content: Uint8Array,
  onUploaded?: (entry: FinderEntry) => void
): Promise<FinderEntry | null> => {
  const ext = extractExt(name) || "txt";
  const now = new Date().toISOString();

  // 1. 立即创建占位 record（无 blob，uploading:true）
  //    用 insertRecord 返回的 id，不能自己 generateUlid()——否则 record 与 blob 的 id 不一致
  const placeholderData: FinderEntryData = {
    name,
    parentId,
    kind: "file",
    ext,
    size: content.byteLength,
    uploading: true
  };
  const id = insertRecord(ENTRY_TYPE, placeholderData);

  const placeholder: FinderEntry = {
    id,
    name,
    parentId,
    kind: "file",
    ext,
    size: content.byteLength,
    uploading: true,
    trashed: false,
    createdAt: now,
    updatedAt: now
  };

  // 2. 后台异步写 blob + 更新 record（不 await，立即返回占位）
  (async () => {
    try {
      const blobResult = await writeBlobBytes(id, ext, content, `Create ${name}`);
      if (!blobResult) {
        console.error(
          "[finder] background upload failed (writeBlobBytes returned null):",
          name
        );
        return;
      }
      const record = await getRecord<FinderEntryData>(id);
      if (!record) return;
      const data: FinderEntryData = {
        ...record.data,
        blob: blobResult,
        uploading: false
      };
      updateRecord(id, ENTRY_TYPE, data, false);
      onUploaded?.({
        ...placeholder,
        blob: blobResult,
        uploading: false,
        updatedAt: new Date().toISOString()
      });
    } catch (err) {
      console.error("[finder] background upload failed:", name, err);
    }
  })();

  return placeholder;
};

/**
 * 新建文件夹。
 * @param name 文件夹名
 * @param parentId 父文件夹 id
 */
export const createFolder = async (
  name: string,
  parentId: string
): Promise<FinderEntry | null> => {
  const data: FinderEntryData = {
    name,
    parentId,
    kind: "folder"
  };
  // 用 insertRecord 返回的 id，不能自己 generateUlid()——否则返回的 id 与 record 实际 id 不一致
  const id = insertRecord(ENTRY_TYPE, data);
  const now = new Date().toISOString();
  return {
    id,
    name,
    parentId,
    kind: "folder",
    trashed: false,
    createdAt: now,
    updatedAt: now
  };
};

// ── 文件内容读写 ─────────────────────────────────────────────

/**
 * 读取文件内容（原始 bytes，二进制安全）。
 * 走 readBlobBytes(id, ext)，内部按 blobs/{id}.{ext} 取。
 */
export const readFileContent = async (entry: FinderEntry): Promise<Uint8Array | null> => {
  if (!entry.blob || !entry.ext) return null;
  return readBlobBytes(entry.id, entry.ext);
};

/**
 * 保存文件内容（覆盖更新，二进制安全）。
 * 流程：1. 写 blob（带 sha 避免每次 GET）2. 更新 record（meta + 新 blob 引用）
 * @returns 更新后的 entry，失败返回 null
 */
export const saveFileContent = async (
  entry: FinderEntry,
  content: Uint8Array
): Promise<FinderEntry | null> => {
  if (!entry.ext) return null;
  const ext = entry.ext;

  // 1. 写 blob 正文（带 sha 避免每次 GET）
  const blobResult = await writeBlobBytes(
    entry.id,
    ext,
    content,
    `Update content of ${entry.name}`,
    entry.blob?.sha
  );
  if (!blobResult) return null;

  // 2. 更新 record（meta + 新 blob 引用）
  const record = await getRecord<FinderEntryData>(entry.id);
  if (!record) return null;

  const data: FinderEntryData = {
    ...record.data,
    blob: blobResult,
    size: content.byteLength
  };
  updateRecord(entry.id, ENTRY_TYPE, data, false);

  return {
    ...entry,
    blob: blobResult,
    size: content.byteLength,
    updatedAt: new Date().toISOString()
  };
};

// ── 修改 ─────────────────────────────────────────────────────

/**
 * 重命名条目。
 * 文件会同时更新 ext 字段（从新 name 提取）。
 */
export const renameEntry = async (
  entry: FinderEntry,
  newName: string
): Promise<boolean> => {
  const record = await getRecord<FinderEntryData>(entry.id);
  if (!record) return false;

  const data: FinderEntryData = {
    ...record.data,
    name: newName,
    ext: entry.kind === "file" ? extractExt(newName) : record.data.ext
  };
  updateRecord(entry.id, ENTRY_TYPE, data, false);
  return true;
};

/**
 * 移动条目到新父文件夹。
 * macOS Finder 拖拽移动语义。
 */
export const moveEntry = async (
  entry: FinderEntry,
  newParentId: string
): Promise<boolean> => {
  const record = await getRecord<FinderEntryData>(entry.id);
  if (!record) return false;

  const data: FinderEntryData = {
    ...record.data,
    parentId: newParentId
  };
  updateRecord(entry.id, ENTRY_TYPE, data, false);
  return true;
};

// ── 复制 ─────────────────────────────────────────────────────

/**
 * 复制单条文件到目标文件夹（新 id + 复制 blob 内容，不共享 blob）。
 * macOS 对齐：复制后的文件名加 " copy" 后缀（如 "report.md" → "report copy.md"）。
 */
export const copyFile = async (
  entry: FinderEntry,
  newParentId: string
): Promise<FinderEntry | null> => {
  if (entry.kind !== "file" || !entry.ext) return null;

  // 1. 读原文件内容（二进制安全）
  const content = await readBlobBytes(entry.id, entry.ext);
  if (content === null) {
    console.error("[finder] copyFile: failed to read source blob", entry.id);
    return null;
  }

  // 2. 生成新文件名（加 " copy" 后缀，macOS 风格）
  const dotIdx = entry.name.lastIndexOf(".");
  const newName =
    dotIdx > 0
      ? `${entry.name.slice(0, dotIdx)} copy.${entry.name.slice(dotIdx + 1)}`
      : `${entry.name} copy`;

  // 3. 先 insertRecord 拿到 id（不能用自己 generateUlid，否则 record 与 blob id 不一致）
  const data: FinderEntryData = {
    name: newName,
    parentId: newParentId,
    kind: "file",
    ext: entry.ext,
    size: content.byteLength
  };
  const newId = insertRecord(ENTRY_TYPE, data);

  // 4. 写到新 id（新 blob，不共享）
  const blobResult = await writeBlobBytes(
    newId,
    entry.ext,
    content,
    `Copy ${entry.name}`
  );
  if (!blobResult) {
    // blob 写失败：回滚 record
    deleteRecord(newId);
    return null;
  }

  // 5. 更新 record 补 blob 引用
  const updatedData: FinderEntryData = { ...data, blob: blobResult };
  updateRecord(newId, ENTRY_TYPE, updatedData, false);

  const now = new Date().toISOString();
  return {
    id: newId,
    name: newName,
    parentId: newParentId,
    kind: "file",
    blob: blobResult,
    ext: entry.ext,
    size: content.byteLength,
    trashed: false,
    createdAt: now,
    updatedAt: now
  };
};

/**
 * 递归复制文件夹到目标文件夹。
 * 创建新文件夹 record + 递归复制所有子条目。
 */
export const copyFolderRecursive = async (
  entry: FinderEntry,
  newParentId: string
): Promise<FinderEntry | null> => {
  if (entry.kind !== "folder") return null;

  // 1. 创建新文件夹（name 加 " copy" 后缀）
  const newFolder = await createFolder(`${entry.name} copy`, newParentId);
  if (!newFolder) return null;

  // 2. 递归复制子条目
  const children = await listEntries(entry.id);
  for (const child of children) {
    await copyEntry(child, newFolder.id);
  }

  return newFolder;
};

/**
 * 统一复制入口：文件 → copyFile，文件夹 → copyFolderRecursive。
 */
export const copyEntry = async (
  entry: FinderEntry,
  newParentId: string
): Promise<FinderEntry | null> => {
  if (entry.kind === "folder") {
    return copyFolderRecursive(entry, newParentId);
  }
  return copyFile(entry, newParentId);
};

// ── Trash（软删除） ─────────────────────────────────────────

/**
 * 移到 Trash（软删除）。
 * 标记 trashed=true + 记录 originalParentId + parentId 改为 "trash"。
 */
export const trashEntry = async (entry: FinderEntry): Promise<boolean> => {
  const record = await getRecord<FinderEntryData>(entry.id);
  if (!record) return false;

  const data: FinderEntryData = {
    ...record.data,
    trashed: true,
    trashedAt: new Date().toISOString(),
    originalParentId: record.data.parentId,
    parentId: TRASH_PARENT_ID
  };
  updateRecord(entry.id, ENTRY_TYPE, data, false);
  return true;
};

/**
 * 从 Trash 恢复。
 * 回填 parentId = originalParentId，清除 trashed 标记。
 * 边界：originalParentId 无效（指向已删/也在 Trash 的文件夹）→ 回填到根目录。
 */
export const restoreEntry = async (entry: FinderEntry): Promise<boolean> => {
  const record = await getRecord<FinderEntryData>(entry.id);
  if (!record) return false;

  const originalParentId = record.data.originalParentId;
  let restoreTo = originalParentId ?? ROOT_PARENT_ID;

  // 校验原父目录是否有效（存在且不在 Trash 中）
  if (restoreTo !== ROOT_PARENT_ID) {
    const parent = await getRecord<FinderEntryData>(restoreTo);
    if (!parent || parent.data.trashed || parent.data.kind !== "folder") {
      restoreTo = ROOT_PARENT_ID;
    }
  }

  const data: FinderEntryData = {
    ...record.data,
    parentId: restoreTo,
    trashed: false,
    trashedAt: undefined,
    originalParentId: undefined
  };
  updateRecord(entry.id, ENTRY_TYPE, data, false);
  return true;
};

/**
 * 递归移文件夹到 Trash。
 * 先递归 trash 所有子条目，再 trash 文件夹本身。
 */
export const trashFolderRecursive = async (folder: FinderEntry): Promise<void> => {
  if (folder.kind !== "folder") return;
  const children = await listEntries(folder.id);
  for (const child of children) {
    if (child.kind === "folder") {
      await trashFolderRecursive(child);
    } else {
      await trashEntry(child);
    }
  }
  await trashEntry(folder);
};

// ── 物理删除 ────────────────────────────────────────────────

/**
 * 立即删除单条条目（物理删除，不进 Trash）。
 * Trash 视图里的"Delete Immediately"用此函数。
 * 若有 blob，先 removeBlob 清理文件内容（责任在调用方，见 data-model.md:88）。
 */
export const deleteEntryImmediately = async (entry: FinderEntry): Promise<void> => {
  if (entry.blob) {
    await removeBlob(entry.blob, `Delete ${entry.name}`);
  }
  deleteRecord(entry.id);
};

/**
 * 清空 Trash：物理删除所有 trashed 条目。
 * 对每个条目：
 * 1. 若有 blob，removeBlob 清理文件内容（失败不阻断）
 * 2. deleteRecord 删 GitHub record
 *
 * 注意：blob 清理责任在调用方（见 data-model.md:88）。
 */
export const emptyTrash = async (entries: FinderEntry[]): Promise<void> => {
  for (const entry of entries) {
    if (entry.blob) {
      await removeBlob(entry.blob, `Empty Trash: delete ${entry.name}`);
    }
    deleteRecord(entry.id);
  }
};

// ── 首次启动播种 ─────────────────────────────────────────────

/** macOS 默认文件夹（Home 下） */
const DEFAULT_FOLDERS = [
  "Desktop",
  "Documents",
  "Downloads",
  "Applications",
  "Movies",
  "Music",
  "Pictures"
];

/**
 * 检查并播种默认文件夹。
 * 若根目录下无任何文件夹，则批量创建 macOS 默认文件夹（Desktop/Documents/Downloads/Applications/Movies/Music/Pictures）。
 * 幂等：根目录下已有文件夹则跳过。
 *
 * 判断依据是"根目录下的文件夹"而非"任何 finder:entry"，避免孤儿数据（如 Trash 中的条目）阻止播种。
 */
export const seedDefaultFolders = async (): Promise<void> => {
  const existing = await listEntries(ROOT_PARENT_ID);
  const hasFolder = existing.some((e) => e.kind === "folder");
  if (hasFolder) return;
  for (const name of DEFAULT_FOLDERS) {
    await createFolder(name, ROOT_PARENT_ID);
  }
};
