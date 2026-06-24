import type { AppMenuDef } from "~/types";

/**
 * app 注册自己的菜单栏。
 * mount 时注册，unmount 时注销；deps 变化时重新注册（保证 onClick 闭包最新）。
 *
 * @param appId app 唯一 id（与 apps.tsx 的 id 一致）
 * @param build 返回菜单定义的函数（闭包捕获最新 handler）
 * @param deps 依赖列表，变化时重新注册
 */
export const useAppMenus = (
  appId: string,
  build: () => AppMenuDef,
  deps: React.DependencyList
): void => {
  const registerAppMenus = useStore((s) => s.registerAppMenus);
  const unregisterAppMenus = useStore((s) => s.unregisterAppMenus);

  useEffect(() => {
    const groups = build();
    // 收集带 shortcut 的 item 的 onClick，存进 shortcuts 映射
    const shortcuts: Record<string, () => void> = {};
    for (const group of groups) {
      for (const item of group.items) {
        if (item.shortcut && item.onClick && !item.disabled && !item.separator) {
          shortcuts[item.shortcut] = item.onClick;
        }
      }
    }
    registerAppMenus(appId, groups, shortcuts);
    return () => unregisterAppMenus(appId);
  }, [appId, registerAppMenus, unregisterAppMenus, ...deps]);
};
