import type { MenuItemDef } from "./contextMenu";

/** 一个顶部菜单栏项（File / Edit / View ...） */
export interface MenuGroup {
  /** 菜单标题，如 "File" */
  label: string;
  /** 该菜单下的菜单项 */
  items: MenuItemDef[];
}

/** app 注册的完整菜单栏定义 */
export type AppMenuDef = MenuGroup[];
