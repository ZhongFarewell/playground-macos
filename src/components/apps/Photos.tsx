import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { getPhotoList, photoUrl, photoThumbUrl } from "~/services";

interface PhotosProps {
  width?: number;
}

interface PhotoItem {
  value: string; // 文件名
  memory?: { title?: string; [k: string]: any };
}

/** 格式化文件大小，与 macOS Finder 一致：KB / MB */
const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};
/**
 * 单个图片格子，处理缩略图加载失败的回退。
 * 缩略图 404（历史图片未生成 thumb）→ 回退到原图 → 原图也失败显示占位图标。
 */
const PhotoCell = React.memo(function PhotoCell({
  item,
  index,
  onOpen
}: {
  item: PhotoItem;
  index: number;
  onOpen: (i: number) => void;
}) {
  // src 状态：缩略图 → 原图 → 失败
  const [src, setSrc] = useState<string | null>(() => photoThumbUrl(item.value));
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (src === photoThumbUrl(item.value)) {
      // 缩略图失败，回退到原图
      setSrc(photoUrl(item.value));
    } else {
      // 原图也失败
      setFailed(true);
    }
  };

  return (
    <div
      className="aspect-square overflow-hidden rounded cursor-pointer bg-gray-100 dark:bg-zinc-800 transition-transform duration-150 hover:scale-[0.98] flex-center"
      style={{
        contentVisibility: "auto",
        containIntrinsicSize: "120px 120px"
      }}
      onClick={() => onOpen(index)}
    >
      {failed ? (
        <span className="i-bi:image text-2xl text-gray-300 dark:text-zinc-600" />
      ) : (
        src && (
          <img
            src={src}
            alt={item.memory?.title || ""}
            className="size-full object-cover"
            loading="lazy"
            decoding="async"
            onError={handleError}
          />
        )
      )}
    </div>
  );
});

