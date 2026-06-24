import type { MenuGroup, MenuItemDef } from "~/types";

interface MenuBarProps {
  /** 当前 app id，null = 桌面/Finder */
  currentAppId: string | null;
  /** 当前 app 显示名（从 apps 配置来） */
  currentAppTitle: string;
  /** 关闭 Typora 窗口（app 名菜单的 Quit 项） */
  onQuitApp?: () => void;
}

/**
 * macOS 式顶部菜单栏。
 * 左侧：app 名（粗体，可点出 About/Quit 菜单）+ File/Edit 等菜单组。
 * 点开一个后，hover 相邻菜单标题自动切换（macOS 关键行为）。
 * 菜单项从 store 的 appMenus[currentAppId] 读取。
 */
const MenuBar = ({ currentAppId, currentAppTitle, onQuitApp }: MenuBarProps) => {
  const appMenus = useStore((s) => s.appMenus);
  const groups: MenuGroup[] = currentAppId ? appMenus[currentAppId] || [] : [];
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useClickOutside(containerRef, () => setOpenMenu(null));

  // ESC 关闭
  useEffect(() => {
    if (!openMenu) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenMenu(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [openMenu]);

  const handleTitleClick = (label: string) => {
    setOpenMenu((cur) => (cur === label ? null : label));
  };

  const handleTitleHover = (label: string) => {
    // 仅当已有菜单展开时，hover 才切换（macOS 行为）
    if (openMenu !== null) setOpenMenu(label);
  };

  const handleItemClick = (item: MenuItemDef) => {
    if (item.disabled || item.separator) return;
    setOpenMenu(null);
    item.onClick?.();
  };

  // app 名菜单（About / Quit）
  const appMenuItems: MenuItemDef[] = [
    { key: "about", label: `About ${currentAppTitle}` },
    { separator: true },
    {
      key: "quit",
      label: `Quit ${currentAppTitle}`,
      shortcut: "⌘Q",
      onClick: () => {
        setOpenMenu(null);
        onQuitApp?.();
      }
    }
  ];

  const renderDropdown = (items: MenuItemDef[]) => (
    <div className="absolute top-full left-0 mt-1 w-56 text-c-black bg-c-200/90 border border-menu rounded-lg shadow-menu">
      <MenuItemGroup border={false}>
        {items.map((item, idx) =>
          item.separator ? (
            <li key={`sep-${idx}`} className="my-1 h-px bg-c-400 mx-2" />
          ) : (
            <MenuItem
              key={item.key || idx}
              disabled={item.disabled}
              shortcut={item.shortcut}
              onClick={() => handleItemClick(item)}
            >
              {item.label}
            </MenuItem>
          )
        )}
      </MenuItemGroup>
    </div>
  );

  // 无 app 菜单注册时，只显示 app 名（粗体），无下拉
  return (
    <div ref={containerRef} className="hstack space-x-0.5 relative">
      {/* app 名（粗体，可点出 About/Quit） */}
      {currentAppId && (
        <div className="relative">
          <button
            className={`px-2 py-0.5 text-sm font-bold rounded cursor-default ${
              openMenu === "__app__" ? "bg-blue-500 text-white" : "hover:bg-c-300"
            }`}
            onClick={() => handleTitleClick("__app__")}
            onMouseEnter={() => handleTitleHover("__app__")}
          >
            {currentAppTitle}
          </button>
          {openMenu === "__app__" && renderDropdown(appMenuItems)}
        </div>
      )}

      {/* 各菜单组（File / Edit ...） */}
      {groups.map((group) => (
        <div key={group.label} className="relative">
          <button
            className={`px-2 py-0.5 text-sm rounded cursor-default ${
              openMenu === group.label ? "bg-blue-500 text-white" : "hover:bg-c-300"
            }`}
            onClick={() => handleTitleClick(group.label)}
            onMouseEnter={() => handleTitleHover(group.label)}
          >
            {group.label}
          </button>
          {openMenu === group.label && renderDropdown(group.items)}
        </div>
      ))}
    </div>
  );
};

export default MenuBar;
