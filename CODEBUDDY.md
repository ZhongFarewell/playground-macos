# CODEBUDDY.md

This file provides guidance to CodeBuddy Code when working with code in this repository.

## Project Overview

A portfolio website that simulates the macOS GUI (Boot → Login → Desktop flow). Built with React 18 + TypeScript + Vite + UnoCSS + Zustand. Deployed to GitHub Pages at `portfolio.zxh.me` via the `build-and-deploy` workflow (pushes to `main` build and deploy).

**Current status:** Originally a pure static frontend, now integrating with the Align-server backend (`D:\AlignSpace\code\Align-server`, port 2120, prod `https://zhongfw.online`). Login, session, and Photos app consume backend APIs; other apps remain static. Runtime config (`window.alignConfig`) in `public/CONFIG.js` controls API/MinIO prefixes — `public/` is not processed by Vite, so `CONFIG.js` uses hardcoded values (not `process.env`).

**macOS fidelity rule (mandatory):** All UI/interaction must strictly follow real macOS behavior. Before implementing any UI/interaction change or new feature, you **must**:
1. Look up how the corresponding macOS app (Preview, Quick Look, Finder, Photos, etc.) handles that exact situation.
2. Explain the macOS behavior to the user in text.
3. Wait for the user to approve before writing any code.

Do not skip this explanation-then-approval step, even if you think your proposed approach is reasonable. If a requirement diverges from macOS, flag it before implementing. See `feedback_macos_style.md` and `feedback_requirement_macos_check.md` in the project memory for details.

## Commands

```bash
pnpm install        # install deps (lockfile is frozen in CI)
pnpm dev            # start Vite dev server with --host
pnpm build          # production build to dist/
pnpm serve          # preview the production build
pnpm lint           # run ESLint on the project
```

There is no test suite configured. Linting also runs via `lint-staged` on the `pre-commit` hook (`.husky/pre-commit` → `pnpm lint-staged`), which runs `eslint --fix` on staged `*.{js,ts,tsx}` and sorts `package.json`.

## Architecture

### App lifecycle (`src/index.tsx`)

Root `App` component toggles between three full-screen pages based on local state (`booting`, `login`): `Boot` → `Login` → `Desktop`. Power actions (`shutMac`, `restartMac`, `sleepMac`) are defined at the top and threaded down to `Login`/`Desktop` as `MacActions` (see `src/types/index.d.ts`). `Boot` controls the boot/sleep/wake/restart progress animation and clears `booting` to hand off to the next page.

### State management (Zustand, sliced)

`src/stores/index.ts` composes a single `useStore` from three slice creators in `src/stores/slices/`:
- `system.ts` — `dark`, `volume`, `brightness`, `wifi`, `bluetooth`, `airdrop`, `fullscreen` + their toggles. `toggleDark` mutates `document.documentElement.classList` directly to flip UnoCSS dark mode.
- `dock.ts` — `dockSize`, `dockMag` (dock magnification).
- `user.ts` — `typoraMd` content + `faceTimeImages` capture map + `userInfo`/`setUserInfo` (login state: backend `/auth` or `/login` response, see `UserInfo` interface in the slice file).

Each slice is a `StateCreator<Slice>`; new slices should follow the same `createXxxSlice` + `XxxSlice` interface pattern and be spread into `useStore`.

### API layer (`src/services/`)

**Not auto-imported** (only `src/hooks`, `src/stores`, `src/components/**` are). Must use explicit imports: `import { loginAlign, authAlign, logoutAlign, getPhotoList, photoUrl } from "~/services"`.

- `index.ts` — Axios instance with `withCredentials: true` (backend uses httpOnly `align_id` cookie for session). `baseURL` reads `window.alignConfig.apiPrefix + "/api"`. Exports `loginAlign` (POST `/login`, FormData with AES-encrypted `user` field), `authAlign` (GET `/auth` cookie session check), `logoutAlign` (GET `/logout` clears cookie), `getPhotoList` (GET `/resources/memory/image`), `photoUrl(filename)` (builds MinIO URL: `blogSourceMinio + "/memoryimage/" + filename`).
- `encrypt.ts` — AES-CBC encryption (key/iv = `2120131404240929`), aligned with dashboard `src/util/index.ts` and backend `helper.encodeUser`. Used to encrypt `{ username, password }` for login.
- `typora.ts` — Typora 笔记持久化，基于 `database/` 模块（笔记存为 `typora:note` 类型 record，正文走 `blobs/{id}.md`）。详见下方 "Database 持久化系统" 章节。
- `database/` — 通用持久化系统，把 GitHub 仓库 `ZhongFarewell/macos-database` 当数据库用。**设计相关功能时务必先查阅 `docs/database/` 文档**（详见下方 "Database 持久化系统" 章节）。

