import React from "react";
import wallpapers from "~/configs/wallpapers";
import { setCurrentWallpaper } from "~/services/wallpaper";
import type { WallpaperFit } from "~/stores/slices/system";

type FitOption = { value: WallpaperFit; label: string };

const FIT_OPTIONS: FitOption[] = [
  { value: "cover", label: "Fill Screen" },
  { value: "contain", label: "Fit to Screen" },
  { value: "stretch", label: "Stretch to Fill Screen" },
  { value: "center", label: "Center" }
];

interface UserPicture {
  id: string;
  url: string;
  name: string;
}

/** 当前壁纸的展示名 */
function currentWallpaperName(customWallpaper: string | null, dark: boolean): string {
  if (customWallpaper) {
    const builtin = wallpapers.builtins.find((w) => w.url === customWallpaper);
    if (builtin) return builtin.name;
    return "Custom";
  }
  return dark ? "Night" : "Day";
}

/** macOS Wallpaper 面板 */
const WallpaperPanel = React.memo(function WallpaperPanel() {
  const dark = useStore((s) => s.dark);
  const customWallpaper = useStore((s) => s.customWallpaper);
  const wallpaperFit = useStore((s) => s.wallpaperFit);
  const userWallpapers = useStore((s) => s.userWallpapers);
  const setWallpaper = useStore((s) => s.setWallpaper);
  const setWallpaperFit = useStore((s) => s.setWallpaperFit);
  const addPreloadedWallpaper = useStore((s) => s.addPreloadedWallpaper);

  // 用户自定义图片（仅当前会话，不持久化）
  const [userPictures, setUserPictures] = useState<UserPicture[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentUrl = customWallpaper ?? (dark ? wallpapers.night : wallpapers.day);
  const currentName = currentWallpaperName(customWallpaper, dark);

  // 是否选中 "随外观自动切换"（即 Light & Dark 对）
  const autoSelected = customWallpaper === null;

  // 统一入口：预加载新壁纸 → 加载完再 setWallpaper（避免流式加载）+ 推送 database
  const applyWallpaper = (url: string | null) => {
    if (!url) {
      // 切回默认壁纸（day/night 已在 boot 预加载，直接切换）
      setWallpaper(null);
      setCurrentWallpaper({ current: customWallpaper, photos: userWallpapers }, null);
      return;
    }
    // fetch 为 blob → createObjectURL，<img> 用 blob URL 不走网络
    fetch(url)
      .then((res) => res.blob())
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        addPreloadedWallpaper(url, blobUrl);
        setWallpaper(url);
        setCurrentWallpaper({ current: customWallpaper, photos: userWallpapers }, url);
      })
      .catch(() => {
        // 加载失败仍切换（用原始 URL，可能流式但状态一致）
        setWallpaper(url);
        setCurrentWallpaper({ current: customWallpaper, photos: userWallpapers }, url);
      });
  };

  const handleAddPicture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    const pic: UserPicture = {
      id: `${Date.now()}-${file.name}`,
      url,
      name: file.name.replace(/\.[^.]+$/, "")
    };
    setUserPictures((prev) => [pic, ...prev]);
    // 选中的同时设为当前壁纸（立即生效 + 推送 database）
    applyWallpaper(url);
    // 清空 input value 以便相同文件可再次选择
    e.target.value = "";
  };

  return (
    <div className="flex-1 overflow-y-auto px-7 py-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
        Wallpaper
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        Choose a desktop background.
      </p>

      {/* 顶部：当前壁纸大预览 + 填充方式下拉 */}
      <div className="flex items-start gap-5 mb-7">
        <WallpaperPreview src={currentUrl} name={currentName} />
        <div className="flex flex-col gap-3 pt-1">
          <div className="text-sm font-medium text-gray-800 dark:text-gray-100">
            {currentName}
          </div>
          <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
            <span>Fill</span>
            <select
              value={wallpaperFit}
              onChange={(e) => setWallpaperFit(e.target.value as WallpaperFit)}
              className="px-2 py-1 rounded-md text-xs bg-gray-100 dark:bg-zinc-700 border border-gray-200 dark:border-zinc-600 text-gray-700 dark:text-gray-200 outline-none cursor-pointer hover:bg-gray-200 dark:hover:bg-zinc-600"
            >
              {FIT_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      {/* Light & Dark Desktop：随外观自动切换的明暗对 */}
      <Section title="Light & Dark Desktop">
        <WallpaperThumb
          src={wallpapers.day}
          srcDark={wallpapers.night}
          label="Day & Night"
          active={autoSelected}
          onClick={() => applyWallpaper(null)}
        />
      </Section>

      {/* Desktop Pictures：内置静态渐变壁纸 */}
      <Section title="Desktop Pictures">
        {(wallpapers.builtins ?? []).map((w) => (
          <WallpaperThumb
            key={w.id}
            src={w.url}
            label={w.name}
            active={customWallpaper === w.url}
            onClick={() => applyWallpaper(w.url)}
          />
        ))}
      </Section>

      {/* Photos Library：从 Photos 右键设过的壁纸（持久化） */}
      {userWallpapers.length > 0 && (
        <Section title="Photos Library">
          {userWallpapers.map((url, i) => (
            <WallpaperThumb
              key={url}
              src={url}
              label={`Photo ${userWallpapers.length - i}`}
              active={customWallpaper === url}
              onClick={() => applyWallpaper(url)}
            />
          ))}
        </Section>
      )}

      {/* Pictures：用户自定义图片 */}
      <Section
        title="Pictures"
        action={
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="px-2.5 py-1 text-xs rounded-md text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 dark:hover:bg-zinc-600 transition-colors"
          >
            Add Picture…
          </button>
        }
      >
        {userPictures.length === 0 ? (
          <div className="text-xs text-gray-400 dark:text-zinc-500 py-2">
            No custom pictures. Click “Add Picture…” to choose one.
          </div>
        ) : (
          userPictures.map((p) => (
            <WallpaperThumb
              key={p.id}
              src={p.url}
              label={p.name}
              active={customWallpaper === p.url}
              onClick={() => applyWallpaper(p.url)}
            />
          ))
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleAddPicture}
        />
      </Section>
    </div>
  );
});

