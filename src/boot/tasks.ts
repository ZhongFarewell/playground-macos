/**
 * boot 各阶段任务（纯函数，不耦合 React）。
 * 每个任务接收上下文 { signal }，返回 void。
 * 失败不抛——由调用方降级（database 不可用也能进桌面）。
 */
import { initDatabase } from "~/services/database";
import { loadWallpaperSettings } from "~/services/wallpaper";
import { authAlign } from "~/services";
import wallpapers from "~/configs/wallpapers";

interface TaskContext {
  signal: AbortSignal;
}

/**
 * 预加载图片：fetch 为 blob → createObjectURL，返回 blob URL。
 * blob URL 是内存引用，<img> 直接用不走网络，绝不流式加载。
 * 失败返回 null（调用方 fallback 到原始 URL）。
 */
const preloadImage = async (url: string, timeoutMs = 8000): Promise<string | null> => {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
};

interface StoreActions {
  setWallpaper: (url: string | null) => void;
  setUserWallpapers: (urls: string[]) => void;
  setUserInfo: (v: { username: string; [k: string]: unknown } | null) => void;
  addPreloadedWallpaper: (originalUrl: string, blobUrl: string) => void;
  pushNotification: (n: {
    title: string;
    body: string;
    appId?: string;
    sidebarItemId?: string;
  }) => void;
}

/** Phase 1: 初始化 database（拉 manifest + 合并缓存）。失败降级。 */
export async function runDatabasePhase(_ctx: TaskContext): Promise<void> {
  try {
    console.log("[boot] Phase 1: initDatabase start");
    await initDatabase();
    console.log("[boot] Phase 1: initDatabase done");
  } catch (err) {
    console.warn("[boot] Phase 1: initDatabase failed (degraded)", err);
  }
}

/** Phase 2: 恢复用户会话数据（壁纸）+ 预加载图片避免闪烁。失败静默用默认值。 */
export async function runSessionRestorePhase(
  _ctx: TaskContext,
  actions: StoreActions
): Promise<void> {
  try {
    console.log("[boot] Phase 2: session-restore start");
    const settings = await loadWallpaperSettings();
    console.log("[boot] Phase 2: wallpaper settings", settings);
    let currentUrl: string | null = null;
    if (settings) {
      if (settings.current !== null) {
        actions.setWallpaper(settings.current);
        currentUrl = settings.current;
      }
      if (settings.photos?.length) actions.setUserWallpapers(settings.photos);
    }

    // 预加载当前生效的壁纸（含自定义）+ 默认 day/night（dark 切换 fallback）
    // fetch 为 blob → createObjectURL，<img> 用 blob URL 不走网络，绝不流式
    const preloadUrls = [currentUrl, wallpapers.day, wallpapers.night].filter(
      (u): u is string => Boolean(u)
    );
    console.log("[boot] Phase 2: preloading images", preloadUrls);
    await Promise.all(
      preloadUrls.map(async (u) => {
        const blobUrl = await preloadImage(u, 8000);
        if (blobUrl) actions.addPreloadedWallpaper(u, blobUrl);
      })
    );
    console.log("[boot] Phase 2: preload done");
  } catch (err) {
    console.warn("[boot] Phase 2: session-restore failed (degraded)", err);
  }
}

/** Phase 3: 免登校验（authAlign）。成功返回 true，失败/无 session 返回 false。 */
export async function runAuthPhase(
  _ctx: TaskContext,
  actions: StoreActions
): Promise<boolean> {
  try {
    console.log("[boot] Phase 3: auth check start");
    const res = await authAlign();
    if (res?.data && typeof res.data === "object") {
      actions.setUserInfo(res.data as { username: string; [k: string]: unknown });
      console.log("[boot] Phase 3: auth succeeded, user logged in");
      return true;
    }
    console.log("[boot] Phase 3: no valid session, need login");
    return false;
  } catch (err) {
    console.warn("[boot] Phase 3: auth check failed (need login)", err);
    return false;
  }
}

/** Phase 4: 非阻塞检查（PAT 缺失提示）。失败只推通知。 */
export async function runPostChecksPhase(
  _ctx: TaskContext,
  actions: StoreActions
): Promise<void> {
  try {
    if (!localStorage.getItem("database_github_pat")) {
      actions.pushNotification({
        title: "GitHub PAT Required",
        body: "Configure your GitHub token in Privacy & Security to persist settings.",
        appId: "settings",
        sidebarItemId: "privacy"
      });
    }
  } catch {
    // localStorage 不可用，忽略
  }
}
