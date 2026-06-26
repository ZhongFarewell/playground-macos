import type { WallpaperData } from "~/types";

/**
 * 生成渐变壁纸的 data URI（SVG）。
 * 用 SVG 而非 CSS 渐变，是为了缩略图 <img> 也能直接用同一 URL。
 */
function gradient(id: string, stops: [string, string, string?], angle = 135): string {
  const gradId = `g-${id}`;
  // SVG linearGradient 用 0..1 的 x1/y1/x2/y2 控制方向
  const rad = (angle * Math.PI) / 180;
  const x1 = (0.5 - Math.cos(rad) / 2).toFixed(3);
  const y1 = (0.5 - Math.sin(rad) / 2).toFixed(3);
  const x2 = (0.5 + Math.cos(rad) / 2).toFixed(3);
  const y2 = (0.5 + Math.sin(rad) / 2).toFixed(3);
  const stopEls = stops
    .filter(Boolean)
    .map(
      (c, i) =>
        `<stop offset="${(i / (stops.filter(Boolean).length - 1)).toFixed(
          3
        )}" stop-color="${c}"/>`
    )
    .join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><defs><linearGradient id="${gradId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">${stopEls}</linearGradient></defs><rect width="1920" height="1080" fill="url(#${gradId})"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const wallpapers: WallpaperData = {
  day: "img/ui/wallpaper-day.jpg",
  night: "img/ui/wallpaper-night.jpg",
  builtins: [
    {
      id: "sunrise",
      name: "Sunrise",
      url: gradient("sunrise", ["#ff9a9e", "#fad0c4", "#fbc2eb"], 135)
    },
    {
      id: "ocean",
      name: "Ocean",
      url: gradient("ocean", ["#2e3192", "#1bffff"], 135)
    },
    {
      id: "forest",
      name: "Forest",
      url: gradient("forest", ["#134e5e", "#71b280"], 135)
    },
    {
      id: "twilight",
      name: "Twilight",
      url: gradient("twilight", ["#0f2027", "#203a43", "#2c5364"], 135)
    },
    {
      id: "grape",
      name: "Grape",
      url: gradient("grape", ["#41295a", "#2F0743"], 135)
    },
    {
      id: "peach",
      name: "Peach",
      url: gradient("peach", ["#ed4264", "#ffedbc"], 135)
    }
  ]
};

export default wallpapers;
