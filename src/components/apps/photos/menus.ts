import type { AppMenuDef } from "~/types";
import type { PhotosState } from "./usePhotosState";

/** 构建菜单定义（闭包捕获最新 handler） */
export const buildMenus = (s: PhotosState): AppMenuDef => [
  {
    label: "File",
    items: [
      {
        key: "export",
        label: "Export…",
        onClick: () => {
          if (s.activeIdx !== null && s.sortedPhotos[s.activeIdx]) {
            s.handleExport(s.sortedPhotos[s.activeIdx].value);
          }
        },
        disabled: s.activeIdx === null
      }
    ]
  },
  {
    label: "Image",
    items: [
      {
        key: "wallpaper",
        label: "Set as Desktop Picture",
        onClick: () => {
          if (s.activeIdx !== null && s.sortedPhotos[s.activeIdx]) {
            s.handleSetWallpaper(s.sortedPhotos[s.activeIdx].value);
          }
        },
        disabled: s.activeIdx === null
      }
    ]
  },
  {
    label: "View",
    items: [
      {
        key: "sort-desc",
        label: "Sort by Newest First",
        checked: s.sortOrder === "desc",
        onClick: () => s.setSortOrder("desc")
      },
      {
        key: "sort-asc",
        label: "Sort by Oldest First",
        checked: s.sortOrder === "asc",
        onClick: () => s.setSortOrder("asc")
      }
    ]
  }
];

/** useAppMenus 的 deps */
export const menuDeps = (s: PhotosState) => [
  s.activeIdx,
  s.sortedPhotos,
  s.sortOrder,
  s.handleExport,
  s.handleSetWallpaper
];
