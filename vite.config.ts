import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import unocss from "unocss/vite";
import autoImport from "unplugin-auto-import/vite";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    unocss(),
    react(),
    autoImport({
      imports: ["react"],
      dts: "src/auto-imports.d.ts",
      dirs: ["src/hooks", "src/stores", "src/components/**"]
    })
  ],
  define: {
    // public/CONFIG.js 里用到 process.env.*，构建时替换为字面量。
    // dev 下留空，走 proxy；prod 下指向线上地址（由 CI 通过环境变量注入）。
    "process.env.ALIGN_SERVER_PREFIX": JSON.stringify(
      process.env.ALIGN_SERVER_PREFIX || ""
    ),
    "process.env.ALIGN_MINIO_PREFIX": JSON.stringify(process.env.ALIGN_MINIO_PREFIX || "")
  },
  resolve: {
    alias: {
      "~/": `${path.resolve(__dirname, "src")}/`
    }
  },
  server: {
    proxy: {
      // 把 /api 转发到本地 Align-server（端口 2120），与 dashboard 的 localstart 行为一致
      "/api": {
        target: "https://zhongfw.online",
        changeOrigin: true
      },
      // MinIO 图片资源走 nginx 代理，dev 下转发到线上
      "/align-minio": {
        target: "https://zhongfw.online",
        changeOrigin: true,
        secure: false
      }
    }
  }
});
