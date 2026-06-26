import React from "react";
import { getPat, setPat, clearPat, hasPat, flushAll } from "~/services/database";

/** Privacy & Security 面板：GitHub PAT 配置 */
const PrivacyPanel = React.memo(function PrivacyPanel() {
  const [pat, setPatState] = useState(() => getPat());
  const [hasPatNow, setHasPatNow] = useState(() => hasPat());
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    const trimmed = pat.trim();
    setPat(trimmed);
    setHasPatNow(Boolean(trimmed));
    setSaved(true);
    // 立即触发队列重试（之前因 PAT 缺失失败的写入）
    flushAll();
    setTimeout(() => setSaved(false), 1500);
  };

  const handleClear = () => {
    clearPat();
    setPatState("");
    setHasPatNow(false);
  };

  return (
    <div className="flex-1 overflow-y-auto px-7 py-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Privacy &amp; Security
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Manage GitHub access token for data persistence.
      </p>

      {/* GitHub Access Token 卡片 */}
      <div className="rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-700 flex items-center justify-between">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            GitHub Access Token
          </span>
          {/* 状态指示 */}
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full ${
              hasPatNow
                ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
            }`}
          >
            {hasPatNow ? "Configured" : "Not Configured"}
          </span>
        </div>

        <div className="px-4 py-3.5">
          <input
            type="password"
            value={pat}
            onChange={(e) => setPatState(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className="w-full text-sm font-mono text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-zinc-700/50 rounded-md px-3 py-2 outline-none border border-gray-200 dark:border-zinc-600 focus:border-blue-400 dark:focus:border-blue-500 transition-colors"
          />
          <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-2 leading-relaxed">
            PAT is used to persist settings to the GitHub repository{" "}
            <code className="text-gray-500 dark:text-gray-400">
              ZhongFarewell/macos-database
            </code>
            . Requires repo contents permission (read &amp; write).
          </p>

          <div className="flex items-center gap-2 mt-3">
            <button
              type="button"
              onClick={handleSave}
              disabled={!pat.trim() || pat.trim() === getPat()}
              className="px-3 py-1.5 text-xs rounded-md text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleClear}
              disabled={!hasPatNow}
              className="px-3 py-1.5 text-xs rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Clear
            </button>
            {saved && (
              <span className="text-xs text-green-600 dark:text-green-400 ml-1">
                Saved
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

export default PrivacyPanel;
