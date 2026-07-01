/** Finder app 内部类型 */

/** 视图模式 */
export type ViewMode = "list" | "icon";

/** 侧边栏项 */
export interface SidebarItem {
  id: string;
  label: string;
  icon: string;
  /** 指向的文件夹 id；Trash 项为 "trash" 触发 Trash 视图 */
  targetId: string;
}

/** 侧边栏分组 */
export interface SidebarGroup {
  items: SidebarItem[];
}

/** 排序方式 */
export type SortBy = "name" | "date";

/** 文件扩展名 → 图标映射（UnoCSS i-ri:* class） */
export const FILE_ICON_MAP: Record<string, string> = {
  // 文本
  md: "i-ri:markdown-line",
  txt: "i-ri:file-text-line",
  json: "i-ri:braces-line",
  csv: "i-ri:file-paper-line",
  // 图片
  png: "i-ri:image-line",
  jpg: "i-ri:image-line",
  jpeg: "i-ri:image-line",
  gif: "i-ri:image-line",
  webp: "i-ri:image-line",
  bmp: "i-ri:image-line",
  svg: "i-ri:image-line",
  // 音频
  mp3: "i-ri:music-line",
  wav: "i-ri:music-line",
  ogg: "i-ri:music-line",
  flac: "i-ri:music-line",
  aac: "i-ri:music-line",
  m4a: "i-ri:music-line",
  // 视频
  mp4: "i-ri:film-line",
  mov: "i-ri:film-line",
  avi: "i-ri:film-line",
  mkv: "i-ri:film-line",
  webm: "i-ri:film-line",
  // 文档
  pdf: "i-ri:file-pdf-line",
  doc: "i-ri:file-word-line",
  docx: "i-ri:file-word-line",
  xls: "i-ri:file-excel-line",
  xlsx: "i-ri:file-excel-line",
  ppt: "i-ri:file-ppt-line",
  pptx: "i-ri:file-ppt-line",
  // 代码
  js: "i-ri:javascript-line",
  ts: "i-ri:file-code-line",
  tsx: "i-ri:file-code-line",
  html: "i-ri:html5-line",
  css: "i-ri:css3-line",
  // 压缩包
  zip: "i-ri:file-zip-line",
  rar: "i-ri:file-zip-line",
  "7z": "i-ri:file-zip-line",
  tar: "i-ri:file-zip-line",
  gz: "i-ri:file-zip-line"
};

/** 默认文件图标 */
export const DEFAULT_FILE_ICON = "i-ri:file-line";

/** 文件夹图标 */
export const FOLDER_ICON = "i-ri:folder-fill";

/** 获取文件图标 */
export const getFileIcon = (ext?: string): string =>
  (ext && FILE_ICON_MAP[ext]) || DEFAULT_FILE_ICON;
