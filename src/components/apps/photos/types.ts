export interface PhotoItem {
  value: string; // 文件名
  memory?: { title?: string; [k: string]: any };
}

/** 格式化文件大小，与 macOS Finder 一致：KB / MB */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
