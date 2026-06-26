import type { BlobRef } from "~/services/database/types";

/**
 * Typora 笔记元数据（存于 record.data）。
 *
 * 改造后：笔记是 database 里的 `typora:note` 类型 record。
 * - record.id = ULID（集合型）
 * - record.data = TyporaNoteData（本接口）
 * - 正文存 blobs/{id}.md，通过 blob 引用
 *
 * UI 层用 TyporaNote 包装一下，对组件隐藏 record 结构，
 * 让 TyporaOpenPanel 等组件的改动最小。
 */
export interface TyporaNoteData {
  title: string;
  excerpt?: string;
  /** 笔记正文 blob 引用（文件路径 + sha） */
  blob: BlobRef;
}

/**
 * UI 层使用的笔记对象。
 * 由 record 转换而来：record.id → id，record.data → data 字段展开 + 时间戳。
 */
export interface TyporaNote {
  /** record id（ULID） */
  id: string;
  title: string;
  excerpt?: string;
  /** blob 文件路径，如 "blobs/01JXY....md" */
  file: string;
  /** blob 文件的 sha（写入时用作乐观锁） */
  blobSha?: string;
  createdAt?: string;
  updatedAt?: string;
}
