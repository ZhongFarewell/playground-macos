import {
  listEntries,
  listTrash,
  getEntry,
  createFolder as svcCreateFolder,
  createFile as svcCreateFile,
  renameEntry as svcRenameEntry,
  trashEntry as svcTrashEntry,
  restoreEntry as svcRestoreEntry,
  trashFolderRecursive,
  deleteEntryImmediately as svcDeleteImmediately,
  emptyTrash as svcEmptyTrash,
  moveEntry as svcMoveEntry,
  copyEntry as svcCopyEntry,
  seedDefaultFolders,
  ROOT_PARENT_ID
} from "~/services/finder";
import { rawUrl } from "~/services/database";
import type { FinderEntry } from "~/types";
import type { SortBy, ViewMode } from "./types";

/** 面包屑路径项 */
export interface BreadcrumbItem {
  id: string;
  name: string;
}

/** 剪贴板 */
export interface FinderClipboard {
  entry: FinderEntry;
  mode: "cut" | "copy";
}

export interface FinderState {
  currentFolderId: string;
  currentFolderName: string;
  /** 面包屑路径（从根到当前文件夹） */
  breadcrumbs: BreadcrumbItem[];
  showTrash: boolean;
  entries: FinderEntry[];
  /** 根目录下的文件夹列表（供侧边栏按名称查找） */
  rootFolders: FinderEntry[];
  loading: boolean;
  selectedIds: Set<string>;
  /** 正在 inline 重命名的条目 id（null 表示无） */
  renamingId: string | null;
  history: string[];
  historyIdx: number;
  viewMode: ViewMode;
  sortBy: SortBy;

  navigateTo: (folderId: string, folderName?: string) => void;
  navigateInto: (folder: FinderEntry) => void;
  goBack: () => void;
  goForward: () => void;
  canGoBack: () => boolean;
  canGoForward: () => boolean;
  selectItem: (id: string, multi: boolean) => void;
  clearSelection: () => void;
  createFolder: () => Promise<void>;
  renameItem: (entry: FinderEntry, newName: string) => Promise<void>;
  trashItem: (entry: FinderEntry) => Promise<void>;
  putBack: (entry: FinderEntry) => Promise<void>;
  /** Trash 视图：立即删除（物理删除，不进 Trash） */
  deleteImmediately: (entry: FinderEntry) => Promise<void>;
  /** Trash 视图：清空废纸篓（物理删除所有 trashed 条目） */
  emptyTrash: () => Promise<void>;
  /** 剪贴板（null 表示空） */
  clipboard: FinderClipboard | null;
  /** 剪切 */
  cutEntry: (entry: FinderEntry) => void;
  /** 复制 */
  copyEntryToClipboard: (entry: FinderEntry) => void;
  /** 粘贴到目标文件夹 */
  pasteEntry: (targetFolderId: string) => Promise<void>;
  /** 拖拽落到文件夹上（移动） */
  handleDropOnFolder: (targetFolderId: string, draggedEntryId: string) => Promise<void>;
  /** 上传本地文件（拖入浏览器） */
  uploadFiles: (files: File[], targetFolderId: string) => Promise<void>;
  /** 双击文件：在新标签页用 raw 直链打开（浏览器流式渲染） */
  openFile: (entry: FinderEntry) => void;
  /** 进入 inline 重命名模式 */
  startRename: (id: string) => void;
  /** 退出 inline 重命名模式（不提交，仅取消 UI 状态） */
  cancelRename: () => void;
  setViewMode: (v: ViewMode) => void;
  setSortBy: (v: SortBy) => void;
  showTrashView: () => void;
  refresh: () => void;
}

