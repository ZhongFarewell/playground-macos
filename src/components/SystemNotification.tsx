import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useStore } from "~/stores";

interface SystemNotificationProps {
  /** 点击通知跳转时打开 app（由 Desktop 传入 openApp） */
  onOpenApp?: (id: string) => void;
}

/** macOS 风格系统通知横幅，挂在 Desktop 顶层右上角 */
const SystemNotification = React.memo(function SystemNotification({
  onOpenApp
}: SystemNotificationProps) {
  const notifications = useStore((s) => s.notifications);
  const dismissNotification = useStore((s) => s.dismissNotification);
  const setPendingNavigate = useStore((s) => s.setPendingNavigate);

  // 每条通知 5s 后自动消失
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((n) =>
      setTimeout(() => dismissNotification(n.id), 5000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, dismissNotification]);

  const handleClick = (n: (typeof notifications)[number]) => {
    if (n.appId) {
      onOpenApp?.(n.appId);
      if (n.sidebarItemId) {
        setPendingNavigate({ appId: n.appId, sidebarItemId: n.sidebarItemId });
      }
    }
    dismissNotification(n.id);
  };

  return (
    <div className="fixed top-10 right-2 z-[100] flex flex-col gap-2 pointer-events-none">
      <AnimatePresence>
        {notifications.map((n) => (
          <motion.div
            key={n.id}
            layout
            initial={{ opacity: 0, x: 40, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="pointer-events-auto w-72 rounded-xl overflow-hidden shadow-xl backdrop-blur-xl bg-white/80 dark:bg-zinc-800/80 border border-white/40 dark:border-zinc-700/60 cursor-pointer"
            onClick={() => handleClick(n)}
          >
            <div className="flex items-start gap-3 p-3">
              {/* app 图标 */}
              <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-gray-200 to-gray-300 dark:from-zinc-700 dark:to-zinc-600 flex-center shrink-0">
                <span className="i-ri:settings-3-fill text-lg text-gray-600 dark:text-gray-200" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-gray-800 dark:text-gray-100 truncate">
                  {n.title}
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 leading-snug">
                  {n.body}
                </div>
              </div>
              {/* 关闭按钮 */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  dismissNotification(n.id);
                }}
                className="shrink-0 w-5 h-5 rounded-full flex-center text-gray-400 hover:bg-gray-200/60 dark:hover:bg-zinc-700/60 hover:text-gray-600 dark:hover:text-gray-200 transition-colors"
                aria-label="Dismiss"
              >
                <span className="i-ri:close-line text-sm" />
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

export default SystemNotification;
