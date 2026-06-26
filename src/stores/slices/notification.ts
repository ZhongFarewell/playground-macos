import type { StateCreator } from "zustand";

/** 单条系统通知 */
export interface NotificationItem {
  /** 唯一 id（用于 dismiss） */
  id: string;
  title: string;
  body: string;
  /** 点击跳转打开的 app id（如 "settings"） */
  appId?: string;
  /** 跳转后选中的 sidebar 项（如 "privacy"）—— 仅对 Settings 有效 */
  sidebarItemId?: string;
  createdAt: number;
}

/** 待处理的导航请求（通知点击后写入，目标 app 组件消费后清除） */
export interface PendingNavigate {
  appId: string;
  sidebarItemId?: string;
}

export interface NotificationSlice {
  notifications: NotificationItem[];
  /** 待处理导航（目标 app 组件 useEffect 监听此字段变化） */
  pendingNavigate: PendingNavigate | null;
  /** 推送通知（相同 title 去重） */
  pushNotification: (n: Omit<NotificationItem, "id" | "createdAt">) => void;
  /** 移除通知 */
  dismissNotification: (id: string) => void;
  /** 设置待处理导航（通知点击时调用） */
  setPendingNavigate: (n: PendingNavigate | null) => void;
}

const genId = (): string =>
  Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const createNotificationSlice: StateCreator<NotificationSlice> = (set) => ({
  notifications: [],
  pendingNavigate: null,
  pushNotification: (n) =>
    set((state) => {
      // 相同 title 去重
      if (state.notifications.some((x) => x.title === n.title)) {
        return state;
      }
      return {
        notifications: [
          ...state.notifications,
          { ...n, id: genId(), createdAt: Date.now() }
        ]
      };
    }),
  dismissNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((x) => x.id !== id)
    })),
  setPendingNavigate: (n) => set(() => ({ pendingNavigate: n }))
});
