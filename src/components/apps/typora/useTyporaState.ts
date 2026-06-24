import type { TyporaNote } from "~/types";
import {
  listNotes,
  getNoteContent,
  saveNote,
  createNote,
  renameNote,
  getPat,
  setPat
} from "~/services/typora";
import type { EditorHandle } from "./MilkdownEditor";

/** 当前编辑文档的状态 */
export interface CurrentDoc {
  note: TyporaNote | null;
  localTitle?: string;
  content: string;
  dirty: boolean;
}

export interface TyporaState {
  doc: CurrentDoc;
  notes: TyporaNote[];
  loadingList: boolean;
  saving: boolean;
  loading: boolean;
  dragOver: boolean;
  toast: { msg: string; type: "success" | "error" } | null;
  showOpen: boolean;
  showSaveDialog: boolean;
  showPatDialog: boolean;
  showRenameDialog: boolean;
  renameValue: string;
  title: string;
  editorRef: React.MutableRefObject<EditorHandle | null>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleNew: () => void;
  handleOpenClick: () => void;
  handleOpenLocal: () => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDragLeave: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  handlePick: (note: TyporaNote) => void;
  handleSaveClick: () => void;
  handleSaveDialogConfirm: (filename: string) => void;
  handlePatConfirm: (pat: string) => void;
  openRenameDialog: () => void;
  handleRenameConfirm: (newTitle: string) => void;
  handleDownload: () => void;
  setShowOpen: (v: boolean) => void;
  setShowSaveDialog: (v: boolean) => void;
  setShowPatDialog: (v: boolean) => void;
  setShowRenameDialog: (v: boolean) => void;
}

