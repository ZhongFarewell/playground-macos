# Photos App 架构

模拟 macOS Photos 的照片画廊应用。照片元数据走后端 API（Align-server），照片文件走 MinIO；仅"设为壁纸"功能涉及 database 持久化（写 `system:wallpaper` 单例）。

> **底层持久化机制**详见 [`docs/database/`](../database/) —— record / manifest / cache / queue 的通用设计不在本文重复。本文只讲 Photos 特有的设计决策与实现结构。

## 目录

- [数据来源与持久化边界](#数据来源与持久化边界)
- [组件结构](#组件结构)
- [状态管理](#状态管理)
- [核心交互](#核心交互)
- [macOS 对齐与偏差](#macos-对齐与偏差)

---

## 数据来源与持久化边界

Photos app 的数据来自**三个不同来源**，需要区分清楚：

| 数据 | 来源 | 持久化 | 说明 |
|------|------|--------|------|
| 照片元数据列表 | Align-server 后端 API | ❌ 不走 database | `GET /api/resources/memory/image`，返回 `{ value, memory }` 数组 |
| 照片文件 | MinIO 对象存储 | ❌ 不走 database | `photoUrl(filename)` 拼接 `blogSourceMinio + "/memoryimage/" + filename` |
| 壁纸设置 | database `system:wallpaper` 单例 | ✅ 走 database | 右键/菜单"Set as Wallpaper"时写入 |

> **照片本身不进 database**——图片是二进制大文件，违反 database「全是文本文件」的约束（见 [`docs/database/storage-layout.md`](../database/storage-layout.md) 「重要约束」）。图片走 MinIO，database 只承载壁纸设置的 URL 引用。

### 壁纸持久化流程

```
右键照片 → Set as Wallpaper
  → handleSetWallpaper(filename)
  → photoUrl(filename) 得到 URL
  → setWallpaper(url)（更新 system slice，UI 立即生效）
  → addPhotoWallpaper(prev, url)（推送 system:wallpaper 单例）
    - prev = { current: url, photos: userWallpapers }（从 store 推导）
    - next = { current: url, photos: [url, ...去重] }
  → setUserWallpapers(next.photos)（同步到 store，供 WallpaperPanel 展示）
```

与 Settings 的 `WallpaperPanel` 共用 `src/services/wallpaper.ts` 的 `addPhotoWallpaper`，保证两边写入 `system:wallpaper` 单例的语义一致。启动时 Desktop 调 `loadWallpaperSettings()` 恢复 `userWallpapers` 到 store，Photos 以此为初值推导 prev。

---

## 组件结构

遵循项目「app 代码组织」规则（>150 行按职责拆分）：

```
src/components/apps/photos/
├── Photos.tsx          # 主组件：顶栏 + 网格 + 大图查看器。自动导入全局
├── usePhotosState.ts   # 状态 + handlers（核心逻辑所在）
├── PhotoCell.tsx       # 网格单元（缩略图 + 右键菜单）
├── PhotoViewer.tsx     # 全屏大图查看器（缩放/平移/导航/信息栏）
├── menus.ts            # useAppMenus 的 buildMenus + menuDeps
└── types.ts            # PhotoItem 类型 + formatFileSize 工具函数
```

### 职责规则

- `Photos.tsx` 用 `React.memo` 包裹并自定义比较 `() => true`（忽略 `width` prop，因为 AppWindow 全屏切换会注入新 `width` 触发重渲染，但 Photos 不使用 `width`）
- `usePhotosState.ts` 集中所有 `useState`/`useCallback`/`useEffect`
- `PhotoCell` / `PhotoViewer` 是纯展示组件，接收 props + 调全局 `useContextMenu`
- `menus.ts` 导出 `buildMenus(s)` + `menuDeps(s)`

---

## 状态管理

`usePhotosState()` 返回 `PhotosState`，核心字段：

### 照片列表与加载

| 字段 | 说明 |
|------|------|
| `photos` | 后端返回的照片元数据数组 |
| `loading` | 加载中标记 |
| `error` | 错误信息（null = 无错误） |
| `sortOrder` | 排序方式：`desc`（最新在前）/ `asc`（最旧在前） |
| `sortedPhotos` | `useMemo` 派生：按 `memory.time` 排序后的列表 |

`fetchPhotos(signal)` 调 `getPhotoList({ pageNo: 1, pageSize: 9999 }, signal)` 一次性拉全部元数据（`pageSize: 9999`）。用 `AbortController` 在组件卸载时取消请求。

### 大图查看器

| 字段 | 说明 |
|------|------|
| `activeIdx` | 当前查看的照片索引（null = 关闭查看器） |
| `imgLoaded` / `imgError` | 图片加载状态 |
| `imgFileSize` | 图片文件大小（字节，信息栏展示） |
| `zoom` | 缩放倍数（1-5） |
| `pan` | 平移偏移 `{ x, y }` |
| `panRef` | 拖拽状态 ref（避免重渲染） |
| `imgContainerRef` | 图片容器 ref（绑定 wheel 事件） |

`zoomRef` / `imgLoadedRef` 是 `zoom` / `imgLoaded` 的 ref 镜像，让 wheel 事件回调能读到最新值而不触发重渲染。

---

## 核心交互

### 网格展示

`Photos.tsx` 用 CSS Grid：

```css
grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
```

- **非虚拟列表**：DOM 节点全部挂载，配合 `content-visibility: auto` + `loading="lazy"` + `decoding="async"` 优化渲染
- **缩略图尺寸固定**（120px），列数随窗口宽度自适应——最大化窗口增加列数而非放大缩略图（对齐 macOS Photos 行为）

### 照片右键菜单

`PhotoCell` 通过 `useContextMenu` 声明：

- **Set as Wallpaper**：`handleSetWallpaper(filename)` → 写 `system:wallpaper` 单例
- **Copy Image Address**：复制 `photoUrl(filename)` 到剪贴板
- **Export**：`handleExport(filename)` → 触发浏览器下载

### 大图查看器

`PhotoViewer` 全屏覆盖：

- **导航**：← / → 键或按钮切换上一张/下一张，ESC 关闭
- **缩放**：滚轮缩放（1-5 倍），`zoom=1` 时重置平移
- **平移**：鼠标拖拽（`zoom>1` 时启用）
- **信息栏**：底部显示文件名 / 大小 / 时间，缩放滑块

### 顶部菜单栏

通过 `useAppMenus("photos", ...)` 注册（`menus.ts`）：

- **File**：Export…（当前查看的照片）
- **Image**：Set as Desktop Picture（当前查看的照片）
- **View**：Sort by Newest First / Sort by Oldest First

---

## macOS 对齐与偏差

### 对齐点

- 网格缩略图固定尺寸，列数随窗口宽度自适应（最大化加列不加尺寸）
- 大图查看器的缩放/平移/导航交互
- 右键菜单：Set as Wallpaper / Copy Image Address / Export（macOS Photos 真实选项）
- 顶部菜单：File / Image / View 三组
- 排序：按拍摄时间（`memory.time`） Newest/Oldest First

### 已知偏差

- **非虚拟列表**：macOS Photos 用虚拟列表处理海量照片，本实现全量挂载 DOM（靠 `content-visibility: auto` 优化，超大量时仍可能卡顿）
- **照片来源是后端 API**：非本地文件系统，照片存在 Align-server + MinIO，需要登录态（`align_id` cookie）
- **无相册/时刻分组**：macOS Photos 有「时刻/精选/年度」智能分组，本实现是平铺网格
- **无编辑功能**：macOS Photos 的裁剪/滤镜/调整未实现
- **无 iCloud 同步**：照片不会跨设备同步
- **无人物/地点/事物分类**：macOS Photos 的智能分类未实现
- **壁纸写入依赖 store 初值**：`handleSetWallpaper` 从 `userWallpapers` 推导 prev，若 Desktop 启动时未调 `loadWallpaperSettings` 恢复 store，prev 可能不准（当前 Desktop 已正确恢复，但耦合点需注意）
