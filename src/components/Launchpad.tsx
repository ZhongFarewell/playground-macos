import { apps, wallpapers } from "~/configs";

interface LaunchpadProps {
  show: boolean;
  toggleLaunchpad: (target: boolean) => void;
  openApp: (id: string) => void;
}

const placeholderText = "Search";

export default function Launchpad({ show, toggleLaunchpad, openApp }: LaunchpadProps) {
  const dark = useStore((state) => state.dark);

  const [searchText, setSearchText] = useState("");
  const [focus, setFocus] = useState(false);

  // 排除 launchpad 自身 + 非 dock app（macOS 真实行为：Launchpad 不显示自己，也不显示从 AppleMenu 打开的系统应用）
  const list = apps.filter((app) => app.id !== "launchpad" && !app.hideFromDock);

  const search = () => {
    if (searchText === "") return list;
    const text = searchText.toLowerCase();
    return list.filter(
      (item) =>
        item.title.toLowerCase().includes(text) || item.id.toLowerCase().includes(text)
    );
  };

  const close = show ? "" : "opacity-0 invisible transition-opacity duration-200";

  const handleClick = (e: React.MouseEvent, app: (typeof apps)[number]) => {
    e.stopPropagation();
    toggleLaunchpad(false);
    if (app.link) {
      window.open(app.link, "_blank", "noreferrer");
    } else {
      openApp(app.id);
    }
  };

  return (
    <div
      className={`${close} z-30 transform scale-110 size-full fixed overflow-hidden bg-center bg-cover`}
      id="launchpad"
      style={{
        backgroundImage: `url(${dark ? wallpapers.night : wallpapers.day})`
      }}
      onClick={() => toggleLaunchpad(false)}
    >
      <div className="size-full absolute bg-gray-900/20 backdrop-blur-2xl">
        <div
          className="mx-auto flex h-7 w-64 mt-5 bg-gray-200/10"
          border="1 rounded-md gray-200/30"
          onClick={(e) => e.stopPropagation()}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
        >
          <div
            className={`${
              focus ? "w-6 duration-200" : "w-26 delay-250"
            } hstack justify-end`}
          >
            <span className="i-bx:search ml-1 text-white" />
          </div>
          <input
            className="flex-1 min-w-0 no-outline bg-transparent px-1 text-sm text-white"
            placeholder={placeholderText}
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
          />
        </div>

        <div
          className="max-w-[1100px] mx-auto mt-8 w-full px-4 sm:px-10"
          grid="~ flow-row cols-4 sm:cols-7"
        >
          {search().map((app) => (
            <div key={`launchpad-${app.id}`} h="32 sm:36" flex="~ col">
              <a
                className="w-14 sm:w-20 mx-auto cursor-pointer"
                onClick={(e) => handleClick(e, app)}
              >
                <img src={app.img} alt={app.title} title={app.title} />
              </a>
              <span m="t-2 x-auto" text="white xs sm:sm">
                {app.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
