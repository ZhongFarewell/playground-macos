# Settings App 架构

模拟 macOS System Settings 的系统偏好设置应用。左 sidebar + 右 detail 区结构，承载账户信息、外观、壁纸、声音、Dock 等系统偏好面板。

> **底层持久化机制**详见 [`docs/database/`](../database/) —— record / manifest / cache / queue 的通用设计不在本文重复。本文只讲 Settings 特有的设计决策与实现结构。

## 目录

- [数据模型](#数据模型)
- [服务层](#服务层)
- [组件结构](#组件结构)
- [面板清单](#面板清单)
- [状态管理](#状态管理)
- [持久化流程](#持久化流程)
- [跨 app 通知机制](#跨-app-通知机制)
- [macOS 对齐与偏差](#macos-对齐与偏差)

---

## 数据模型

Settings 涉及两个 database 单例：

### `user:profile`（账户信息）

- **type**：`user:profile`（单例，id === type）
- **定义位置**：`AccountPanel.tsx` 内联 interface `UserProfile`（未抽到 types/）

```ts
interface UserProfile {
  name: string;        // 姓名
  autograph: string;   // 个性签名
  intr: string;        // 简介
  gender: string;      // 性别
  wechat: string;      // 微信
  QQ: string;          // QQ
}
```

### `system:wallpaper`（壁纸设置）

- **type**：`system:wallpaper`（单例，id === type）
- **定义位置**：`src/services/wallpaper.ts`

```ts
interface WallpaperSettings {
  current: string | null;   // 当前壁纸 URL，null = 用默认 day/night
  photos: string[];         // 从 Photos 设过的壁纸 URL 列表（最新在前，去重）
}
```

### 未持久化的 system slice 字段

`src/stores/slices/system.ts` 的 `dark` / `volume` / `brightness` / `wifi` / `bluetooth` / `wallpaperFit` / `dockSize` / `dockMag` 等**目前只存 Zustand 内存，未接入 database**。

> [`docs/database/type-naming-convention.md`](../database/type-naming-convention.md) 登记了 `system:settings`（`{ dark, volume, brightness, wifi, bluetooth }`），但 system slice 尚未调用 `writeSingleton("system:settings", ...)`。这是规划中的 type，当前实现与文档登记存在差距——后续接入时无需改 type 命名，直接在 system slice 里补 `writeSingleton` 调用即可。

---

## 服务层

### `src/services/wallpaper.ts`

壁纸持久化服务，基于 database 的 `system:wallpaper` 单例。

| 函数 | 说明 |
|------|------|
| `loadWallpaperSettings()` | 读取持久化壁纸设置（启动时 Desktop 调用恢复 store） |
| `saveWallpaperSettings(settings)` | 写入壁纸设置（立即入队，debounce 2s 后 flush） |
| `addPhotoWallpaper(prev, url)` | 把 Photos 图片加入壁纸库 + 设为当前（返回新 settings） |
| `setCurrentWallpaper(prev, url)` | 只更新当前壁纸（不改动 photos 列表） |

**流程**：用户操作 → 立即更新 Zustand store（UI 即时响应）→ `writeSingleton` 推送 database（debounce 2s）。启动时 Desktop 调 `loadWallpaperSettings()` 恢复 store。

### `src/services/database/`（直接使用）

`AccountPanel` 和 `PrivacyPanel` 直接 import database 模块的 API（不经中间 service 层）：

- `AccountPanel`：`getSingleton` / `writeSingleton` / `hasPat` / `onQueueStatus` / `hasPending`
- `PrivacyPanel`：`getPat` / `setPat` / `clearPat` / `hasPat` / `flushAll`

> AccountPanel 直接调 database 是因为 `user:profile` 单例逻辑简单（读 + 失焦写），且需要订阅队列状态做保存指示器，抽 service 层收益不大。PrivacyPanel 是 PAT 管理本身属于 database 模块的能力，直接调最自然。

---

## 组件结构

```
src/components/apps/settings/
├── Settings.tsx              # 主组件：左 sidebar + 右 detail。自动导入全局
├── useSettingsState.ts       # sidebar 选中项状态 + localStorage 持久化 + 通知导航
├── SettingsSidebar.tsx       # 左侧 sidebar：账户卡片 + 搜索框 + 分组列表
├── SettingsDetail.tsx        # 右侧详情区：按 sidebar 选中项 switch 到对应 Panel
├── SettingsSlider.tsx        # 通用滑块组件（Sound/Desktop&Dock 复用）
├── SettingsToggle.tsx        # 通用开关组件
├── menus.ts                 # useAppMenus 定义（当前为空骨架）
├── types.ts                  # SidebarItemId / SidebarItem / SidebarGroup
└── panels/                   # 各设置面板
    ├── AccountPanel.tsx      # Apple ID 账户信息（持久化 user:profile）
    ├── AppearancePanel.tsx   # 外观 Light/Dark 切换
    ├── WallpaperPanel.tsx    # 壁纸选择（持久化 system:wallpaper）
    ├── SoundPanel.tsx        # 音量 + 静音
    ├── DesktopDockPanel.tsx  # Dock 大小 + 放大
    ├── PrivacyPanel.tsx      # GitHub PAT 配置
    ├── AccountField.tsx      # 账户字段行（label + input/textarea，失焦触发保存）
    └── PlaceholderPanel.tsx  # 占位面板（未实现项用）
```

### 职责规则

- `Settings.tsx` 极薄：调 `useSettingsState()` 拿 `currentItemId` + `setItemId`，组合 `SettingsSidebar` + `SettingsDetail`
- `SettingsDetail` 是纯路由：按 `currentItemId` switch 到对应 Panel 组件
- 各 Panel 独立管理自己的状态和持久化，互不依赖（AccountPanel 管 `user:profile`，WallpaperPanel 管 `system:wallpaper`，PrivacyPanel 管 PAT）
- 通用控件 `SettingsSlider` / `SettingsToggle` / `AccountField` 被 Panel 复用

---

## 面板清单

| SidebarItemId | 面板组件 | 状态来源 | 持久化 |
|---------------|---------|---------|--------|
| `account` | AccountPanel | local + `user:profile` 单例 | ✅ `user:profile` |
| `appearance` | AppearancePanel | `useStore.dark` | ❌（仅内存） |
| `wallpaper` | WallpaperPanel | `useStore.customWallpaper` + `system:wallpaper` 单例 | ✅ `system:wallpaper` |
| `sound` | SoundPanel | `useStore.volume` | ❌（仅内存） |
| `desktop-dock` | DesktopDockPanel | `useStore.dockSize/dockMag` | ❌（仅内存） |
| `privacy` | PrivacyPanel | localStorage PAT | ✅ PAT → `database_github_pat` |
| 其他 15 项 | PlaceholderPanel | — | — |

Sidebar 完整分组（拟真 macOS Ventura+ 顺序）定义在 `SettingsSidebar.tsx` 的 `SIDEBAR_GROUPS`：Wi-Fi/Bluetooth/Network · Notifications/Sound/Focus · General/Appearance/Accessibility/Control Center/Siri/Spotlight/Privacy · Desktop&Dock/Wallpaper/Displays/Battery/Lock Screen/Login Password/Users&Groups。

---

## 状态管理

`useSettingsState()` 只管 sidebar 选中项：

```ts
interface SettingsState {
  currentItemId: SidebarItemId;
  setItemId: (id: SidebarItemId) => void;
}
```

### localStorage 持久化

- **key**：`mdb:settings:last-sidebar`
- 启动时从 localStorage 恢复上次选中的 panel
- 选中项变化时立即写入

这是 Settings app 自己的 UI 状态持久化，不走 database（只是记住上次看到哪个 panel，不值得入 GitHub）。

### 通知导航信号

监听 `useStore.pendingNavigate`：若 `appId === "settings"` 且有 `sidebarItemId`，自动切换到对应 panel 并清除信号。这让其他 app 可以通过 `pushNotification` 引导用户跳到 Settings 的特定面板（如 AccountPanel 在 PAT 缺失时推送通知，点击跳到 Privacy panel）。

---

## 持久化流程

### AccountPanel：失焦自动保存

```
用户编辑字段 → 字段失焦 → handleFieldBlur
  → setProfile(更新本地) → writeSingleton("user:profile", next)
  → 若 !hasPat()：标记 failed + pushNotification 引导去 Privacy panel
```

**保存状态指示器**（右下角）通过 `onQueueStatus` 订阅 database 队列：

| 队列状态 | UI 显示 | 说明 |
|---------|---------|------|
| running | Saving… | 队列正在 flush |
| flush 结束 + 无 pending + 有 PAT | Saved（1.5s 后回 idle） | 保存成功 |
| flush 结束 + 有 pending 或无 PAT | Save failed | 任务被丢弃 |

> PAT 缺失时队列任务会被丢弃，`hasPending()` 可能为 false 但实际没写入。用 `hasPat()` 区分「真成功」和「静默失败」。

### WallpaperPanel：立即生效 + 推送 database

```
点击壁纸缩略图 → applyWallpaper(url)
  → fetch(url) → blob → createObjectURL（预加载避免流式）
  → addPreloadedWallpaper(url, blobUrl) + setWallpaper(url)（更新 store，UI 立即生效）
  → setCurrentWallpaper(prev, url)（推送 system:wallpaper 单例）
```

切回默认壁纸（`url=null`）：day/night 已在 boot 预加载，直接 `setWallpaper(null)` + `setCurrentWallpaper`。

### PrivacyPanel：PAT 配置

```
输入 PAT → Save → setPat(trimmed) → flushAll()（重试之前因 PAT 缺失失败的写入）
Clear → clearPat() → 清空 localStorage key
```

`flushAll()` 立即触发队列重试，让 AccountPanel 等 pending 写入能继续完成。

---

## 跨 app 通知机制

Settings 通过两个 Zustand slice 与其他 app 协作：

### notification slice（`src/stores/slices/notification.ts`）

- `pushNotification({ title, body, appId, sidebarItemId? })`：推送系统通知
- `pendingNavigate: { appId, sidebarItemId? } | null`：通知点击后的跳转信号

**典型场景**：AccountPanel 在 PAT 缺失时 `pushNotification`，通知点击后 `pendingNavigate = { appId: "settings", sidebarItemId: "privacy" }`，`useSettingsState` 监听到后自动切到 Privacy panel。

### system slice

`customWallpaper` / `userWallpapers` / `wallpaperFit` 等壁纸相关字段在 system slice，WallpaperPanel 和 Photos app 共享：

- **WallpaperPanel**：`setWallpaper` / `setWallpaperFit` / `addPreloadedWallpaper`
- **Photos app**：`setWallpaper` + 调 `addPhotoWallpaper` 推送 database（详见 Photos app 的右键 "Set as Wallpaper"）

> Photos app 的壁纸操作走 `src/services/wallpaper.ts` 的 `addPhotoWallpaper`，与 WallpaperPanel 共用同一套持久化逻辑，保证两边写入 `system:wallpaper` 单例的语义一致。

---

## macOS 对齐与偏差

### 对齐点

- 左 sidebar + 右 detail 的两栏布局（macOS Ventura+ 风格）
- sidebar 分组顺序、图标、彩色图标效果拟真 macOS
- Appearance 面板：Light / Dark 两个缩略图选项（带桌面预览样式）
- Wallpaper 面板：当前壁纸大预览 + 填充方式下拉 + 分区缩略图网格
  - 分区：Light & Dark Desktop（明暗对）/ Desktop Pictures（内置）/ Photos Library（从 Photos 设过的）/ Pictures（用户自定义）
  - 缩略图选中态：蓝色边框 + 右上角勾选圆点
- Sound 面板：输出音量滑块 + 静音开关
- Desktop & Dock 面板：Dock 大小 + 放大滑块
- Apple ID 账户页：大头像 + 姓名 + 个签 + 个人信息卡片
- 字段失焦自动保存（macOS 系统偏好的即时保存语义）
- 保存状态指示器（Saving… / Saved / Save failed）

### 已知偏差

- **大部分面板是占位**：21 个 sidebar 项里只有 6 个有实现（Account/Appearance/Wallpaper/Sound/Desktop&Dock/Privacy），其余 15 个是 PlaceholderPanel
- **system:settings 未接入**：dark/volume/brightness/wifi/bluetooth/dockSize/dockMag 目前只在 Zustand 内存，刷新即丢（type-naming-convention 已登记但实现未跟上）
- **无 Apple ID 登录态**：AccountPanel 编辑的是本地 profile（`user:profile` 单例），非真实 iCloud 账户
- **壁纸填充方式仅 UI 生效**：`wallpaperFit` 切换后 store 更新，但 Desktop 渲染层是否完整支持 cover/contain/stretch/center 四种模式取决于 Desktop 实现
- **无 Quit 菜单**：`menus.ts` 是空骨架，⌘Q 未接入关闭窗口（用户需点窗口关闭按钮）
- **搜索框禁用**：sidebar 顶部搜索框是 UI 占位，`disabled` 状态