// 用 memo 包裹并自定义比较：忽略 width prop（Photos 不使用 width，但 AppWindow 全屏切换会注入新 width 触发重渲染）
const Photos = React.memo(
  function Photos({ width }: PhotosProps) {
    const [photos, setPhotos] = useState<PhotoItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeIdx, setActiveIdx] = useState<number | null>(null);
    // 排序方向：desc = 新→旧（默认，与 macOS Photos 一致），asc = 旧→新
    const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
    const [sortMenuOpen, setSortMenuOpen] = useState(false);
    // 大图查看器的原图加载状态：切换图片时重置为 false，onLoad 后置 true
    const [imgLoaded, setImgLoaded] = useState(false);
    const [imgError, setImgError] = useState(false);
    // 当前大图的文件大小（字节），通过 fetch HEAD 的 Content-Length 获取
    const [imgFileSize, setImgFileSize] = useState<number | null>(null);
    // 大图缩放比例：1 = 适应窗口，>1 放大。切换图片时重置为 1
    const [zoom, setZoom] = useState(1);
    // 拖拽平移偏移量（缩放 >1 时拖动查看图片不同区域）
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const panRef = useRef({ dragging: false, startX: 0, startY: 0, baseX: 0, baseY: 0 });
    // 大图容器 ref，用于滚动缩放时阻止页面滚动
    const imgContainerRef = useRef<HTMLDivElement>(null);
    // 用 ref 保存最新的 zoom/imgLoaded 供 wheel 事件读取（避免监听器频繁重建）
    const zoomRef = useRef(zoom);
    const imgLoadedRef = useRef(imgLoaded);
    zoomRef.current = zoom;
    imgLoadedRef.current = imgLoaded;

    // 拉取图片列表（抽成函数供重试调用；signal 用于 effect 卸载时中止请求，
    // 避免 React 18 StrictMode 开发模式双挂载导致的重复请求）
    const fetchPhotos = useCallback((signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      getPhotoList({ pageNo: 1, pageSize: 9999 }, signal)
        .then((res) => {
          const list = res?.data?.data || [];
          setPhotos(list);
        })
        .catch((err) => {
          // abort 导致的错误不算业务错误
          if (err?.name === "CanceledError" || signal?.aborted) return;
          setError("Unable to load photos");
        })
        .finally(() => {
          if (signal?.aborted) return;
          setLoading(false);
        });
    }, []);

    // 首次挂载加载
    useEffect(() => {
      const controller = new AbortController();
      fetchPhotos(controller.signal);
      return () => controller.abort();
    }, [fetchPhotos]);

    // 切换大图时重置加载状态与错误状态
    useEffect(() => {
      if (activeIdx !== null) {
        setImgLoaded(false);
        setImgError(false);
        setImgFileSize(null);
        setZoom(1);
        setPan({ x: 0, y: 0 });
      }
    }, [activeIdx]);

    // 滚动缩放：向上滚放大、向下滚缩小，以图片中心为锚点。
    // 用原生事件 + non-passive 以便 preventDefault 阻止页面滚动。
    useEffect(() => {
      if (activeIdx === null) return;
      const el = imgContainerRef.current;
      if (!el) return;
      const onWheel = (e: WheelEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (!imgLoadedRef.current) return;
        const oldZoom = zoomRef.current;
        // 滚轮 deltaY < 0 向上 = 放大，> 0 向下 = 缩小
        const delta = e.deltaY < 0 ? 1.15 : 1 / 1.15;
        const newZoom = Math.max(1, Math.min(5, oldZoom * delta));
        setZoom(newZoom);
        // 缩小回 100% 时重置 pan，让图片居中
        if (newZoom === 1) setPan({ x: 0, y: 0 });
      };
      el.addEventListener("wheel", onWheel, { passive: false });
      return () => el.removeEventListener("wheel", onWheel);
    }, [activeIdx]);

    // 按 sortOrder 排序图片（时间降序 = 新→旧，升序 = 旧→新）
    // 注意：比较用函数封装，避免裸标识符被 UnoCSS attributify 误解析
    const isDesc = sortOrder === "desc";
    const cmp = (x: number, y: number) => (x > y ? 1 : x < y ? -1 : 0);
    const sortedPhotos = useMemo(() => {
      return [...photos].sort((a, b) => {
        const ta = Number(a.memory?.time) || 0;
        const tb = Number(b.memory?.time) || 0;
        return isDesc ? cmp(tb, ta) : cmp(ta, tb);
      });
    }, [photos, isDesc]);

    // 获取当前大图的文件大小（fetch HEAD 读取 Content-Length）
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

    // 大图键盘导航：← → 切换、ESC 关闭
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

    return (
      <div className="size-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="h-10 px-4 flex items-center justify-between border-b border-gray-200 dark:bg-zinc-700 shrink-0">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Photos
          </div>
          <div className="flex items-center gap-3">
            {photos.length > 0 && (
              <div className="relative">
                <button
                  className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300 hover:text-gray-700 dark:hover:text-gray-100 transition-colors"
                  onClick={() => setSortMenuOpen((v) => !v)}
                >
                  <span className="i-bi:sort-down text-sm" />
                  <span>{sortOrder === "desc" ? "Newest First" : "Oldest First"}</span>
                </button>
                {sortMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setSortMenuOpen(false)}
                    />
                    <div className="absolute right-0 top-full mt-1 z-50 bg-white dark:bg-zinc-800 rounded-md shadow-lg border border-gray-200 dark:border-zinc-700 py-1 min-w-[140px]">
                      <button
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center justify-between ${
                          sortOrder === "desc"
                            ? "text-blue-500"
                            : "text-gray-700 dark:text-gray-200"
                        }`}
                        onClick={() => {
                          setSortOrder("desc");
                          setSortMenuOpen(false);
                        }}
                      >
                        <span>Newest First</span>
                        {sortOrder === "desc" && <span className="i-bi:check text-xs" />}
                      </button>
                      <button
                        className={`w-full text-left px-3 py-1.5 text-xs hover:bg-gray-100 dark:hover:bg-zinc-700 flex items-center justify-between ${
                          sortOrder === "asc"
                            ? "text-blue-500"
                            : "text-gray-700 dark:text-gray-200"
                        }`}
                        onClick={() => {
                          setSortOrder("asc");
                          setSortMenuOpen(false);
                        }}
                      >
                        <span>Oldest First</span>
                        {sortOrder === "asc" && <span className="i-bi:check text-xs" />}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
            <div className="text-xs text-gray-400">
              {photos.length > 0 ? `${photos.length} items` : ""}
            </div>
          </div>
        </div>

        {/* 主区 */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="size-full flex-center">
              <span className="i-bi:arrow-repeat animate-spin text-3xl text-gray-400" />
            </div>
          ) : error ? (
            <div className="size-full flex-center flex-col text-gray-400">
              <span className="i-bi:exclamation-circle text-4xl mb-3" />
              <span className="text-sm mb-4">{error}</span>
              <button
                className="px-4 py-1.5 rounded-md text-sm text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors"
                onClick={() => fetchPhotos()}
              >
                Try Again
              </button>
            </div>
          ) : photos.length === 0 ? (
            <div className="size-full flex-center flex-col text-gray-400">
              <span className="i-bi:images text-5xl mb-3" />
              <span className="text-sm">No photos</span>
            </div>
          ) : (
            <div
              className="grid gap-1.5 p-3"
              style={{
                gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))"
              }}
            >
              {sortedPhotos.map((p, i) => (
                <PhotoCell key={p.value + i} item={p} index={i} onOpen={setActiveIdx} />
              ))}
            </div>
          )}
        </div>

        {/* 大图查看器 */}
        <AnimatePresence>
          {activeIdx !== null && sortedPhotos[activeIdx] && (
            <motion.div
              ref={imgContainerRef}
              className="absolute inset-0 z-50 bg-black flex-center overflow-hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setActiveIdx(null)}
            >
              {/* 左切换 */}
              {activeIdx > 0 && (
                <button
                  className="absolute left-4 top-1/2 -translate-y-1/2 size-10 flex-center rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIdx(activeIdx - 1);
                  }}
                >
                  <span className="i-bi:chevron-left text-2xl" />
                </button>
              )}

              {/* 大图 */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeIdx}
                  className="relative flex-center size-full p-8"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* 加载中 spinner：原图未加载完毕时显示 */}
                  {!imgLoaded && !imgError && (
                    <span className="absolute i-bi:arrow-repeat animate-spin text-4xl text-white/60" />
                  )}
                  {imgError ? (
                    <div
                      className="flex-center flex-col text-white/40"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <span className="i-bi:image text-5xl mb-2" />
                      <span className="text-sm">Image failed to load</span>
                    </div>
                  ) : (
                    <motion.img
                      src={photoUrl(sortedPhotos[activeIdx].value)}
                      alt=""
                      className="max-w-full max-h-full object-contain rounded shadow-2xl select-none"
                      style={{
                        opacity: imgLoaded ? 1 : 0,
                        transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                        transformOrigin: "center center",
                        cursor:
                          zoom > 1
                            ? panRef.current.dragging
                              ? "grabbing"
                              : "grab"
                            : "default",
                        // 拖拽时关闭 transition 避免跟手延迟，滚轮缩放/双击时保留过渡
                        transition: panRef.current.dragging
                          ? "none"
                          : "transform 150ms ease-out"
                      }}
                      draggable={false}
                      onLoad={() => setImgLoaded(true)}
                      onError={() => setImgError(true)}
                      onDoubleClick={(e) => {
                        if (!imgLoaded) return;
                        e.stopPropagation();
                        setZoom((z) => (z > 1 ? 1 : 2));
                        setPan({ x: 0, y: 0 });
                      }}
                      onMouseDown={(e) => {
                        if (!imgLoaded || zoom <= 1) return;
                        e.stopPropagation();
                        panRef.current = {
                          dragging: true,
                          startX: e.clientX,
                          startY: e.clientY,
                          baseX: pan.x,
                          baseY: pan.y
                        };
                      }}
                      onMouseMove={(e) => {
                        if (!panRef.current.dragging) return;
                        // 限制拖拽范围：图片边缘不能拖进容器内部（不留空白）
                        // 最大偏移 = (缩放后尺寸 - 原始尺寸) / 2
                        const img = e.currentTarget;
                        const maxX = (img.offsetWidth * (zoom - 1)) / 2;
                        const maxY = (img.offsetHeight * (zoom - 1)) / 2;
                        let nx =
                          panRef.current.baseX + (e.clientX - panRef.current.startX);
                        let ny =
                          panRef.current.baseY + (e.clientY - panRef.current.startY);
                        nx = Math.max(-maxX, Math.min(maxX, nx));
                        ny = Math.max(-maxY, Math.min(maxY, ny));
                        setPan({ x: nx, y: ny });
                      }}
                      onMouseUp={() => {
                        panRef.current.dragging = false;
                      }}
                      onMouseLeave={() => {
                        panRef.current.dragging = false;
                      }}
                    />
                  )}
                </motion.div>
              </AnimatePresence>

              {/* 右切换 */}
              {activeIdx < sortedPhotos.length - 1 && (
                <button
                  className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex-center rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIdx(activeIdx + 1);
                  }}
                >
                  <span className="i-bi:chevron-right text-2xl" />
                </button>
              )}

              {/* 顶部关闭按钮 */}
              <button
                className="absolute top-3 right-3 size-8 flex-center rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveIdx(null);
                }}
              >
                <span className="i-bi:x-lg" />
              </button>

              {/* 底部信息栏 + 缩放滑块（与 macOS Quick Look 一致） */}
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                <div className="flex items-center gap-2 text-xs text-white/70 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full max-w-[90%] whitespace-nowrap">
                  {sortedPhotos[activeIdx]?.memory?.time && (
                    <span>
                      {new Date(
                        parseInt(sortedPhotos[activeIdx].memory.time)
                      ).toLocaleString()}
                    </span>
                  )}
                  {imgFileSize !== null && (
                    <>
                      <span className="text-white/30">·</span>
                      <span>{formatFileSize(imgFileSize)}</span>
                    </>
                  )}
                </div>
                {imgLoaded && (
                  <div
                    className="flex items-center gap-2 text-xs text-white/70 bg-black/50 backdrop-blur px-3 py-1.5 rounded-full"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      className="size-5 flex-center rounded-full hover:bg-white/20"
                      onClick={() => {
                        const z = Math.max(1, +(zoom - 0.25).toFixed(2));
                        setZoom(z);
                        if (z === 1) setPan({ x: 0, y: 0 });
                      }}
                    >
                      <span className="i-bi:dash text-sm" />
                    </button>
                    <input
                      type="range"
                      min="1"
                      max="5"
                      step="0.25"
                      value={zoom}
                      onChange={(e) => {
                        const z = parseFloat(e.target.value);
                        setZoom(z);
                        if (z === 1) setPan({ x: 0, y: 0 });
                      }}
                      className="w-24 accent-white"
                    />
                    <button
                      className="size-5 flex-center rounded-full hover:bg-white/20"
                      onClick={() => setZoom((z) => Math.min(5, +(z + 0.25).toFixed(2)))}
                    >
                      <span className="i-bi:plus text-sm" />
                    </button>
                    <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  },
  // 自定义比较：永远不因 props 变化重渲染（内部 state 变化仍会触发）
  () => true
);

export default Photos;
