import React from "react";

interface SettingsSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  /** 左侧标签 */
  label?: string;
}

/** macOS 银色细长 Slider */
const SettingsSlider = React.memo(function SettingsSlider({
  value,
  min,
  max,
  step = 1,
  onChange,
  disabled,
  label
}: SettingsSliderProps) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className={`flex items-center gap-3 ${disabled ? "opacity-40" : ""}`}>
      {label && (
        <span className="text-xs text-gray-600 dark:text-gray-300 shrink-0">{label}</span>
      )}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="settings-slider flex-1"
        style={
          {
            "--pct": `${pct}%`
          } as React.CSSProperties
        }
      />
      <span className="text-xs text-gray-500 dark:text-gray-400 tabular-nums w-8 text-right shrink-0">
        {Math.round(value)}
      </span>
      <style>{`
        .settings-slider {
          -webkit-appearance: none;
          appearance: none;
          height: 4px;
          border-radius: 9999px;
          background: linear-gradient(
            to right,
            #3b82f6 0%,
            #3b82f6 var(--pct),
            #d1d5db var(--pct),
            #d1d5db 100%
          );
          outline: none;
        }
        .dark .settings-slider {
          background: linear-gradient(
            to right,
            #3b82f6 0%,
            #3b82f6 var(--pct),
            #52525b var(--pct),
            #52525b 100%
          );
        }
        .settings-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 9999px;
          background: #fff;
          border: 0.5px solid rgba(0, 0, 0, 0.1);
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
          cursor: pointer;
        }
        .settings-slider:disabled {
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
});

export default SettingsSlider;
