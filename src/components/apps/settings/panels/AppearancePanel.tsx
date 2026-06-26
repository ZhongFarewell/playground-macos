import React from "react";

/** macOS Appearance 面板：Light / Dark 切换 */
const AppearancePanel = React.memo(function AppearancePanel() {
  const dark = useStore((s) => s.dark);
  const toggleDark = useStore((s) => s.toggleDark);

  return (
    <div className="flex-1 overflow-y-auto px-7 py-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Appearance
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Choose light or dark mode for your interface.
      </p>

      <div className="flex items-start gap-5">
        {/* Light */}
        <AppearanceOption
          label="Light"
          active={!dark}
          preview="light"
          onClick={() => dark && toggleDark()}
        />
        {/* Dark */}
        <AppearanceOption
          label="Dark"
          active={dark}
          preview="dark"
          onClick={() => !dark && toggleDark()}
        />
      </div>
    </div>
  );
});

/** Appearance 缩略图选项 */
const AppearanceOption = React.memo(function AppearanceOption({
  label,
  active,
  preview,
  onClick
}: {
  label: string;
  active: boolean;
  preview: "light" | "dark";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`flex flex-col items-center gap-2 ${
        active ? "cursor-default" : "cursor-pointer group"
      }`}
    >
      <div
        className={`relative w-[88px] h-[60px] rounded-lg overflow-hidden border-2 transition-all ${
          active
            ? "border-blue-500 ring-2 ring-blue-500/30"
            : "border-gray-200 dark:border-zinc-600 group-hover:border-gray-300 dark:group-hover:border-zinc-500"
        }`}
      >
        {/* 模拟桌面缩略图：上菜单栏 + 下 Dock */}
        <div
          className={`size-full flex flex-col ${
            preview === "light" ? "bg-gray-100" : "bg-zinc-900"
          }`}
        >
          {/* 菜单栏 */}
          <div className={`h-3 ${preview === "light" ? "bg-white" : "bg-zinc-800"}`} />
          {/* 内容区 */}
          <div className="flex-1 flex items-center justify-center">
            <span
              className={`text-[10px] ${
                preview === "light" ? "text-gray-400" : "text-zinc-500"
              }`}
            >
              {label}
            </span>
          </div>
          {/* Dock */}
          <div
            className={`h-3 mx-auto mb-1 rounded-full w-3/4 ${
              preview === "light" ? "bg-white/80" : "bg-zinc-700/80"
            }`}
          />
        </div>
        {active && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
            <span className="i-ri:check-line text-xs" />
          </span>
        )}
      </div>
      <span className="text-xs text-gray-700 dark:text-gray-200">{label}</span>
    </button>
  );
});

export default AppearancePanel;
