import React from "react";
import SettingsSlider from "../SettingsSlider";
import SettingsToggle from "../SettingsToggle";

/** macOS Sound 面板：输出音量 + 静音开关（骨架阶段仅此一项） */
const SoundPanel = React.memo(function SoundPanel() {
  const volume = useStore((s) => s.volume);
  const setVolume = useStore((s) => s.setVolume);

  const muted = volume === 0;

  return (
    <div className="flex-1 overflow-y-auto px-7 py-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Sound
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Adjust the volume and sound effects.
      </p>

      {/* Output 卡片 */}
      <div className="rounded-xl bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-700">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-300">
            Output
          </span>
        </div>

        {/* 音量滑块行 */}
        <div className="px-4 py-3.5 flex items-center gap-4">
          <span className="i-ri:volume-up-line text-base text-gray-500 dark:text-gray-400 shrink-0" />
          <SettingsSlider
            value={volume}
            min={0}
            max={100}
            onChange={setVolume}
            label="Output Volume"
          />
        </div>

        {/* 静音开关行 */}
        <div className="px-4 py-3.5 flex items-center justify-between border-t border-gray-100 dark:border-zinc-700">
          <span className="text-sm text-gray-700 dark:text-gray-200">Mute</span>
          <SettingsToggle checked={muted} onChange={(v) => setVolume(v ? 0 : 50)} />
        </div>
      </div>

      <p className="text-xs text-gray-400 dark:text-gray-500 mt-4">
        Input and Sound Effects panels are not yet implemented.
      </p>
    </div>
  );
});

export default SoundPanel;
