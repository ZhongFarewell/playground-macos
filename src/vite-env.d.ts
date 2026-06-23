/// <reference types="vite/client" />

import type { AttributifyAttributes } from "unocss/dist/preset-attributify";

declare module "react" {
  /* eslint-disable-next-line @typescript-eslint/no-empty-interface */
  interface HTMLAttributes<T> extends AttributifyAttributes {}
}

// 运行时配置（public/CONFIG.js 注入），与 dashboard 的 window.alignConfig 同构
// 文件含 import 后为模块，全局类型需用 declare global
declare global {
  interface AlignConfig {
    apiPrefix: string;
    sourceHost?: string;
    blogSourceMinio?: string;
    [k: string]: any;
  }

  interface Window {
    alignConfig?: AlignConfig;
  }
}
