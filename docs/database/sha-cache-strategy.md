# sha 缓存与乐观锁策略

## 背景：为什么需要 sha

GitHub Contents API 用 Git 的 sha 做乐观锁：
- PUT 文件时必须带"当前文件版本的 sha"
- GitHub 比对远端 sha 与请求 sha：
  - 一致 → 接受 PUT，返回新 sha
  - 不一致 → 409/422 冲突
- 新建文件不需要 sha（省略 `sha` 字段）

**sha 是文件内容的指纹**：内容变则 sha 变，内容不变则 sha 不变。

## 朴素方案的痛点

如果每次 PUT 前都 GET 一次拿 sha：
```
改一条 record：
  GET records/{id}.json     ← 拿 sha（浪费，全量下载）
  PUT records/{id}.json     ← 上传新内容
  GET _manifest.json        ← 拿 sha（浪费，全量下载）
  PUT _manifest.json        ← 上传新 manifest
```

**4 次网络请求，2 次大文件 GET**。对 GitHub Contents API 来说，每次 GET 都是全量下载（base64 内容），manifest 大了会很痛。

## 优化策略：本地 sha 缓存

### 核心观察
- PUT 响应里**已经带新 sha**，不需要再 GET
- 单用户单设备场景，本地 sha 几乎总是有效的（没有别人改远端）
- 只有冲突时才需要 GET 拉最新

### 优化后的流程

```
改一条 record（首次，本地无缓存）：
  GET records/{id}.json     ← 拿初始 sha + 内容
  PUT records/{id}.json     ← 响应里给新 sha，本地存下
  
改一条 record（后续，本地有缓存）：
  读本地 sha                ← 0 网络
  PUT records/{id}.json     ← 响应里给新 sha，本地存下
  
冲突时（其他设备改过远端）：
  读本地 sha="abc"
  PUT → 409（远端已是 "xyz"）
  GET → 拉最新 sha="xyz" + 内容
  合并 → PUT → 响应给新 sha
```

### 网络请求数对比

| 场景 | 朴素方案 | 优化后 |
|------|---------|--------|
| 单次 record 写入（首次） | 1 GET + 1 PUT | 1 GET + 1 PUT |
| 单次 record 写入（后续） | 1 GET + 1 PUT | **1 PUT** |
| 单次 record 写入（冲突） | 1 GET + 1 PUT | 1 PUT + 1 GET + 1 PUT = 2 PUT + 1 GET |
| Typora 修改保存（3 文件） | 3 GET + 3 PUT = 6 请求 | **3 PUT = 3 请求** |

## 缓存存储

### manifest 的 sha
存在 localStorage `mdb:manifest` 里，整个 manifest JSON 包含顶层 `sha` 字段：

```ts
interface Manifest {
  records: ManifestEntry[];
  sha?: string;  // ← manifest 文件自身的 sha
  version: 1;
}
```

### record 的 sha
存在 localStorage `mdb:record:{id}` 里，包装结构：

```ts
interface CachedRecord {
  record: DatabaseRecord;
  sha?: string;  // ← record 文件最近的 sha
}
```

### blob 的 sha
**不存 localStorage**，存到 record.data 里：

```ts
interface BlobRef {
  file: string;
  sha?: string;  // ← blob 文件最近的 sha，跟着 record 一起缓存
}
```

调用方（如 `typora.ts` 的 `saveNote`）保存 blob 后拿到新 sha，更新 record.data.blob.sha，下次保存用这个 sha。

## PUT 响应解析

GitHub Contents API PUT 响应结构：

```json
{
  "content": {
    "name": "_manifest.json",
    "path": "_manifest.json",
    "sha": "新sha",
    ...
  },
  "commit": {
    "sha": "commit sha",
    ...
  }
}
```

`github.ts` 的 `putFile` 返回 `{ ok: true, sha: data.content?.sha }`，调用方用这个 sha 更新本地缓存。

## 冲突重试

`queue.ts` 和 `manifest.ts` 都有重试循环：

```ts
for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
  // attempt 0：用本地 sha 直接 PUT
  // attempt 1+：冲突后拉远端 sha 再 PUT
}
```

- `manifest.ts`：MAX_RETRY = 3
- `queue.ts`：SHA_RETRY = 2

单用户场景几乎不会冲突，重试是兜底。

## 不一致场景与兜底

### 本地 sha 过期
- 场景：其他设备改过远端，本地 sha 是旧值
- 结果：PUT 返回 409
- 兜底：拉远端 sha + 内容，合并后重试

### 本地缓存丢失
- 场景：localStorage 被清空
- 结果：`readRecordSha` 返回 undefined
- 兜底：`executeWrite` 会 `getFileSha` 拉一次远端 sha（多 1 次 GET，但能成功）

### PUT 成功但缓存写入失败
- 场景：localStorage 配额满
- 结果：本地 sha 还是旧值
- 兜底：下次 PUT 会冲突 → 拉远端 → 重试。功能不丢，只是多 1 次 GET

## 一句话

**PUT 响应带新 sha，本地缓存下来下次用。冲突时才 GET 拉最新 sha。单用户场景从「每次 1 GET + 1 PUT」降到「每次 1 PUT」。**
