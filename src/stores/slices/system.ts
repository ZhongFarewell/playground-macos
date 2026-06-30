import type { StateCreator } from "zustand";
import { enterFullScreen, exitFullScreen } from "~/utils";
import wallpapers from "~/configs/wallpapers";

/** 壁纸填充方式（对应 macOS Wallpaper 的填充下拉） */
export type WallpaperFit = "cover" | "contain" | "stretch" | "center";

export interface SystemSlice {
  dark: boolean;
  volume: number;
  brightness: number;
  wifi: boolean;
  bluetooth: boolean;
  airdrop: boolean;
  fullscreen: boolean;
  /** 自定义壁纸 URL，null = 用默认 day/night 壁纸 */
  customWallpaper: string | null;
  /** 壁纸填充方式 */
  wallpaperFit: WallpaperFit;
  /** 从 Photos 设过的壁纸 URL 列表（最新在前，持久化在 system:wallpaper） */
  userWallpapers: string[];
  /** boot 预加载的壁纸：原始 URL → blob URL（内存引用，<img> 直接用不走网络） */
  preloadedWallpapers: Record<string, string>;
  toggleDark: () => void;
  toggleWIFI: () => void;
  toggleBluetooth: () => void;
  toggleAirdrop: () => void;
  toggleFullScreen: (v: boolean) => void;
  setVolume: (v: number) => void;
  setBrightness: (v: number) => void;
  setWallpaper: (url: string | null) => void;
  setWallpaperFit: (fit: WallpaperFit) => void;
  setUserWallpapers: (urls: string[]) => void;
  addPreloadedWallpaper: (originalUrl: string, blobUrl: string) => void;
}

export const createSystemSlice: StateCreator<SystemSlice> = (set) => ({
  dark: false,
  volume: 100,
  brightness: 80,
  wifi: true,
  bluetooth: true,
  airdrop: true,
  fullscreen: false,
  customWallpaper: null,
  wallpaperFit: "cover",
  userWallpapers: [],
  preloadedWallpapers: {},
  toggleDark: () =>
    set((state) => {
      if (!state.dark) document.documentElement.classList.add("dark");
      else document.documentElement.classList.remove("dark");
      return { dark: !state.dark };
    }),
  toggleWIFI: () => set((state) => ({ wifi: !state.wifi })),
  toggleBluetooth: () => set((state) => ({ bluetooth: !state.bluetooth })),
  toggleAirdrop: () => set((state) => ({ airdrop: !state.airdrop })),
  toggleFullScreen: (v) =>
    set(() => {
      v ? enterFullScreen() : exitFullScreen();
      return { fullscreen: v };
    }),
  setVolume: (v) => set(() => ({ volume: v })),
  setBrightness: (v) => set(() => ({ brightness: v })),
  setWallpaper: (url) => set(() => ({ customWallpaper: url })),
  setWallpaperFit: (fit) => set(() => ({ wallpaperFit: fit })),
  setUserWallpapers: (urls) => set(() => ({ userWallpapers: urls })),
  addPreloadedWallpaper: (originalUrl, blobUrl) =>
    set((state) => ({
      preloadedWallpapers: { ...state.preloadedWallpapers, [originalUrl]: blobUrl }
    }))
});

/** 获取当前壁纸 URL（自定义优先，否则按深色模式取默认） */
export const getWallpaper = (dark: boolean, custom: string | null): string =>
  custom ?? (dark ? wallpapers.night : wallpapers.day);
