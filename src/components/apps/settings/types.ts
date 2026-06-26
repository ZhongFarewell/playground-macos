/** Settings sidebar 项 id（含已实现与占位项） */
export type SidebarItemId =
  | "account"
  | "wifi"
  | "bluetooth"
  | "network"
  | "notifications"
  | "sound"
  | "focus"
  | "general"
  | "appearance"
  | "accessibility"
  | "control-center"
  | "siri"
  | "spotlight"
  | "privacy"
  | "desktop-dock"
  | "wallpaper"
  | "displays"
  | "battery"
  | "lock-screen"
  | "login-password"
  | "users-groups";

/** Sidebar 单项定义 */
export interface SidebarItem {
  id: SidebarItemId;
  label: string;
  /** UnoCSS 图标类，如 i-ri:wifi-fill */
  icon: string;
  /** 图标颜色（CSS color），用于彩色图标效果 */
  color: string;
}

/** Sidebar 分组 */
export interface SidebarGroup {
  /** 分组标题（可选，首组无标题） */
  label?: string;
  items: SidebarItem[];
}
