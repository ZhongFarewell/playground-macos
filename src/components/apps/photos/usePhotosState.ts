import { getPhotoList, photoUrl } from "~/services";
import { addPhotoWallpaper } from "~/services/wallpaper";
import type { PhotoItem } from "./types";

export interface PhotosState {
  photos: PhotoItem[];
  loading: boolean;
  error: string | null;
  activeIdx: number | null;
  sortOrder: "desc" | "asc";
  imgLoaded: boolean;
  imgError: boolean;
  imgFileSize: number | null;
  zoom: number;
  pan: { x: number; y: number };
  panRef: React.MutableRefObject<{
    dragging: boolean;
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  }>;
  imgContainerRef: React.RefObject<HTMLDivElement>;
  zoomRef: React.MutableRefObject<number>;
  imgLoadedRef: React.MutableRefObject<boolean>;
  sortedPhotos: PhotoItem[];
  fetchPhotos: (signal?: AbortSignal) => void;
  setActiveIdx: (v: number | null) => void;
  setSortOrder: (v: "desc" | "asc") => void;
  setImgLoaded: (v: boolean) => void;
  setImgError: (v: boolean) => void;
  setZoom: (v: number | ((z: number) => number)) => void;
  setPan: (v: { x: number; y: number }) => void;
  handleSetWallpaper: (filename: string) => void;
  handleExport: (filename: string) => void;
}

export const usePhotosState = (): PhotosState => {
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState<number | null>(null);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");

  const [imgLoaded, setImgLoaded] = useState(false);
  const [imgError, setImgError] = useState(false);
  const [imgFileSize, setImgFileSize] = useState<number | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0
  });
  const imgContainerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef(zoom);
  const imgLoadedRef = useRef(imgLoaded);
  zoomRef.current = zoom;
  imgLoadedRef.current = imgLoaded;

  const setWallpaper = useStore((s) => s.setWallpaper);
  const userWallpapers = useStore((s) => s.userWallpapers);
  const setUserWallpapers = useStore((s) => s.setUserWallpapers);

  // 内存里维护一份 wallpaper settings，供 addPhotoWallpaper 计算 next
  // 启动时 Desktop 已从 database 恢复 userWallpapers，这里以此为初值推导
  const handleSetWallpaper = useCallback(
    (filename: string) => {
      const url = photoUrl(filename);
      // 立即生效：更新 store 的当前壁纸
      setWallpaper(url);
      // 后台推送：更新 system:wallpaper 单例（current + photos 去重）
      const prev = { current: url, photos: userWallpapers };
      const next = addPhotoWallpaper(prev, url);
      setUserWallpapers(next.photos);
    },
    [setWallpaper, userWallpapers, setUserWallpapers]
  );

  const handleExport = useCallback((filename: string) => {
    const url = photoUrl(filename);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, []);

  const fetchPhotos = useCallback((signal?: AbortSignal) => {
    setLoading(true);
    setError(null);
    getPhotoList({ pageNo: 1, pageSize: 9999 }, signal)
      .then((res) => {
        const list = res?.data?.data || [];
        setPhotos(list);
      })
      .catch((err) => {
        if (err?.name === "CanceledError" || signal?.aborted) return;
        setError("Unable to load photos");
      })
      .finally(() => {
        if (signal?.aborted) return;
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchPhotos(controller.signal);
    return () => controller.abort();
  }, [fetchPhotos]);

  useEffect(() => {
    if (activeIdx !== null) {
      setImgLoaded(false);
      setImgError(false);
      setImgFileSize(null);
      setZoom(1);
      setPan({ x: 0, y: 0 });
    }
  }, [activeIdx]);

  useEffect(() => {
    if (activeIdx === null) return;
    const el = imgContainerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!imgLoadedRef.current) return;
      const oldZoom = zoomRef.current;
      const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(1, Math.min(5, oldZoom * delta));
      setZoom(newZoom);
      if (newZoom === 1) setPan({ x: 0, y: 0 });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [activeIdx]);

  const isDesc = sortOrder === "desc";
  const cmp = (x: number, y: number) => (x > y ? 1 : x < y ? -1 : 0);
  const sortedPhotos = useMemo(() => {
    return [...photos].sort((a, b) => {
      const ta = Number(a.memory?.time) || 0;
      const tb = Number(b.memory?.time) || 0;
      return isDesc ? cmp(tb, ta) : cmp(ta, tb);
    });
  }, [photos, isDesc]);

  useEffect(() => {
    if (activeIdx === null || !sortedPhotos[activeIdx]) return;
    const url = photoUrl(sortedPhotos[activeIdx].value);
    const controller = new AbortController();
    fetch(url, { method: "HEAD", signal: controller.signal })
      .then((res) => {
        const len = parseInt(res.headers.get("Content-Length") || "");
        if (!isNaN(len)) setImgFileSize(len);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [activeIdx, sortedPhotos]);

  useEffect(() => {
    if (activeIdx === null) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveIdx(null);
      else if (e.key === "ArrowLeft")
        setActiveIdx((i) => (i === null ? null : Math.max(0, i - 1)));
      else if (e.key === "ArrowRight")
        setActiveIdx((i) =>
          i === null ? null : Math.min(sortedPhotos.length - 1, i + 1)
        );
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeIdx, sortedPhotos.length]);

  return {
    photos,
    loading,
    error,
    activeIdx,
    sortOrder,
    imgLoaded,
    imgError,
    imgFileSize,
    zoom,
    pan,
    panRef,
    imgContainerRef,
    zoomRef,
    imgLoadedRef,
    sortedPhotos,
    fetchPhotos,
    setActiveIdx,
    setSortOrder,
    setImgLoaded,
    setImgError,
    setZoom,
    setPan,
    handleSetWallpaper,
    handleExport
  };
};
