# 数据模型

三类核心对象：**record**（业务数据）、**manifest**（全局索引）、**blob**（大文本）。

## 1. DatabaseRecord — 单条业务数据

```ts
interface DatabaseRecord<T = unknown> {
  id: RecordId;        // 单例时等于 type；集合时是 ULID
  type: RecordType;    // 分类，格式 {app}:{feature}
  data: T;             // 业务数据，结构由 type 决定
  createdAt: string;   // ISO 时间戳
  updatedAt: string;   // ISO 时间戳
}
```

**文件位置**：`records/{id}.json`

**关键规则**：
- 所有数据都是 record，靠 `type` 字段分类（Notion/Linear 风格）
- 单条 record 独立一个文件，改一条不影响其他
- record 文件大小通常 < 2 KB（大文本走 blob）

## 2. 单例 vs 集合

| 类型 | id 形式 | 例子 | 何时用 |
|------|---------|------|--------|
| 单例 | `id === type` | `system:settings` | 整个功能的数据是一个 JSON 对象 |
| 集合 | `id = ULID` | `01JXY...` | 一类数据的多个条目，每条独立 |

### 单例
- id 就是 type 本身，一对一
- 例：`system:settings`（dark/volume/brightness 一个对象）、`desktop:window-state`
- 用 `writeSingleton(type, data)` / `getSingleton(type)`

### 集合
- 每条数据一个 ULID（26 位，时间序可排序）
- 例：`browser:history`（每次访问一条 record）、`typora:note`（每篇笔记一条）
- 用 `insertRecord(type, data)` / `queryByType(type)`

## 3. Manifest — 全局索引

```ts
interface Manifest {
  records: ManifestEntry[];  // 所有 record 的元信息
  sha?: string;              // manifest 文件自身的 sha（PUT 时用）
  version: 1;                // 结构版本号
}

interface ManifestEntry {
  id: RecordId;
  type: RecordType;
  singleton: boolean;
  file: string;              // record 文件路径，如 "records/01JXY....json"
  sha?: string;              // record 文件最近的 git sha
  updatedAt: string;
}
```

**文件位置**：`_manifest.json`（仓库根目录）

**关键规则**：
- manifest 是**写热点**——任何 record 的增删改都要 PATCH 一次 manifest
- manifest 只存元信息，不存业务数据本体（控制大小）
- 查询时只拉 manifest（本地缓存优先），按需再拉具体 record 文件
- 单用户场景并发极低，sha 重试足够兜底

## 4. Blob — 大文本 / 二进制

```ts
interface BlobRef {
  file: string;  // blob 文件路径，如 "blobs/01JXY....md"
  sha?: string;  // blob 文件最近的 git sha
}
```

**文件位置**：`blobs/{id}.{ext}`（如 `blobs/01JXY....md`、`blobs/01JXY....mp3`）

**关键规则**：
- 大文本（笔记正文、长文档）走 blob，不进 record
- 二进制文件（图片/音频/视频等）也走 blob，用独立的 bytes API（`readBlobBytes`/`writeBlobBytes`），不经 TextEncoder/TextDecoder
- record.data 里只存 `BlobRef`（路径 + sha 引用）
- blob 不进 manifest（manifest 只索引 record）
- 改 blob 不影响 record 的 sha，反之亦然

**文本 vs 二进制**：
- 文本 blob：`readBlob`/`writeBlob`，content 是 UTF-8 字符串（Typora 笔记正文用）
- 二进制 blob：`readBlobBytes`/`writeBlobBytes`，content 是 `Uint8Array`（Finder 任意类型文件用）
- 两套 API 共享同一套 `blobs/{id}.{ext}` 存储和 sha 乐观锁机制，只是编解码路径不同

**大文件 fallback**：GitHub Contents API 对 >1MB 文件返回 `content` 为空。`readBlobBytes` 在 `content` 为空时自动用响应里的 `download_url` 拉 raw bytes。写大文件不受影响（PUT 不受大小限制，但有 100MB 上限）。

**为什么不进 record**：
- record 文件要保持小（查询快、PUT 便宜）
- 大文本单独 PUT，sha 独立管理
- 删除 record 时，blob 成为孤儿（由调用方负责清理或留着）

## 数据流示例

### 新建一篇 Typora 笔记

1. 生成 ULID `01JXY...`
2. PUT `blobs/01JXY....md`（笔记正文）
3. PUT `records/01JXY....json`：
   ```json
   {
     "id": "01JXY...",
     "type": "typora:note",
     "data": {
       "title": "我的笔记",
       "excerpt": "开头...",
       "blob": { "file": "blobs/01JXY....md", "sha": "abc123" }
     },
     "createdAt": "...",
     "updatedAt": "..."
   }
   ```
4. PATCH `_manifest.json`：登记 `{ id, type: "typora:note", file, sha, updatedAt }`

### 改系统设置（单例）

1. PUT `records/system:settings.json`（整个 record 全量重写）
2. PATCH `_manifest.json`：更新 `system:settings` 这条 entry 的 sha/updatedAt

## 数据规模预估

| 数据类型 | 单条大小 | 累计量级 | 是否进 blob |
|---------|---------|---------|------------|
| system:settings | ~200 B | 1 条 | 否 |
| desktop:window-state | ~2 KB | 1 条 | 否 |
| browser:history（单条） | ~300 B | 1 万条 → 3 MB | 否 |
| browser:bookmark（单条） | ~200 B | 100 条 → 20 KB | 否 |
| typora:note（record） | ~400 B | 1000 篇 → 400 KB | 否（meta） |
| typora:note（blob 正文） | 几 KB ~ 几 MB | 不限 | ✅ 是 |

**瓶颈**：manifest 文件大小。1 万条 record → manifest ~1.5 MB。当前规模无感，未来如需可按 type 分片。
