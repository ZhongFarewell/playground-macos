# type 命名约定与单例/集合规则

## type 命名格式

```
{app}:{feature}
```

- 分隔符：冒号 `:`
- app：应用名（小写）
- feature：功能名（小写）

## 已规划的 type 清单

| type | 形态 | data 结构 | 说明 |
|------|------|----------|------|
| `system:settings` | 单例 | `{ dark, volume, brightness, wifi, bluetooth }` | 系统偏好（规划中，system slice 尚未接入） |
| `system:wallpaper` | 单例 | `{ current, photos }` | 壁纸设置（详见 [apps/settings.md](../apps/settings.md)） |
| `user:profile` | 单例 | `{ name, autograph, intr, gender, wechat, QQ }` | Apple ID 账户信息（详见 [apps/settings.md](../apps/settings.md)） |
| `desktop:window-state` | 单例 | `{ apps: [{id, x, y, w, h, z}], maxZ }` | 桌面窗口状态 |
| `desktop:dock-config` | 单例 | `{ size, magnification }` | Dock 配置 |
| `browser:history` | 集合 | `{ url, title, visitedAt, favicon }` | 浏览历史 |
| `browser:bookmark` | 集合 | `{ title, link, img?, inner?, section, order }` | 书签（详见 [apps/safari.md](../apps/safari.md)） |
| `browser:tab` | 集合 | `{ url, title, active }` | 打开的标签页 |
| `typora:note` | 集合 | `{ title, excerpt, blob: BlobRef }` | 笔记（正文走 blob，详见 [apps/typora.md](../apps/typora.md)） |
| `facetime:snapshot` | 集合 | `{ url }` | 快照（图片走 MinIO） |
| `finder:entry` | 集合 | `{ name, parentId, kind, blob?, ext?, size?, uploading?, trashed?, trashedAt?, originalParentId? }` | 文件/文件夹统一条目（内容走 GitHub blob，详见 [apps/finder.md](../apps/finder.md)） |

## 单例 vs 集合判定规则

### 用单例当...
- 整个功能的数据是**一个 JSON 对象**
- 字段**强相关**，通常**同时改**（如 dark/volume 都是系统偏好）
- 全局只有一份（如桌面窗口状态、系统设置）

**单例 id === type**，用 `writeSingleton` / `getSingleton`。

### 用集合当...
- 一类数据有**多个条目**，每条独立
- 用户会**增删**条目（如书签、历史记录）
- 每条需要**独立操作**（删除单条不影响其他）

**集合 id = ULID**，用 `insertRecord` / `queryByType` / `updateRecord` / `deleteRecord`。

## 字段捆绑原则

按"**同时改的字段捆一起**"分组：

### 反例 1：拆太细
```
system:volume    { value: 60 }       ← 单独 record
system:dark      { value: true }     ← 单独 record
system:brightness { value: 80 }      ← 单独 record
```
问题：
- manifest 膨胀（每个设置一条 entry）
- 查询系统设置要并发拉 N 个文件
- 改一个设置要 PATCH manifest 一次，频繁撞 sha

### 反例 2：捆太粗
```
browser:all { history: [...1000条], bookmarks: [...100条] }
```
问题：
- 加一个书签要重写整个 100KB 数组
- 并发加书签撞 sha
- 删除单条书签 = 重写整个数组

### 正例
```
system:settings { dark, volume, brightness, wifi }   ← 强相关捆一起
system:wallpaper { url }                              ← 独立分开
browser:history（每条一个 record）                    ← 集合型
browser:bookmark（每条一个 record）                   ← 集合型
```

## 命名规范

### app 名
- 用应用名小写：`system`、`browser`、`typora`、`desktop`、`facetime`
- 与 `src/configs/apps.tsx` 里的 app id 对齐

### feature 名
- 单数名词：`settings`、`history`、`bookmark`、`note`
- 避免复数（`history` 不是 `histories`）
- 避免 `list`、`data` 这种无意义后缀

### 大小写
- 全小写
- 多词用连字符：`window-state`（不用 `windowState` 或 `window_state`）

## ULID 生成

集合 record 的 id 用 ULID（`generateUlid()`）：

- 26 位 Crockford base32
- 前 10 位是时间戳编码，**按字符串排序 = 按创建时间排序**
- 后 16 位随机
- 示例：`01JXY7KQ5R8V9H2N6M3P4QXSTZ`

### 为什么用 ULID 不用 UUID
- ULID 时间序可排序（历史记录按创建时间排序天然有序）
- UUID v4 完全随机，排序无意义
- UUID v7 也可排序，但生态不如 ULID 成熟

## 扩展新 type 的步骤

1. 在业务代码里直接用 `insertRecord` / `writeSingleton`，type 字符串即约定
2. 在本文档表格里登记新 type
3. 定义 `data` 的 TypeScript 接口（业务代码里）
4. 不需要改 database 模块任何代码

## 示例：加一个新功能"日历事件"

```ts
// 1. 定义 data 类型（业务代码里）
interface CalendarEventData {
  title: string;
  startAt: string;
  endAt: string;
  location?: string;
}

// 2. 直接用，type 字符串即约定
const id = insertRecord("calendar:event", {
  title: "开会",
  startAt: "2026-06-25T10:00:00Z",
  endAt: "2026-06-25T11:00:00Z"
});

// 3. 查询
const events = await queryByType<CalendarEventData>("calendar:event");

// 4. 在本文档登记：calendar:event | 集合 | { title, startAt, endAt, location }
```

**零基础设施改动**——这是统一数据模型的核心收益。
