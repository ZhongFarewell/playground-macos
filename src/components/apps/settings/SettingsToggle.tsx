import React from "react";

interface SettingsToggleProps {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

/** macOS 蓝色胶囊 Toggle */
const SettingsToggle = React.memo(function SettingsToggle({
  checked,
  onChange,
  disabled
}: SettingsToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative w-[38px] h-[22px] rounded-full transition-colors duration-200 ease-out shrink-0 ${
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
      } ${checked ? "bg-green-500" : "bg-gray-300 dark:bg-zinc-600"}`}
    >
      <span
        className={`absolute top-[2px] left-[2px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ease-out ${
          checked ? "translate-x-[16px]" : "translate-x-0"
        }`}
      />
    </button>
  );
});

export default SettingsToggle;
