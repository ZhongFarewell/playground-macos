import React from "react";
import type { FinderEntry } from "~/types";
import { getFileIcon, FOLDER_ICON } from "./types";
import type { FinderClipboard } from "./useFinderState";

interface FinderFileRowProps {
  entry: FinderEntry;
  selected: boolean;
  showTrash: boolean;
  renaming: boolean;
  clipboard: FinderClipboard | null;
  /** 拖拽悬停高亮 */
  dragOver: boolean;
  onSelect: (id: string, multi: boolean) => void;
  onOpen: (entry: FinderEntry) => void;
  onRename: (entry: FinderEntry) => void;
  onCommitRename: (entry: FinderEntry, newName: string) => void;
  onCancelRename: () => void;
  onTrash: (entry: FinderEntry) => void;
  onPutBack: (entry: FinderEntry) => void;
  onDeleteImmediately: (entry: FinderEntry) => void;
  onCut: (entry: FinderEntry) => void;
  onCopy: (entry: FinderEntry) => void;
  onPaste: (targetFolderId: string) => void;
  onDragStart: (entry: FinderEntry) => void;
  onDropOnFolder: (targetFolderId: string, draggedEntryId: string) => void;
  onDragOverChange: (id: string | null) => void;
  /** 上传本地文件到此文件夹（拖入浏览器） */
  onUploadFiles: (files: File[], targetFolderId: string) => Promise<void>;
}

const formatSize = (bytes?: number): string => {
  if (!bytes) return "--";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

const formatDate = (iso?: string): string => {
  if (!iso) return "--";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
};

const FinderFileRow = React.memo(function FinderFileRow({
  entry,
  selected,
  showTrash,
  renaming,
  clipboard,
  dragOver,
  onSelect,
  onOpen,
  onRename,
  onCommitRename,
  onCancelRename,
  onTrash,
  onPutBack,
  onDeleteImmediately,
  onCut,
  onCopy,
  onPaste,
  onDragStart,
  onDropOnFolder,
  onDragOverChange,
  onUploadFiles
}: FinderFileRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  console.log("FinderFileRow", entry);
  const [draftName, setDraftName] = useState(entry.name);

  useEffect(() => {
    if (renaming) {
      setDraftName(entry.name);
      const input = inputRef.current;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [renaming, entry.name]);

  const ref = useContextMenu(
    renaming
      ? () => {}
      : (ctx, collector) => {
          if (!showTrash) {
            collector.add({
              label: "Open",
              onClick: () => onOpen(entry)
            });
            collector.add({ separator: true });
            collector.add({
              label: "Cut",
              shortcut: "⌘X",
              onClick: () => onCut(entry)
            });
            collector.add({
              label: "Copy",
              shortcut: "⌘C",
              onClick: () => onCopy(entry)
            });
            collector.add({
              label: "Paste",
              shortcut: "⌘V",
              onClick: () => onPaste(entry.kind === "folder" ? entry.id : entry.parentId),
              disabled: !clipboard
            });
            collector.add({ separator: true });
            collector.add({
              label: "Rename",
              onClick: () => onRename(entry)
            });
            collector.add({
              label: "Move to Trash",
              onClick: () => onTrash(entry)
            });
          } else {
            collector.add({
              label: "Put Back",
              onClick: () => onPutBack(entry)
            });
            collector.add({ separator: true });
            collector.add({
              label: "Delete Immediately...",
              onClick: () => onDeleteImmediately(entry)
            });
          }
        }
  );

  // 上传中：显示旋转图标；否则按类型显示文件/文件夹图标
  const icon = entry.uploading
    ? "i-ri:loader-4-line animate-spin"
    : entry.kind === "folder"
      ? FOLDER_ICON
      : getFileIcon(entry.ext);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onCommitRename(entry, draftName);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancelRename();
    }
  };

  // 拖拽：只有文件夹和非重命名模式可拖拽/接收
  const draggable = !renaming && !showTrash;
  const isFolder = entry.kind === "folder";

  return (
    <div
      ref={ref as any}
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.setData("text/finder-entry-id", entry.id);
        e.dataTransfer.effectAllowed = "move";
        onDragStart(entry);
      }}
      onDragOver={
        isFolder && draggable
          ? (e) => {
              // 接收 Finder 内部拖拽和本地文件拖拽
              if (
                e.dataTransfer.types.includes("text/finder-entry-id") ||
                e.dataTransfer.types.includes("files")
              ) {
                e.preventDefault();
                e.dataTransfer.dropEffect = "copy";
              }
            }
          : undefined
      }
      onDragEnter={isFolder && draggable ? () => onDragOverChange(entry.id) : undefined}
      onDragLeave={isFolder && draggable ? () => onDragOverChange(null) : undefined}
      onDrop={
        isFolder && draggable
          ? (e) => {
              e.preventDefault();
              onDragOverChange(null);
              // 优先处理本地文件上传
              if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                onUploadFiles(Array.from(e.dataTransfer.files), entry.id);
                return;
              }
              // Finder 内部拖拽 = 移动
              const draggedId = e.dataTransfer.getData("text/finder-entry-id");
              if (draggedId) onDropOnFolder(entry.id, draggedId);
            }
          : undefined
      }
      onClick={(e) => !renaming && onSelect(entry.id, e.metaKey || e.ctrlKey)}
      onDoubleClick={() => !renaming && !showTrash && onOpen(entry)}
      className={`flex items-center gap-3 px-3 h-8 cursor-default text-sm transition-all ${
        dragOver && isFolder
          ? "bg-blue-500/25 ring-2 ring-blue-500 ring-inset rounded-md scale-[1.02]"
          : selected
            ? "bg-blue-500/15 text-blue-700 dark:text-blue-200"
            : "hover:bg-gray-100 dark:hover:bg-zinc-800 text-gray-700 dark:text-gray-200"
      }`}
    >
      <span className={`text-base ${icon} shrink-0`} />
      {renaming ? (
        <input
          ref={inputRef}
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => onCommitRename(entry, draftName)}
          onClick={(e) => e.stopPropagation()}
          onDoubleClick={(e) => e.stopPropagation()}
          className="flex-1 h-5 px-1 text-sm rounded border border-blue-500 bg-white dark:bg-zinc-900 text-gray-800 dark:text-gray-100 outline-none"
        />
      ) : (
        <span className="flex-1 truncate">{entry.name}</span>
      )}
      <span className="w-20 text-right text-xs text-gray-400 dark:text-zinc-500">
        {entry.kind === "folder" ? "--" : formatSize(entry.size)}
      </span>
      <span className="w-28 text-right text-xs text-gray-400 dark:text-zinc-500">
        {formatDate(entry.updatedAt)}
      </span>
    </div>
  );
});

export default FinderFileRow;
