import React from "react";
import type { BreadcrumbItem } from "./useFinderState";

interface FinderPathBarProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigate: (folderId: string, folderName?: string) => void;
}

/**
 * 底部路径栏（对齐 macOS Finder View → Show Path Bar）。
 * 显示从根到当前文件夹的完整路径，每级可点击跳转。
 * 路径过长时 truncate 截断，hover 显示完整路径 tooltip。
 */
const FinderPathBar = React.memo(function FinderPathBar({
  breadcrumbs,
  onNavigate
}: FinderPathBarProps) {
  // tooltip 完整路径文本：Home > Documents > SubFolder
  const fullPath = breadcrumbs.map((b) => b.name).join(" > ");

  return (
    <div
      className="h-6 px-3 flex items-center gap-0.5 text-xs text-gray-500 dark:text-zinc-400 border-t border-gray-200/60 dark:border-zinc-700/60 shrink-0 overflow-hidden"
      title={fullPath}
    >
      {breadcrumbs.map((item, idx) => {
        const isLast = idx === breadcrumbs.length - 1;
        return (
          <React.Fragment key={item.id}>
            {idx > 0 && (
              <span className="i-ri:arrow-right-s-line text-gray-400 text-xs shrink-0" />
            )}
            <button
              type="button"
              onClick={() => !isLast && onNavigate(item.id, item.name)}
              className={`shrink-0 px-0.5 rounded transition-colors truncate ${
                isLast
                  ? "font-semibold text-gray-700 dark:text-gray-200 cursor-default"
                  : "hover:bg-gray-200/60 dark:hover:bg-zinc-700/60"
              }`}
            >
              {item.name}
            </button>
          </React.Fragment>
        );
      })}
    </div>
  );
});

export default FinderPathBar;
