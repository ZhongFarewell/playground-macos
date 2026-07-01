/**
 * GitHub Contents API 封装。
 *
 * 从原 typora.ts 抽出的通用部分，仓库指向 macos-database。
 * - PAT 存 localStorage（原文，用户自行承担风险）
 * - 前端直连 GitHub API（CORS 已放行）
 * - 公开仓库可匿名读，写必须带 PAT
 */
import type { BlobRef } from "./types";

const REPO_OWNER = "ZhongFarewell";
const REPO_NAME = "macos-database";
const REPO_BRANCH = "main";
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}`;

/** 拼接 raw 文件直链（公开仓库可直接访问，浏览器流式渲染） */
export const rawUrl = (path: string): string => `${RAW_BASE}/${path}`;

/** PAT 在 localStorage 的 key（与原 typora 共用，PAT 范围限定到本仓库） */
const PAT_KEY = "database_github_pat";

/** 读取 localStorage 里的 PAT */
export const getPat = (): string => localStorage.getItem(PAT_KEY) || "";

/** 存 PAT 到 localStorage */
export const setPat = (pat: string): void => {
  localStorage.setItem(PAT_KEY, pat);
};

/** 清除 PAT */
export const clearPat = (): void => {
  localStorage.removeItem(PAT_KEY);
};

/** 是否配置了 PAT（写操作前置检查） */
export const hasPat = (): boolean => Boolean(getPat());

const authHeaders = (): HeadersInit => {
  const pat = getPat();
  return pat
    ? {
        Authorization: `Bearer ${pat}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
      }
    : { Accept: "application/vnd.github+json" };
};

