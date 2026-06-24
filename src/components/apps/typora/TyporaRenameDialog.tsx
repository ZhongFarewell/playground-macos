import { useState } from "react";

interface TyporaRenameDialogProps {
  defaultValue: string;
  onConfirm: (newTitle: string) => void;
  onCancel: () => void;
}

/** Rename 对话框，对齐 macOS Typora 的 File → Rename */
const TyporaRenameDialog = ({
  defaultValue,
  onConfirm,
  onCancel
}: TyporaRenameDialogProps) => {
  const [value, setValue] = useState(defaultValue);

  const confirm = () => {
    const trimmed = value.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex-center bg-black/30" onClick={onCancel}>
      <div
        className="w-3/4 max-w-sm rounded-lg overflow-hidden shadow-2xl bg-c-100 border border-c-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-9 flex items-center px-3 border-b border-c-300 bg-c-200">
          <span className="text-xs font-medium text-c-700">Rename</span>
        </div>
        <div className="p-4">
          <div className="text-xs text-c-600 mb-2">Enter new title:</div>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
              if (e.key === "Escape") onCancel();
            }}
            className="w-full h-8 px-2 text-sm bg-c-100 border border-c-300 rounded focus:outline-none focus:border-blue-500"
          />
          <div className="flex justify-end gap-2 mt-4">
            <button
              className="h-7 px-3 text-xs rounded hover:bg-c-200"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="h-7 px-3 text-xs rounded bg-blue-500 text-white hover:bg-blue-600 disabled:opacity-50"
              onClick={confirm}
              disabled={!value.trim()}
            >
              Rename
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TyporaRenameDialog;
