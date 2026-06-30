import React from "react";
import { apps, wallpapers } from "~/configs";
import { minMarginY, minMarginX } from "~/utils";
import type { MacActions } from "~/types";
import type { PersistWindowState } from "~/components/AppWindow";

/** localStorage key：窗口位置/大小持久化（仅本地，不进 GitHub） */
const WINDOW_STATE_KEY = "mdb:desktop:window-state-local";

interface SavedWindowState {
  x: number;
  y: number;
  width: number;
  height: number;
  max: boolean;
}

/** 从 localStorage 读取所有窗口状态 */
const loadWindowStates = (): Record<string, SavedWindowState> => {
  try {
    const raw = localStorage.getItem(WINDOW_STATE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

/** 写入所有窗口状态到 localStorage */
const saveWindowStates = (states: Record<string, SavedWindowState>): void => {
  try {
    localStorage.setItem(WINDOW_STATE_KEY, JSON.stringify(states));
  } catch {
    // 配额满或被禁用，静默降级
  }
};

/**
 * Clamp 窗口状态到当前视口可见区域。
 * 跨设备/视口变化时保证窗口至少部分可见。
 */
const clampToViewport = (
  s: SavedWindowState,
  winWidth: number,
  winHeight: number,
  dockSize: number
): { x: number; y: number; width: number; height: number } => {
  const width = Math.min(s.width, winWidth);
  const height = Math.min(s.height, winHeight - minMarginY);
  // x 含 boundary 偏移（+ winWidth），clamp 到 [winWidth + minMarginX, winWidth*2 - width - minMarginX]
  const x = Math.min(
    winWidth * 2 - width - minMarginX,
    Math.max(winWidth + minMarginX, s.x)
  );
  // y clamp 到 [0, winHeight - height - dockSize - minMarginY]
  const y = Math.min(winHeight - height - dockSize - minMarginY, Math.max(0, s.y));
  return { x, y, width, height };
};

interface DesktopState {
  showApps: {
    [key: string]: boolean;
  };
  appsZ: {
    [key: string]: number;
  };
  maxApps: {
    [key: string]: boolean;
  };
  minApps: {
    [key: string]: boolean;
  };
  maxZ: number;
  showLaunchpad: boolean;
  currentTitle: string;
  currentAppId: string | null;
  hideDockAndTopbar: boolean;
  spotlight: boolean;
}

export default function Desktop(props: MacActions) {
  const [state, setState] = useState({
    showApps: {},
    appsZ: {},
    maxApps: {},
    minApps: {},
    maxZ: 2,
    showLaunchpad: false,
    currentTitle: "Finder",
    currentAppId: null,
    hideDockAndTopbar: false,
    spotlight: false
  } as DesktopState);

  const [spotlightBtnRef, setSpotlightBtnRef] =
    useState<React.RefObject<HTMLDivElement> | null>(null);

  // 窗口位置/大小持久化（仅 localStorage，不进 GitHub）
  // 启动时同步加载，closeApp 时更新
  const [windowStates, setWindowStates] = useState<Record<string, SavedWindowState>>(() =>
    loadWindowStates()
  );
  const dockSize = useStore((s) => s.dockSize);
  const { winWidth, winHeight } = useWindowSize();

  // 全局菜单快捷键（按当前 app 路由）
  useMenuShortcuts(state.currentAppId);

  const { dark, brightness, customWallpaper, wallpaperFit } = useStore((state) => ({
    dark: state.dark,
    brightness: state.brightness,
    customWallpaper: state.customWallpaper,
    wallpaperFit: state.wallpaperFit
  }));

  // 壁纸 URL（自定义优先，否则按深色模式取默认）
  const wallpaperUrl = customWallpaper ?? (dark ? wallpapers.night : wallpapers.day);

  // 壁纸渲染：优先用 boot 预加载的 blob URL（内存引用，不走网络，绝不流式）
  const preloadedWallpapers = useStore((s) => s.preloadedWallpapers);
  const wallpaperSrc = preloadedWallpapers[wallpaperUrl] ?? wallpaperUrl;
  const [wallpaperLoaded, setWallpaperLoaded] = useState(
    Boolean(preloadedWallpapers[wallpaperUrl])
  );
  useEffect(() => {
    setWallpaperLoaded(Boolean(preloadedWallpapers[wallpaperUrl]));
  }, [wallpaperUrl, preloadedWallpapers]);

  const getAppsData = (): void => {
    let showApps = {},
      appsZ = {},
      maxApps = {},
      minApps = {};

    apps.forEach((app) => {
      showApps = {
        ...showApps,
        [app.id]: !!app.show
      };
      appsZ = {
        ...appsZ,
        [app.id]: 2
      };
      maxApps = {
        ...maxApps,
        [app.id]: false
      };
      minApps = {
        ...minApps,
        [app.id]: false
      };
    });

    setState({ ...state, showApps, appsZ, maxApps, minApps });
  };

  useEffect(() => {
    getAppsData();
  }, []);

  // 壁纸恢复 & PAT 检测已移至 boot 序列（src/boot/），Desktop 假设 boot 已完成，
  // 直接从 store 读 customWallpaper / userWallpapers（boot Phase 2 已写入）。

  const toggleLaunchpad = (target: boolean): void => {
    const r = document.querySelector(`#launchpad`) as HTMLElement;
    if (target) {
      r.style.transform = "scale(1)";
      r.style.transition = "ease-in 0.2s";
    } else {
      r.style.transform = "scale(1.1)";
      r.style.transition = "ease-out 0.2s";
    }

    // 函数式更新：避免连续 setState（如 Launchpad 点应用时 toggle + openApp 串联）
    // 里 spread 过期 state 覆盖 showLaunchpad 的更新
    setState((prev) => ({ ...prev, showLaunchpad: target }));
  };

  const toggleSpotlight = (): void => {
    setState({ ...state, spotlight: !state.spotlight });
  };

  const setWindowPosition = (id: string): void => {
    const r = document.querySelector(`#window-${id}`) as HTMLElement;
    const rect = r.getBoundingClientRect();
    r.style.setProperty(
      "--window-transform-x",
      // "+ window.innerWidth" because of the boundary for windows
      (window.innerWidth + rect.x).toFixed(1).toString() + "px"
    );
    r.style.setProperty(
      "--window-transform-y",
      // "- minMarginY" because of the boundary for windows
      (rect.y - minMarginY).toFixed(1).toString() + "px"
    );
  };

  const setAppMax = (id: string, target?: boolean): void => {
    const maxApps = state.maxApps;
    if (target === undefined) target = !maxApps[id];
    maxApps[id] = target;
    setState({
      ...state,
      maxApps: maxApps,
      hideDockAndTopbar: target
    });
  };

  const setAppMin = (id: string, target?: boolean): void => {
    const minApps = state.minApps;
    if (target === undefined) target = !minApps[id];
    minApps[id] = target;
    setState({
      ...state,
      minApps: minApps
    });
  };

  const minimizeApp = (id: string): void => {
    setWindowPosition(id);

    // 非 dock app（如 Settings）：直接最小化，不做 dock 图标动画
    let dockEl = document.querySelector(`#dock-${id}`) as HTMLElement | null;
    if (!dockEl) {
      setAppMin(id, true);
      return;
    }
    const dockAppRect = dockEl.getBoundingClientRect();

    dockEl = document.querySelector(`#window-${id}`) as HTMLElement;
    // const appRect = r.getBoundingClientRect();
    const posY = window.innerHeight - dockEl.offsetHeight / 2 - minMarginY;
    // "+ window.innerWidth" because of the boundary for windows
    const posX = window.innerWidth + dockAppRect.x - dockEl.offsetWidth / 2 + 25;

    // translate the window to that position
    dockEl.style.transform = `translate(${posX}px, ${posY}px) scale(0.2)`;
    dockEl.style.transition = "ease-out 0.3s";

    // add it to the minimized app list
    setAppMin(id, true);
  };

  // AppWindow 关闭前回传状态，记录到 windowStates + localStorage
  const handleWindowClose = (id: string, s: PersistWindowState): void => {
    const next = { ...windowStates, [id]: s };
    setWindowStates(next);
    saveWindowStates(next);
  };

  const closeApp = (id: string): void => {
    setAppMax(id, false);
    const showApps = state.showApps;
    showApps[id] = false;
    // 回退 currentAppId：找剩余可见 app 中 z 最高的；没有则 null
    let nextAppId: string | null = null;
    let nextZ = -1;
    const appsZ = state.appsZ;
    for (const appId of Object.keys(showApps)) {
      if (showApps[appId] && !state.minApps[appId] && appsZ[appId] > nextZ) {
        nextZ = appsZ[appId];
        nextAppId = appId;
      }
    }
    const nextApp = nextAppId ? apps.find((a) => a.id === nextAppId) : undefined;
    setState({
      ...state,
      showApps: showApps,
      currentAppId: nextAppId,
      currentTitle: nextApp ? nextApp.title : "Finder",
      hideDockAndTopbar: false
    });
  };

  const openApp = (id: string): void => {
    // add it to the shown app list
    const showApps = state.showApps;
    const wasClosed = !showApps[id];
    showApps[id] = true;

    // move to the top (use a maximum z-index)
    const appsZ = state.appsZ;
    const maxZ = state.maxZ + 1;
    appsZ[id] = maxZ;

    // get the title of the currently opened app
    const currentApp = apps.find((app) => {
      return app.id === id;
    });
    if (currentApp === undefined) {
      throw new TypeError(`App ${id} is undefined.`);
    }

    // 从关闭状态打开时，恢复持久化的 max 状态
    const maxApps = state.maxApps;
    if (wasClosed) {
      const saved = windowStates[id];
      if (saved?.max) {
        maxApps[id] = true;
      } else {
        maxApps[id] = false;
      }
    }

    // 函数式更新：避免 spread 过期 state 覆盖其他字段的并发更新
    // （如 Launchpad 点应用时 toggleLaunchpad 已把 showLaunchpad 改 false）
    setState((prev) => ({
      ...prev,
      showApps: { ...showApps },
      appsZ: { ...appsZ },
      maxApps: { ...maxApps },
      maxZ: maxZ,
      currentTitle: currentApp.title,
      currentAppId: id,
      hideDockAndTopbar: maxApps[id]
    }));

    const minApps = state.minApps;
    // if the app has already been shown but minimized
    if (minApps[id]) {
      // move to window's last position
      const r = document.querySelector(`#window-${id}`) as HTMLElement;
      r.style.transform = `translate(${r.style.getPropertyValue(
        "--window-transform-x"
      )}, ${r.style.getPropertyValue("--window-transform-y")}) scale(1)`;
      r.style.transition = "ease-in 0.3s";
      // remove it from the minimized app list
      minApps[id] = false;
      setState((prev) => ({ ...prev, minApps: { ...minApps } }));
    }
  };

  const renderAppWindows = () => {
    return apps.map((app) => {
      if (app.desktop && state.showApps[app.id]) {
        // 从持久化状态恢复（clamp 到当前视口）
        const saved = windowStates[app.id];
        const initialState = saved
          ? clampToViewport(saved, winWidth, winHeight, dockSize)
          : undefined;

        const props = {
          id: app.id,
          title: app.title,
          width: app.width,
          height: app.height,
          minWidth: app.minWidth,
          minHeight: app.minHeight,
          aspectRatio: app.aspectRatio,
          x: app.x,
          y: app.y,
          z: state.appsZ[app.id],
          max: state.maxApps[app.id],
          min: state.minApps[app.id],
          close: closeApp,
          setMax: setAppMax,
          setMin: minimizeApp,
          focus: openApp,
          initialState,
          onClose: (s: PersistWindowState) => handleWindowClose(app.id, s)
        };

        return (
          <AppWindow key={`desktop-app-${app.id}`} {...props}>
            {app.content}
          </AppWindow>
        );
      } else {
        return <div key={`desktop-app-${app.id}`} />;
      }
    });
  };

  // object-fit 对应 wallpaperFit：cover/contain/stretch/center
  const objectFit =
    wallpaperFit === "contain"
      ? "contain"
      : wallpaperFit === "stretch"
        ? "fill"
        : wallpaperFit === "center"
          ? "none"
          : "cover";
  const wallpaperFilter = `brightness( ${(brightness as number) * 0.7 + 50}% )`;

  return (
    <div className="size-full overflow-hidden relative bg-black">
      {/* 壁纸层：blob URL 直接显示（内存引用不走网络）；原始 URL 等 onLoad */}
      <img
        src={wallpaperSrc}
        alt=""
        aria-hidden
        decoding="sync"
        onLoad={() => setWallpaperLoaded(true)}
        className="absolute inset-0 size-full transition-opacity duration-300"
        style={{
          opacity: wallpaperLoaded ? 1 : 0,
          objectFit: objectFit as React.CSSProperties["objectFit"],
          objectPosition: "center",
          filter: wallpaperFilter
        }}
      />
      {/* Top Menu Bar */}
      <TopBar
        title={state.currentTitle}
        currentAppId={state.currentAppId}
        onQuitApp={() => state.currentAppId && closeApp(state.currentAppId)}
        openSettings={() => openApp("settings")}
        setLogin={props.setLogin}
        shutMac={props.shutMac}
        sleepMac={props.sleepMac}
        restartMac={props.restartMac}
        toggleSpotlight={toggleSpotlight}
        hide={state.hideDockAndTopbar}
        setSpotlightBtnRef={setSpotlightBtnRef}
      />

      {/* 系统通知横幅（macOS Notification Center 风格，PAT 缺失等提示） */}
      <SystemNotification onOpenApp={openApp} />

      {/* Desktop Apps */}
      <div className="window-bound z-10 absolute" style={{ top: minMarginY }}>
        {renderAppWindows()}
      </div>

      {/* Spotlight */}
      {state.spotlight && (
        <Spotlight
          openApp={openApp}
          toggleLaunchpad={toggleLaunchpad}
          toggleSpotlight={toggleSpotlight}
          btnRef={spotlightBtnRef as React.RefObject<HTMLDivElement>}
        />
      )}

      {/* Launchpad */}
      <Launchpad
        show={state.showLaunchpad}
        toggleLaunchpad={toggleLaunchpad}
        openApp={openApp}
      />

      {/* Dock */}
      <Dock
        open={openApp}
        showApps={state.showApps}
        showLaunchpad={state.showLaunchpad}
        toggleLaunchpad={toggleLaunchpad}
        hide={state.hideDockAndTopbar}
      />
    </div>
  );
}
