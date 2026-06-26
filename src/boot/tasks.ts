/**
 * boot 各阶段任务（纯函数，不耦合 React）。
 * 每个任务接收上下文 { signal }，返回 void。
 * 失败不抛——由调用方降级（database 不可用也能进桌面）。
 */
import { initDatabase } from "~/services/database";
import { loadWallpaperSettings } from "~/services/wallpaper";
import wallpapers from "~/configs/wallpapers";

interface TaskContext {
  signal: AbortSignal;
}

/**
 * 预加载图片：等图片下载 + 解码完成后再 resolve。
 * 进桌面时 backgroundImage 直接命中浏览器缓存，无闪烁。
 * 超时/失败静默忽略（不阻塞启动）。
 */
const preloadImage = (url: string, timeoutMs = 4000): Promise<void> => {
  return new Promise((resolve) => {
    const img = new Image();
    const timer = setTimeout(() => {
      resolve();
    }, timeoutMs);
    img.onload = () => {
      clearTimeout(timer);
      // decode 进一步确保解码完成（大图解码也耗时）
      if (img.decode) {
        img.decode().then(resolve, resolve);
      } else {
        resolve();
      }
    };
    img.onerror = () => {
      clearTimeout(timer);
      resolve();
    };
    img.src = url;
  });
};

interface StoreActions {
  setWallpaper: (url: string | null) => void;
  setUserWallpapers: (urls: string[]) => void;
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
    // 全部 await：进桌面时所有可能显示的壁纸都已就绪，无流式加载
    const preloadUrls = [currentUrl, wallpapers.day, wallpapers.night].filter(
      (u): u is string => Boolean(u)
    );
    console.log("[boot] Phase 2: preloading images", preloadUrls);
    await Promise.all(preloadUrls.map((u) => preloadImage(u, 8000)));
    console.log("[boot] Phase 2: preload done");
  } catch (err) {
    console.warn("[boot] Phase 2: session-restore failed (degraded)", err);
  }
}

/** Phase 3: 非阻塞检查（PAT 缺失提示）。失败只推通知。 */
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
