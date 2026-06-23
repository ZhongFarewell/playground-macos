import axios from "axios";

/**
 * Axios 实例。baseURL 复用 dashboard 的 window.alignConfig.apiPrefix 模式：
 *   - dev: Vite proxy 转发到 http://localhost:2120，apiPrefix 为空
 *   - prod: 指向 https://zhongfw.online（在 public/CONFIG.js 中可运行时切换）
 *
 * withCredentials 必须开：后端用 httpOnly 的 align_id cookie 维持会话，
 * 跨域请求必须携带凭证，否则 /auth 免登会失败。
 */
const request = axios.create({
  baseURL: (window?.alignConfig?.apiPrefix || "") + "/api",
  withCredentials: true,
  timeout: 15000
});

request.interceptors.response.use(
  (response) => response,
  (error) => {
    console.log("request error:", error?.response?.data || error?.message);
    return Promise.reject(error);
  }
);

export const urls = {
  login: "/login",
  auth: "/auth",
  logout: "/logout",
  // 相册：memory 图片列表（需 auth）
  memoryImages: "/resources/memory/image"
};

/** 登录：data 为 FormData，含加密后的 user 字段（与 dashboard 一致） */
export const loginAlign = (data: FormData) => {
  return request({ url: urls.login, method: "POST", data });
};

/** 免登验证：凭 align_id cookie 解析当前用户，失败返回 403 */
export const authAlign = () => {
  return request({ url: urls.auth, method: "GET" });
};

/** 退出：清除 align_id cookie（httpOnly，只能靠后端清） */
export const logoutAlign = () => {
  return request({ url: urls.logout, method: "GET" });
};

/**
 * 拉取相册图片列表（memory 图片）。
 * 返回 { data: [{ value: filename, memory }], total }
 * 图片完整 URL = blogSourceMinio + "/memoryimage/" + value
 */
export const getPhotoList = (
  params?: { pageNo?: number; pageSize?: number },
  signal?: AbortSignal
) => {
  return request({ url: urls.memoryImages, method: "GET", params, signal });
};
/** 拼 MinIO 原图完整 URL */
export const photoUrl = (filename: string): string => {
  const prefix = window?.alignConfig?.blogSourceMinio || "";
  return `${prefix}/memoryimage/${filename}`;
};
/** 拼 MinIO 缩略图完整 URL（后端上传时生成，存于 thumb/ 前缀） */
export const photoThumbUrl = (filename: string): string => {
  const prefix = window?.alignConfig?.blogSourceMinio || "";
  return `${prefix}/memoryimage/thumb/${filename}`;
};

export default request;
