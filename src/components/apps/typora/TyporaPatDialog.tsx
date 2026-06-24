interface TyporaPatDialogProps {
  onConfirm: (pat: string) => void;
  onCancel: () => void;
}

/**
 * GitHub PAT 输入对话框。
 * 首次保存时若 localStorage 无 PAT 则弹出。
 * PAT 原文存 localStorage，用户自行承担风险。
 */
const TyporaPatDialog = ({ onConfirm, onCancel }: TyporaPatDialogProps) => {
  const [pat, setPat] = useState("");

  const confirm = () => {
    const trimmed = pat.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex-center bg-black/30" onClick={onCancel}>
      <div
        className="w-3/4 max-w-md rounded-lg overflow-hidden shadow-2xl bg-c-100 border border-c-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-9 flex items-center px-3 border-b border-c-300 bg-c-200">
          <span className="text-xs font-medium text-c-700">GitHub Token Required</span>
        </div>
        <div className="p-4">
          <div className="text-xs text-c-600 mb-2 leading-relaxed">
            A fine-grained GitHub PAT with{" "}
            <code className="px-1 bg-c-200 rounded">contents: read &amp; write</code>{" "}
            permission for the{" "}
            <code className="px-1 bg-c-200 rounded">ZhongFarewell/macos-notes</code>{" "}
            repository is required to save notes. The token will be stored in
            localStorage.
          </div>
          <input
            autoFocus
            type="password"
            value={pat}
            onChange={(e) => setPat(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirm();
              if (e.key === "Escape") onCancel();
            }}
            placeholder="github_pat_xxx..."
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
              disabled={!pat.trim()}
            >
              Confirm
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TyporaPatDialog;
