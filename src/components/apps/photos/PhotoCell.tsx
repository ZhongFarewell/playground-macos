import React from "react";
import { photoUrl, photoThumbUrl } from "~/services";
import { useContextMenu } from "~/hooks/useContextMenu";
import type { PhotoItem } from "./types";

interface PhotoCellProps {
  item: PhotoItem;
  index: number;
  onOpen: (i: number) => void;
  onSetWallpaper: (filename: string) => void;
  onExport: (filename: string) => void;
}

/**
 * 单个图片格子，处理缩略图加载失败的回退。
 * 缩略图 404（历史图片未生成 thumb）→ 回退到原图 → 原图也失败显示占位图标。
 * 右键菜单：Set as Wallpaper / Copy Image Address / Export（对齐 macOS Photos）。
 */
const PhotoCell = React.memo(function PhotoCell({
  item,
  index,
  onOpen,
  onSetWallpaper,
  onExport
}: PhotoCellProps) {
  const [src, setSrc] = useState<string | null>(() => photoThumbUrl(item.value));
  const [failed, setFailed] = useState(false);

  const handleError = () => {
    if (src === photoThumbUrl(item.value)) {
      setSrc(photoUrl(item.value));
    } else {
      setFailed(true);
    }
  };

  const cellRef = useContextMenu(
    (_ctx, collector) => {
      collector.add(
        { label: "Set as Wallpaper", onClick: () => onSetWallpaper(item.value) },
        { separator: true },
        {
          label: "Copy Image Address",
          onClick: () =>
            navigator.clipboard?.writeText(window.location.origin + photoUrl(item.value))
        },
        { label: "Export…", onClick: () => onExport(item.value) }
      );
    },
    [item.value, onSetWallpaper, onExport]
  );

  return (
    <div
      ref={cellRef as any}
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

export default PhotoCell;
