import React from "react";
import { ROOT_PARENT_ID } from "~/services/finder";
import type { FinderEntry } from "~/types";
import type { SidebarGroup } from "./types";

const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    items: [
      { id: "home", label: "Home", icon: "i-ri:home-5-fill", targetId: ROOT_PARENT_ID },
      { id: "desktop", label: "Desktop", icon: "i-ri:desktop-line", targetId: "Desktop" },
      {
        id: "documents",
        label: "Documents",
        icon: "i-ri:file-text-fill",
        targetId: "Documents"
      },
      {
        id: "downloads",
        label: "Downloads",
        icon: "i-ri:download-2-fill",
        targetId: "Downloads"
      },
      {
        id: "applications",
        label: "Applications",
        icon: "i-ri:apps-2-fill",
        targetId: "Applications"
      }
    ]
  },
  {
    items: [
      { id: "trash", label: "Trash", icon: "i-ri:delete-bin-7-fill", targetId: "trash" }
    ]
  }
];

interface FinderSidebarProps {
  currentFolderId: string;
  showTrash: boolean;
  rootFolders: FinderEntry[];
  onNavigate: (folderId: string, folderName?: string) => void;
  onShowTrash: () => void;
  onDropOnFolder: (targetFolderId: string, draggedEntryId: string) => Promise<void>;
  onDropToTrash: (draggedEntryId: string) => Promise<void>;
}

const FinderSidebar = React.memo(function FinderSidebar({
  currentFolderId,
  showTrash,
  rootFolders,
  onNavigate,
  onShowTrash,
  onDropOnFolder,
  onDropToTrash
}: FinderSidebarProps) {
  const [dragOverItem, setDragOverItem] = useState<string | null>(null);

  const handleClick = (item: { id: string; targetId: string; label: string }) => {
    if (item.id === "trash") {
      onShowTrash();
      return;
    }
    if (item.id === "home") {
      onNavigate(ROOT_PARENT_ID, "Home");
      return;
    }
    const folder = rootFolders.find((f) => f.name === item.targetId);
    if (folder) {
      onNavigate(folder.id, folder.name);
    } else {
      onNavigate(ROOT_PARENT_ID, "Home");
    }
  };

  const isItemActive = (item: { id: string; targetId: string }) => {
    if (item.id === "trash") return showTrash;
    if (item.id === "home") return !showTrash && currentFolderId === ROOT_PARENT_ID;
    if (showTrash) return false;
    const folder = rootFolders.find((f) => f.name === item.targetId);
    return folder ? currentFolderId === folder.id : false;
  };

  // 解析侧边栏项对应的目标 folderId
  const resolveTargetFolderId = (item: {
    id: string;
    targetId: string;
  }): string | null => {
    if (item.id === "home") return ROOT_PARENT_ID;
    if (item.id === "trash") return null;
    const folder = rootFolders.find((f) => f.name === item.targetId);
    return folder ? folder.id : null;
  };

  const handleDrop = (item: { id: string; targetId: string }, e: React.DragEvent) => {
    e.preventDefault();
    setDragOverItem(null);
    const draggedId = e.dataTransfer.getData("text/finder-entry-id");
    if (!draggedId) return;
    if (item.id === "trash") {
      onDropToTrash(draggedId);
    } else {
      const folderId = resolveTargetFolderId(item);
      if (folderId) onDropOnFolder(folderId, draggedId);
    }
  };

  return (
    <div className="w-[180px] shrink-0 h-full flex flex-col bg-gray-100/80 dark:bg-zinc-800/80 backdrop-blur-xl border-r border-gray-200/60 dark:border-zinc-700/60">
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {SIDEBAR_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : ""}>
            {group.items.map((item) => {
              const active = isItemActive(item);
              const isDragOver = dragOverItem === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleClick(item)}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = "move";
                  }}
                  onDragEnter={() => setDragOverItem(item.id)}
                  onDragLeave={() =>
                    setDragOverItem((prev) => (prev === item.id ? null : prev))
                  }
                  onDrop={(e) => handleDrop(item, e)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-all mb-0.5 ${
                    isDragOver
                      ? "bg-blue-500/25 ring-2 ring-blue-500 ring-inset scale-[1.02]"
                      : active
                        ? "bg-blue-500/15 text-blue-600 dark:text-blue-300"
                        : "hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <span className={`text-[15px] leading-none ${item.icon}`} />
                  <span className="text-[13px] truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

export default FinderSidebar;
