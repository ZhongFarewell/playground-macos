# 写任务队列与 flush 机制

## 设计目标

- **不阻塞 UI**：业务调用 `writeSingleton` 等立即返回
- **合并高频写**：debounce 2s，同一条 record 的多次修改合并成一次 PUT
- **避免并发冲突**：串行执行，避免并发 PUT 撞 sha
- **失败重试**：sha 冲突自动重试，网络错重新入队

## 队列结构

```ts
const queue: Map<string, QueueTask> = new Map();
// key = record id，相同 key 后到覆盖先到（去重）
```

```ts
interface QueueTask {
  key: string;           // record id，用于去重
  op: "write" | "delete";
  type?: RecordType;     // write 时需要
  data?: unknown;        // write 时的业务数据
  singleton?: boolean;
  seq: number;           // 入队时间戳，用于排序
}
```

## 入队

```ts
enqueueWrite(id, type, data, singleton);  // 立即返回，不阻塞
enqueueDelete(id);                        // 立即返回
```

入队后：
1. 相同 key 的任务被覆盖（最新数据为准）
2. 安排一次 flush（debounce 2s）

## flush 时机

### Debounce 触发
```ts
const FLUSH_DEBOUNCE_MS = 2000;

function scheduleFlush() {
  if (flushTimer) clearTimeout(flushTimer);
  flushTimer = setTimeout(() => void flush(), FLUSH_DEBOUNCE_MS);
}
```

2s 内的多次入队只触发一次 flush。

### 立即触发（关键时刻）
```ts
flushAll();  // beforeunload / 页面隐藏时调用
```

跳过 debounce，立即执行队列。注意：浏览器 beforeunload 里异步操作可能被截断，靠 localStorage 缓存兜底。

### 串行执行
```ts
async function flush() {
  if (running) return;       // 已经在 flush，等下次
  if (queue.size === 0) return;
  
  running = true;
  const batch = Array.from(queue.values()).sort((a, b) => a.seq - b.seq);
  queue.clear();
  
  for (const task of batch) {
    // 串行执行，不并发
    await executeTask(task);
  }
  
  running = false;
  if (queue.size > 0) scheduleFlush();  // flush 期间又有新任务
}
```

## 单任务执行

### executeWrite 流程
```
1. 读本地缓存拿 createdAt + sha
2. 构造 record（id/type/data/时间戳）
3. PUT record 文件
   ├─ attempt 0：用本地 sha
   ├─ sha 冲突：GET 拉最新 sha 重试
   └─ 成功：用响应 sha 更新本地缓存
4. upsertManifestEntry
   ├─ attempt 0：用本地 manifest sha 直接 PUT manifest
   ├─ sha 冲突：GET 拉最新 manifest 重试
   └─ 成功：用响应 sha 更新本地 manifest 缓存
```

### executeDelete 流程
```
1. 读本地 sha（没有则 GET 拉一次）
2. DELETE record 文件
   ├─ sha 冲突：GET 拉最新 sha 重试
   └─ 文件已不存在（别人已删）：视为成功
3. removeManifestEntry（PATCH manifest）
4. 清本地 record 缓存
```

## 去重语义

相同 key 的任务后到覆盖先到：
```ts
// 用户连续改 volume：50 → 60 → 70
writeSingleton("system:settings", { volume: 50 });
writeSingleton("system:settings", { volume: 60 });
writeSingleton("system:settings", { volume: 70 });

// 队列里只剩最后一个任务（volume: 70）
// 2s 后只 flush 一次，PUT 一次
```

**含义**：中间状态丢失，但 localStorage 已经实时同步了每一步（在 `index.ts` 的 `writeSingleton` 里应该立即写本地缓存——当前实现是入队 + queue flush 时才写本地，**这是一个待优化点**：理想做法是入队的同时立即更新 localStorage，让真相源永远最新）。

## 失败处理

### sha 冲突
- 重试 MAX_RETRY 次
- 重试时拉远端 sha + 内容
- 重试耗尽：任务重新入队，下次 flush 再试

### 网络错
- 重新入队
- 下次 flush 再试

### PAT 缺失
- 不重试，直接放弃
- 由调用方提示用户配置 PAT

## 状态订阅

```ts
onQueueStatus((running) => {
  // running=true：正在 flush
  // running=false：空闲
});
```

UI 可用于显示"保存中..."指示。

## 队列不持久化

队列本身不存 localStorage——页面关闭丢失未 flush 任务。

**兜底**：localStorage 缓存层保证了状态不丢，下次启动时：
1. 读 localStorage 立即渲染
2. 后台拉远端 manifest
3. `hasPendingChanges` 检测本地是否领先远端
4. 如果领先，触发 flush 把本地状态推到远端

## 当前实现的待优化点

### 入队时立即写本地缓存
当前 `writeSingleton` 只入队，本地缓存在 queue flush 时才写。如果用户秒关页面：
- 队列任务丢失（未 flush）
- 本地缓存还是旧值
- 下次启动用旧值渲染

**优化方向**：`writeSingleton` / `updateRecord` 入队的同时立即更新 localStorage 缓存。这样队列丢失也无所谓，本地永远是最新真相。

### blob 写入不入队
大文本（笔记正文）走 `writeBlob` 同步 await，不走 debounce 队列。原因：用户主动 ⌘S 要即时反馈。

**副作用**：大文件保存会阻塞队列（队列串行，blob 在队列外执行但占网络）。如果同时有 record 写入，会排队等 blob 完成。

## 一句话

**业务调用立即入队 + debounce 2s + 串行 flush。相同 key 去重，sha 冲突重试，失败重新入队。localStorage 缓存兜底页面关闭场景。**
