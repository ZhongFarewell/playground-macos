import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { MenuItemDef, MenuCollector, ContextMenuContext } from "~/types/contextMenu";

interface ContextMenuState {
  x: number;
  y: number;
  visible: boolean;
  items: MenuItemDef[];
}

// 自定义事件名：右键时派发，冒泡路径上的元素监听并往 collector 里 add 菜单项
const COLLECT_EVENT = "contextmenu-collect";

// 全局默认菜单（当没有任何元素声明菜单项时显示）
const defaultMenus: MenuItemDef[] = [
  { label: "Cut", shortcut: "⌘X", disabled: true },
  { label: "Copy", shortcut: "⌘C", disabled: true },
  { label: "Paste", shortcut: "⌘V", disabled: true },
  { separator: true },
  { label: "Look Up", disabled: true },
  { separator: true },
  { label: "Search with Google", disabled: true },
  { separator: true },
  { label: "Select All", shortcut: "⌘A", disabled: true }
];

export default function ContextMenu() {
  const [state, setState] = useState<ContextMenuState>({
    x: 0,
    y: 0,
    visible: false,
    items: []
  });

  // 拦截全局右键，派发收集事件让冒泡路径上的元素声明菜单项
  useEffect(() => {
    const onContextMenu = (e: MouseEvent) => {
      e.preventDefault();

      // 创建收集器
      const collected: MenuItemDef[] = [];
      const collector: MenuCollector = {
        add: (...items) => collected.push(...items),
        addSeparator: () => collected.push({ separator: true })
      };

      // 构造上下文
      const selection = window.getSelection()?.toString() || "";
      const ctx: ContextMenuContext = {
        event: e,
        x: e.clientX,
        y: e.clientY,
        selection,
        target: e.target as HTMLElement
      };

      // 派发自定义事件，冒泡路径上的元素可监听并往 collector 里 add
      const collectEvent = new CustomEvent(COLLECT_EVENT, {
        bubbles: true,
        cancelable: true,
        detail: { collector, ctx }
      });
      (e.target as HTMLElement).dispatchEvent(collectEvent);

      // 收集到菜单项就用收集的，否则回退到默认菜单
      const items = collected.length > 0 ? collected : defaultMenus;

      setState({ x: e.clientX, y: e.clientY, visible: true, items });
    };

    const onClick = () => setState((s) => (s.visible ? { ...s, visible: false } : s));
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setState((s) => (s.visible ? { ...s, visible: false } : s));
    };
    const onScroll = () => setState((s) => (s.visible ? { ...s, visible: false } : s));

    document.addEventListener("contextmenu", onContextMenu);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      document.removeEventListener("contextmenu", onContextMenu);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, []);

  // 边界检测：菜单超出视口右/下时翻转
  const MENU_W = 220;
  const MENU_H = state.items.length * 28 + 16;
  const adjustedX = state.x + MENU_W > window.innerWidth ? state.x - MENU_W : state.x;
  const adjustedY = state.y + MENU_H > window.innerHeight ? state.y - MENU_H : state.y;

  return (
    <AnimatePresence>
      {state.visible && (
        <motion.div
          className="fixed z-[9999] min-w-[200px] py-1 rounded-lg backdrop-blur-2xl bg-gray-200/90 dark:bg-zinc-700/90 border border-gray-400/30 shadow-md shadow-black/25"
          style={{ left: adjustedX, top: adjustedY }}
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.12, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()}
        >
          {state.items.map((item, i) =>
            item.separator ? (
              <div
                key={i}
                className="my-1 mx-2 h-px bg-gray-400/30 dark:bg-zinc-500/30"
              />
            ) : (
              <div
                key={item.key || i}
                className={`mx-1 px-2.5 h-7 flex items-center justify-between rounded text-sm cursor-default ${
                  item.disabled
                    ? "text-gray-400 dark:text-zinc-500 cursor-not-allowed"
                    : "text-gray-800 dark:text-zinc-100 hover:bg-blue-500 hover:text-white"
                }`}
                onClick={() => {
                  if (!item.disabled && item.onClick) {
                    item.onClick();
                    setState((s) => ({ ...s, visible: false }));
                  }
                }}
              >
                <span>{item.label}</span>
                {item.shortcut && (
                  <span className="ml-6 text-xs opacity-60">{item.shortcut}</span>
                )}
              </div>
            )
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * 导出收集事件名，供元素/App 监听使用。
 *
 * 使用方式（在任何元素上）：
 * ```tsx
 * useEffect(() => {
 *   const handler = (e: Event) => {
 *     const { collector, ctx } = (e as CustomEvent).detail;
 *     collector.add({ label: "My Action", onClick: () => {...} });
 *   };
 *   ref.current?.addEventListener("contextmenu-collect", handler);
 *   return () => ref.current?.removeEventListener("contextmenu-collect", handler);
 * }, []);
 * ```
 */
export { COLLECT_EVENT };
