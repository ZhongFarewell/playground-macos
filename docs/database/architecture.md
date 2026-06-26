# 整体架构

## 模块分层

```
业务代码 (Typora/Browser/System/...)
    ↓ 只 import ~/services/database
index.ts (语义化 API)
    ↓ 调用
┌──────────────┬──────────────┐
│ manifest.ts  │  queue.ts    │  ← 业务逻辑层
│ (查询/登记)   │  (异步刷盘)   │
└──────┬───────┴──────┬───────┘
       ↓              ↓
   cache.ts       github.ts      ← 基础设施层
   (localStorage)  (HTTP)
                      ↓
                 types.ts        ← 类型契约（最底层，无依赖）
```

## 文件清单与职责

| 文件 | 职责 | 是否有逻辑 |
|------|------|----------|
| `types.ts` | 类型定义（DatabaseRecord / Manifest / ManifestEntry / QueueTask） | 零逻辑 |
| `github.ts` | GitHub Contents API 通信层（PAT / base64 / 文件 CRUD / sha 错误识别） | 纯 HTTP 封装 |
| `cache.ts` | localStorage 缓存层（manifest + record 缓存 + 远端合并） | 同步读写 |
| `manifest.ts` | `_manifest.json` 索引管理（fetch/upsert/remove + sha 重试） | 业务逻辑 |
| `queue.ts` | 写任务队列（debounce + 串行 + 去重 + sha 冲突重试） | 业务逻辑 |
| `index.ts` | 对外 API（业务唯一入口） | 聚合层 |

## 依赖方向

- 上层依赖下层，单向不循环
- `types.ts` 谁都依赖，自己不依赖任何模块
- 业务代码只 import `index.ts`，**不直接 import 内部模块**

## 关键设计决策

### 为什么 manifest 和 record 分开存
- manifest 是全局索引（写热点），record 是单条数据（独立文件）
- 查询走 manifest（按 type 过滤、按 id 定位），按需再拉具体 record 文件
- 改一条 record 不影响其他 record 的 sha，并发冲突只发生在同一条上

### 为什么有 queue 层
- 业务调用 `writeSingleton` 等立即返回（不阻塞 UI）
- 实际刷盘延后合并（debounce 2s），降低 GitHub API 调用频率
- 串行执行避免并发 PUT 撞 sha

### 为什么 cache 层用 localStorage
- 状态变化立即同步写本地，用户秒关页面也不丢配置
- 启动时先读本地立即渲染，后台拉远端 diff
- GitHub 是异步副本，localStorage 是同步真相源

## 可替换性

| 换什么 | 改哪层 | 其他层影响 |
|--------|--------|----------|
| 换存储后端（GitHub → Postgres） | `github.ts` | 上层几乎不动 |
| 换缓存策略（localStorage → IndexedDB） | `cache.ts` | 上层不动 |
| 换队列策略（debounce → 实时） | `queue.ts` | 上层不动 |
| 加新数据类型 | 只加 `type` 值，无结构改动 | 零改动 |

这是分层架构的核心收益：**数据建模稳定，基础设施可换**。
