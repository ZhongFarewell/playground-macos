import React from "react";
import { useAppMenus } from "~/hooks/useAppMenus";
import PhotoCell from "./PhotoCell";
import PhotoViewer from "./PhotoViewer";
import { usePhotosState } from "./usePhotosState";
import { buildMenus, menuDeps } from "./menus";

// 用 memo 包裹并自定义比较：忽略 width prop（Photos 不使用 width，但 AppWindow 全屏切换会注入新 width 触发重渲染）
const Photos = React.memo(
  function Photos() {
    const s = usePhotosState();

    useAppMenus("photos", () => buildMenus(s), menuDeps(s));

    return (
      <div className="size-full bg-white dark:bg-zinc-900 flex flex-col overflow-hidden">
        {/* 顶部工具栏 */}
        <div className="h-10 px-4 flex items-center justify-between border-b border-gray-200 dark:bg-zinc-700 shrink-0">
          <div className="text-sm font-semibold text-gray-700 dark:text-gray-200">
            Photos
          </div>
          <div className="flex items-center gap-3">
            <div className="text-xs text-gray-400">
              {s.photos.length > 0 ? `${s.photos.length} items` : ""}
            </div>
          </div>
        </div>

        {/* 主区 */}
        <div className="flex-1 overflow-y-auto">
          {s.loading ? (
            <div className="size-full flex-center">
              <span className="i-bi:arrow-repeat animate-spin text-3xl text-gray-400" />
            </div>
          ) : s.error ? (
            <div className="size-full flex-center flex-col text-gray-400">
              <span className="i-bi:exclamation-circle text-4xl mb-3" />
              <span className="text-sm mb-4">{s.error}</span>
              <button
                className="px-4 py-1.5 rounded-md text-sm text-white bg-blue-500 hover:bg-blue-600 active:bg-blue-700 transition-colors"
                onClick={() => s.fetchPhotos()}
              >
                Try Again
              </button>
            </div>
          ) : s.photos.length === 0 ? (
            <div className="size-full flex-center flex-col text-gray-400">
              <span className="i-bi:images text-5xl mb-3" />
              <span className="text-sm">No photos</span>
            </div>
          ) : (
            <div
              className="grid gap-1.5 p-3"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))" }}
            >
              {s.sortedPhotos.map((p, i) => (
                <PhotoCell
                  key={p.value + i}
                  item={p}
                  index={i}
                  onOpen={s.setActiveIdx}
                  onSetWallpaper={s.handleSetWallpaper}
                  onExport={s.handleExport}
                />
              ))}
            </div>
          )}
        </div>

        {/* 大图查看器 */}
        <PhotoViewer
          photos={s.sortedPhotos}
          activeIdx={s.activeIdx}
          onClose={() => s.setActiveIdx(null)}
          onNavigate={s.setActiveIdx}
          imgLoaded={s.imgLoaded}
          imgError={s.imgError}
          imgFileSize={s.imgFileSize}
          zoom={s.zoom}
          pan={s.pan}
          panRef={s.panRef}
          imgContainerRef={s.imgContainerRef}
          setImgLoaded={s.setImgLoaded}
          setImgError={s.setImgError}
          setZoom={s.setZoom}
          setPan={s.setPan}
        />
      </div>
    );
  },
  () => true
);

export default Photos;
