import type { AppMenuDef } from "~/types";
import type { SettingsState } from "./useSettingsState";

/**
 * 构建菜单定义。
 * 骨架阶段：只注册空的 app 名菜单（MenuBar 会显示 "Settings" bold）。
 * Quit ⌘Q 暂不接入真正关闭（closeApp 在 Desktop local state，Settings 组件拿不到），
 * 用户可点窗口关闭按钮关闭。下个迭代统一接 quit 机制。
 */
export const buildMenus = (_s: SettingsState): AppMenuDef => [];

/** useAppMenus 的 deps */
export const menuDeps = (_s: SettingsState): React.DependencyList => [];
