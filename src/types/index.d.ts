import React from "react";

export interface MacActions {
  setLogin: (value: boolean | ((prevVar: boolean) => boolean)) => void;
  shutMac: (e: React.MouseEvent) => void;
  restartMac: (e: React.MouseEvent) => void;
  sleepMac: (e: React.MouseEvent) => void;
}

export {
  AppsData,
  FinderEntry,
  FinderEntryData,
  EntryKind,
  MusicData,
  TerminalData,
  TyporaNote,
  TyporaNoteData,
  UserData,
  WallpaperData,
  WebsitesData,
  SiteSectionData,
  SiteData
} from "./configs";

export { MenuGroup, AppMenuDef } from "./menus";
