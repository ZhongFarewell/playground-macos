import type { TyporaNote } from "~/types";

interface TyporaOpenPanelProps {
  notes: TyporaNote[];
  loading: boolean;
  onPick: (note: TyporaNote) => void;
  onClose: () => void;
}

/**
 * 打开文件面板。macOS Typora 用系统文件选择器，
 * 浏览器无此能力，用自定义 modal 替代。
 */
const TyporaOpenPanel = ({ notes, loading, onPick, onClose }: TyporaOpenPanelProps) => {
  return (
    <div className="fixed inset-0 z-50 flex-center bg-black/30" onClick={onClose}>
      <div
        className="w-3/4 max-w-md max-h-3/4 flex flex-col rounded-lg overflow-hidden shadow-2xl bg-c-100 border border-c-300"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 标题栏 */}
        <div className="h-9 flex items-center justify-between px-3 border-b border-c-300 bg-c-200">
          <span className="text-xs font-medium text-c-700">Open</span>
          <button
            className="h-6 w-6 hstack justify-center rounded hover:bg-c-300"
            onClick={onClose}
          >
            <span className="i-gg:close text-xs text-c-600" />
          </button>
        </div>

        {/* 列表 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-c-500">Loading...</div>
          ) : notes.length === 0 ? (
            <div className="p-4 text-center text-xs text-c-500">No notes</div>
          ) : (
            <ul className="py-1">
              {notes.map((note) => (
                <li
                  key={note.id}
                  className="px-3 py-2 cursor-default hover:bg-blue-500 hover:text-white"
                  onClick={() => onPick(note)}
                >
                  <div className="text-sm font-medium truncate">{note.title}</div>
                  {note.excerpt && (
                    <div className="text-xs opacity-70 truncate mt-0.5">
                      {note.excerpt}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default TyporaOpenPanel;