**Runtime config (`public/CONFIG.js`):** Sets `window.alignConfig = { apiPrefix, sourceHost, blogSourceMinio }`. `public/` is not processed by Vite — do not use `process.env.*` here (browser has no `process`). Dev uses Vite proxy (`/api` → Align-server, `/align-minio` → zhongfw.online); prod hardcodes values. Type declaration in `src/vite-env.d.ts` (`declare global { interface Window { alignConfig?: AlignConfig } }`).

### Login & session (`src/pages/Login.tsx`)

Login flow (replaces the original static password mock):
1. On mount, calls `authAlign()` — if `align_id` cookie is valid, backend returns user object → `setUserInfo` + `setLogin(true)` (auto-login, no password needed).
2. If session invalid, stays on login page. Username comes from `src/configs/user.ts` `user.username` (single fixed admin account, matching backend `Users` table). Login page only shows a password input — username is read from config.
3. On password submit: encrypts `{ username: user.username, password }` → FormData `user` field → `loginAlign()`. Success → `setUserInfo` + `setLogin(true)`; failure → shake animation + "Incorrect password".
4. Loading state: arrow button becomes a rotating spinner. Error state: whole input area shakes horizontally (framer-motion), text turns red.
5. Long-press (400ms) the password input to peek at plaintext (macOS Keychain-style press-and-hold), with a blue ring indicator.

**AppleMenu logout** (`src/components/menus/AppleMenu.tsx`): Both "Lock Screen" and "Log Out..." call `logout` in TopBar, which calls `logoutAlign()` to clear the `align_id` cookie, then `setLogin(false)`. This ensures a page refresh after lock/logout won't bypass the login (cookie is gone, `/auth` fails). The "Log Out {name}..." text is dynamic, reading `user.name` from config.

### Auto-imports (critical)

`vite.config.ts` uses `unplugin-auto-import` with `dirs: ["src/hooks", "src/stores", "src/components/**"]`. This means **hooks, the store, and all components are available globally without import**. The generated `src/auto-imports.d.ts` lists what's auto-imported (e.g. `useState`, `useStore`, `useWindowSize`, `AppWindow`, `TopBar`, etc.).

- Do **not** add explicit imports for these symbols — they are already global. Adding them can cause duplicate-declaration errors.
- React APIs (`useState`, `useEffect`, `useRef`, …) are also auto-imported; no `import React` is needed for hooks (though some files still `import React` for types/JSX namespace — keep that where used).
- When you add a new component/hook/store, run `pnpm dev` (or just save a file) so the plugin regenerates `src/auto-imports.d.ts`. Treat that file as generated — do not hand-edit.

### Path alias

`~/*` → `src/*` (configured in both `vite.config.ts` and `tsconfig.json`). Prefer `~/...` for intra-project imports.

### Apps & the desktop window system

`src/configs/apps.tsx` is the app registry: an array of `AppsData` (`src/types/configs/apps.d.ts`) describing each dock app — `id`, `title`, `img`, optional `desktop` (whether it opens in a window), `width/height/minWidth/minHeight/aspectRatio`, initial `x/y` offset, and `content` (the JSX element rendered inside the window). Apps with `desktop: false` either open Launchpad (`id: "launchpad"`) or external links (`link` field).

`src/pages/Desktop.tsx` owns all per-window runtime state (`showApps`, `appsZ` z-index stack, `maxApps`, `minApps`, `maxZ`) in a single `useState` object. Key behaviors:
- `openApp(id)` — shows the app, bumps its z-index above `maxZ`, restores position if it was minimized.
- `minimizeApp(id)` — reads the dock icon's rect and translates the window down to the dock via CSS transform, then marks it minimized. Relies on `#window-{id}` and `#dock-{id}` element IDs and the `--window-transform-x/y` CSS vars set in `setWindowPosition`.
- `closeApp`, `setAppMax` (also toggles `hideDockAndTopbar` for fullscreen), `setAppMin`.

