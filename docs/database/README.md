# macos-database 持久化系统文档

本目录记录 `src/services/database/` 持久化系统的架构、规范与设计决策。

这套系统把 GitHub 仓库 `ZhongFarewell/macos-database` 当数据库用，承载 macOS 模拟器中所有需要持久化的数据：Typora 笔记、浏览器历史/书签、系统设置、桌面状态等。

## 文档索引

| 文档 | 内容 |
|------|------|
| [architecture.md](./architecture.md) | 整体架构、分层关系、模块职责 |
| [data-model.md](./data-model.md) | 数据模型：record / manifest / blob 三类对象 |
| [storage-layout.md](./storage-layout.md) | GitHub 仓库目录结构与文件格式 |
| [api-reference.md](./api-reference.md) | 对外 API 速查（业务代码用法） |
| [sha-cache-strategy.md](./sha-cache-strategy.md) | sha 缓存与乐观锁策略（避免多余 GET） |
| [queue-and-flush.md](./queue-and-flush.md) | 写任务队列与 flush 机制 |
| [github-api-constraints.md](./github-api-constraints.md) | GitHub API 限制与权衡说明 |
| [type-naming-convention.md](./type-naming-convention.md) | type 命名约定、单例/集合规则 |

## 核心设计原则

1. **统一数据模型**：所有数据都是 `DatabaseRecord`，靠 `type` 字段分类（Notion/Linear 风格）
2. **localStorage 是真相源，GitHub 是异步副本**：状态变化立即写本地，避免用户秒关页面丢配置
3. **sha 乐观锁 + 本地缓存**：PUT 前用本地 sha，冲突时才拉远端，最大化减少 GET
4. **写队列 debounce + 串行**：合并高频写、避免并发 PUT 撞 sha
5. **大文本分离**：笔记正文走 `blobs/`，不进 record，不进 manifest

## 适用场景与边界

**适用**：单用户 portfolio 项目，并发极低，数据量 < 1 万条 record。

**不适用**：
- 多用户协作（sha 冲突会频繁）
- 高频写入（GitHub 限流 5000/小时）
- 大二进制存储（图片/视频走 MinIO，不走 GitHub）
- 强一致性场景（无事务，中间断电会不一致）

未来如需迁移到真数据库，**只换 `github.ts` 通信层**，上层 `manifest.ts` / `queue.ts` / `index.ts` 几乎不动。
