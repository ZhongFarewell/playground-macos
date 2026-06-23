import { useEffect, useRef, useCallback } from "react";
import type { MenuItemDef, ContextMenuContext } from "~/types/contextMenu";
import { COLLECT_EVENT } from "~/components/ContextMenu";

interface UseContextMenuReturn {
  /** 绑定到需要声明菜单项的元素 ref 上 */
  ref: React.RefObject<HTMLElement>;
}

/**
 * 让一个元素声明自己的右键菜单项。
 *
 * 右键事件冒泡到该元素时，callback 被调用，接收上下文和一个 collector。
 * callback 内 collector.add() 声明的菜单项会出现在右键菜单中。
 *
 * @example
 * ```tsx
 * const photoRef = useContextMenu((ctx, collector) => {
 *   collector.add(
 *     { label: "Set as Wallpaper", onClick: () => setWallpaper(src) },
 *     { label: "Copy Image Address", onClick: () => copy(url) }
 *   );
 * });
 * return <img ref={photoRef as any} src={url} />;
 * ```
 */
export function useContextMenu(
  collect: (
    ctx: ContextMenuContext,
    collector: {
      add: (...items: MenuItemDef[]) => void;
      addSeparator: () => void;
    }
  ) => void,
  deps: React.DependencyList = []
): React.RefObject<HTMLElement> {
  const ref = useRef<HTMLElement>(null);

  // 用 useCallback 保证 handler 稳定，deps 变化时重建
  const collectFn = useCallback(collect, deps);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail) return;
      collectFn(detail.ctx, detail.collector);
    };

    el.addEventListener(COLLECT_EVENT, handler);
    return () => el.removeEventListener(COLLECT_EVENT, handler);
  }, [collectFn]);

  return ref;
}