export const useTyporaState = (): TyporaState => {
  const [doc, setDoc] = useState<CurrentDoc>({
    note: null,
    content:
      "# Hi 👋\nThis is a simple clone of [Typora](https://typora.io/). Built on top of [Milkdown](https://milkdown.dev/).\n\nClick **Open** to load a note, or just start typing and hit **Save**.",
    dirty: false
  });
  const [notes, setNotes] = useState<TyporaNote[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [toast, setToast] = useState<{
    msg: string;
    type: "success" | "error";
  } | null>(null);
  const [showOpen, setShowOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showPatDialog, setShowPatDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const editorRef = useRef<EditorHandle | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingSaveRef = useRef<string | null>(null);
  const { setTyporaMd } = useStore((state) => ({ setTyporaMd: state.setTyporaMd }));
  const typoraMd = useStore((state) => state.typoraMd);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const title = doc.note ? doc.note.title : doc.localTitle || "Untitled";

  const handleNew = useCallback(() => {
    const empty = "";
    setDoc({ note: null, localTitle: undefined, content: empty, dirty: false });
    editorRef.current?.setContent(empty);
    setTyporaMd(empty);
  }, [setTyporaMd]);

  const handleOpenClick = useCallback(async () => {
    setShowOpen(true);
    setLoadingList(true);
    const list = await listNotes();
    setNotes(list);
    setLoadingList(false);
  }, []);

  const handleOpenLocal = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  const loadFile = useCallback(
    (file: File) => {
      setLoading(true);
      const reader = new FileReader();
      reader.onload = () => {
        const content = reader.result as string;
        const name = file.name.replace(/\.(md|markdown|txt)$/i, "");
        setDoc({ note: null, localTitle: name, content, dirty: false });
        editorRef.current?.setContent(content);
        setTyporaMd(content);
        setToast({ msg: `Opened ${name}`, type: "success" });
        setLoading(false);
      };
      reader.onerror = () => {
        setToast({ msg: "Failed to open file", type: "error" });
        setLoading(false);
      };
      reader.readAsText(file);
    },
    [setTyporaMd]
  );

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      loadFile(file);
      e.target.value = "";
    },
    [loadFile]
  );

  const isAcceptedFile = (file: File): boolean => /\.(md|markdown|txt)$/i.test(file.name);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.types.includes("Files")) {
      setDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setDragOver(false);
    }
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (!file) return;
      if (!isAcceptedFile(file)) {
        setToast({ msg: "Only .md / .markdown / .txt supported", type: "error" });
        return;
      }
      loadFile(file);
    },
    [loadFile]
  );

  const handlePick = useCallback(
    async (note: TyporaNote) => {
      setShowOpen(false);
      setLoading(true);
      try {
        const content = await getNoteContent(note.file);
        if (content === null) {
          setToast({ msg: "Failed to load note", type: "error" });
          return;
        }
        setDoc({ note, localTitle: undefined, content, dirty: false });
        editorRef.current?.setContent(content);
        setTyporaMd(content);
      } catch {
        setToast({ msg: "Failed to load note", type: "error" });
      } finally {
        setLoading(false);
      }
    },
    [setTyporaMd]
  );

  const performSave = useCallback(
    async (filename?: string) => {
      setSaving(true);
      setLoading(true);
      try {
        if (doc.note) {
          const ok = await saveNote(doc.note, doc.content);
          if (ok) {
            setDoc((d) => ({ ...d, dirty: false }));
            setToast({ msg: "Saved", type: "success" });
          } else {
            setToast({ msg: "Save failed", type: "error" });
          }
        } else if (filename) {
          const note = await createNote(filename, doc.content);
          if (note) {
            setDoc({ note, content: doc.content, dirty: false });
            setToast({ msg: "Saved", type: "success" });
          } else {
            setToast({ msg: "Save failed", type: "error" });
          }
        }
      } finally {
        setSaving(false);
        setLoading(false);
      }
    },
    [doc]
  );

  const doSave = useCallback(
    async (filename?: string) => {
      if (!getPat()) {
        setShowPatDialog(true);
        pendingSaveRef.current = filename || null;
        return;
      }
      await performSave(filename);
    },
    [doc, performSave]
  );

  const handleSaveClick = useCallback(() => {
    if (doc.note) {
      doSave();
      return;
    }
    setShowSaveDialog(true);
  }, [doc, doSave]);

  const handlePatConfirm = useCallback(
    (pat: string) => {
      setPat(pat);
      setShowPatDialog(false);
      const fname = pendingSaveRef.current;
      pendingSaveRef.current = null;
      performSave(fname ?? undefined);
    },
    [performSave]
  );

  const handleSaveDialogConfirm = useCallback(
    (filename: string) => {
      setShowSaveDialog(false);
      doSave(filename);
    },
    [doSave]
  );

  const handleRename = useCallback(
    async (newTitle: string) => {
      if (doc.note) {
        setSaving(true);
        setLoading(true);
        try {
          const ok = await renameNote(doc.note, newTitle);
          if (ok) {
            setDoc((d) => ({
              ...d,
              note: d.note ? { ...d.note, title: newTitle } : null
            }));
            setToast({ msg: "Renamed", type: "success" });
          } else {
            setToast({ msg: "Rename failed", type: "error" });
          }
        } finally {
          setSaving(false);
          setLoading(false);
        }
        return;
      }
      setDoc((d) => ({ ...d, localTitle: newTitle }));
      setToast({ msg: "Renamed", type: "success" });
    },
    [doc.note]
  );

  const handleDownload = useCallback(() => {
    const name = doc.note ? doc.note.title : doc.localTitle || "untitled";
    const filename = `${name}.md`;
    const blob = new Blob([doc.content], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setToast({ msg: "Downloaded", type: "success" });
  }, [doc]);

  const handleContentChange = useCallback((md: string) => {
    setDoc((d) => ({ ...d, content: md, dirty: d.content !== md }));
  }, []);

  useEffect(() => {
    if (typoraMd !== doc.content) {
      handleContentChange(typoraMd);
    }
  }, [typoraMd, doc.content, handleContentChange]);

  const openRenameDialog = useCallback(() => {
    const current = doc.note ? doc.note.title : doc.localTitle || "";
    if (!current) return;
    setRenameValue(current);
    setShowRenameDialog(true);
  }, [doc.note, doc.localTitle]);

  const handleRenameConfirm = useCallback(
    (newTitle: string) => {
      setShowRenameDialog(false);
      const trimmed = newTitle.trim();
      if (trimmed) handleRename(trimmed);
    },
    [handleRename]
  );

  return {
    doc,
    notes,
    loadingList,
    saving,
    loading,
    dragOver,
    toast,
    showOpen,
    showSaveDialog,
    showPatDialog,
    showRenameDialog,
    renameValue,
    title,
    editorRef,
    fileInputRef,
    handleNew,
    handleOpenClick,
    handleOpenLocal,
    handleFileChange,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handlePick,
    handleSaveClick,
    handleSaveDialogConfirm,
    handlePatConfirm,
    openRenameDialog,
    handleRenameConfirm,
    handleDownload,
    setShowOpen,
    setShowSaveDialog,
    setShowPatDialog,
    setShowRenameDialog
  };
};
