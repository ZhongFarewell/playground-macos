import React from "react";
import { user } from "~/configs";
import type { SidebarGroup, SidebarItemId } from "./types";

/** Sidebar 完整分组定义（拟真 macOS Ventura+ 顺序） */
const SIDEBAR_GROUPS: SidebarGroup[] = [
  {
    items: [
      { id: "wifi", label: "Wi-Fi", icon: "i-ri:wifi-fill", color: "#3b82f6" },
      {
        id: "bluetooth",
        label: "Bluetooth",
        icon: "i-ri:bluetooth-fill",
        color: "#3b82f6"
      },
      { id: "network", label: "Network", icon: "i-ri:global-line", color: "#6b7280" }
    ]
  },
  {
    items: [
      {
        id: "notifications",
        label: "Notifications",
        icon: "i-ri:notification-3-fill",
        color: "#ef4444"
      },
      { id: "sound", label: "Sound", icon: "i-ri:volume-up-fill", color: "#ec4899" },
      { id: "focus", label: "Focus", icon: "i-ri:moon-clear-fill", color: "#8b5cf6" }
    ]
  },
  {
    items: [
      { id: "general", label: "General", icon: "i-ri:settings-3-fill", color: "#6b7280" },
      {
        id: "appearance",
        label: "Appearance",
        icon: "i-ri:contrast-2-fill",
        color: "#1f2937"
      },
      {
        id: "accessibility",
        label: "Accessibility",
        icon: "i-ri:accessibility-fill",
        color: "#3b82f6"
      },
      {
        id: "control-center",
        label: "Control Center",
        icon: "i-ri:toggle-fill",
        color: "#6b7280"
      },
      { id: "siri", label: "Siri", icon: "i-ri:mic-fill", color: "#1f2937" },
      { id: "spotlight", label: "Spotlight", icon: "i-ri:search-fill", color: "#6b7280" },
      {
        id: "privacy",
        label: "Privacy & Security",
        icon: "i-ri:lock-fill",
        color: "#3b82f6"
      }
    ]
  },
  {
    items: [
      {
        id: "desktop-dock",
        label: "Desktop & Dock",
        icon: "i-ri:layout-grid-fill",
        color: "#3b82f6"
      },
      {
        id: "wallpaper",
        label: "Wallpaper",
        icon: "i-ri:image-fill",
        color: "#22c55e"
      },
      { id: "displays", label: "Displays", icon: "i-ri:monitor-fill", color: "#6b7280" },
      {
        id: "battery",
        label: "Battery",
        icon: "i-ri:battery-2-charge-fill",
        color: "#10b981"
      },
      {
        id: "lock-screen",
        label: "Lock Screen",
        icon: "i-ri:lock-2-fill",
        color: "#6b7280"
      },
      {
        id: "login-password",
        label: "Login Password",
        icon: "i-ri:key-2-fill",
        color: "#f59e0b"
      },
      {
        id: "users-groups",
        label: "Users & Groups",
        icon: "i-ri:user-3-fill",
        color: "#6b7280"
      }
    ]
  }
];

interface SettingsSidebarProps {
  currentItemId: SidebarItemId;
  onSelect: (id: SidebarItemId) => void;
}

/** 左侧 sidebar：账户卡片 + 搜索框 + 分组列表 */
const SettingsSidebar = React.memo(function SettingsSidebar({
  currentItemId,
  onSelect
}: SettingsSidebarProps) {
  return (
    <div className="w-[220px] shrink-0 h-full flex flex-col bg-gray-100/80 dark:bg-zinc-800/80 backdrop-blur-xl border-r border-gray-200/60 dark:border-zinc-700/60">
      {/* 账户卡片（点击进入 Apple ID 账户页） */}
      <div className="px-3 pt-3 pb-2">
        <button
          type="button"
          onClick={() => onSelect("account")}
          className={`w-full flex items-center gap-2.5 px-2 py-2 rounded-lg transition-colors ${
            currentItemId === "account"
              ? "bg-blue-500/10 ring-1 ring-blue-500/30"
              : "hover:bg-gray-200/60 dark:hover:bg-zinc-700/60"
          }`}
        >
          <img
            src={user.avatar}
            alt={user.name}
            className="w-8 h-8 rounded-full object-cover"
          />
          <div className="flex-1 min-w-0 text-left">
            <div className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
              {user.name}
            </div>
          </div>
          <span className="i-ri:arrow-right-s-line text-gray-400 text-base" />
        </button>
      </div>

      {/* 搜索框（UI 占位） */}
      <div className="px-3 pb-2">
        <div className="relative">
          <span className="absolute left-2 top-1/2 -translate-y-1/2 i-ri:search-line text-xs text-gray-400" />
          <input
            type="text"
            disabled
            placeholder="Search"
            className="w-full h-7 pl-7 pr-2 text-xs rounded-md bg-white/70 dark:bg-zinc-700/70 border border-gray-200/60 dark:border-zinc-600/60 text-gray-500 dark:text-gray-400 placeholder-gray-400 dark:placeholder-zinc-500 cursor-not-allowed outline-none"
          />
        </div>
      </div>

      {/* 分组列表 */}
      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {SIDEBAR_GROUPS.map((group, gi) => (
          <div key={gi} className={gi > 0 ? "mt-3" : ""}>
            {group.items.map((item) => {
              const active = item.id === currentItemId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left transition-colors ${
                    active
                      ? "bg-blue-500 text-white"
                      : "hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 text-gray-700 dark:text-gray-200"
                  }`}
                >
                  <span
                    className={`text-[15px] leading-none ${item.icon} ${
                      active ? "text-white" : ""
                    }`}
                    style={!active ? { color: item.color } : undefined}
                  />
                  <span className="text-[13px] truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
});

export default SettingsSidebar;
