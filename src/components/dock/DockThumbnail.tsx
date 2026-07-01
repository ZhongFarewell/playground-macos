import React from "react";
import { motion, type MotionValue } from "framer-motion";
import { useDockHoverAnimation } from "./DockItem";

interface DockThumbnailProps {
  id: string;
  title: string;
  img: string;
  mouseX: MotionValue;
  openApp: (id: string) => void;
  dockSize: number;
  dockMag: number;
  /** 窗口原始宽高比（width/height），保留供未来 C 方案（live 缩略图）使用 */
  aspectRatio: number;
}

/**
 * Dock 右侧分隔线后的最小化窗口缩略图（B 方案：图标占位，无内容预览）。
 *
 * B 方案下缩略图就是 app 图标，尺寸/放大行为和左侧 DockItem 完全一致，
 * 因此间距也和左侧 app 图标一致（由 <ul> 的 space-x-2 统一控制）。
 * aspectRatio 当前未用于视觉，保留 prop 供未来 C 方案（按窗口比例的 live 缩略图）使用。
 *
 * - 接入 magnification，鼠标悬停时和 DockItem 一样放大
 * - 点击调 openApp 恢复窗口
 * - id=`dock-thumb-${id}` 供 Desktop.minimizeApp 计算窗口 transform 的目标坐标
 */
export default function DockThumbnail({
  id,
  title,
  img,
  mouseX,
  openApp,
  dockSize,
  dockMag,
  aspectRatio
}: DockThumbnailProps) {
  void aspectRatio;
  const imgRef = useRef<HTMLImageElement>(null);

  const { width } = useDockHoverAnimation(mouseX, imgRef, dockSize, dockMag, dockSize);

  const { winWidth } = useWindowSize();

  return (
    <li
      id={`dock-thumb-${id}`}
      onClick={() => openApp(id)}
      className="relative flex flex-col justify-end mb-1 cursor-pointer"
    >
      <p
        className="tooltip absolute inset-x-0 mx-auto w-max rounded-md bg-c-300/80"
        p="x-3 y-1"
        text="sm c-black"
      >
        {title}
      </p>
      <motion.img
        ref={imgRef}
        src={img}
        alt={title}
        title={title}
        draggable={false}
        style={
          winWidth < 640
            ? { width: `${dockSize / 16}rem` }
            : { width, willChange: "width" }
        }
      />
      {/* 占位元素：对齐 DockItem 底部的指示点高度，让缩略图图标与左侧 app 图标在同一基线 */}
      <div className="size-1 mx-auto invisible" />
    </li>
  );
}
