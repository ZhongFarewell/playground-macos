import React from "react";
import { useStore } from "~/stores";
import type { SidebarItemId } from "./types";

const STORAGE_KEY = "mdb:settings:last-sidebar";

export interface SettingsState {
  /** 当前选中的 sidebar 项 id */
  currentItemId: SidebarItemId;
  /** 切换选中项 */
  setItemId: (id: SidebarItemId) => void;
}

/** Settings app 的状态 hook：管理当前选中的 sidebar 项 + localStorage 持久化 + 通知导航信号 */
export const useSettingsState = (): SettingsState => {
  const [currentItemId, setCurrentItemId] = useState<SidebarItemId>("appearance");
  const pendingNavigate = useStore((s) => s.pendingNavigate);
  const setPendingNavigate = useStore((s) => s.setPendingNavigate);

  // 启动时从 localStorage 恢复
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        setCurrentItemId(saved as SidebarItemId);
      }
    } catch {
      // localStorage 不可用时静默忽略
    }
  }, []);

  // 监听通知导航信号：若指向 settings，切换到对应 sidebar 项并清除信号
  useEffect(() => {
    if (pendingNavigate?.appId === "settings" && pendingNavigate.sidebarItemId) {
      setCurrentItemId(pendingNavigate.sidebarItemId as SidebarItemId);
      setPendingNavigate(null);
    }
  }, [pendingNavigate, setPendingNavigate]);

  // 选中项变化时写入 localStorage
  const setItemId = useCallback((id: SidebarItemId) => {
    setCurrentItemId(id);
    try {
      localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // 静默忽略
    }
  }, []);

  return { currentItemId, setItemId };
};
