/**
 * 全局菜单快捷键监听。
 * 仅当 currentAppId 对应的快捷键命中时触发（符合 macOS active app 概念）。
 *
 * @param currentAppId 当前聚焦的 app id，null/空时忽略所有快捷键
 */
export const useMenuShortcuts = (currentAppId: string | null): void => {
  const appShortcuts = useStore((s) => s.appShortcuts);

  useEffect(() => {
    if (!currentAppId) return;
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      if (!meta) return;
      // 拼快捷键字符串：⌘ + Shift? + Key
      const key = e.key;
      // 规范化常见按键
      const keyMap: Record<string, string> = {
        s: "⌘S",
        n: "⌘N",
        o: "⌘O",
        q: "⌘Q",
        w: "⌘W",
        p: "⌘P",
        e: "⌘E"
      };
      const shortcut = e.shiftKey
        ? `⌘⇧${key.toUpperCase()}`
        : keyMap[key.toLowerCase()] || `⌘${key.toUpperCase()}`;
      const shortcuts = appShortcuts[currentAppId];
      if (shortcuts && shortcuts[shortcut]) {
        e.preventDefault();
        shortcuts[shortcut]();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentAppId, appShortcuts]);
};