export const useFinderState = (initialTrash = false): FinderState => {
  const [currentFolderId, setCurrentFolderId] = useState(ROOT_PARENT_ID);
  const [currentFolderName, setCurrentFolderName] = useState(
    initialTrash ? "Trash" : "Home"
  );
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([
    { id: ROOT_PARENT_ID, name: "Home" }
  ]);
  const [showTrash, setShowTrash] = useState(initialTrash);
  const [entries, setEntries] = useState<FinderEntry[]>([]);
  const [rootFolders, setRootFolders] = useState<FinderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<string[]>([ROOT_PARENT_ID]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [clipboard, setClipboard] = useState<FinderClipboard | null>(null);

  // 排序后的列表
  const sortedEntries = useMemo(() => {
    const arr = [...entries];
    // 文件夹优先
    arr.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "folder" ? -1 : 1;
      if (sortBy === "date") {
        return (b.updatedAt || "").localeCompare(a.updatedAt || "");
      }
      return a.name.localeCompare(b.name);
    });
    return arr;
  }, [entries, sortBy]);

  // 是否已播种过（避免重复播种）
  const seededRef = useRef(false);

  // 加载当前目录
  const loadCurrent = useCallback(async () => {
    setLoading(true);
    try {
      // 首次加载且非 Trash 视图时播种默认文件夹
      if (!seededRef.current && !showTrash) {
        seededRef.current = true;
        await seedDefaultFolders();
      }
      const list = showTrash ? await listTrash() : await listEntries(currentFolderId);
      setEntries(list);
      // 始终刷新根目录文件夹列表（供侧边栏按名称查找）
      const root = await listEntries(ROOT_PARENT_ID);
      setRootFolders(root);
      // 构建面包屑路径链（从根到当前文件夹）
      if (showTrash) {
        setBreadcrumbs([{ id: "trash", name: "Trash" }]);
      } else {
        const chain: BreadcrumbItem[] = [];
        let curId: string = currentFolderId;
        // 防御性循环上限（避免环引用死循环）
        for (let i = 0; i < 50 && curId !== ROOT_PARENT_ID; i++) {
          const entry = await getEntry(curId);
          if (!entry) break;
          chain.unshift({ id: entry.id, name: entry.name });
          curId = entry.parentId;
        }
        chain.unshift({ id: ROOT_PARENT_ID, name: "Home" });
        setBreadcrumbs(chain);
      }
    } catch (err) {
      console.error("Finder load error:", err);
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, showTrash]);

  useEffect(() => {
    loadCurrent();
  }, [loadCurrent]);

  const navigateTo = useCallback(
    (folderId: string, folderName?: string) => {
      setShowTrash(false);
      setCurrentFolderId(folderId);
      setCurrentFolderName(
        folderName ?? (folderId === ROOT_PARENT_ID ? "Home" : "Folder")
      );
      setSelectedIds(new Set());
      // 截断 history 到当前 idx，再推入新 id
      setHistory((prev) => [...prev.slice(0, historyIdx + 1), folderId]);
      setHistoryIdx((prev) => prev + 1);
    },
    [historyIdx]
  );

  const navigateInto = useCallback(
    (folder: FinderEntry) => {
      if (folder.kind !== "folder") return;
      navigateTo(folder.id, folder.name);
    },
    [navigateTo]
  );

  // 按 folderId 查找文件夹名（从 rootFolders 或 entries 查）
  const resolveFolderName = useCallback(
    (folderId: string): string => {
      if (folderId === ROOT_PARENT_ID) return "Home";
      const root = rootFolders.find((f) => f.id === folderId);
      if (root) return root.name;
      // 嵌套场景：从当前 entries 里找（后退/前进到子文件夹时 entries 可能没有）
      const inEntries = entries.find((e) => e.id === folderId);
      if (inEntries) return inEntries.name;
      return "Folder";
    },
    [rootFolders, entries]
  );

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const newIdx = historyIdx - 1;
    const targetId = history[newIdx];
    setHistoryIdx(newIdx);
    setShowTrash(false);
    setCurrentFolderId(targetId);
    setCurrentFolderName(resolveFolderName(targetId));
    setSelectedIds(new Set());
  }, [history, historyIdx, resolveFolderName]);

  const goForward = useCallback(() => {
    if (historyIdx >= history.length - 1) return;
    const newIdx = historyIdx + 1;
    const targetId = history[newIdx];
    setHistoryIdx(newIdx);
    setShowTrash(false);
    setCurrentFolderId(targetId);
    setCurrentFolderName(resolveFolderName(targetId));
    setSelectedIds(new Set());
  }, [history, historyIdx, resolveFolderName]);

  const canGoBack = useCallback(() => historyIdx > 0, [historyIdx]);
  const canGoForward = useCallback(
    () => historyIdx < history.length - 1,
    [history, historyIdx]
  );

  const selectItem = useCallback((id: string, multi: boolean) => {
    setSelectedIds((prev) => {
      if (multi) {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      }
      return new Set([id]);
    });
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const createFolder = useCallback(async () => {
    const folder = await svcCreateFolder("untitled folder", currentFolderId);
    await loadCurrent();
    // 创建后立即进入 inline 重命名
    if (folder) {
      setRenamingId(folder.id);
      setSelectedIds(new Set([folder.id]));
    }
  }, [currentFolderId, loadCurrent]);

  const renameItem = useCallback(
    async (entry: FinderEntry, newName: string) => {
      setRenamingId(null);
      if (newName && newName !== entry.name) {
        await svcRenameEntry(entry, newName);
        loadCurrent();
      }
    },
    [loadCurrent]
  );

  const startRename = useCallback((id: string) => {
    setRenamingId(id);
  }, []);

  const cancelRename = useCallback(() => {
    setRenamingId(null);
  }, []);

  const trashItem = useCallback(
    async (entry: FinderEntry) => {
      if (entry.kind === "folder") {
        await trashFolderRecursive(entry);
      } else {
        await svcTrashEntry(entry);
      }
      loadCurrent();
    },
    [loadCurrent]
  );

  const putBack = useCallback(
    async (entry: FinderEntry) => {
      await svcRestoreEntry(entry);
      loadCurrent();
    },
    [loadCurrent]
  );

  const deleteImmediately = useCallback(
    async (entry: FinderEntry) => {
      if (entry.kind === "folder") {
        // 文件夹：递归物理删除子条目
        const children = await listEntries(entry.id);
        for (const child of children) {
          await deleteImmediately(child);
        }
      }
      await svcDeleteImmediately(entry);
      loadCurrent();
    },
    [loadCurrent]
  );

  const emptyTrash = useCallback(async () => {
    const items = await listTrash();
    await svcEmptyTrash(items);
    loadCurrent();
  }, [loadCurrent]);

  // ── 剪贴板 ───────────────────────────────────────────────

  const cutEntry = useCallback((entry: FinderEntry) => {
    setClipboard({ entry, mode: "cut" });
  }, []);

  const copyEntryToClipboard = useCallback((entry: FinderEntry) => {
    setClipboard({ entry, mode: "copy" });
  }, []);

  const pasteEntry = useCallback(
    async (targetFolderId: string) => {
      if (!clipboard) return;
      const { entry, mode } = clipboard;
      // 防御：粘贴到原位置无操作
      if (entry.parentId === targetFolderId && mode === "cut") return;
      if (mode === "cut") {
        await svcMoveEntry(entry, targetFolderId);
        setClipboard(null); // cut 粘贴后清空
      } else {
        await svcCopyEntry(entry, targetFolderId);
        // copy 粘贴后保留剪贴板（macOS 行为，可多次粘贴）
      }
      loadCurrent();
    },
    [clipboard, loadCurrent]
  );

  // ── 拖拽 ─────────────────────────────────────────────────

  // 检查 targetId 是否是 entryId 的子文件夹（避免拖到自己的子项造成环引用）
  const isDescendant = useCallback(
    async (entryId: string, targetId: string): Promise<boolean> => {
      if (entryId === targetId) return true;
      let curId = targetId;
      for (let i = 0; i < 50; i++) {
        const entry = await getEntry(curId);
        if (!entry || entry.parentId === ROOT_PARENT_ID) return false;
        if (entry.parentId === entryId) return true;
        curId = entry.parentId;
      }
      return false;
    },
    []
  );

  const handleDropOnFolder = useCallback(
    async (targetFolderId: string, draggedEntryId: string) => {
      if (targetFolderId === draggedEntryId) return; // 拖到自己
      // 防御：拖到自己的子文件夹
      if (await isDescendant(draggedEntryId, targetFolderId)) return;
      const dragged = await getEntry(draggedEntryId);
      if (!dragged) return;
      // 同文件夹无操作
      if (dragged.parentId === targetFolderId) return;
      await svcMoveEntry(dragged, targetFolderId);
      loadCurrent();
    },
    [isDescendant, loadCurrent]
  );

  // 上传本地文件（拖入浏览器）：立即创建占位（可见），后台异步上传内容
  // 用 arrayBuffer 而非 text()——二进制文件（图片/音频/视频）用 text() 会损坏
  const uploadFiles = useCallback(
    async (files: File[], targetFolderId: string) => {
      for (const file of files) {
        try {
          const content = new Uint8Array(await file.arrayBuffer());
          const placeholder = await svcCreateFile(
            file.name,
            targetFolderId,
            content,
            (uploaded) => {
              // 后台上传完成：直接更新 entries 状态（替换占位），不依赖 loadCurrent
              // 避免 queryByType 读远端时 record 还没 flush 导致 404
              setEntries((prev) =>
                prev.map((e) => (e.id === uploaded.id ? uploaded : e))
              );
            }
          );
          // 占位条目立即插入 entries（可见）
          if (placeholder && placeholder.parentId === currentFolderId) {
            setEntries((prev) => [...prev, placeholder]);
          }
        } catch (err) {
          console.error("[finder] upload failed:", file.name, err);
        }
      }
    },
    [currentFolderId]
  );

  // 双击文件：直接用 raw URL 在新标签页打开（浏览器流式渲染，边下边显示）。
  // 公开仓库 raw 直链可直接访问，无需 PAT。图片/PDF/音视频/文本浏览器按扩展名判断 Content-Type。
  const openFile = useCallback((entry: FinderEntry) => {
    if (entry.kind !== "file" || !entry.blob) return;
    window.open(rawUrl(entry.blob.file), "_blank");
  }, []);

  const showTrashView = useCallback(() => {
    setShowTrash(true);
    setCurrentFolderId(ROOT_PARENT_ID); // 不影响 trash 视图
    setCurrentFolderName("Trash");
    setSelectedIds(new Set());
  }, []);

  const refresh = useCallback(() => {
    loadCurrent();
  }, [loadCurrent]);

  return {
    currentFolderId,
    currentFolderName,
    breadcrumbs,
    showTrash,
    entries: sortedEntries,
    rootFolders,
    loading,
    selectedIds,
    renamingId,
    history,
    historyIdx,
    viewMode,
    sortBy,
    navigateTo,
    navigateInto,
    goBack,
    goForward,
    canGoBack,
    canGoForward,
    selectItem,
    clearSelection,
    createFolder,
    renameItem,
    trashItem,
    putBack,
    deleteImmediately,
    emptyTrash,
    clipboard,
    cutEntry,
    copyEntryToClipboard,
    pasteEntry,
    handleDropOnFolder,
    uploadFiles,
    openFile,
    startRename,
    cancelRename,
    setViewMode,
    setSortBy,
    showTrashView,
    refresh
  };
};
