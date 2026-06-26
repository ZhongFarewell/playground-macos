import { useState } from "react";
import type { Bookmark } from "~/services/bookmark";

interface SafariRenameDialogProps {
  bookmark: Bookmark;
  onConfirm: (id: string, newTitle: string) => void;
  onCancel: () => void;
}

/**
 * 重命名书签对话框。
 * macOS Finder 风格的双击重命名，浏览器用 modal 替代。
 */
const SafariRenameDialog = ({
  bookmark,
  onConfirm,
  onCancel
}: SafariRenameDialogProps) => {
  const [title, setTitle] = useState(bookmark.title);

  const handleConfirm = () => {
    const t = title.trim();
    if (!t) return;
    onConfirm(bookmark.id, t);
  };

  return (
    <div className="fixed inset-0 z-50 flex-center bg-black/30" onClick={onCancel}>
      <div
        className="w-3/4 max-w-sm flex flex-col rounded-lg overflow-hidden shadow-2xl bg-c-100 border border-c-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-9 flex items-center justify-between px-3 border-b border-c-300 bg-c-200">
          <span className="text-xs font-medium text-c-700">Rename</span>
          <button
            className="h-6 w-6 hstack justify-center rounded hover:bg-c-300"
            onClick={onCancel}
          >
            <span className="i-gg:close text-xs text-c-600" />
          </button>
        </div>

        <div className="p-4">
          <input
            autoFocus
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirm();
              if (e.key === "Escape") onCancel();
            }}
            className="w-full h-7 px-2 rounded border border-c-300 bg-white text-sm no-outline focus:border-blue-400"
          />
        </div>

        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            className="px-3 py-1 rounded text-sm bg-c-200 hover:bg-c-300"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`px-3 py-1 rounded text-sm text-white ${
              title.trim()
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-blue-300 cursor-not-allowed"
            }`}
            onClick={handleConfirm}
            disabled={!title.trim()}
          >
            Rename
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafariRenameDialog;
