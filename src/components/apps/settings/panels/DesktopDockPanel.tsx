import React from "react";
import SettingsSlider from "../SettingsSlider";

/** macOS Desktop & Dock 面板：Dock 大小 + 放大（骨架阶段仅此两项） */
const DesktopDockPanel = React.memo(function DesktopDockPanel() {
  const dockSize = useStore((s) => s.dockSize);
  const dockMag = useStore((s) => s.dockMag);
  const setDockSize = useStore((s) => s.setDockSize);
  const setDockMag = useStore((s) => s.setDockMag);

  return (
    <div className="flex-1 overflow-y-auto px-7 py-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Desktop &amp; Dock
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Adjust the Dock size and magnification.
      </p>

      {/* Dock 卡片 */}
      <div className="rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-700">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Dock
          </span>
        </div>

        {/* 大小滑块 */}
        <div className="px-4 py-3.5">
          <SettingsSlider
            value={dockSize}
            min={30}
            max={80}
            onChange={setDockSize}
            label="Size"
          />
        </div>

        {/* 放大滑块 */}
        <div className="px-4 py-3.5 border-t border-gray-100 dark:border-zinc-700">
          <SettingsSlider
            value={dockMag}
            min={1}
            max={4}
            step={0.1}
            onChange={setDockMag}
            label="Magnification"
          />
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        Desktop, Position, Minimize Effect and Auto-Hide options are not yet implemented.
      </p>
    </div>
  );
});

export default DesktopDockPanel;
