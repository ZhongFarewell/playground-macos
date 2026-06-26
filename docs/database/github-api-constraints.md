# GitHub API 限制与权衡

## 1. 文件级整体覆盖（无增量）

GitHub Contents API 的 PUT 请求体：

```json
{
  "message": "commit msg",
  "content": "<整个文件内容的 base64>",
  "sha": "<文件现有 sha>",
  "branch": "main"
}
```

- `content` 是整个文件的新内容（base64 编码）
- **没有"只改某段"的参数**
- 想改一个字符也得把整个文件重写一遍发上去

### 根因
Git 本身是"快照存储"，一个 commit 就是一个文件的完整新版本，不存在 in-place 修改。GitHub API 只是把这层模型暴露出来。

### 影响
- 改 `system:settings` 的 volume 字段 → 整个 record JSON 重写
- 改 Typora 笔记一行 → 整个 md 文件重传

### 替代方案
GitHub Git Database API（trees/blobs/refs）也是文件级，没有增量更新能力。它的优势在多文件原子提交，不在单文件增量。

### 真正的增量更新
只有换存储后端（Postgres/MongoDB）才能拿到字段级 PATCH。当前架构已为这个迁移留好接口：只换 `github.ts` 那一层。

## 2. 单文件单 commit（无原子提交）

Contents API 一次只能提交一个文件。多文件操作 = 多个独立 commit。

### 影响
Typora 保存一次笔记 = 3 个 commit：
```
commit 1: Update blobs/{id}.md
commit 2: Update records/{id}.json
commit 3: Index typora:note {id}
```

### 一致性风险
中间断电会不一致：
```
1. PUT blobs/{id}.md        ✓ commit 1
2. PUT records/{id}.json    ✗ 网络断
3. PUT _manifest.json       ✗ 没执行
```
结果：blob 孤儿（没 record 引用），manifest 还指向旧 record。

### 兜底
- record 写入失败 → blob 孤子，下次保存会重新写 record
- manifest 写入失败 → record 已存在但 manifest 没登记，下次启动 `fetchManifest` 看不到这条 record（数据"丢"了，但 blob 还在）
- 用户主动保存会看到 toast，可以重试

### 原子提交方案
Git Database API 支持 N+3 请求一次 commit：
1. POST `/git/blobs` N 次（为每个文件创建 blob）
2. POST `/git/trees` 1 次（创建 tree 引用所有 blob）
3. POST `/git/commits` 1 次（创建 commit 指向 tree）
4. PATCH `/git/refs/heads/main` 1 次（更新分支指针）

**收益**：1 commit，原子性
**成本**：实现复杂度高（要管 parent commit sha、tree 结构、部分失败处理）

当前 portfolio 场景不需要原子性，不采用。

## 3. 限流

| 类型 | 限制 |
|------|------|
| 认证用户 | 5000 请求/小时 |
| 未认证 | 60 请求/小时 |
| GitHub Enterprise | 更高 |

### 影响
- 单用户 portfolio 用不满 5000/小时
- 高频自动保存（如输入即存）可能撞限流
- Typora 手动 ⌘S 完全无感

### 缓解
- 队列 debounce 合并写
- 本地缓存减少 GET
- 未来可加 403 限流响应的退避重试

## 4. 延迟

GitHub Contents API PUT 比 GET 慢，因为要：
1. 创建 blob 对象
2. 创建 tree 对象
3. 创建 commit
4. 更新 ref

**典型延迟**：
- GET：~200-500ms
- PUT：~1-2 秒
- DELETE：~1 秒

### 影响
- 用户感知"保存慢"——Typora ⌘S 后 spinner 转 1-2 秒
- 队列串行执行，多任务累积延迟

### 缓解
- debounce 合并（连续修改只 flush 一次）
- 本地缓存立即反馈（UI 显示"已保存"其实只是本地写入，远端异步同步）
- sha 缓存避免 GET

## 5. 文件大小限制

- Contents API 单文件上限 **100 MB**
- base64 编码后膨胀 ~33%
- 实际建议单文件 < 10 MB（再大 PUT 容易超时）

### 影响
- Typora 笔记正文通常 < 100 KB，无感
- 大文本（> 1 MB）保存慢，需 UI 预警
- 大二进制（图片/视频）**不走 GitHub，走 MinIO**

## 6. CORS 与认证

- GitHub Contents API 已开放 CORS，前端可直连
- PAT 通过 `Authorization: Bearer xxx` 头传递
- PAT 存 localStorage（原文，用户自行承担风险）

### 替代方案
走后端代理（Align-server `/github/*`）：
- 优：PAT 不暴露前端，可加缓存
- 缺：后端要加路由

当前选前端直连，与 Typora 现有模式一致。

## 7. CDN 缓存

- `raw.githubusercontent.com` 有 CDN 缓存延迟（仓库已更新但接口返回旧内容）
- Contents API 实时返回最新

### 影响
当前所有读取走 Contents API（`github.ts` 的 `getFile`），不走 raw。保证数据实时性。

## 当前架构的应对总结

| 限制 | 应对策略 |
|------|---------|
| 文件级覆盖 | 接受，单 record 控制在 < 2 KB |
| 单文件单 commit | 接受，多 commit 不影响功能 |
| 限流 | debounce + 本地缓存 |
| 延迟 | 本地缓存即时反馈，远端异步 |
| 文件大小 | 大文本走 blob，大二进制走 MinIO |
| CORS | 前端直连 |
| CDN 缓存 | 全走 Contents API |

## 未来如需突破限制

- **原子提交** → 换 Git Database API
- **字段级更新** → 换真数据库（Postgres/MongoDB）
- **高频写** → 加后端缓冲层
- **大二进制** → 走 MinIO（已规划）

架构已为这些迁移留好接口，主要改动集中在 `github.ts` 一层。