`src/components/AppWindow.tsx` wraps `react-rnd` (`Rnd`) to make windows draggable/resizable. The window's title bar (`.window-bar`) is the drag handle. Maximize disables drag/resize and stretches to the viewport minus the top-bar margin. Windows with `aspectRatio` set (e.g. FaceTime) disable the maximize button. `AppWindow` injects `width` into its child via `React.cloneElement` — child app components should accept a `width` prop when they need it.

There is an intentional "boundary for windows" trick: windows are positioned with an extra `winWidth` offset and `minMarginY` (top bar height, `src/utils/constants.ts`) so `Rnd`'s `bounds="parent"` keeps them inside the visible area. Pay attention to comments referencing "because of the boundary for windows" before changing any position math.

### Desktop chrome

- `src/components/menus/TopBar.tsx` — top menu bar. Left side: Apple logo + `MenuBar` (renders current app's name as bold clickable + File/Edit/etc. menus declared by the app via `useAppMenus`). Right side: clock, control center, spotlight trigger, battery/wifi menus. Receives `currentAppId` + `onQuitApp` from Desktop.
- `src/components/menus/MenuBar.tsx` — macOS-style menu bar with hover-switching (click one menu, hover adjacent to switch). Reads `appMenus[currentAppId]` from the menu slice. App name is bold + clickable (About/Quit menu).
- `src/components/dock/Dock.tsx` + `DockItem.tsx` — bottom dock with framer-motion magnification driven by a `useMotionValue` for mouse X.
- `src/components/Spotlight.tsx` — Spotlight search (`Cmd/Space`-style) to open apps / toggle Launchpad.
- `src/components/Launchpad.tsx` — full-screen app grid (config in `src/configs/launchpad.ts`).
- `src/components/menus/` — `AppleMenu`, `ControlCenterMenu`, `WifiMenu`, `Battery`, `MenuBar`, plus `base.tsx` exporting `MenuItem` (supports `disabled`/`shortcut`) / `MenuItemGroup` primitives for dropdown menus.

### App menu system (`src/hooks/useAppMenus.ts` + `src/stores/slices/menu.ts`)

Apps declare their own top-bar menus (File/Edit/etc.) by calling `useAppMenus(appId, () => groups, deps)` in their component. The hook registers menu groups + shortcuts into the `menu` slice on mount, unregisters on unmount, and re-registers when `deps` change (so `onClick` closures stay fresh). `MenuBar` reads `appMenus[currentAppId]` from the store. Menu items use the same `MenuItemDef` interface as the context menu system (`src/types/contextMenu.d.ts`). Shortcuts (⌘N/O/S/Q etc.) are globally listened via `useMenuShortcuts(currentAppId)` (called in Desktop), routed by `currentAppId` — matches macOS "active app" concept. `currentAppId` lives in Desktop's local state (not store); `closeApp` falls back to the highest-z visible app.

### App code organization (mandatory for non-trivial apps)

Apps with more than ~150 lines **must** be split by responsibility into a folder under `src/components/apps/{app-id}/`. The main component file (e.g. `Photos.tsx`) is auto-imported globally (so `apps.tsx` can use `<Photos />` without import). All other files in the folder are **explicitly imported** by the main file — they are NOT auto-imported (avoids global namespace pollution).

Required structure:

```
src/components/apps/{app-id}/
  ├── {App}.tsx           # Main component — only composition + JSX. Auto-imported globally.
  ├── {Sub}.tsx           # Sub-components (e.g. PhotoCell, PhotoViewer) — explicit import
  ├── use{App}State.ts    # Custom hook: all state + handlers (fetch, save, rename, etc.) — explicit import
  └── menus.ts            # Menu group definitions for useAppMenus (a build function + deps) — explicit import
```

Rules:
- Main component (`{App}.tsx`) should be thin: call `use{App}State()` for state/handlers, call `useAppMenus()` for menu registration, compose sub-components in JSX. No business logic here.
- `use{App}State.ts` returns `{ state, handlers }` — all `useState`/`useCallback`/`useEffect` live here.
- `menus.ts` exports a `buildMenus(handlers)` function + a `menuDeps` array, so the main component can call `useAppMenus(appId, () => buildMenus(handlers), deps)`.
- Sub-components receive props only — they don't call app-level hooks. If a sub-component needs store access (e.g. `useContextMenu`), it calls the global hook directly.
- Dialog/modal components (e.g. `TyporaSaveDialog`) live alongside other sub-components in the same folder.
- Small apps (under ~150 lines, like VSCode/FaceTime) can stay as a single file in `src/components/apps/{App}.tsx` — no need to create a folder.

### Built-in apps (`src/components/apps/`)

`Typora` (Milkdown WYSIWYG markdown editor with GitHub-persisted notes — see "Typora app" below), `Finder` (file manager with GitHub-persisted entries — see "Finder app" below), `Safari` (iframe browser over `src/configs/websites.tsx`), `VSCode` (opens `vscode://` URL), `Terminal` (command loop over `src/configs/terminal.tsx`), `FaceTime` (webcam capture via `react-webcam`, stores snapshots in the `user` store), `Photos` (photo gallery consuming backend `/resources/memory/image` API).

**Finder app** (`src/components/apps/finder/`): File manager backed by the `macos-database` GitHub repo. Folder structure: `Finder.tsx` (main, auto-imported) + `FinderSidebar`/`FinderToolbar`/`FinderFileList`/`FinderFileRow`/`FinderPathBar`/`EmptyTrashDialog` + `useFinderState.ts` + `menus.ts` + `types.ts`. Files/folders are unified as `finder:entry` records (id = ULID, collection type): meta (name/parentId/kind/blob-ref/ext/size/trashed/...) in `records/{id}.json`, file content in `blobs/{id}.{ext}`. **Binary-safe blob path**: file content uses `Uint8Array` via `readBlobBytes`/`writeBlobBytes` (not `readBlob`/`writeBlob` — those are UTF-8 text only, used by Typora). Service layer in `src/services/finder.ts` wraps the database API. Drag-and-drop any file type into the window to upload (uses `file.arrayBuffer()`, binary-safe). Double-click a file opens it in a new browser tab via `rawUrl` (raw.githubusercontent.com direct link, streamed by the browser). Trash is soft-delete (`trashed:true` + `originalParentId` preserved); Empty Trash physically deletes records + blobs. Two app entries in `apps.tsx`: `id:"finder"` (Home view) + `id:"trash"` (`<Finder initialTrash />`). See `docs/apps/finder.md` for full architecture.

**Typora app** (`src/components/apps/typora/`): WYSIWYG markdown editor backed by the `macos-database` GitHub repo (via the `src/services/database/` persistence system — see "Database 持久化系统" below). Folder structure follows the app code organization rule: `Typora.tsx` (main, auto-imported) + `MilkdownEditor.tsx` + `useTyporaState.ts` (state/handlers) + `menus.ts` + dialog components (`TyporaOpenPanel`/`TyporaSaveDialog`/`TyporaPatDialog`/`TyporaRenameDialog`). Notes are stored as `typora:note` records (id = ULID, collection type): meta (title/excerpt/blob-ref) in `records/{id}.json`, content in `blobs/{id}.md`. Service layer in `src/services/typora.ts` wraps the database API (`queryByType`/`insertRecord`/`updateRecord`/`readBlob`/`writeBlob`). PAT stored in `localStorage` key `database_github_pat` (auto-migrated from the old `typora_github_pat` key on module load). No in-window toolbar — all operations (New ⌘N / Open… ⌘O / Save ⌘S / Rename… / Export…) are exposed via the macOS-style top menu bar through `useAppMenus("typora", ...)` (see `menus.ts`). Save menu triggers a submenu choice (Save to GitHub / Save to Local download). Drag-and-drop `.md`/`.markdown`/`.txt` files into the window to open them. Deviates from real Typora in: (1) no independent window per document (browser limitation), (2) custom Open/Save modals replace native system dialogs (browser limitation), (3) saves to GitHub instead of local filesystem. Milkdown `markdownUpdated` callback syncs content to Zustand `typoraMd` for cross-component access.

**Photos app** (`src/components/apps/photos/`): Simulates macOS Photos. Folder structure: `Photos.tsx` (main, auto-imported) + `PhotoCell.tsx` + `PhotoViewer.tsx` + `usePhotosState.ts` + `menus.ts` + `types.ts`. Fetches all photo metadata in one request (`pageSize: 9999`), renders a grid with `content-visibility: auto` + `loading="lazy"` + `decoding="async"` (not a virtual list — DOM nodes stay mounted so images don't reload on scroll). Grid columns use `repeat(auto-fill, minmax(120px, 1fr))` so thumbnail size stays constant while column count adapts to window width (matches macOS Photos behavior — maximizing adds columns, not enlarges thumbnails). Features: skeleton screen during load, error state with "Try Again" retry button, empty state, full-screen image viewer with ← → navigation, ESC close, zoom/pan, bottom info bar + zoom slider. Menus via `useAppMenus("photos", ...)` (File: Export; Image: Set as Desktop Picture; View: sort order). Right-click on thumbnail: Set as Wallpaper / Copy Image Address / Export (uses `useContextMenu` hook). "Set as Desktop Picture" writes to system slice's `customWallpaper` (Desktop reads it for background). App icon `public/img/icons/photos.png` must be supplied manually.

### Hooks (`src/hooks/`)

`useWindowSize`, `useClickOutside`, `useInterval`, `useAudio`, `useBattery` (Battery Status API; falls back to 100% on unsupported browsers), `useContextMenu` (element-level context menu declaration, see "Context menu system" below). All auto-imported globally.

### Context menu system (plugin-friendly, element-level)

Replaces the browser's native context menu with a macOS-style one. Designed for future plugin architecture: apps (which may be independently bundled but run in-process) declare their own menu items via a fixed protocol interface.

**Protocol interface** (`src/types/contextMenu.d.ts`):
- `MenuItemDef` — `{ key?, label?, shortcut?, onClick?, disabled?, separator?, children? }` (children reserved for submenus).
- `MenuCollector` — `{ add(...items), addSeparator() }`, passed to collection callbacks.
- `ContextMenuContext` — `{ event, x, y, selection, target }`, gives elements context to decide what menu items to return.

**Collection mechanism** (`src/components/ContextMenu.tsx`): On `contextmenu` event, the component dispatches a custom `contextmenu-collect` event (bubbles up the DOM). Elements on the bubble path listen for this event and call `collector.add(...)` to declare their menu items. If nothing is collected, falls back to a default menu (Cut/Copy/Paste/Look Up/Search/Select All — macOS universal menu). Renders at mouse position with edge-flipping, closes on click-outside/ESC/scroll. Always mounted in `App` (all three routes: Boot/Login/Desktop).

**Element declaration** (`src/hooks/useContextMenu.ts`): The `useContextMenu(collect, deps)` hook returns a ref. Attach the ref to any element; right-clicking it will invoke `collect(ctx, collector)` where you call `collector.add(...)`. Auto-imported globally.

```tsx
const photoRef = useContextMenu((ctx, collector) => {
  collector.add(
    { label: "Set as Wallpaper", onClick: () => setWallpaper(src) },
    { separator: true },
    { label: "Copy Image Address", onClick: () => copy(url) }
  );
});
return <img ref={photoRef as any} src={url} />;
```

**Design rationale:** macOS context menus are context-sensitive (right-clicking a photo vs. text vs. desktop shows different items). The collect-event-bubble pattern lets each element self-declare its menu items without a central registry — matching macOS behavior. If an element doesn't declare anything, the bubble continues to parents, and ultimately the default menu shows. This aligns with the future plugin architecture: an independently bundled app just needs to comply with the `MenuItemDef` protocol and listen for `contextmenu-collect` events.

### Database 持久化系统 (`src/services/database/`)

把 GitHub 仓库 `ZhongFarewell/macos-database` 当数据库用，承载 macOS 模拟器中所有需要持久化的数据（Typora 笔记、浏览器历史/书签、系统设置、桌面状态等）。

**📋 设计相关功能时务必先查阅文档**：`docs/database/` 目录下有完整架构文档，**动手前必读**：

| 场景 | 必读文档 |
|------|---------|
| 新增持久化数据 / 接入新功能 | `docs/database/README.md` + `data-model.md` + `api-reference.md` |
| 设计新的 type / 单例 vs 集合判定 | `docs/database/type-naming-convention.md` |
| 理解读写流程 / 排查请求问题 | `docs/database/sha-cache-strategy.md` + `queue-and-flush.md` |
| 评估 GitHub API 限制 / 性能权衡 | `docs/database/github-api-constraints.md` |
| 理解仓库目录结构 / 文件格式 | `docs/database/storage-layout.md` |
| 理解整体架构 / 模块分层 | `docs/database/architecture.md` |

**核心设计原则**（详见 `docs/database/README.md`）：
1. 统一数据模型：所有数据都是 `DatabaseRecord`，靠 `type` 字段分类
2. localStorage 是真相源，GitHub 是异步副本
3. sha 乐观锁 + 本地缓存（PUT 前用本地 sha，冲突才 GET）
4. 写队列 debounce 2s + 串行 flush
5. 大文本走 `blobs/`，不进 record

**对外 API 入口**：`~/services/database`（业务代码只 import 这一个，不直接 import 内部模块）。核心 API：`initDatabase` / `getSingleton` / `writeSingleton` / `queryByType` / `insertRecord` / `updateRecord` / `deleteRecord` / `readBlob` / `writeBlob` / `readBlobBytes` / `writeBlobBytes` / `rawUrl` / `flushAll`。详见 `docs/database/api-reference.md`。

**type 命名约定**：`{app}:{feature}` 格式（如 `browser:history`、`system:settings`、`typora:note`、`finder:entry`）。单例 id === type，集合 id = ULID。详见 `docs/database/type-naming-convention.md`。

**适用边界**：单用户 portfolio 项目，< 1 万条 record。不适用多用户协作、高频写、超大二进制存储（图片走 MinIO）。Finder 的 `finder:entry` 支持任意类型文件（mp3/pdf 等），但 GitHub 有 100MB 单文件上限，超大文件仍应走 MinIO。未来如需迁移到真数据库，只换 `github.ts` 通信层。

### Styling — UnoCSS (`unocss.config.ts`)

Uses `presetUno`, `presetAttributify` (attribute-based classes like `<div text="sm gray-200" />`), `presetIcons` (`i-{set}:{icon}` classes render inline SVGs — e.g. `i-gg:close`, `i-ri:restart-line`), and three transformers (directives, variant groups, attributify-jsx).

Notable custom shortcuts: `flex-center`, `hstack`, `vstack`, `no-outline`, `window-btn`, `menu-box`, `cc-grid` (control-center tile), `cc-btn`, `battery-level`.

Theme-aware color shortcuts `text-c-*`, `bg-c-*`, `border-c-*` auto-generate a `dark:` variant — `colorAttr` in the config maps a light gray shade to its dark-mode counterpart (see the `colorReg`/`colorAttr` helpers). Use these `*-c-*` shortcuts for any color that needs to respond to dark mode, rather than writing explicit `dark:` variants.

**Safelist for dynamic icon classes**: UnoCSS scans source for literal class names, but icons referenced only as object values (like `FILE_ICON_MAP` in `src/components/apps/finder/types.ts`) won't be collected. The `safelist` array in `unocss.config.ts` explicitly lists these. **When adding new file-type icons to `FILE_ICON_MAP`, sync the safelist** or the icon won't render after build.

Dark mode is toggled by adding/removing the `dark` class on `<html>` (done in `system.ts` `toggleDark`), so UnoCSS `dark:` variants work out of the box.

### TypeScript

Strict mode, `moduleResolution: "Node"`, `jsx: "react-jsx"`, `noEmit: true` (Vite handles emit). Path alias `~/*` → `src/*`. ESLint config (`eslint.config.js`) turns off `no-explicit-any`, `no-unused-vars`, `ban-types`, and `react/jsx-no-undef` — `any` is allowed.

## Conventions

- 2-space indent, LF line endings, UTF-8, trim trailing whitespace, final newline (`.editorconfig`).
- Functional components + hooks only (the README notes a class-component predecessor on the `class-component` branch — do not reintroduce class components).
- Add new apps via: an entry in `src/configs/apps.tsx` (and `src/configs/launchpad.ts` if it should appear in Launchpad), a component in `src/components/apps/`, and any related config in `src/configs/` + types in `src/types/configs/`. The component will be auto-imported — no manual import in `apps.tsx` needed.
- `src/services/` is **not** auto-imported — always use explicit `import { ... } from "~/services"`.
- `public/CONFIG.js` is not processed by Vite — use hardcoded values, not `process.env.*`.
- `src/configs/user.ts` now has a `username` field (backend `Users.username` for login). The `password` field is deprecated (was for the old static mock login). `name` is the display name shown on the login page and AppleMenu's "Log Out {name}...".
- Commit hooks run `lint-staged`; make sure `pnpm lint` passes before committing.
- 新增持久化数据时，**先读 `docs/database/` 文档**（尤其是 `type-naming-convention.md` 和 `api-reference.md`），按约定设计 type 和数据结构。不要绕过 database 模块直接调 GitHub API——所有持久化都走 `~/services/database` 统一入口。
