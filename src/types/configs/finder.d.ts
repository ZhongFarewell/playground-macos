import type { DatabaseRecord, BlobRef } from "~/services/database/types";

/**
 * Finder 文件系统条目元数据（存于 record.data）。
 *
 * 设计：文件/文件夹统一一条 `finder:entry` 类型 record（集合型，id = ULID）。
 * - record.data = FinderEntryData（本接口）
 * - 文件内容走 GitHub blob（与 Typora 笔记同模式，存 blobs/{id}.{ext}）
 * - 文件夹是"无 blob 的 record"
 *
 * macOS 对齐：Finder 里文件和文件夹是同一套视图（图标/列表/分栏），
 * 用单 type + kind 字段区分，符合"按同时改的字段捆一起"原则。
 */
export interface FinderEntryData {
  /** 条目名（含扩展名，如 "report.md"） */
  name: string;
  /** 父文件夹的 record id；根目录为 ROOT_PARENT_ID */
  parentId: string;
  /** file 或 folder */
  kind: EntryKind;
  /**
   * 仅 file 有：文件内容 blob 引用（文件路径 + sha）。
   * 内容存 GitHub blobs/{id}.{ext}，走 database 模块的 writeBlob/readBlob。
   */
  blob?: BlobRef;
  /** 扩展名（如 "md"），从 name 提取，用于图标/预览 */
  ext?: string;
  /** 文件大小（字节），用于 UI 展示 */
  size?: number;
  /** 上传中标记：拖入本地文件时先创建 record（无 blob），后台异步上传内容 */
  uploading?: boolean;
  /** Trash：是否在废纸篓中（软删除标记） */
  trashed?: boolean;
  /** Trash：移入废纸篓的时间（ISO 字符串） */
  trashedAt?: string;
  /** Trash：原始 parentId（恢复时用） */
  originalParentId?: string;
}

/** UI 层使用的条目对象（由 record 转换，隐藏 record 结构） */
export interface FinderEntry {
  /** record id（ULID） */
  id: string;
  name: string;
  parentId: string;
  kind: EntryKind;
  /** 文件内容 blob 引用（文件路径 + sha） */
  blob?: BlobRef;
  ext?: string;
  size?: number;
  /** 上传中标记 */
  uploading?: boolean;
  trashed: boolean;
  trashedAt?: string;
  originalParentId?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** 条目类型 */
export type EntryKind = "file" | "folder";
