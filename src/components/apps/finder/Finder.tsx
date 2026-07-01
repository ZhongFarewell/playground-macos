import React from "react";
import { useAppMenus } from "~/hooks/useAppMenus";
import { useFinderState } from "./useFinderState";
import { buildMenus, menuDeps } from "./menus";
import FinderSidebar from "./FinderSidebar";
import FinderToolbar from "./FinderToolbar";
import FinderFileList from "./FinderFileList";
import FinderPathBar from "./FinderPathBar";
import EmptyTrashDialog from "./EmptyTrashDialog";
import { getEntry, trashEntry } from "~/services/finder";
import type { FinderEntry } from "~/types";

interface FinderProps {
  initialTrash?: boolean;
}

const Finder = React.memo(function Finder({ initialTrash = false }: FinderProps) {
  const s = useFinderState(initialTrash);
  const [showEmptyDialog, setShowEmptyDialog] = useState(false);

  useAppMenus("finder", () => buildMenus(s), menuDeps(s));

  const handleDelete = () => {
    s.selectedIds.forEach((id) => {
      const entry = s.entries.find((e) => e.id === id);
      if (entry) s.trashItem(entry);
    });
  };

  const handleOpen = (entry: FinderEntry) => {
    if (entry.kind === "folder") s.navigateInto(entry);
    else s.openFile(entry);
  };

  const handleRename = (entry: FinderEntry) => {
    s.startRename(entry.id);
  };

  const handleEmptyTrash = () => setShowEmptyDialog(true);
  const confirmEmptyTrash = () => {
    setShowEmptyDialog(false);
    s.emptyTrash();
  };

  // 拖到 Trash（侧边栏）：查 entry 后 trashEntry
  const handleDropToTrash = async (draggedEntryId: string) => {
    const entry = await getEntry(draggedEntryId);
    if (entry && !entry.trashed) {
      await trashEntry(entry);
      s.refresh();
    }
  };

  return (
    <div
      className="size-full flex overflow-hidden bg-white dark:bg-zinc-900"
      onDragOver={(e) => {
        // 阻止浏览器默认行为（拖文件到页面会在新标签页打开）
        // 不检查类型：dragover 时 dataTransfer.types 可能不完整，直接 preventDefault 最稳妥
        e.preventDefault();
      }}
      onDragEnter={(e) => {
        e.preventDefault();
      }}
      onDrop={(e) => {
        // 全局兜底：阻止默认 drop（子组件已处理的会自行 stopPropagation）
        e.preventDefault();
      }}
    >
      <FinderSidebar
        currentFolderId={s.currentFolderId}
        showTrash={s.showTrash}
        rootFolders={s.rootFolders}
        onNavigate={s.navigateTo}
        onShowTrash={s.showTrashView}
        onDropOnFolder={s.handleDropOnFolder}
        onDropToTrash={handleDropToTrash}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <FinderToolbar
          folderName={s.currentFolderName}
          canGoBack={s.canGoBack()}
          canGoForward={s.canGoForward()}
          isTrash={s.showTrash}
          onBack={s.goBack}
          onForward={s.goForward}
          onNewFolder={s.createFolder}
          onDelete={handleDelete}
          onEmptyTrash={handleEmptyTrash}
        />
        <FinderFileList
          entries={s.entries}
          loading={s.loading}
          showTrash={s.showTrash}
          selectedIds={s.selectedIds}
          renamingId={s.renamingId}
          clipboard={s.clipboard}
          onSelect={s.selectItem}
          onOpen={handleOpen}
          onRename={handleRename}
          onCommitRename={s.renameItem}
          onCancelRename={s.cancelRename}
          onTrash={s.trashItem}
          onPutBack={s.putBack}
          onDeleteImmediately={s.deleteImmediately}
          onCut={s.cutEntry}
          onCopy={s.copyEntryToClipboard}
          onPaste={s.pasteEntry}
          onDragStart={() => {}}
          onDropOnFolder={s.handleDropOnFolder}
          onUploadFiles={s.uploadFiles}
          currentFolderId={s.currentFolderId}
        />
        <FinderPathBar breadcrumbs={s.breadcrumbs} onNavigate={s.navigateTo} />
        <div className="h-6 px-3 flex items-center justify-between text-xs text-gray-400 dark:text-zinc-500 border-t border-gray-200/60 dark:border-zinc-700/60 shrink-0">
          <span>{s.entries.length} items</span>
          <span>{s.selectedIds.size} selected</span>
        </div>
      </div>
      {showEmptyDialog && (
        <EmptyTrashDialog
          itemCount={s.entries.length}
          onConfirm={confirmEmptyTrash}
          onCancel={() => setShowEmptyDialog(false)}
        />
      )}
    </div>
  );
});

export default Finder;
