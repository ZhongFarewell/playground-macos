import React from "react";

interface AppleMenuProps {
  logout: () => void;
  shut: (e: React.MouseEvent<HTMLLIElement>) => void;
  restart: (e: React.MouseEvent<HTMLLIElement>) => void;
  sleep: (e: React.MouseEvent<HTMLLIElement>) => void;
  toggleAppleMenu: () => void;
  btnRef: React.RefObject<HTMLDivElement>;
  /** 当前用户显示名，用于 "Log Out {name}..." 文案 */
  userName: string;
  /** 打开 System Settings 窗口 */
  openSettings: () => void;
}

export default function AppleMenu({
  logout,
  shut,
  restart,
  sleep,
  toggleAppleMenu,
  btnRef,
  userName,
  openSettings
}: AppleMenuProps) {
  const ref = useRef<HTMLDivElement>(null);

  useClickOutside(ref, toggleAppleMenu, [btnRef]);

  return (
    <div className="menu-box left-2 w-56" ref={ref}>
      <MenuItemGroup>
        <MenuItem>About This Mac</MenuItem>
      </MenuItemGroup>
      <MenuItemGroup>
        <MenuItem
          onClick={() => {
            openSettings();
            toggleAppleMenu();
          }}
        >
          System Settings…
        </MenuItem>
        <MenuItem>App Store...</MenuItem>
      </MenuItemGroup>
      <MenuItemGroup>
        <MenuItem>Recent Items</MenuItem>
      </MenuItemGroup>
      <MenuItemGroup>
        <MenuItem>Force Quit...</MenuItem>
      </MenuItemGroup>
      <MenuItemGroup>
        <MenuItem onClick={sleep}>Sleep</MenuItem>
        <MenuItem onClick={restart}>Restart...</MenuItem>
        <MenuItem onClick={shut}>Shut Down...</MenuItem>
      </MenuItemGroup>
      <MenuItemGroup border={false}>
        {/* 锁屏与注销都清 cookie：刷新后 /auth 失败必然回登录页，无绕过问题 */}
        <MenuItem onClick={logout}>Lock Screen</MenuItem>
        <MenuItem onClick={logout}>{`Log Out ${userName}`}</MenuItem>
      </MenuItemGroup>
    </div>
  );
}
