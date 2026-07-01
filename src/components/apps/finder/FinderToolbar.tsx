import React from "react";

interface FinderToolbarProps {
  folderName: string;
  canGoBack: boolean;
  canGoForward: boolean;
  /** Trash 视图：禁用新建文件夹，删除按钮变为 Empty Trash */
  isTrash: boolean;
  onBack: () => void;
  onForward: () => void;
  onNewFolder: () => void;
  onDelete: () => void;
  onEmptyTrash?: () => void;
}

const FinderToolbar = React.memo(function FinderToolbar({
  folderName,
  canGoBack,
  canGoForward,
  isTrash,
  onBack,
  onForward,
  onNewFolder,
  onDelete,
  onEmptyTrash
}: FinderToolbarProps) {
  return (
    <div className="h-10 px-3 flex items-center gap-2 border-b border-gray-200/60 dark:border-zinc-700/60 shrink-0">
      {/* 后退/前进 */}
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          disabled={!canGoBack}
          className="size-7 flex-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <span className="i-ri:arrow-left-s-line text-lg" />
        </button>
        <button
          type="button"
          onClick={onForward}
          disabled={!canGoForward}
          className="size-7 flex-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
        >
          <span className="i-ri:arrow-right-s-line text-lg" />
        </button>
      </div>

      {/* 当前文件夹名 */}
      <div className="flex-1 flex-center min-w-0">
        <span className="text-sm font-semibold text-gray-700 dark:text-gray-200 truncate">
          {folderName}
        </span>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-1">
        {!isTrash && (
          <button
            type="button"
            onClick={onNewFolder}
            className="size-7 flex-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 transition-colors"
            title="New Folder"
          >
            <span className="i-ri:folder-add-line text-base" />
          </button>
        )}
        {isTrash ? (
          <button
            type="button"
            onClick={() => onEmptyTrash?.()}
            className="size-7 flex-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-red-500/10 hover:text-red-500 transition-colors"
            title="Empty Trash"
          >
            <span className="i-ri:delete-bin-2-line text-base" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onDelete}
            className="size-7 flex-center rounded-md text-gray-600 dark:text-gray-300 hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 transition-colors"
            title="Delete"
          >
            <span className="i-ri:delete-bin-line text-base" />
          </button>
        )}
      </div>
    </div>
  );
});

export default FinderToolbar;
