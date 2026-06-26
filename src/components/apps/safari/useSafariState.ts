import { useCallback, useEffect, useState } from "react";
import {
  loadBookmarks,
  addBookmark,
  renameBookmark,
  removeBookmark,
  seedBookmarksIfEmpty,
  type Bookmark,
  type BookmarkSection
} from "~/services/bookmark";

/** 起始页书签数据（按 section 分组） */
export interface BookmarkSections {
  favorites: Bookmark[];
  freq: Bookmark[];
}

export interface SafariState {
  /** 地址栏输入值 */
  currentURL: string;
  /** 当前加载的 URL（空 = 起始页），派生自 history[historyIndex] */
  goURL: string;
  /** 历史栈（含起始页 ""） */
  history: string[];
  /** 当前历史指针 */
  historyIndex: number;
  /** 可后退 */
  canBack: boolean;
  /** 可前进 */
  canForward: boolean;
  /** 书签数据 */
  bookmarks: BookmarkSections;
  /** 是否正在加载书签 */
  loadingBookmarks: boolean;
  /** toast 提示 */
  toast: { msg: string; type: "success" | "error" } | null;
  /** 添加书签 dialog */
  showAddDialog: boolean;
  /** 重命名 dialog */
  renameTarget: Bookmark | null;
  /** PAT 未配置时提示 */
  showPatDialog: boolean;
  setGoURL: (url: string) => void;
  goBack: () => void;
  goForward: () => void;
  setCurrentURL: (url: string) => void;
  refreshBookmarks: () => Promise<void>;
  handleAddBookmark: (data: {
    title: string;
    link: string;
    section: BookmarkSection;
  }) => Promise<void>;
  handleRenameBookmark: (id: string, newTitle: string) => Promise<void>;
  handleDeleteBookmark: (id: string) => Promise<void>;
  openLink: (url: string, inner?: boolean) => void;
  copyLink: (url: string) => void;
  setShowAddDialog: (v: boolean) => void;
  setRenameTarget: (b: Bookmark | null) => void;
  setShowPatDialog: (v: boolean) => void;
}

export const useSafariState = (): SafariState => {
  const [currentURL, setCurrentURL] = useState("");
  // 历史栈：初始含起始页 ""。goURL 派生自 history[historyIndex]
  const [history, setHistory] = useState<string[]>([""]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const goURL = history[historyIndex] ?? "";
  const canBack = historyIndex > 0;
  const canForward = historyIndex < history.length - 1;
  const [bookmarks, setBookmarks] = useState<BookmarkSections>({
    favorites: [],
    freq: []
  });
  const [loadingBookmarks, setLoadingBookmarks] = useState(true);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [renameTarget, setRenameTarget] = useState<Bookmark | null>(null);
  const [showPatDialog, setShowPatDialog] = useState(false);

  // toast 自动消失
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  const refreshBookmarks = useCallback(async () => {
    setLoadingBookmarks(true);
    const data = await loadBookmarks();
    setBookmarks(data);
    setLoadingBookmarks(false);
  }, []);

  // 启动时播种 + 加载
  useEffect(() => {
    (async () => {
      await seedBookmarksIfEmpty();
      await refreshBookmarks();
    })();
  }, [refreshBookmarks]);

  const setGoURL = useCallback(
    (url: string) => {
      let target = url;
      const isURL = /^https?:\/\//.test(url) || /^[\w-]+(\.[\w-]+)+/.test(url);
      if (isURL) {
        if (!/^https?:\/\//.test(url)) target = `https://${url}`;
      } else if (url !== "") {
        target = `https://www.bing.com/search?q=${encodeURIComponent(url)}`;
      }
      // 与当前页相同则不重复压栈（避免 index 与 history 脱节）
      if (history[historyIndex] === target) {
        setCurrentURL(target);
        return;
      }
      // 截断当前指针之后的历史，压入新 URL（与真实浏览器一致）
      const next = history.slice(0, historyIndex + 1);
      next.push(target);
      setHistory(next);
      setHistoryIndex(historyIndex + 1);
      setCurrentURL(target);
    },
    [history, historyIndex]
  );

  const goBack = useCallback(() => {
    if (historyIndex <= 0) return;
    const newIndex = historyIndex - 1;
    setHistoryIndex(newIndex);
    setCurrentURL(history[newIndex] ?? "");
  }, [historyIndex, history]);

  const goForward = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const newIndex = historyIndex + 1;
    setHistoryIndex(newIndex);
    setCurrentURL(history[newIndex] ?? "");
  }, [historyIndex, history]);

  const openLink = useCallback(
    (url: string, inner = true) => {
      if (inner) {
        setGoURL(url);
      } else {
        window.open(url, "_blank");
      }
    },
    [setGoURL]
  );

  const copyLink = useCallback((url: string) => {
    navigator.clipboard
      .writeText(url)
      .then(() => {
        setToast({ msg: "Link copied", type: "success" });
      })
      .catch(() => {
        setToast({ msg: "Copy failed", type: "error" });
      });
  }, []);

  const handleAddBookmark = useCallback(
    async (data: { title: string; link: string; section: BookmarkSection }) => {
      try {
        await addBookmark({ title: data.title, link: data.link }, data.section);
        await refreshBookmarks();
        setToast({ msg: "Bookmark added", type: "success" });
      } catch {
        setToast({ msg: "Add failed", type: "error" });
      }
    },
    [refreshBookmarks]
  );

  const handleRenameBookmark = useCallback(
    async (id: string, newTitle: string) => {
      try {
        await renameBookmark(id, newTitle);
        await refreshBookmarks();
        setToast({ msg: "Renamed", type: "success" });
      } catch {
        setToast({ msg: "Rename failed", type: "error" });
      }
    },
    [refreshBookmarks]
  );

  const handleDeleteBookmark = useCallback(
    async (id: string) => {
      try {
        removeBookmark(id);
        await refreshBookmarks();
        setToast({ msg: "Deleted", type: "success" });
      } catch {
        setToast({ msg: "Delete failed", type: "error" });
      }
    },
    [refreshBookmarks]
  );

  return {
    currentURL,
    goURL,
    history,
    historyIndex,
    canBack,
    canForward,
    bookmarks,
    loadingBookmarks,
    toast,
    showAddDialog,
    renameTarget,
    showPatDialog,
    setGoURL,
    goBack,
    goForward,
    setCurrentURL,
    refreshBookmarks,
    handleAddBookmark,
    handleRenameBookmark,
    handleDeleteBookmark,
    openLink,
    copyLink,
    setShowAddDialog,
    setRenameTarget,
    setShowPatDialog
  };
};
