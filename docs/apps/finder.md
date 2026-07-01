# Finder App 架构

模拟 macOS Finder 的文件管理应用。文件/文件夹统一建模，基于 `macos-database` 持久化系统（GitHub 仓库 `ZhongFarewell/macos-database`）。

> **底层持久化机制**详见 [`docs/database/`](../database/) —— record / manifest / blob / cache / queue 的通用设计不在本文重复。本文只讲 Finder 特有的设计决策与实现结构。

## 目录

- [数据模型](#数据模型)
- [服务层（src/services/finder.ts）](#服务层)
- [组件结构（src/components/apps/finder/）](#组件结构)
- [状态管理（useFinderState）](#状态管理)
- [核心交互](#核心交互)
- [macOS 对齐与偏差](#macos-对齐与偏差)

---

## 数据模型

### type 与 record 结构

- **type**：`finder:entry`（集合型，id = ULID）
- **record.data**：`FinderEntryData`（定义在 `src/types/configs/finder.d.ts`）

```ts
interface FinderEntryData {
  name: string;              // 条目名（含扩展名，如 "report.md"）
  parentId: string;          // 父文件夹 id；根目录为 "root"
  kind: "file" | "folder";   // 文件 vs 文件夹，单 type + kind 字段区分
  blob?: BlobRef;            // 仅 file：文件内容引用（路径 + sha）
  ext?: string;              // 扩展名（从 name 提取），用于图标/预览
  size?: number;             // 文件大小（字节）
  uploading?: boolean;       // 上传中标记（拖入本地文件时先建占位 record）
  trashed?: boolean;         // 软删除标记
  trashedAt?: string;        // 移入废纸篓时间
  originalParentId?: string; // 原始 parentId（恢复时用）
}
```

### 设计决策：单 type + kind 字段

文件和文件夹用**同一种 type**（`finder:entry`），靠 `kind` 字段区分。理由：

- macOS Finder 里文件和文件夹是同一套视图（图标/列表/分栏），统一建模贴合真实交互
- 符合 database 的「按同时改的字段捆一起」原则——文件和文件夹的元数据结构高度重合
- 避免跨 type 的联合查询（`listEntries` 一次 `queryByType` 拿全量，内存过滤）

### 文件内容存储

- 文件正文走 GitHub blob：`blobs/{id}.{ext}`（与 Typora 笔记同模式）
- record.data 里只存 `BlobRef`（`{ file, sha }`），不存正文
- 文件夹是「无 blob 的 record」
- **blob 清理责任在调用方**：物理删除 record 前，若有 blob 必须先 `removeBlob`（见 `docs/database/data-model.md` 「Blob」章节）

### 根目录与 Trash 的虚拟 id

| 常量 | 值 | 含义 |
|------|----|----|
| `ROOT_PARENT_ID` | `"root"` | 根目录的 parentId |
| `TRASH_PARENT_ID` | `"trash"` | Trash 的虚拟 parentId（trashed 条目逻辑上在此） |

这两个是**逻辑约定**，不是真实 record id——不存在 id 为 `"root"` 或 `"trash"` 的 record。

### Trash 软删除模型

- **移到 Trash**：`trashed=true` + `parentId="trash"` + `originalParentId=原parentId` + `trashedAt=时间戳`
- **Put Back（恢复）**：回填 `parentId=originalParentId`，清 `trashed` 标记；若原父目录已失效（已删/也在 Trash），回填到根目录
- **Delete Immediately**：物理删 record + `removeBlob` 清理文件内容
- **Empty Trash**：对所有 `trashed=true` 的条目执行 Delete Immediately
- 文件夹进 Trash 时递归 trash 所有子条目（`trashFolderRecursive`）

---

## 服务层

`src/services/finder.ts` —— Finder 与 database 模块的唯一适配层。所有 record/blob 操作都经此文件，组件不直接调 database API。

> **不自动导入**（`src/services/` 不在 auto-import 目录里），需 `import { ... } from "~/services/finder"`。

### API 速查

| 分类 | 函数 | 说明 |
|------|------|------|
| 读取 | `listEntries(parentId)` | 列某文件夹下条目（不含 Trash），文件夹优先按 name 排序 |
| 读取 | `listTrash()` | 列 Trash 中条目，按 trashedAt 降序 |
| 读取 | `getEntry(id)` | 按 id 读单条 |
| 创建 | `createFolder(name, parentId)` | 新建文件夹（无 blob） |
| 创建 | `createFile(name, parentId, content, onUploaded?)` | 新建文件：立即返回占位（uploading:true），后台异步 writeBlob |
| 内容 | `readFileContent(entry)` | 读文件正文（readBlob） |
| 内容 | `saveFileContent(entry, content)` | 覆盖写文件正文（writeBlob 带 sha + 更新 record） |
| 修改 | `renameEntry(entry, newName)` | 重命名（文件同时更新 ext） |
| 修改 | `moveEntry(entry, newParentId)` | 移动（改 parentId） |
| 复制 | `copyEntry(entry, newParentId)` | 统一入口：文件→copyFile，文件夹→copyFolderRecursive |
| 复制 | `copyFile(entry, newParentId)` | 复制文件：新 id + 新 blob（不共享），文件名加 " copy" 后缀 |
| 复制 | `copyFolderRecursive(entry, newParentId)` | 递归复制文件夹及其所有子条目 |
| Trash | `trashEntry(entry)` | 软删除单条 |
| Trash | `trashFolderRecursive(folder)` | 递归 trash 文件夹 |
| Trash | `restoreEntry(entry)` | 从 Trash 恢复（带原父目录有效性校验） |
| 物理删除 | `deleteEntryImmediately(entry)` | 物理删单条（先 removeBlob 再 deleteRecord） |
| 物理删除 | `emptyTrash(entries)` | 批量物理删（Trash 视图用） |
| 初始化 | `seedDefaultFolders()` | 首次启动播种 macOS 默认文件夹（幂等） |

### 实现要点

- **二进制安全的 blob 通路**：Finder 支持任意类型文件（图片/音频/视频/任意二进制）。文件内容用 `Uint8Array` 传输，走 database 模块的 `writeBlobBytes` / `readBlobBytes`（直接 base64 编解码 bytes，不经过 `TextEncoder`/`TextDecoder`）。这与 Typora 笔记的文本 blob 通路（`writeBlob`/`readBlob`，UTF-8 字符串）是分开的两套——Finder 不是 Typora，不能用文本模式处理二进制。上传时 `useFinderState.uploadFiles` 用 `file.arrayBuffer()` 而非 `file.text()`。
- **id 一致性约束（关键）**：`createFile` / `createFolder` / `copyFile` 都必须用 `insertRecord` **返回的** id，不能自己 `generateUlid()` 再丢弃返回值。否则 record 实际 id（`insertRecord` 内部生成）与 blob 文件名用的 id 不一致，导致 `getRecord(id)` 找不到 record、`onUploaded` 永不触发、UI 一直转圈。`copyFile` 的顺序：先 `insertRecord` 拿 id → 用此 id 写 blob → 失败则 `deleteRecord` 回滚 → 成功则 `updateRecord` 补 blob 引用。
- **listEntries 的全量过滤模式**：走 `queryByType("finder:entry")` 一次性拉全部 record，内存过滤 `parentId` 匹配且 `!trashed`。单用户小规模数据下可接受；规模增长后可考虑按 parentId 索引。
- **createFile 的占位 + 异步上传**：拖入本地文件时先 `insertRecord` 建占位（`uploading:true`，无 blob），立即返回让 UI 可见；后台异步 `writeBlobBytes` + `updateRecord` 清除 uploading 标记。回调 `onUploaded` 让调用方在不依赖 `loadCurrent` 的情况下更新 UI（避免 record 还没 flush 导致 queryByType 读不到）。
- **复制不共享 blob**：复制文件会 `readBlobBytes` 读出原内容再 `writeBlobBytes` 到新 id，生成独立 blob（macOS 语义）。
- **seedDefaultFolders 的幂等判断**：以「根目录下是否存在文件夹」为依据，而非「是否存在任何 finder:entry」，避免 Trash 中的孤儿数据阻止播种。

---

## 组件结构

遵循项目「app 代码组织」规则（>150 行按职责拆分），Finder 文件夹结构：

```
src/components/apps/finder/
├── Finder.tsx              # 主组件：组合 + JSX。自动导入全局
├── FinderSidebar.tsx       # 左侧边栏（Home/Desktop/Documents/.../Trash）
├── FinderToolbar.tsx       # 顶部工具栏（后退/前进 + 文件夹名 + 新建/删除）
├── FinderFileList.tsx      # 文件列表（表头 + 行渲染 + 空白区拖拽上传）
├── FinderFileRow.tsx       # 单行（图标 + 名称 + 大小 + 日期 + 拖拽 + 右键菜单 + inline 重命名）
├── FinderPathBar.tsx       # 底部路径栏（面包屑）
├── EmptyTrashDialog.tsx    # 清空废纸篓确认对话框
├── useFinderState.ts       # 状态 + handlers（核心逻辑所在）
├── menus.ts                # useAppMenus 的 buildMenus + menuDeps
└── types.ts                # 内部类型（ViewMode/SidebarItem/SortBy）+ 图标映射
```

### 职责规则

- `Finder.tsx` 保持薄：调 `useFinderState()` 拿 state/handlers，调 `useAppMenus()` 注册菜单，组合子组件
- `useFinderState.ts` 集中所有 `useState`/`useCallback`/`useEffect`，返回 `FinderState` 对象
- `menus.ts` 导出 `buildMenus(s)` + `menuDeps(s)`，主组件 `useAppMenus("finder", () => buildMenus(s), menuDeps(s))`
- 子组件只接收 props，不调 app 级 hooks（需要全局能力时直接调全局 hook，如 `useContextMenu`）

### 两个入口

`src/configs/apps.tsx` 里 Finder 有两个 app 条目：

- `id: "finder"` → `<Finder />`（默认 Home 视图）
- `id: "trash"` → `<Finder initialTrash />`（默认打开 Trash 视图）

`initialTrash` prop 控制 `useFinderState` 的初始 `showTrash` 状态和 `currentFolderName`。

---

## 状态管理

`useFinderState(initialTrash)` 返回 `FinderState`，核心字段：

### 导航与历史

| 字段 | 说明 |
|------|------|
| `currentFolderId` | 当前文件夹 id（初始 `"root"`） |
| `currentFolderName` | 当前文件夹名（初始 "Home" 或 "Trash"） |
| `breadcrumbs` | 面包屑路径链（从根到当前），每次 `loadCurrent` 时按 parentId 反向回溯构建（带上限 50 防环） |
| `history` / `historyIdx` | 后退/前进历史栈，`navigateTo` 截断到当前 idx 再推入新 id |
| `showTrash` | 是否在 Trash 视图 |

### 加载与刷新

- `loadCurrent()`（`useCallback` 依赖 `currentFolderId` + `showTrash`）：
  1. 首次加载且非 Trash 视图时 `seedDefaultFolders()`（用 `seededRef` 防重复播种）
  2. 按 `showTrash` 调 `listTrash()` 或 `listEntries(currentFolderId)`
  3. 始终额外 `listEntries(ROOT_PARENT_ID)` 刷新 `rootFolders`（供侧边栏按 name 查找）
  4. 构建 `breadcrumbs`（反向回溯 parentId，带上限 50 防环）
- 所有写操作（创建/重命名/移动/复制/trash/恢复/删除）完成后调 `loadCurrent()` 刷新

### 选择与重命名

- `selectedIds: Set<string>` —— 多选用 `Set`，`selectItem(id, multi)` 支持 cmd/ctrl 多选
- `renamingId: string | null` —— inline 重命名模式，创建文件夹后自动进入重命名

### 排序

- `sortBy: "name" | "date"` —— `useMemo` 派生 `sortedEntries`，文件夹永远优先，文件内部按 sortBy 排序

### 剪贴板

- `clipboard: { entry, mode: "cut" | "copy" } | null`
- cut 粘贴后清空剪贴板，copy 粘贴后保留（macOS 行为，可多次粘贴）
- 粘贴到原位置（`entry.parentId === targetFolderId && mode === "cut"`）无操作

---

## 核心交互

### 拖拽

三种拖拽来源/目标：

1. **Finder 内部拖拽**（移动）：`onDragStart` 设置 `text/finder-entry-id`，文件夹 `onDrop` 读取后 `moveEntry`
2. **本地文件拖入**（上传）：`onDrop` 检查 `e.dataTransfer.files`，调 `uploadFiles` → `createFile`（占位 + 异步上传）
3. **拖到 Trash**（侧边栏）：`onDropToTrash` → `getEntry` → `trashEntry`

**防环检查**：`isDescendant(entryId, targetId)` 拖文件夹到自己的子文件夹时拒绝，沿 parentId 链向上查找（带上限 50）。

**dragover 不检查类型**：`dragover` 时 `dataTransfer.types` 可能不完整，统一 `preventDefault` 最稳妥；`drop` 时再判断来源。

### 右键菜单

通过 `useContextMenu` hook（全局自动导入）声明，走项目的 `contextmenu-collect` 事件冒泡机制（见 `CODEBUDDY.md` 「Context menu system」）：

- **普通视图**：Open / Cut / Copy / Paste / Rename / Move to Trash
- **Trash 视图**：Put Back / Delete Immediately...

### 顶部菜单栏

通过 `useAppMenus("finder", ...)` 注册（`menus.ts`）：

- **File**：New Folder (⇧⌘N) / Open (⌘O)
- **Edit**：Cut (⌘X) / Copy (⌘C) / Paste (⌘V) / Select All (⌘A) —— Trash 视图下 Cut/Copy/Paste 禁用
- **View**：Sort by Name / Sort by Date

### 侧边栏映射

`SIDEBAR_GROUPS`（`FinderSidebar.tsx`）是静态配置，`targetId` 字段对 Home 是 `ROOT_PARENT_ID`，对其他是**文件夹名**（如 "Desktop"）。点击时通过 `rootFolders.find(f => f.name === item.targetId)` 解析为真实 folder id，找不到则回退到 Home。Trash 项的 `targetId: "trash"` 触发 `onShowTrash`。

### 文件上传（拖入浏览器）

`uploadFiles(files, targetFolderId)` 流程：

1. 对每个文件 `new Uint8Array(await file.arrayBuffer())` 读原始 bytes（二进制安全，不能用 `file.text()`——会把二进制当 UTF-8 损坏）
2. `createFile(name, parentId, content, onUploaded)` 建占位 + 后台异步上传
3. 占位立即 `setEntries` 插入（当前文件夹下可见）
4. `onUploaded` 回调直接替换 entries 中的占位条目（不依赖 `loadCurrent`，避免 record 未 flush 时 queryByType 读不到）

### 双击文件打开

`openFile(entry)` 流程：

1. 校验 `entry.kind === "file"` 且 `entry.blob` 存在（uploading 中的文件无 blob，不响应）
2. `window.open(rawUrl(entry.blob.file), "_blank")` 在新标签页打开 raw 直链
3. 浏览器按 URL 扩展名判断 Content-Type，流式渲染（图片/PDF/音视频边下边显示，不阻塞当前窗口）

> `rawUrl` 拼 `https://raw.githubusercontent.com/ZhongFarewell/macos-database/main/{path}`。macos-database 是公开仓库，raw 直链可匿名访问，无需 PAT。

### 文件图标

`FILE_ICON_MAP`（`types.ts`）按扩展名映射到 UnoCSS `i-ri:*` 图标 class：

- 图片（png/jpg/gif/webp/svg/bmp）→ `i-ri:image-line`
- 音频（mp3/wav/ogg/flac/aac/m4a）→ `i-ri:music-line`
- 视频（mp4/mov/avi/mkv/webm）→ `i-ri:film-line`
- 文档（pdf/doc/docx/xls/xlsx/ppt/pptx）→ 对应 office 图标
- 代码（js/ts/tsx/html/css）→ 对应代码图标
- 压缩包（zip/rar/7z/tar/gz）→ `i-ri:file-zip-line`
- 未识别 → `i-ri:file-line`（默认文件图标）
- 文件夹 → `i-ri:folder-fill`
- 上传中 → `i-ri:loader-4-line`（旋转动画）

> **UnoCSS safelist 约束**：`FILE_ICON_MAP` 里的图标 class 是动态拼接的（对象字面量值），UnoCSS 扫描器收集不到。必须在 `unocss.config.ts` 的 `safelist` 里显式列出所有图标 class，否则 build 后 CSS 不生成对应图标。**新增文件类型图标时，同步更新 safelist。**

---

## macOS 对齐与偏差

### 对齐点

- 文件/文件夹统一视图，单 type + kind 区分
- 文件夹永远排在文件前面
- 复制文件名加 " copy" 后缀（`report.md` → `report copy.md`）
- Trash 软删除 + Put Back + Delete Immediately + Empty Trash 四种操作语义
- Empty Trash 确认对话框文案对齐 macOS 真实警告
- copy 粘贴后保留剪贴板（可多次粘贴），cut 粘贴后清空
- 底部路径栏对齐 View → Show Path Bar

### 已知偏差（浏览器限制）

- **没有分栏视图**：macOS Finder 有图标/列表/分栏/画廊四种视图，当前只实现列表视图
- **双击文件在新标签页打开**：macOS 双击文件调 LaunchServices 用默认应用打开（浏览器做不到），改为在新标签页用 raw 直链打开（浏览器按扩展名渲染，图片/PDF/音视频可直接预览，其他类型触发下载）
- **没有 Quick Look**：macOS 选中文件按空格预览（Quick Look），未实现
- **没有标签/标记**：macOS 的 tags、彩色标记、智能文件夹未实现
- **没有连接服务器/网络位置**：侧边栏只有本地默认文件夹 + Trash
- **大文件预览依赖 raw 直链**：>1MB 文件 GitHub Contents API 不返回 content，走 `download_url` fallback（详见 [`docs/database/api-reference.md`](../database/api-reference.md) 「二进制 Blob」）
- **Empty Trash 是物理删除**：无 macOS 的「30 天后自动清空」选项
