export interface AppsData {
  id: string;
  title: string;
  desktop: boolean;
  img: string;
  show?: boolean;
  /** 不在 Dock 和 Launchpad 显示（如 System Settings 从 AppleMenu 打开） */
  hideFromDock?: boolean;
  width?: number;
  height?: number;
  minWidth?: number;
  minHeight?: number;
  aspectRatio?: number;
  x?: number;
  y?: number;
  content?: JSX.Element;
  link?: string;
}
