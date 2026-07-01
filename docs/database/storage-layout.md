# GitHub 仓库目录结构

仓库：`ZhongFarewell/macos-database`，默认分支 `main`。

## 目录布局

```
macos-database/
├── _manifest.json              # 全局索引（所有 record 的元信息）
├── records/                    # record 文件目录
│   ├── {ulid}.json             # 集合型 record
│   └── {type}.json             # 单例型 record（id === type）
└── blobs/                      # 大文本文件目录
    └── {ulid}.{ext}            # blob 文件（扩展名由调用方定）
```

## 文件格式

### `_manifest.json`

```json
{
  "version": 1,
  "records": [
    {
      "id": "system:settings",
      "type": "system:settings",
      "singleton": true,
      "file": "records/system:settings.json",
      "sha": "a1b2c3d4e5f6...",
      "updatedAt": "2026-06-24T10:30:00.000Z"
    },
    {
      "id": "01JXY7KQ5R8V9H2N6M3P4QXSTZ",
      "type": "browser:history",
      "singleton": false,
      "file": "records/01JXY7KQ5R8V9H2N6M3P4QXSTZ.json",
      "sha": "9z8y7x6w5v4u...",
      "updatedAt": "2026-06-24T12:15:30.000Z"
    },
    {
      "id": "01JXY9CD4N8P7Q6R5T2V1W3X9Y",
      "type": "typora:note",
      "singleton": false,
      "file": "records/01JXY9CD4N8P7Q6R5T2V1W3X9Y.json",
      "sha": "5e6f7g8h9i0j...",
      "updatedAt": "2026-06-24T13:00:00.000Z"
    }
  ],
  "sha": "x7y8z9a0b1c2..."
}
```

### `records/{id}.json`

集合型示例（`records/01JXY9CD4N8P7Q6R5T2V1W3X9Y.json`）：

```json
{
  "id": "01JXY9CD4N8P7Q6R5T2V1W3X9Y",
  "type": "typora:note",
  "data": {
    "title": "我的笔记",
    "excerpt": "这是笔记开头...",
    "blob": {
      "file": "blobs/01JXY9CD4N8P7Q6R5T2V1W3X9Y.md",
      "sha": "5e6f7g8h9i0j..."
    }
  },
  "createdAt": "2026-06-24T13:00:00.000Z",
  "updatedAt": "2026-06-24T13:00:00.000Z"
}
```

单例型示例（`records/system:settings.json`）：

```json
{
  "id": "system:settings",
  "type": "system:settings",
  "data": {
    "dark": true,
    "volume": 60,
    "brightness": 80,
    "wifi": true,
    "bluetooth": false
  },
  "createdAt": "2026-06-24T10:30:00.000Z",
  "updatedAt": "2026-06-24T10:30:00.000Z"
}
```

### `blobs/{id}.{ext}`

纯文本文件，无 JSON 包装。如 `blobs/01JXY9CD4N8P7Q6R5T2V1W3X9Y.md`：

```markdown
# 我的笔记

这是笔记正文，可以很长很长...
```

## 文件命名规则

| 文件类型 | 命名规则 | 例子 |
|---------|---------|------|
| manifest | 固定 `_manifest.json` | `_manifest.json` |
| record（集合） | `records/{ULID}.json` | `records/01JXY....json` |
| record（单例） | `records/{type}.json` | `records/system:settings.json` |
| blob | `blobs/{id}.{ext}` | `blobs/01JXY....md` |

## 路径生成函数

代码里的路径生成（见 `manifest.ts`）：

```ts
recordFilePath(id) → `records/${id}.json`
blobFilePath(id, ext) → `blobs/${id}.${ext}`
```

## 重要约束

- **大二进制文件不存 GitHub**：图片/视频走 MinIO（已有 `blogSourceMinio` 基础设施）。Finder 的 `finder:entry` 虽支持任意类型文件（mp3/pdf 等），但 GitHub 有 100MB 单文件上限，超大文件仍应走 MinIO
- **blob 文件格式**：JSON record 用 `.json`，文本 blob 用对应扩展名（`.md`/`.txt`），二进制 blob 用原始扩展名（`.mp3`/`.png`）。二进制 blob 在 GitHub web 界面无法 diff，但可正常存储和访问
- **`{type}` 里的 `:` 不会出现在文件名**：单例 record 文件名虽然包含 type，但 GitHub 文件名允许 `:`，无问题
- **ULID 时间序**：集合 record 按文件名排序 = 按创建时间排序
