import { appBarHeight } from "~/utils";
import type { AppsData } from "~/types";

const apps: AppsData[] = [
  {
    id: "launchpad",
    title: "Launchpad",
    desktop: false,
    img: "img/icons/launchpad.png"
  },
  {
    id: "typora",
    title: "Typora",
    desktop: true,
    width: 600,
    height: 580,
    y: -20,
    img: "img/icons/typora.png",
    content: <Typora />
  },
  {
    id: "safari",
    title: "Safari",
    desktop: true,
    width: 1024,
    minWidth: 375,
    minHeight: 200,
    x: -20,
    img: "img/icons/safari.png",
    content: <Safari />
  },
  {
    id: "vscode",
    title: "VSCode",
    desktop: true,
    width: 900,
    height: 600,
    x: 80,
    y: -30,
    img: "img/icons/vscode.png",
    content: <VSCode />
  },
  {
    id: "facetime",
    title: "FaceTime",
    desktop: true,
    img: "img/icons/facetime.png",
    width: 500 * 1.7,
    height: 500 + appBarHeight,
    minWidth: 350 * 1.7,
    minHeight: 350 + appBarHeight,
    aspectRatio: 1.7,
    x: -80,
    y: 20,
    content: <FaceTime />
  },
  {
    id: "photos",
    title: "Photos",
    desktop: true,
    img: "img/icons/photos.png",
    width: 880,
    height: 560,
    minWidth: 480,
    minHeight: 320,
    x: 60,
    y: -30,
    content: <Photos />
  },
  {
    id: "terminal",
    title: "Terminal",
    desktop: true,
    img: "img/icons/terminal.png",
    content: <Terminal />
  },
  {
    id: "github",
    title: "Github",
    desktop: false,
    img: "img/icons/github.png",
    link: "https://github.com/ZhongFarewell/playground-macos"
  },
  {
    id: "settings",
    title: "Settings",
    desktop: true,
    hideFromDock: true,
    img: "",
    width: 780,
    height: 560,
    minWidth: 560,
    minHeight: 400,
    x: 0,
    y: 0,
    content: <Settings />
  }
];

export default apps;
