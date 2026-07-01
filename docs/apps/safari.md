# Safari App 架构

模拟 macOS Safari 的浏览器应用。起始页书签持久化基于 `macos-database` 系统（GitHub 仓库 `ZhongFarewell/macos-database`）；浏览页面通过 iframe 加载外部 URL。

> **底层持久化机制**详见 [`docs/database/`](../database/) —— record / manifest / cache / queue 的通用设计不在本文重复。本文只讲 Safari 特有的设计决策与实现结构。

## 目录

- [数据模型](#数据模型)
- [服务层（src/services/bookmark.ts）](#服务层)
- [组件结构（src/components/apps/safari/）](#组件结构)
- [状态管理（useSafariState）](#状态管理)
- [核心交互](#核心交互)
- [macOS 对齐与偏差](#macos-对齐与偏差)

---

## 数据模型

### type 与 record 结构

- **type**：`browser:bookmark`（集合型，id = ULID）
- **record.data**：`BookmarkData`（定义在 `src/services/bookmark.ts`）

```ts
interface BookmarkData {
  title: string;                       // 书签标题
  link: string;                        // URL
  img?: string;                        // 图标 URL（可选）
  inner?: boolean;                     // 是否在 iframe 内打开（false = 新标签打开）
  section: "favorites" | "freq";       // 分组：SNS Links / Frequently Visited
  order: number;                       // 同组内排序权重（小的在前）
}
```

### 两个分组

真实 Safari 起始页有「收藏夹」和「常访」分区。本实现映射为：

| record.data.section | UI 显示名 | 语义 |
|---------------------|----------|------|
| `favorites` | SNS Links | 收藏的社交链接 |
| `freq` | Frequently Visited | 常访站点 |

### UI 层包装类型

`Bookmark`（UI 层用）由 record 转换而来，继承 `SiteData`（`src/types/configs/`）并加 `id` / `section` / `order` 字段。

### 播种策略

`seedBookmarksIfEmpty`：首次启动时若 database 无书签，从 `src/configs/websites.ts` 的硬编码数据播种到 database。与 Finder 的 `seedDefaultFolders` 同模式——保留原有数据不丢，只在空库时播种。

---

## 服务层

`src/services/bookmark.ts` —— Safari 与 database 模块的适配层。

> **不自动导入**，需 `import { ... } from "~/services/bookmark"`。

### API 速查

| 分类 | 函数 | 说明 |
|------|------|------|
| 读取 | `loadBookmarks()` | 加载所有书签，按 section 分组返回，每组按 order 升序 |
| 播种 | `seedBookmarksIfEmpty()` | 空库时从 websites.ts 播种，返回是否执行了播种 |
| 添加 | `addBookmark(data, section)` | 添加书签，自动算 order（当前组最大 order + 1）追加到末尾 |
| 重命名 | `renameBookmark(id, newTitle)` | 只改 title（拉最新 record 保留其他字段） |
| 删除 | `removeBookmark(id)` | 删除书签 record |
| 检查 | `canWriteBookmarks()` | 是否配置了 PAT（写操作前置检查） |

### 实现要点

- **loadBookmarks 全量拉取后内存分组**：走 `queryByType("browser:bookmark")` 一次拉全部，内存按 section 过滤 + 按 order 排序。单用户小规模数据下可接受。
- **addBookmark 的 order 计算**：先 `loadBookmarks` 拿当前组列表，`maxOrder + 1` 作为新 order。非原子操作，但单用户并发极低无问题。
- **renameBookmark 保留其他字段**：先 `getRecord` 拿最新 data，展开后只覆盖 title，避免丢 img/section/order 等字段。
- **无 blob**：书签数据小（~200 B），全进 record，不走 blob。

---

## 组件结构

遵循项目「app 代码组织」规则（>150 行按职责拆分）：

```
src/components/apps/safari/
├── Safari.tsx              # 主组件：顶栏 + 起始页/iframe/离线页切换 + dialog 组合。自动导入全局
├── useSafariState.ts       # 状态 + handlers（核心逻辑所在）
├── NavSection.tsx          # 起始页书签宫格分组 + 单个 BookmarkCell（含右键菜单）
├── SafariAddDialog.tsx     # 添加书签对话框
└── SafariRenameDialog.tsx  # 重命名书签对话框
```

### 职责规则

- `Safari.tsx` 保持薄：调 `useSafariState()` 拿 state/handlers，组合 `NavPage` / `NoInternetPage` / 各 dialog
- `useSafariState.ts` 集中所有 `useState`/`useCallback`/`useEffect`，返回 `SafariState` 对象
- `NavSection.tsx` 是纯展示组件，接收 bookmarks + 回调 props，不调 app 级 hooks（`useContextMenu` 是全局 hook 直接调）
- 2 个 dialog 组件只接收 props，无业务逻辑

### 无 useAppMenus

Safari **没有**注册顶部菜单栏（无 `useAppMenus` 调用）。书签操作通过地址栏的 + 按钮和书签右键菜单触发，不需要 File/Edit 菜单。这与 macOS Safari 略有差异（macOS Safari 有 File/Edit/View/History/Bookmarks/Develop/Window 菜单），但当前实现聚焦起始页 + 浏览核心功能。

---

## 状态管理

`useSafariState()` 返回 `SafariState`，核心字段：

### 地址栏与历史栈

| 字段 | 说明 |
|------|------|
| `currentURL` | 地址栏输入值（受控） |
| `goURL` | 当前加载的 URL（空 = 起始页），派生自 `history[historyIndex]` |
| `history` | 历史栈，初始含起始页 `""` |
| `historyIndex` | 当前历史指针 |
| `canBack` / `canForward` | 派生：`historyIndex > 0` / `historyIndex < history.length - 1` |

`setGoURL(url)` 流程：
1. 判断是 URL 还是搜索词（`https://` 开头或含点号 → URL，否则 → Bing 搜索）
2. 补全 `https://` 前缀
3. 与当前页相同则不重复压栈（避免 index 与 history 脱节）
4. 截断当前指针之后的历史，压入新 URL（与真实浏览器一致）

`goBack` / `goForward` 只移动 `historyIndex`，不截断历史。

### 书签

| 字段 | 说明 |
|------|------|
| `bookmarks` | `{ favorites: Bookmark[]; freq: Bookmark[] }` 按 section 分组 |
| `loadingBookmarks` | 加载中标记 |
| `showAddDialog` | 添加书签 dialog 显隐 |
| `renameTarget` | 重命名目标书签（null = 无） |

启动时 `seedBookmarksIfEmpty` + `refreshBookmarks`。所有书签写操作后调 `refreshBookmarks` 刷新。

### Toast 与离线

- `toast`：操作反馈（Bookmark added / Renamed / Deleted / Copy failed 等），3 秒自动消失
- 离线检测用 `useStore(state => state.wifi)`，`wifi=false` 时渲染 `NoInternetPage`

---

## 核心交互

### 起始页书签宫格

`NavPage`（`Safari.tsx` 内）渲染两个 `NavSection`（SNS Links / Frequently Visited），每个 section 是宫格布局：

- 窗口宽度 < 640 → 4 列
- 窗口宽度 ≥ 640 → 9 列

`BookmarkCell`（`NavSection.tsx` 内）：有 `img` 显示图标，无 `img` 显示标题首字母。

### 添加书签

浏览页面（`goURL !== ""`）时地址栏显示 + 按钮 → 弹 `SafariAddDialog`：

- 默认 title 从 `currentURL` 提取域名（跨域 iframe 无法读页面 title，回退到域名）
- 默认 link 填入 `currentURL`
- 选择 section（Frequently Visited / SNS Links）
- 确认 → `addBookmark` → `refreshBookmarks`

### 书签右键菜单

`BookmarkCell` 通过 `useContextMenu` 声明（走项目的 `contextmenu-collect` 事件冒泡机制）：

- **Open**：iframe 内打开（`openLink(link, true)` → `setGoURL`）
- **Open in New Tab**：新标签打开（`openLink(link, false)` → `window.open`）
- **Copy Link**：复制 URL 到剪贴板
- **Rename…**：弹 `SafariRenameDialog`
- **Delete**：`removeBookmark` → `refreshBookmarks`

### 离线页面

`wifi=false` 时渲染 `NoInternetPage`（对齐 macOS Safari 的离线提示页）。

---

## macOS 对齐与偏差

### 对齐点

- 起始页「收藏夹」+「常访」双分区
- 书签右键菜单：Open / Open in New Tab / Copy Link / Rename / Delete（macOS Safari 真实选项）
- 地址栏输入 URL 或搜索词（非 URL 走搜索引擎）
- 历史栈后退/前进（截断当前指针之后的历史）
- 离线提示页
- 添加书签时从 URL 提取域名作为默认标题

### 已知偏差（浏览器限制）

- **iframe 跨域限制**：许多网站（Google / GitHub 等）设置 `X-Frame-Options: DENY` 无法在 iframe 加载，实际可浏览的站点有限
- **无多标签页**：macOS Safari 支持多标签，本实现单 iframe
- **无顶部菜单栏**：未注册 `useAppMenus`，无 File/Edit/History/Bookmarks 菜单
- **无侧边栏书签管理**：macOS Safari 有侧边栏书签管理器，本实现只在起始页展示书签
- **无阅读模式 / 阅读列表**：macOS Safari 的 Reader Mode / Reading List 未实现
- **无开发者工具**：macOS Safari 的 Develop 菜单未实现
- **搜索固定走 Bing**：macOS Safari 默认搜索引擎可选（Google/Yahoo/Bing/DuckDuckGo/Ecosia），本实现固定 Bing
- **书签无文件夹层级**：macOS Safari 书签支持嵌套文件夹，本实现只有两个平铺分组
