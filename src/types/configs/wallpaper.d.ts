export interface BuiltInWallpaper {
  id: string;
  name: string;
  /** 图片路径或 data URI（CSS 渐变 SVG） */
  url: string;
}

export interface WallpaperData {
  day: string;
  night: string;
  /** 内置静态壁纸（除 day/night 之外） */
  builtins: BuiltInWallpaper[];
}