/** 当前壁纸大预览（带桌面缩略框样式） */
const WallpaperPreview = React.memo(function WallpaperPreview({
  src,
  name
}: {
  src: string;
  name: string;
}) {
  return (
    <div className="relative w-[200px] h-[125px] rounded-lg overflow-hidden border border-gray-200 dark:border-zinc-700 shadow-sm">
      <img src={src} alt={name} className="size-full object-cover" />
    </div>
  );
});

/** 分区：标题 + 可选操作按钮 + 缩略图网格 */
const Section = React.memo(function Section({
  title,
  action,
  children
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-gray-600 dark:text-gray-300">
          {title}
        </div>
        {action}
      </div>
      <div className="flex flex-wrap items-start gap-4">{children}</div>
    </div>
  );
});

/** 壁纸缩略图（支持明暗对展示：srcDark 存在时左半亮右半暗） */
const WallpaperThumb = React.memo(function WallpaperThumb({
  src,
  srcDark,
  label,
  active,
  onClick
}: {
  src: string;
  srcDark?: string;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={active}
      className={`flex flex-col items-center gap-1.5 ${
        active ? "cursor-default" : "cursor-pointer group"
      }`}
    >
      <div
        className={`relative w-[120px] h-[76px] rounded-lg overflow-hidden border-2 transition-all ${
          active
            ? "border-blue-500 ring-2 ring-blue-500/30"
            : "border-transparent group-hover:border-gray-300 dark:group-hover:border-zinc-600"
        }`}
      >
        {srcDark ? (
          <>
            <img
              src={src}
              alt={label}
              className="absolute inset-0 size-full object-cover"
              style={{ clipPath: "polygon(0 0, 50% 0, 50% 100%, 0 100%)" }}
            />
            <img
              src={srcDark}
              alt={label}
              className="absolute inset-0 size-full object-cover"
              style={{ clipPath: "polygon(50% 0, 100% 0, 100% 100%, 50% 100%)" }}
            />
          </>
        ) : (
          <img src={src} alt={label} className="size-full object-cover" />
        )}
        {active && (
          <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center">
            <span className="i-ri:check-line text-xs" />
          </span>
        )}
      </div>
      <span className="text-xs text-gray-700 dark:text-gray-200 max-w-[120px] truncate">
        {label}
      </span>
    </button>
  );
});

export default WallpaperPanel;