/** utf-8 字符串 → base64（GitHub Contents API 要求 base64 编码） */
export const toBase64 = (text: string): string => {
  // 先转 bytes 再 base64，避免多字节字符被破坏
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

/** base64 → utf-8 字符串 */
export const fromBase64 = (b64: string): string => {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/** 任意 bytes → base64（用于二进制文件，不经过 TextEncoder，避免损坏） */
export const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  const chunk = 0x8000; // 避免调用栈溢出，分块拼接
  for (let i = 0; i < bytes.length; i += chunk) {
    const slice = bytes.subarray(i, i + chunk);
    for (let j = 0; j < slice.length; j++) {
      binary += String.fromCharCode(slice[j]);
    }
  }
  return btoa(binary);
};

/** base64 → 任意 bytes（用于二进制文件，不经过 TextDecoder） */
export const base64ToBytes = (b64: string): Uint8Array => {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export interface GithubFile {
  /** 文件内容（base64）。>1MB 文件此字段为空，需用 downloadUrl 拉 raw。 */
  content?: string;
  /** 文件 sha，更新/删除时需要 */
  sha?: string;
  /** raw 文件直链（content 为空时用此 URL 拉原始 bytes） */
  downloadUrl?: string;
}

/**
 * 读取文件。404 或失败返回 null。
 * 走 Contents API 而非 raw.githubusercontent.com——后者有 CDN 缓存延迟，
 * Contents API 实时返回最新。
 */
export const getFile = async (path: string): Promise<GithubFile | null> => {
  try {
    const res = await fetch(`${API_BASE}/contents/${path}?ref=${REPO_BRANCH}`, {
      headers: authHeaders()
    });
    if (!res.ok) return null;
    const data = await res.json();
    return { content: data.content, sha: data.sha, downloadUrl: data.download_url };
  } catch {
    return null;
  }
};

/** 拿某个文件的 sha。不存在返回 undefined。 */
export const getFileSha = async (path: string): Promise<string | undefined> => {
  const file = await getFile(path);
  return file?.sha;
};

/** 写操作失败的原因分类 */
export type PutFileError = "no-pat" | "sha-conflict" | "network" | "unknown";

export interface PutFileResult {
  ok: boolean;
  /** 写入后的新 sha（成功时） */
  sha?: string;
  error?: PutFileError;
}

/**
 * PUT 一个文件到仓库。
 * @param path 仓库内相对路径
 * @param content 文本内容（utf-8）
 * @param message commit message
 * @param sha 已有文件的 sha（更新时必传，新建时省略）
 */
export const putFile = async (
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<PutFileResult> => {
  const pat = getPat();
  if (!pat) return { ok: false, error: "no-pat" };

  const body: Record<string, unknown> = {
    message,
    content: toBase64(content),
    branch: REPO_BRANCH
  };
  if (sha) body.sha = sha;

  try {
    const res = await fetch(`${API_BASE}/contents/${path}`, {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, sha: data.content?.sha };
    }

    // 409 = sha 冲突（文件已被修改）；422 = sha 不匹配
    if (res.status === 409 || res.status === 422) {
      return { ok: false, error: "sha-conflict" };
    }
    return { ok: false, error: "unknown" };
  } catch {
    return { ok: false, error: "network" };
  }
};

export interface DeleteFileResult {
  ok: boolean;
  error?: PutFileError;
}

/**
 * 删除文件。需要 sha。
 */
export const deleteFile = async (
  path: string,
  message: string,
  sha: string
): Promise<DeleteFileResult> => {
  const pat = getPat();
  if (!pat) return { ok: false, error: "no-pat" };

  try {
    const res = await fetch(`${API_BASE}/contents/${path}`, {
      method: "DELETE",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ message, sha, branch: REPO_BRANCH })
    });

    if (res.ok) return { ok: true };
    if (res.status === 409 || res.status === 422) {
      return { ok: false, error: "sha-conflict" };
    }
    return { ok: false, error: "unknown" };
  } catch {
    return { ok: false, error: "network" };
  }
};

/**
 * 读取文本文件并解析为 JSON。
 * 文件不存在返回 null。
 */
export const getJson = async <T>(path: string): Promise<T | null> => {
  const file = await getFile(path);
  if (!file?.content) return null;
  try {
    return JSON.parse(fromBase64(file.content)) as T;
  } catch {
    return null;
  }
};

/** 带 sha 的 JSON 读取结果，用于读取时同步缓存 sha */
export interface JsonWithSha<T> {
  data: T;
  sha: string;
}

/**
 * 读取 JSON 文件并同时返回 sha。
 * 用于首次读取 record 时把 sha 一起存入本地缓存，
 * 后续 PUT 直接用缓存的 sha，不必再 GET。
 */
export const getJsonWithSha = async <T>(path: string): Promise<JsonWithSha<T> | null> => {
  const file = await getFile(path);
  if (!file?.content) return null;
  try {
    return {
      data: JSON.parse(fromBase64(file.content)) as T,
      sha: file.sha!
    };
  } catch {
    return null;
  }
};

/**
 * 写入 JSON 文件（自动序列化 + 美化）。
 */
export const putJson = async (
  path: string,
  data: unknown,
  message: string,
  sha?: string
): Promise<PutFileResult> => {
  return putFile(path, JSON.stringify(data, null, 2), message, sha);
};

/**
 * 读取 blob 文件（纯文本，如 .md）。
 * 用于大文本场景（Typora 笔记正文等）。
 */
export const getBlob = async (ref: BlobRef | string): Promise<string | null> => {
  const path = typeof ref === "string" ? ref : ref.file;
  const file = await getFile(path);
  if (!file?.content) return null;
  return fromBase64(file.content);
};

/**
 * 读取 blob 文件的原始 bytes（二进制安全，不经过 TextDecoder）。
 * 用于图片/音频/视频等非文本文件。
 */
export const getBlobBytes = async (ref: BlobRef | string): Promise<Uint8Array | null> => {
  const path = typeof ref === "string" ? ref : ref.file;
  const file = await getFile(path);
  if (file?.content) {
    return base64ToBytes(file.content);
  }
  // content 为空（文件 >1MB）：用 download_url 拉 raw bytes
  if (file?.downloadUrl) {
    try {
      const res = await fetch(file.downloadUrl);
      if (!res.ok) return null;
      return new Uint8Array(await res.arrayBuffer());
    } catch {
      return null;
    }
  }
  return null;
};

/**
 * 写入 blob 文件。
 * 返回新 sha，调用方需更新 record 里的 BlobRef.sha。
 */
export const putBlob = async (
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<PutFileResult> => putFile(path, content, message, sha);

/**
 * 写入 blob 文件的原始 bytes（二进制安全，不经过 TextEncoder）。
 * 用于图片/音频/视频等非文本文件。返回新 sha。
 */
export const putBlobBytes = async (
  path: string,
  bytes: Uint8Array,
  message: string,
  sha?: string
): Promise<PutFileResult> => {
  const pat = getPat();
  if (!pat) return { ok: false, error: "no-pat" };

  const body: Record<string, unknown> = {
    message,
    content: bytesToBase64(bytes),
    branch: REPO_BRANCH
  };
  if (sha) body.sha = sha;

  try {
    const res = await fetch(`${API_BASE}/contents/${path}`, {
      method: "PUT",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });

    if (res.ok) {
      const data = await res.json();
      return { ok: true, sha: data.content?.sha };
    }
    if (res.status === 409 || res.status === 422) {
      return { ok: false, error: "sha-conflict" };
    }
    return { ok: false, error: "unknown" };
  } catch {
    return { ok: false, error: "network" };
  }
};

/** 删除 blob 文件 */
export const deleteBlob = async (
  ref: BlobRef,
  message: string
): Promise<DeleteFileResult> => {
  if (!ref.sha) return { ok: false, error: "unknown" };
  return deleteFile(ref.file, message, ref.sha);
};

export const REPO_INFO = {
  owner: REPO_OWNER,
  name: REPO_NAME,
  branch: REPO_BRANCH
} as const;
