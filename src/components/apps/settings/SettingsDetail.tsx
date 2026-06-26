import React from "react";
import type { SidebarItemId } from "./types";
import AccountPanel from "./panels/AccountPanel";
import AppearancePanel from "./panels/AppearancePanel";
import WallpaperPanel from "./panels/WallpaperPanel";
import SoundPanel from "./panels/SoundPanel";
import DesktopDockPanel from "./panels/DesktopDockPanel";
import PrivacyPanel from "./panels/PrivacyPanel";
import PlaceholderPanel from "./panels/PlaceholderPanel";

/** 面板标题映射（占位面板用） */
const PANEL_TITLES: Record<SidebarItemId, string> = {
  account: "Apple ID",
  wifi: "Wi-Fi",
  bluetooth: "Bluetooth",
  network: "Network",
  notifications: "Notifications",
  sound: "Sound",
  focus: "Focus",
  general: "General",
  appearance: "Appearance",
  accessibility: "Accessibility",
  "control-center": "Control Center",
  siri: "Siri",
  spotlight: "Spotlight",
  privacy: "Privacy & Security",
  "desktop-dock": "Desktop & Dock",
  wallpaper: "Wallpaper",
  displays: "Displays",
  battery: "Battery",
  "lock-screen": "Lock Screen",
  "login-password": "Login Password",
  "users-groups": "Users & Groups"
};

interface SettingsDetailProps {
  currentItemId: SidebarItemId;
}

/** 右侧详情区：按 sidebar 选中项切换内容 */
const SettingsDetail = React.memo(function SettingsDetail({
  currentItemId
}: SettingsDetailProps) {
  let content: React.ReactNode;
  switch (currentItemId) {
    case "account":
      content = <AccountPanel />;
      break;
    case "appearance":
      content = <AppearancePanel />;
      break;
    case "sound":
      content = <SoundPanel />;
      break;
    case "desktop-dock":
      content = <DesktopDockPanel />;
      break;
    case "wallpaper":
      content = <WallpaperPanel />;
      break;
    case "privacy":
      content = <PrivacyPanel />;
      break;
    case "wifi":
    case "bluetooth":
    case "network":
    case "notifications":
    case "focus":
    case "general":
    case "accessibility":
    case "control-center":
    case "siri":
    case "spotlight":
    case "displays":
    case "battery":
    case "lock-screen":
    case "login-password":
    case "users-groups":
      content = <PlaceholderPanel title={PANEL_TITLES[currentItemId]} />;
      break;
    default:
      content = <PlaceholderPanel title={PANEL_TITLES[currentItemId]} />;
  }

  return (
    <div className="flex-1 h-full overflow-hidden flex flex-col bg-white dark:bg-zinc-900">
      {content}
    </div>
  );
});

export default SettingsDetail;
