import { useMotionValue } from "framer-motion";
import { apps } from "~/configs";
import DockThumbnail from "./DockThumbnail";
import DockTrash from "./DockTrash";

interface DockProps {
  open: (id: string) => void;
  showApps: {
    [key: string]: boolean;
  };
  minApps: {
    [key: string]: boolean;
  };
  showLaunchpad: boolean;
  toggleLaunchpad: (target: boolean) => void;
  hide: boolean;
}

export default function Dock({
  open,
  showApps,
  minApps,
  showLaunchpad,
  toggleLaunchpad,
  hide
}: DockProps) {
  const { dockSize, dockMag } = useStore((state) => ({
    dockSize: state.dockSize,
    dockMag: state.dockMag
  }));

  const openApp = (id: string) => {
    if (id === "launchpad") toggleLaunchpad(!showLaunchpad);
    else {
      toggleLaunchpad(false);
      open(id);
    }
  };

  const mouseX = useMotionValue<number | null>(null);

  // 最小化窗口列表：从 apps 中筛出 desktop 且 minApps[id] 为 true 的项
  // 排除 hideFromDock（settings/trash 等）：这些 app 不在 Dock 显示，最小化时无缩略图
  const minimizedApps = apps.filter(
    (app) => app.desktop && !app.hideFromDock && minApps[app.id]
  );

  return (
    <div
      className={`dock fixed inset-x-0 mx-auto bottom-1 ${hide ? "z-0" : "z-50"}`}
      w="full sm:max"
      overflow="x-scroll sm:x-visible"
    >
      <ul
        className="flex space-x-2 px-2 backdrop-blur-2xl bg-c-white/20"
        border="~ c-400/40 rounded-none sm:rounded-xl"
        onMouseMove={(e) => mouseX.set(e.nativeEvent.x)}
        onMouseLeave={() => mouseX.set(null)}
        style={{
          height: `${(dockSize + 15) / 16}rem`
        }}
      >
        {apps
          .filter((app) => !app.hideFromDock)
          .map((app) => (
            <DockItem
              key={`dock-${app.id}`}
              id={app.id}
              title={app.title}
              img={app.img}
              mouseX={mouseX}
              desktop={app.desktop}
              openApp={openApp}
              isOpen={app.desktop && showApps[app.id]}
              link={app.link}
              dockSize={dockSize}
              dockMag={dockMag}
            />
          ))}

        {/* 分隔线：macOS Dock 在应用图标与文件/Trash 之间的竖线，始终存在 */}
        <li
          className="flex items-center justify-center self-stretch"
          style={{ width: "2px", margin: "0 4px" }}
          aria-hidden
        >
          <div
            className="bg-gray-500/60 dark:bg-gray-200/60"
            style={{ width: "1px", height: `${(dockSize * 0.7) / 16}rem` }}
          />
        </li>

        {/* 最小化窗口缩略图区（macOS 经典行为：缩略图显示在分隔线右侧） */}
        {minimizedApps.map((app) => {
          // 窗口原始比例：宽/高。无 width/height 的 app（如 Terminal）用默认 4/3
          const w = app.width ?? 640;
          const h = app.height ?? 480;
          return (
            <DockThumbnail
              key={`dock-thumb-${app.id}`}
              id={app.id}
              title={app.title}
              img={app.img}
              mouseX={mouseX}
              openApp={openApp}
              dockSize={dockSize}
              dockMag={dockMag}
              aspectRatio={w / h}
            />
          );
        })}

        {/* Trash：Dock 最右侧固定项 */}
        <DockTrash
          mouseX={mouseX}
          openApp={openApp}
          dockSize={dockSize}
          dockMag={dockMag}
          isOpen={showApps["trash"]}
        />
      </ul>
    </div>
  );
}
