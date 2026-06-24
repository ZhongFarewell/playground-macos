import type { StateCreator } from "zustand";
import type { MenuGroup } from "~/types";

export interface MenuSlice {
  /** appId → 菜单组列表 */
  appMenus: { [appId: string]: MenuGroup[] };
  /** appId → 快捷键映射（"⌘S" → handler） */
  appShortcuts: { [appId: string]: { [shortcut: string]: () => void } };
  /** 注册 app 菜单 + 快捷键 */
  registerAppMenus: (
    appId: string,
    groups: MenuGroup[],
    shortcuts: Record<string, () => void>
  ) => void;
  /** 注销 app 菜单 + 快捷键 */
  unregisterAppMenus: (appId: string) => void;
}

export const createMenuSlice: StateCreator<MenuSlice> = (set) => ({
  appMenus: {},
  appShortcuts: {},
  registerAppMenus: (appId, groups, shortcuts) =>
    set((state) => ({
      appMenus: { ...state.appMenus, [appId]: groups },
      appShortcuts: { ...state.appShortcuts, [appId]: shortcuts }
    })),
  unregisterAppMenus: (appId) =>
    set((state) => {
      const appMenus = { ...state.appMenus };
      const appShortcuts = { ...state.appShortcuts };
      delete appMenus[appId];
      delete appShortcuts[appId];
      return { appMenus, appShortcuts };
    })
});
