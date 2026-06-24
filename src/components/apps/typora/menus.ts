import type { AppMenuDef } from "~/types";
import type { TyporaState } from "./useTyporaState";

/** 构建菜单定义（闭包捕获最新 handler） */
export const buildMenus = (s: TyporaState): AppMenuDef => [
  {
    label: "File",
    items: [
      { key: "new", label: "New", shortcut: "⌘N", onClick: s.handleNew },
      {
        key: "open",
        label: "Open…",
        shortcut: "⌘O",
        onClick: s.handleOpenLocal
      },
      {
        key: "open-github",
        label: "Open from GitHub",
        onClick: s.handleOpenClick
      },
      { separator: true },
      {
        key: "save",
        label: "Save",
        shortcut: "⌘S",
        onClick: s.handleSaveClick,
        disabled: s.saving
      },
      { separator: true },
      {
        key: "rename",
        label: "Rename…",
        onClick: s.openRenameDialog,
        disabled: !s.doc.note && !s.doc.localTitle
      },
      { key: "export", label: "Export…", onClick: s.handleDownload }
    ]
  }
];

/** useAppMenus 的 deps */
export const menuDeps = (s: TyporaState) => [
  s.handleNew,
  s.handleOpenLocal,
  s.handleOpenClick,
  s.handleSaveClick,
  s.handleDownload,
  s.saving,
  s.doc.note,
  s.doc.localTitle,
  s.openRenameDialog
];
