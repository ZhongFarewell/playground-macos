/**
 * 壁纸持久化服务：基于 database 模块的 system:wallpaper 单例。
 *
 * 数据结构：
 *   { current: string | null, photos: string[] }
 *   - current: 当前壁纸 URL（null = 默认 day/night）
 *   - photos:  从 Photos 设过的壁纸 URL 列表（去重，最新在前）
 *
 * 流程：用户操作 → 立即更新 store（UI 即时响应）→ writeSingleton 推送 database（debounce 2s）。
 * 启动时 Desktop 调 loadWallpaperSettings() 恢复 store。
 */
import { getSingleton, writeSingleton } from "~/services/database";

export interface WallpaperSettings {
  /** 当前壁纸 URL，null = 用默认 day/night */
  current: string | null;
  /** 从 Photos 设过的壁纸 URL 列表（最新在前，去重） */
  photos: string[];
}

/** 读取持久化的壁纸设置（启动时调用） */
export const loadWallpaperSettings = async (): Promise<WallpaperSettings | null> => {
  const rec = await getSingleton<WallpaperSettings>("system:wallpaper");
  return rec?.data ?? null;
};

/** 写入壁纸设置（立即入队，debounce 2s 后 flush 到 GitHub） */
export const saveWallpaperSettings = (settings: WallpaperSettings): void => {
  writeSingleton("system:wallpaper", settings);
};

/**
 * 把一张 Photos 图片加入壁纸库并设为当前壁纸。
 * 返回更新后的 settings（供调用方同步到 store）。
 */
export const addPhotoWallpaper = (
  prev: WallpaperSettings,
  url: string
): WallpaperSettings => {
  const photos = [url, ...prev.photos.filter((p) => p !== url)];
  const next = { current: url, photos };
  saveWallpaperSettings(next);
  return next;
};

/**
 * 只更新当前壁纸（不改动 photos 列表）。
 * 用于 Settings → Wallpaper 面板切换内置/已有壁纸。
 */
export const setCurrentWallpaper = (
  prev: WallpaperSettings,
  url: string | null
): WallpaperSettings => {
  const next = { ...prev, current: url };
  saveWallpaperSettings(next);
  return next;
};
