# Typora App 架构

模拟 macOS Typora 的 WYSIWYG Markdown 编辑器。笔记持久化基于 `macos-database` 系统（GitHub 仓库 `ZhongFarewell/macos-database`），正文走 blob，meta 走 record。

> **底层持久化机制**详见 [`docs/database/`](../database/) —— record / manifest / blob / cache / queue 的通用设计不在本文重复。本文只讲 Typora 特有的设计决策与实现结构。

## 目录

- [数据模型](#数据模型)
- [服务层（src/services/typora.ts）](#服务层)
- [组件结构（src/components/apps/typora/）](#组件结构)
- [状态管理（useTyporaState）](#状态管理)
- [核心流程](#核心流程)
- [PAT 管理与迁移](#pat-管理与迁移)
- [macOS 对齐与偏差](#macos-对齐与偏差)

---

## 数据模型

### type 与 record 结构

- **type**：`typora:note`（集合型，id = ULID）
- **record.data**：`TyporaNoteData`（定义在 `src/types/configs/typora.d.ts`）

```ts
interface TyporaNoteData {
  title: string;             // 笔记标题（与 .md 文件名解耦）
  excerpt?: string;          // 摘要（正文前 80 字符，用于 Open 列表展示）
  blob: BlobRef;             // 正文 blob 引用（{ file, sha }）
}
```

### 存储分层

- **meta**（title / excerpt / 时间戳）存 `records/{id}.json`，进 manifest
- **正文**存 `blobs/{id}.md`，不进 manifest，不进 record.data
- record.data 只持有 `BlobRef`（路径 + sha 引用）

这是 database 的通用模式（大文本走 blob），与 Finder 文件内容、Typora 笔记正文一致。详见 [`docs/database/data-model.md`](../database/data-model.md) 「Blob」章节。

### UI 层包装类型

`TyporaNote`（UI 层用）由 record 转换而来，隐藏 record 结构：

```ts
interface TyporaNote {
  id: string;          // record id（ULID）
  title: string;
  excerpt?: string;
  file: string;        // blob 文件路径，如 "blobs/01JXY....md"
  blobSha?: string;    // blob 文件的 sha（写入时用作乐观锁）
  createdAt?: string;
  updatedAt?: string;
}
```

---

## 服务层

`src/services/typora.ts` —— Typora 与 database 模块的适配层。所有 record/blob 操作经此文件，组件不直接调 database API。

> **不自动导入**，需 `import { ... } from "~/services/typora"`。

### API 速查

| 分类 | 函数 | 说明 |
|------|------|------|
| 读取 | `listNotes()` | 列所有笔记 meta（不拉正文），按 updatedAt 降序 |
| 读取 | `getNoteContent(note)` | 读单篇正文（`readBlob(id, "md")`） |
| 创建 | `createNote(title, content)` | 新建笔记：生成 ULID + writeBlob + insertRecord |
| 保存 | `saveNote(note, content)` | 覆盖已存在笔记：writeBlob（带 sha）+ updateRecord |
| 重命名 | `renameNote(note, newTitle)` | 只改 record.data.title，不动 blob |
| PAT | `getPat` / `setPat` / `hasPat` | 转发到 database 模块（见下节） |

### 实现要点

- **listNotes 只拉 meta**：走 `queryByType("typora:note")` 只拿 record 文件（meta），不读 blob 正文。正文按需在 `handlePick` 时才 `getNoteContent` 拉。避免列表页加载全部正文。
- **saveNote 带 sha 乐观锁**：`writeBlob(id, "md", content, msg, note.blobSha)`，用缓存的 blobSha 避免每次 GET 最新 sha（详见 [`docs/database/sha-cache-strategy.md`](../database/sha-cache-strategy.md)）。
- **createNote 同步 await writeBlob**：与 Finder 的 `createFile` 占位模式不同，Typora 新建笔记时同步等待 blob 写完再入队 record。因为笔记正文是用户直接输入的内容，不存在「后台异步上传」的语义，同步写更简单可靠。
- **excerpt 自动生成**：`saveNote` / `createNote` 时自动取正文前 80 字符（去换行）作为 excerpt，无需用户手填。
- **renameNote 不动 blob**：只更新 record.data.title，正文文件名（blob 路径）不变。macOS Typora 的文件名与标题也是解耦的。

---

## 组件结构

遵循项目「app 代码组织」规则（>150 行按职责拆分）：

```
src/components/apps/typora/
├── Typora.tsx              # 主组件：组合 + JSX。自动导入全局
├── MilkdownEditor.tsx      # Milkdown WYSIWYG 编辑器封装
├── useTyporaState.ts       # 状态 + handlers（核心逻辑所在）
├── menus.ts                # useAppMenus 的 buildMenus + menuDeps
├── TyporaOpenPanel.tsx     # Open from GitHub 笔记列表面板
├── TyporaSaveDialog.tsx    # 首次保存输入文件名对话框
├── TyporaPatDialog.tsx     # GitHub PAT 输入对话框
└── TyporaRenameDialog.tsx  # 重命名对话框
```

### 职责规则

- `Typora.tsx` 保持薄：调 `useTyporaState()` 拿 state/handlers，调 `useAppMenus()` 注册菜单，组合 `MilkdownEditor` + 各 dialog
- `useTyporaState.ts` 集中所有 `useState`/`useCallback`/`useEffect`，返回 `TyporaState` 对象
- `menus.ts` 导出 `buildMenus(s)` + `menuDeps(s)`，主组件 `useAppMenus("typora", ...)` 注册
- 4 个 dialog 组件只接收 props，无业务逻辑

---

## 状态管理

`useTyporaState()` 返回 `TyporaState`，核心字段：

### 当前文档

```ts
interface CurrentDoc {
  note: TyporaNote | null;  // null = 未绑定到 GitHub record（本地新建/打开的文件）
  localTitle?: string;      // 未绑定 record 时的本地标题（从文件名提取）
  content: string;          // 当前正文
  dirty: boolean;           // 是否有未保存改动
}
```

`doc.note` 是否为 null 决定保存路径：
- `doc.note` 存在 → `saveNote` 覆盖（⌘S 直接保存，不弹框）
- `doc.note` 为 null → 弹 `TyporaSaveDialog` 让用户输入文件名 → `createNote`

### 跨组件内容同步

Milkdown 的 `markdownUpdated` 回调把内容同步到 Zustand `typoraMd`；`useTyporaState` 通过 `useEffect` 监听 `typoraMd` 变化更新 `doc.content`。这样 `MilkdownEditor` 与 `useTyporaState` 解耦——编辑器只管写 store，状态层监听 store。

### 编辑器控制

`editorRef: MutableRefObject<EditorHandle | null>` —— 通过 ref 暴露 `setContent(md)` 给父组件。加载文件/笔记时，`useTyporaState` 调 `editorRef.current?.setContent(content)` 替换编辑器内容。

### Toast 与 Dialog

- `toast`：操作反馈（Saved / Failed / Opened 等），3 秒自动消失
- `showOpen` / `showSaveDialog` / `showPatDialog` / `showRenameDialog`：4 个 dialog 显隐状态

---

## 核心流程

### 新建笔记（⌘N）

1. `handleNew`：清空 `doc`（note=null, content=""），调 `editorRef.setContent("")` 清空编辑器
2. 用户输入内容 → Milkdown `markdownUpdated` → `setTyporaMd` → `useEffect` 更新 `doc.content`
3. ⌘S → `doc.note` 为 null → 弹 `TyporaSaveDialog` → 输入文件名 → `doSave(filename)`

### 打开笔记

两条路径：

- **Open…（⌘O）**：打开本地 `.md`/`.markdown`/`.txt` 文件 → `FileReader` 读内容 → `loadFile`（note=null, localTitle=文件名）
- **Open from GitHub**：弹 `TyporaOpenPanel` → `listNotes` 拉列表 → 用户选中 → `handlePick` → `getNoteContent` 拉正文 → `setDoc({ note, ... })`

### 保存笔记（⌘S）

`doSave(filename?)` 流程：

1. 检查 `getPat()`，无 PAT → 弹 `TyporaPatDialog`，`pendingSaveRef` 记住待保存参数
2. PAT 确认后 `setPat` + 继续保存
3. `performSave(filename)`：
   - `doc.note` 存在 → `saveNote(note, content)` 覆盖
   - `doc.note` 为 null 且有 filename → `createNote(filename, content)` 新建

### 拖拽打开

拖 `.md`/`.markdown`/`.txt` 文件到窗口 → `handleDrop` → `loadFile`（同 Open… 本地路径）。非支持格式弹 toast 拒绝。

### 重命名

- `doc.note` 存在 → `renameNote` 改 record.data.title
- `doc.note` 为 null → 只改 `doc.localTitle`

### 导出（Export…）

`handleDownload`：把 `doc.content` 转 Blob → 触发浏览器下载 `{title}.md`。纯前端操作，不走 database。

---

## PAT 管理与迁移

### PAT 存储

- **localStorage key**：`database_github_pat`（database 模块统一 key）
- PAT 原文存 localStorage，用户自行承担风险
- 所有需要写 GitHub 的 app（Typora / Safari / Finder / Settings）共享同一个 PAT

### 旧 key 自动迁移

`src/services/typora.ts` 模块加载时执行一次性迁移：

```ts
// 旧 key: typora_github_pat → 新 key: database_github_pat
const OLD_PAT_KEY = "typora_github_pat";
const NEW_PAT_KEY = "database_github_pat";
// 若旧 key 有值且新 key 无值，复制过去；然后删旧 key
```

迁移原因：早期 Typora 用独立 key，后来 database 模块统一为 `database_github_pat` 供所有 app 共享。迁移代码放在 typora.ts 而非 database 模块，避免 database 模块耦合业务历史。

### PAT 转发

`src/services/typora.ts` re-export `getPat` / `setPat` / `hasPat` from database 模块，让 Typora 组件可以从 `~/services/typora` 一处导入。Settings app 的 PrivacyPanel 则直接从 `~/services/database` 导入。

---

## macOS 对齐与偏差

### 对齐点

- WYSIWYG 编辑（Milkdown 实现「所见即所得」，非双栏 split preview）
- ⌘S 直接覆盖已存在笔记，不弹框（首次保存才弹输入文件名）
- File → New / Open… / Open from GitHub / Save / Rename… / Export… 菜单项
- 拖拽 `.md` 文件直接打开
- 文件名与标题解耦（rename 只改 title，blob 路径不变）

### 已知偏差（浏览器限制）

- **无独立窗口**：浏览器无法开多窗口，一个 Typora 窗口只能编辑一篇笔记（macOS Typora 可多窗口）
- **自定义 Open/Save 对话框**：浏览器无系统文件选择器/Save 对话框，用自定义 modal 替代
  - Open 拆成两条：Open…（本地文件，用隐藏 `<input type="file">`）+ Open from GitHub（自定义列表 modal）
  - Save 首次保存用自定义输入框 modal
- **存储后端是 GitHub**：非本地文件系统，笔记存在 `ZhongFarewell/macos-database` 仓库
- **无图片插入**：macOS Typora 支持拖入图片，本实现未做（图片需走 MinIO，未集成到编辑器）
- **无主题切换**：macOS Typora 有多个主题，本实现只有跟随系统暗色模式
