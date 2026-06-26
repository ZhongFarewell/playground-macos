import React from "react";
import { useAppMenus } from "~/hooks/useAppMenus";
import { useSettingsState } from "./useSettingsState";
import { buildMenus, menuDeps } from "./menus";
import SettingsSidebar from "./SettingsSidebar";
import SettingsDetail from "./SettingsDetail";

/** Settings app 主组件：左 sidebar + 右 detail 区 */
const Settings = React.memo(function Settings() {
  const s = useSettingsState();

  useAppMenus("settings", () => buildMenus(s), menuDeps(s));

  return (
    <div className="size-full flex overflow-hidden bg-white dark:bg-zinc-900">
      <SettingsSidebar currentItemId={s.currentItemId} onSelect={s.setItemId} />
      <SettingsDetail currentItemId={s.currentItemId} />
    </div>
  );
});

export default Settings;
