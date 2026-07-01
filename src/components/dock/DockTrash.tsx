import React from "react";
import { motion, type MotionValue } from "framer-motion";
import { useDockHoverAnimation } from "./DockItem";
import { getEntry, trashEntry } from "~/services/finder";

interface DockTrashProps {
  mouseX: MotionValue;
  openApp: (id: string) => void;
  dockSize: number;
  dockMag: number;
  /** Trash 窗口是否已打开 */
  isOpen: boolean;
}

/**
 * Dock 最右侧的 Trash 图标（macOS 固定行为）。
 * 使用 trash.png（macOS 金属垃圾桶风格），结构和 DockItem 完全一致：
 * 裸 <motion.img> 绑定 width，响应 magnification。
 * 点击 openApp('trash') 打开 Trash 窗口。
 * 支持拖拽：Finder 里的文件/文件夹拖到 Trash 图标触发 trashEntry。
 */
export default function DockTrash({
  mouseX,
  openApp,
  dockSize,
  dockMag,
  isOpen
}: DockTrashProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const { width } = useDockHoverAnimation(mouseX, imgRef, dockSize, dockMag);
  const { winWidth } = useWindowSize();
  const [dragOver, setDragOver] = useState(false);

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const draggedId = e.dataTransfer.getData("text/finder-entry-id");
    if (!draggedId) return;
    const entry = await getEntry(draggedId);
    if (entry && !entry.trashed) {
      await trashEntry(entry);
    }
  };

  return (
    <li
      id="dock-trash"
      onClick={() => openApp("trash")}
      onDragOver={(e) => {
        // 接收 Finder 内部拖拽和本地文件拖拽
        if (
          e.dataTransfer.types.includes("text/finder-entry-id") ||
          e.dataTransfer.types.includes("files")
        ) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDragEnter={() => setDragOver(true)}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`relative flex flex-col justify-end mb-1 cursor-pointer transition-transform ${
        dragOver ? "scale-125 -translate-y-1" : ""
      }`}
    >
      <p
        className="tooltip absolute inset-x-0 mx-auto w-max rounded-md bg-c-300/80"
        p="x-3 y-1"
        text="sm c-black"
      >
        Trash
      </p>
      <motion.img
        ref={imgRef}
        src="img/icons/trash.png"
        alt="Trash"
        title="Trash"
        draggable={false}
        style={winWidth < 640 ? {} : { width, willChange: "width" }}
      />
      <div
        className={`size-1 mx-auto rounded-full bg-c-800 ${isOpen ? "" : "invisible"}`}
      />
    </li>
  );
}
