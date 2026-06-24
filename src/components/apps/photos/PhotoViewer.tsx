import { motion, AnimatePresence } from "framer-motion";
import { photoUrl } from "~/services";
import { formatFileSize, type PhotoItem } from "./types";

interface PhotoViewerProps {
  photos: PhotoItem[];
  activeIdx: number | null;
  onClose: () => void;
  onNavigate: (idx: number) => void;
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
  setImgLoaded: (v: boolean) => void;
  setImgError: (v: boolean) => void;
  setZoom: (v: number | ((z: number) => number)) => void;
  setPan: (v: { x: number; y: number }) => void;
}

/**
 * 全屏大图查看器。对齐 macOS Photos 的大图浏览：
 * ← → 切换、ESC 关闭、滚轮/双击缩放、拖拽平移、底部信息栏 + 缩放滑块。
 */
const PhotoViewer = ({
  photos,
  activeIdx,
  onClose,
  onNavigate,
  imgLoaded,
  imgError,
  imgFileSize,
  zoom,
  pan,
  panRef,
  imgContainerRef,
  setImgLoaded,
  setImgError,
  setZoom,
  setPan
}: PhotoViewerProps) => {
  if (activeIdx === null || !photos[activeIdx]) return null;

  return (
    <AnimatePresence>
      <motion.div
        ref={imgContainerRef}
        className="absolute inset-0 z-50 bg-black flex-center overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        onClick={onClose}
      >
        {/* 左切换 */}
        {activeIdx > 0 && (
          <button
            className="absolute left-4 top-1/2 -translate-y-1/2 size-10 flex-center rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(activeIdx - 1);
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
                src={photoUrl(photos[activeIdx].value)}
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
                  setZoom((z: number) => (z > 1 ? 1 : 2));
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
                  const img = e.currentTarget;
                  const maxX = (img.offsetWidth * (zoom - 1)) / 2;
                  const maxY = (img.offsetHeight * (zoom - 1)) / 2;
                  let nx = panRef.current.baseX + (e.clientX - panRef.current.startX);
                  let ny = panRef.current.baseY + (e.clientY - panRef.current.startY);
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
        {activeIdx < photos.length - 1 && (
          <button
            className="absolute right-4 top-1/2 -translate-y-1/2 size-10 flex-center rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
            onClick={(e) => {
              e.stopPropagation();
              onNavigate(activeIdx + 1);
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
            onClose();
          }}
        >
          <span className="i-bi:x-lg" />
        </button>

        {/* 底部信息栏 + 缩放滑块 */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-xs text-white/70 bg-black/50 backdrop-blur px-4 py-1.5 rounded-full max-w-[90%] whitespace-nowrap">
            {photos[activeIdx]?.memory?.time && (
              <span>
                {new Date(parseInt(photos[activeIdx].memory.time)).toLocaleString()}
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
                onClick={() =>
                  setZoom((z: number) => Math.min(5, +(z + 0.25).toFixed(2)))
                }
              >
                <span className="i-bi:plus text-sm" />
              </button>
              <span className="w-10 text-center">{Math.round(zoom * 100)}%</span>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PhotoViewer;
