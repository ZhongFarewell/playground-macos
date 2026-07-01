import React from "react";
import type { FinderEntry } from "~/types";
import FinderFileRow from "./FinderFileRow";
import type { FinderClipboard } from "./useFinderState";

interface FinderFileListProps {
  entries: FinderEntry[];
  loading: boolean;
  showTrash: boolean;
  selectedIds: Set<string>;
  renamingId: string | null;
  clipboard: FinderClipboard | null;
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
  onDropOnFolder: (targetFolderId: string, draggedEntryId: string) => Promise<void>;
  /** 上传本地文件到目标文件夹 */
  onUploadFiles: (files: File[], targetFolderId: string) => Promise<void>;
  /** 当前文件夹 id（用于空白区上传） */
  currentFolderId: string;
}

const FinderFileList = React.memo(function FinderFileList({
  entries,
  loading,
  showTrash,
  selectedIds,
  renamingId,
  clipboard,
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
  onUploadFiles,
  currentFolderId
}: FinderFileListProps) {
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [dragOverEmpty, setDragOverEmpty] = useState(false);

  // 判断是否是本地文件拖拽（files.length > 0）
  const hasLocalFiles = (e: React.DragEvent) => e.dataTransfer.types.includes("files");

  // 空白区 drop：上传到当前文件夹
  const handleEmptyDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOverEmpty(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUploadFiles(Array.from(e.dataTransfer.files), currentFolderId);
    }
  };

  return (
    <div
      className={`flex-1 overflow-y-auto transition-colors ${
        dragOverEmpty
          ? "bg-blue-500/10 border-2 border-dashed border-blue-500/60"
          : "border-2 border-transparent"
      }`}
      onDragOver={(e) => {
        // 阻止默认行为（不在子组件检查类型，dragover 时 types 可能不完整）
        e.preventDefault();
        if (hasLocalFiles(e)) {
          setDragOverEmpty(true);
        }
      }}
      onDragLeave={() => setDragOverEmpty(false)}
      onDrop={handleEmptyDrop}
    >
      {/* 表头 */}
      <div className="flex items-center gap-3 px-3 h-7 text-xs font-semibold text-gray-500 dark:text-zinc-400 border-b border-gray-200/60 dark:border-zinc-700/60 sticky top-0 bg-gray-50/80 dark:bg-zinc-800/80 backdrop-blur-sm">
        <span className="w-4 shrink-0" />
        <span className="flex-1">Name</span>
        <span className="w-20 text-right">Size</span>
        <span className="w-28 text-right">Date Modified</span>
      </div>

      {loading ? (
        <div className="size-full flex-center">
          <span className="i-bi:arrow-repeat animate-spin text-2xl text-gray-400" />
        </div>
      ) : entries.length === 0 ? (
        <div className="size-full flex-center flex-col text-gray-400 dark:text-zinc-500">
          <span className="i-ri:folder-open-line text-5xl mb-3 opacity-50" />
          <span className="text-sm">{showTrash ? "Trash is Empty" : "No items"}</span>
        </div>
      ) : (
        <div>
          {entries.map((entry) => (
            <FinderFileRow
              key={entry.id}
              entry={entry}
              selected={selectedIds.has(entry.id)}
              showTrash={showTrash}
              renaming={renamingId === entry.id}
              clipboard={clipboard}
              dragOver={dragOverId === entry.id}
              onSelect={onSelect}
              onOpen={onOpen}
              onRename={onRename}
              onCommitRename={onCommitRename}
              onCancelRename={onCancelRename}
              onTrash={onTrash}
              onPutBack={onPutBack}
              onDeleteImmediately={onDeleteImmediately}
              onCut={onCut}
              onCopy={onCopy}
              onPaste={onPaste}
              onDragStart={onDragStart}
              onDropOnFolder={onDropOnFolder}
              onDragOverChange={setDragOverId}
              onUploadFiles={onUploadFiles}
            />
          ))}
        </div>
      )}
    </div>
  );
});

export default FinderFileList;
