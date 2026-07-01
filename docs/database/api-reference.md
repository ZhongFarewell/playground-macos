# 对外 API 速查

业务代码只 import `~/services/database`，不直接 import 内部模块。

## 初始化

```ts
import { initDatabase } from "~/services/database";

// 应用启动时调用一次（如 Desktop 挂载时）
await initDatabase();
```

拉取远端 manifest + 合并本地缓存。可重复调用，只初始化一次。

## ID 生成

```ts
import { generateUlid } from "~/services/database";

const id = generateUlid();  // "01JXY7KQ5R8V9H2N6M3P4QXSTZ"
```

ULID：26 位 Crockford base32，时间序可排序。通常由 `insertRecord` 内部生成，不必手动调。

## 读取

### 按 ID 读单条
```ts
const record = await getRecord<MyData>("01JXY...");
// record.data 是 MyData 类型
```

### 读单例
```ts
const settings = await getSingleton<SystemSettings>("system:settings");
```

### 按 type 查集合
```ts
const history = await queryByType<HistoryEntry>("browser:history");
// 返回 DatabaseRecord<HistoryEntry>[]
```

### 只查元信息（不拉 record 文件）
```ts
const metas = queryMetaByType("browser:history");
// 返回 ManifestEntry[]，用于列表展示
```

### 强制拉远端
```ts
const history = await queryByType<HistoryEntry>("browser:history", true);
// 第二参数 forceRemote=true，跳过本地缓存
```

## 写入

### 写单例
```ts
writeSingleton("system:settings", { dark: true, volume: 60 });
// 立即入队，debounce 2s 后 flush
```

### 新建集合 record
```ts
const id = insertRecord("browser:history", { url, title, visitedAt });
// 立即返回 ULID，可绑定 UI；实际写入异步入队
```

### 按 ID 更新（集合或单例通用）
```ts
updateRecord(id, "browser:history", newData, false);
// 第 4 参数 singleton，默认 false
```

### 按 ID 删除
```ts
deleteRecord(id);
```

## Blob（大文本）

```ts
// 读
const content = await readBlob(id, "md");

// 写（同步 await，不入队——大文本用户主动保存）
const blobRef = await writeBlob(id, "md", content, "commit msg", existingSha);
// 返回 { file, sha }，存到 record.data 里

// 删
const ok = await removeBlob(blobRef, "commit msg");
```

**注意**：blob 写入是同步 await，不走 debounce 队列。失败由调用方处理。

## 二进制 Blob（图片/音频/视频等）

文本 blob（`readBlob`/`writeBlob`）走 UTF-8 字符串编解码，会损坏二进制文件。处理任意类型文件时用 bytes 版本：

```ts
// 读原始 bytes（二进制安全，不经过 TextDecoder）
const bytes = await readBlobBytes(id, "mp3");

// 写原始 bytes（二进制安全，不经过 TextEncoder）
const blobRef = await writeBlobBytes(id, "mp3", bytes, "commit msg", existingSha);
```

**大文件 fallback**：GitHub Contents API 对 >1MB 文件返回 `content` 为空，只给 `download_url`。`readBlobBytes` 内部自动 fallback：优先用 `content`（base64 解码），为空时走 `download_url` 拉 raw bytes。

## raw 直链

```ts
import { rawUrl } from "~/services/database";

// 拼公开仓库的 raw 文件直链，浏览器可直接 window.open 流式渲染
const url = rawUrl("blobs/01JXY....mp3");
// → https://raw.githubusercontent.com/ZhongFarewell/macos-database/main/blobs/01JXY....mp3
```

**用途**：Finder 双击文件在新标签页打开预览。公开仓库 raw 直链可匿名访问，无需 PAT。浏览器按 URL 扩展名判断 Content-Type，图片/PDF/音视频可流式渲染（边下边显示）。

## 关键时刻

### 立即刷盘
```ts
import { flushAll } from "~/services/database";

// beforeunload / 页面隐藏时调用
window.addEventListener("beforeunload", () => {
  flushAll();  // 不阻塞，但会触发 pending 任务的 PUT
});
```

### 订阅"保存中"状态
```ts
import { onQueueStatus } from "~/services/database";

const off = onQueueStatus((running) => {
  // running=true 表示队列正在 flush
  // UI 可显示"保存中..."指示
});
off();  // 取消订阅
```

### 检查是否有未刷盘任务
```ts
import { hasPending } from "~/services/database";
if (hasPending()) {
  // 提示用户"有未保存的更改"
}
```

## PAT 管理

```ts
import { getPat, setPat, clearPat, hasPat } from "~/services/database";

if (!hasPat()) {
  const pat = prompt("请输入 GitHub PAT");
  setPat(pat);
}
```

- PAT 存 localStorage key `database_github_pat`（原文，用户自行承担风险）
- PAT 范围限定到 `macos-database` 仓库
- 写操作必须带 PAT，公开仓库可匿名读

## 高级 API（慎用）

```ts
import { fetchManifest, getManifestLocal, findSingleton } from "~/services/database";

// 直接操作 manifest，绕过 queue
// 仅用于特殊场景（如数据迁移、调试）
```

## 完整类型

```ts
interface DatabaseRecord<T = unknown> {
  id: RecordId;
  type: RecordType;
  data: T;
  createdAt: string;
  updatedAt: string;
}

type RecordId = string;  // 单例时 === type，集合时是 ULID
type RecordType = string;  // 格式 {app}:{feature}
```
