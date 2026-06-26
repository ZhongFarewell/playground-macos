import { useState } from "react";
import type { BookmarkSection } from "~/services/bookmark";

interface SafariAddDialogProps {
  /** 预填的 link（从地址栏带入） */
  defaultLink?: string;
  onConfirm: (data: { title: string; link: string; section: BookmarkSection }) => void;
  onCancel: () => void;
}

/**
 * 从 URL 中提取域名作为默认标题（跨域 iframe 无法读取页面 title，回退到域名）。
 * e.g. https://www.google.com/search?q=foo → www.google.com
 */
const extractDomain = (url: string): string => {
  try {
    const u = new URL(url);
    return u.hostname;
  } catch {
    return "";
  }
};

/**
 * 添加书签对话框。
 * macOS Safari 添加书签时弹出的简洁输入框。
 */
const SafariAddDialog = ({
  defaultLink = "",
  onConfirm,
  onCancel
}: SafariAddDialogProps) => {
  const [title, setTitle] = useState(extractDomain(defaultLink));
  const [link, setLink] = useState(defaultLink);
  const [section, setSection] = useState<BookmarkSection>("freq");

  const handleConfirm = () => {
    const t = title.trim();
    const l = link.trim();
    if (!t || !l) return;
    onConfirm({ title: t, link: l, section });
  };

  return (
    <div className="fixed inset-0 z-50 flex-center bg-black/30" onClick={onCancel}>
      <div
        className="w-3/4 max-w-md flex flex-col rounded-lg overflow-hidden shadow-2xl bg-c-100 border border-c-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="h-9 flex items-center justify-between px-3 border-b border-c-300 bg-c-200">
          <span className="text-xs font-medium text-c-700">Add Bookmark</span>
          <button
            className="h-6 w-6 hstack justify-center rounded hover:bg-c-300"
            onClick={onCancel}
          >
            <span className="i-gg:close text-xs text-c-600" />
          </button>
        </div>

        {/* 表单 */}
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs text-c-600 mb-1">Title</label>
            <input
              autoFocus
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className="w-full h-7 px-2 rounded border border-c-300 bg-white text-sm no-outline focus:border-blue-400"
              placeholder="Bookmark title"
            />
          </div>
          <div>
            <label className="block text-xs text-c-600 mb-1">URL</label>
            <input
              type="text"
              value={link}
              onChange={(e) => setLink(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleConfirm()}
              className="w-full h-7 px-2 rounded border border-c-300 bg-white text-sm no-outline focus:border-blue-400"
              placeholder="https://"
            />
          </div>
          <div>
            <label className="block text-xs text-c-600 mb-1">Section</label>
            <select
              value={section}
              onChange={(e) => setSection(e.target.value as BookmarkSection)}
              className="w-full h-7 px-2 rounded border border-c-300 bg-white text-sm no-outline focus:border-blue-400"
            >
              <option value="freq">Frequently Visited</option>
              <option value="favorites">SNS Links</option>
            </select>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex justify-end gap-2 px-4 pb-4">
          <button
            className="px-3 py-1 rounded text-sm bg-c-200 hover:bg-c-300"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            className={`px-3 py-1 rounded text-sm text-white ${
              title.trim() && link.trim()
                ? "bg-blue-500 hover:bg-blue-600"
                : "bg-blue-300 cursor-not-allowed"
            }`}
            onClick={handleConfirm}
            disabled={!title.trim() || !link.trim()}
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
};

export default SafariAddDialog;
