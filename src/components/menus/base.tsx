import React from "react";

interface MenuItemProps {
  onClick?: (e: React.MouseEvent<HTMLLIElement>) => void;
  children: React.ReactNode;
  /** 是否禁用（灰色不可点） */
  disabled?: boolean;
  /** 快捷键提示，如 "⌘O"，右对齐显示 */
  shortcut?: string;
}

interface MenuItemGroupProps {
  border?: boolean;
  children: React.ReactNode;
}

const MenuItem = (props: MenuItemProps) => {
  const { disabled, shortcut } = props;
  return (
    <li
      onClick={disabled ? undefined : props.onClick}
      className={`leading-6 cursor-default px-2.5 rounded flex justify-between items-center gap-4 ${
        disabled ? "opacity-40" : "hover:text-white hover:bg-blue-500"
      }`}
    >
      <span>{props.children}</span>
      {shortcut && <span className="text-xs opacity-70">{shortcut}</span>}
    </li>
  );
};

const MenuItemGroup = (props: MenuItemGroupProps) => {
  const border =
    props.border === false
      ? "pb-1"
      : "after:(content-empty block pb-0 h-1.5 max-w-full mx-2 border-b border-c-400)";
  return <ul className={`relative px-1 pt-1 ${border}`}>{props.children}</ul>;
};

export { MenuItem, MenuItemGroup };
