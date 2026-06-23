(() => {
  // 运行时配置，可在不重新构建的情况下切换 API 地址。
  // 注意：public/ 下的 JS 不经过 Vite 构建，不能用 process.env.*（浏览器无 process）。
  //   - dev: Vite proxy 把 /api 转发到 http://localhost:2120，/align-minio 转发到线上
  //   - prod: 发布前手动改这里的值，或由部署脚本注入
  window.alignConfig = {
    apiPrefix: "",
    sourceHost: "https://zhongfw.online",
    // MinIO 可访问前缀，图片 URL = blogSourceMinio + "/memoryimage/" + filename
    blogSourceMinio: "/align-minio"
  };
})();
