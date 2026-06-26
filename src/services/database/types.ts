/**
 * 数据库核心类型定义。
 *
 * 设计要点：
 * - 所有数据都是 Record，靠 type 字段分类（Notion/Linear 风格）
 * - 单例数据（系统设置、桌面状态）：id === type，一对一
 * - 集合数据（历史记录、书签、笔记）：id = ULID，靠 type 归类
 * - type 命名约定：{app}:{feature}，如 "browser:history"、"system:settings"
 */

/** ULID 字符串（26 位大小写字母数字，时间序可排序） */
export type Ulid = string;

/** record type，约定格式 {app}:{feature}，如 "browser:history" */
export type RecordType = string;

/** 单例数据的 id 等于 type 本身 */
export type SingletonId = RecordType;

/** 集合数据的 id 是 ULID */
export type CollectionId = Ulid;

/** record 的唯一标识：单例时等于 type，集合时是 ULID */
export type RecordId = SingletonId | CollectionId;

/**
 * 单条数据记录。
 * 文件位置：records/{id}.json
 */
export interface DatabaseRecord<T = unknown> {
  /** 唯一标识。单例时等于 type；集合时是 ULID */
  id: RecordId;
  /** 数据分类，格式 {app}:{feature} */
  type: RecordType;
  /** 业务数据，结构由 type 决定 */
  data: T;
  /** 创建时间 ISO 字符串 */
  createdAt: string;
  /** 最后更新时间 ISO 字符串 */
  updatedAt: string;
}

/**
 * _manifest.json 里的单条目。
 * 只存元信息 + 文件定位，不存业务数据本体。
 * 查询时只拉 manifest，按需再拉具体 record 文件。
 */
export interface ManifestEntry {
  /** record id */
  id: RecordId;
  /** record type，用于按类型查询 */
  type: RecordType;
  /** 单例标记。单例数据的 id === type，singleton = true */
  singleton: boolean;
  /** record 文件路径，如 "records/01JXY....json" */
  file: string;
  /** 该 record 文件最近的 git sha，用于乐观锁更新 */
  sha?: string;
  /** 最后更新时间，便于排序/展示列表时不拉具体文件 */
  updatedAt: string;
}

/**
 * _manifest.json 的完整结构。
 * 仓库根目录唯一的索引文件，所有 record 的元信息都登记在这里。
 */
export interface Manifest {
  /** 所有记录条目 */
  records: ManifestEntry[];
  /** manifest 文件自身的 sha（更新时用） */
  sha?: string;
  /** 结构版本号，未来不兼容升级用 */
  version: 1;
}

/**
 * 大文本文件（如 Typora 笔记正文）的引用信息。
 * 存在 blobs/{id}.md，record.data 里只存引用。
 */
export interface BlobRef {
  /** blob 文件路径，如 "blobs/01JXY....md" */
  file: string;
  /** blob 文件最近的 git sha */
  sha?: string;
}

/** 队列任务 */
export interface QueueTask {
  /** 任务 key，通常是 record id，用于去重 */
  key: string;
  /** 任务类型 */
  op: "write" | "delete";
  /** record type（写入时需要） */
  type?: RecordType;
  /** 写入的数据（write 时） */
  data?: unknown;
  /** 是否单例 */
  singleton?: boolean;
  /** 任务入队时间，用于排序 */
  seq: number;
}

/** 队列状态 */
export type QueueStatus = "idle" | "running" | "error";

/** 写操作结果 */
export interface WriteResult {
  ok: boolean;
  /** 错误原因（失败时） */
  error?: "no-pat" | "sha-conflict" | "network" | "unknown";
  /** 写入后的 record（成功时） */
  record?: DatabaseRecord;
}
