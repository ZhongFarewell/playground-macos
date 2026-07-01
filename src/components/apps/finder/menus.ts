import type { AppMenuDef } from "~/types";
import type { FinderState } from "./useFinderState";

export const buildMenus = (s: FinderState): AppMenuDef => [
  {
    label: "File",
    items: [
      {
        key: "new-folder",
        label: "New Folder",
        shortcut: "⇧⌘N",
        onClick: () => s.createFolder()
      },
      {
        key: "open",
        label: "Open",
        shortcut: "⌘O",
        onClick: () => {
          const id = Array.from(s.selectedIds)[0];
          if (id) {
            const entry = s.entries.find((e) => e.id === id);
            if (entry) s.navigateInto(entry);
          }
        },
        disabled: s.selectedIds.size !== 1
      }
    ]
  },
  {
    label: "Edit",
    items: [
      {
        key: "cut",
        label: "Cut",
        shortcut: "⌘X",
        onClick: () => {
          const id = Array.from(s.selectedIds)[0];
          if (id) {
            const entry = s.entries.find((e) => e.id === id);
            if (entry) s.cutEntry(entry);
          }
        },
        disabled: s.selectedIds.size !== 1 || s.showTrash
      },
      {
        key: "copy",
        label: "Copy",
        shortcut: "⌘C",
        onClick: () => {
          const id = Array.from(s.selectedIds)[0];
          if (id) {
            const entry = s.entries.find((e) => e.id === id);
            if (entry) s.copyEntryToClipboard(entry);
          }
        },
        disabled: s.selectedIds.size !== 1 || s.showTrash
      },
      {
        key: "paste",
        label: "Paste",
        shortcut: "⌘V",
        onClick: () => s.pasteEntry(s.currentFolderId),
        disabled: !s.clipboard || s.showTrash
      },
      {
        key: "select-all",
        label: "Select All",
        shortcut: "⌘A",
        onClick: () => {
          s.entries.forEach((e) => s.selectItem(e.id, true));
        }
      }
    ]
  },
  {
    label: "View",
    items: [
      {
        key: "sort-name",
        label: "Sort by Name",
        checked: s.sortBy === "name",
        onClick: () => s.setSortBy("name")
      },
      {
        key: "sort-date",
        label: "Sort by Date",
        checked: s.sortBy === "date",
        onClick: () => s.setSortBy("date")
      }
    ]
  }
];

export const menuDeps = (s: FinderState) => [
  s.createFolder,
  s.navigateInto,
  s.selectedIds,
  s.entries,
  s.sortBy,
  s.setSortBy,
  s.selectItem,
  s.cutEntry,
  s.copyEntryToClipboard,
  s.pasteEntry,
  s.clipboard,
  s.currentFolderId,
  s.showTrash
];
