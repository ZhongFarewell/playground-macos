import type { TyporaNote } from "~/types";

/**
 * Typora 笔记的 GitHub 仓库持久化。
 *
 * 设计：
 * - 仓库 ZhongFarewell/macos-notes，默认分支 main
 * - 根目录 index.json 为笔记清单（不存在视为空数组）
 * - 笔记内容存 notes/{id}.md
 * - PAT 存 localStorage（原文，用户自行承担风险）
 * - 前端直接调 GitHub Contents API（CORS 已放行）
 *
 * macOS 对齐：真实 Typora 用本地文件系统 + 系统 Save 对话框；
 * 浏览器无文件系统，改用 GitHub 仓库做存储后端，系统对话框用自定义 modal 替代。
 */

const REPO_OWNER = "ZhongFarewell";
const REPO_NAME = "macos-notes";
const REPO_BRANCH = "main";
const API_BASE = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}`;
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${REPO_BRANCH}`;
const PAT_KEY = "typora_github_pat";

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
const toBase64 = (text: string): string => {
  // 先转 bytes 再 base64，避免多字节字符被破坏
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
};

/** base64 → utf-8 字符串 */
const fromBase64 = (b64: string): string => {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new TextDecoder().decode(bytes);
};

/**
 * 读取 index.json。文件不存在（404）视为空数组。
 * 未认证或 PAT 无效时也返回空数组（公开仓库可匿名读）。
 */
export const listNotes = async (): Promise<TyporaNote[]> => {
  try {
    const res = await fetch(`${API_BASE}/contents/index.json?ref=${REPO_BRANCH}`, {
      headers: authHeaders()
    });
    if (!res.ok) return [];
    const data = await res.json();
    if (!data.content) return [];
    const text = fromBase64(data.content);
    const arr = JSON.parse(text);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
};

/**
 * 读取单个 md 文件内容。失败返回 null（区分空文件）。
 * 走 Contents API 而非 raw.githubusercontent.com——后者有 CDN 缓存延迟
 *（仓库已更新但接口返回旧内容），Contents API 实时返回最新。
 */
export const getNoteContent = async (file: string): Promise<string | null> => {
  try {
    const res = await fetch(`${API_BASE}/contents/${file}?ref=${REPO_BRANCH}`, {
      headers: authHeaders()
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.content) return null;
    return fromBase64(data.content);
  } catch {
    return null;
  }
};

/**
 * 重命名笔记：只更新 index.json 里的 title，file 路径不动。
 * macOS Finder 双击重命名风格；md 文件名与 title 解耦。
 */
export const renameNote = async (
  note: TyporaNote,
  newTitle: string
): Promise<boolean> => {
  const list = await listNotes();
  const idx = list.findIndex((n) => n.id === note.id);
  if (idx === -1) return false;
  list[idx] = { ...list[idx], title: newTitle, updatedAt: new Date().toISOString() };
  const indexSha = await getFileSha("index.json");
  return putFile(
    "index.json",
    JSON.stringify(list, null, 2),
    `Rename to ${newTitle}`,
    indexSha
  );
};

/**
 * PUT 一个文件到仓库。内部用，不暴露。
 * 返回是否成功。
 */
const putFile = async (
  path: string,
  content: string,
  message: string,
  sha?: string
): Promise<boolean> => {
  const pat = getPat();
  if (!pat) return false;
  const body: Record<string, unknown> = {
    message,
    content: toBase64(content),
    branch: REPO_BRANCH
  };
  if (sha) body.sha = sha;
  const res = await fetch(`${API_BASE}/contents/${path}`, {
    method: "PUT",
    headers: {
      ...authHeaders(),
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  return res.ok;
};

/** 拿某个文件的 sha（更新时需要）。不存在返回 undefined。 */
const getFileSha = async (path: string): Promise<string | undefined> => {
  try {
    const res = await fetch(`${API_BASE}/contents/${path}?ref=${REPO_BRANCH}`, {
      headers: authHeaders()
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return data.sha;
  } catch {
    return undefined;
  }
};

/**
 * 保存已存在的笔记（覆盖更新）。
 * macOS 对齐：Cmd+S 直接覆盖，不弹框。
 * 同时更新 index.json 里的 updatedAt 和 excerpt（保持清单同步）。
 */
export const saveNote = async (note: TyporaNote, content: string): Promise<boolean> => {
  // 1. 更新 md 文件
  const sha = await getFileSha(note.file);
  const mdOk = await putFile(note.file, content, `Update ${note.title}`, sha);
  if (!mdOk) return false;

  // 2. 更新 index.json 里的 updatedAt 和 excerpt
  const list = await listNotes();
  const idx = list.findIndex((n) => n.id === note.id);
  if (idx !== -1) {
    list[idx] = {
      ...list[idx],
      excerpt: content.slice(0, 80).replace(/\n/g, " "),
      updatedAt: new Date().toISOString()
    };
    const indexSha = await getFileSha("index.json");
    await putFile(
      "index.json",
      JSON.stringify(list, null, 2),
      `Update index.json for ${note.title}`,
      indexSha
    );
  }
  return true;
};

/**
 * 新建笔记：创建 md 文件 + 更新 index.json。
 * 两次 PUT（两个 commit）。简单先这样，不做原子性。
 * 返回创建好的 note（含生成的 id 和 file 路径）。
 */
export const createNote = async (
  title: string,
  content: string
): Promise<TyporaNote | null> => {
  const id = `${Date.now()}`;
  const file = `notes/${id}.md`;
  const now = new Date().toISOString();
  const note: TyporaNote = {
    id,
    title,
    file,
    excerpt: content.slice(0, 80).replace(/\n/g, " "),
    createdAt: now,
    updatedAt: now
  };

  // 1. 创建 md 文件
  const mdOk = await putFile(file, content, `Create ${title}`);
  if (!mdOk) return null;

  // 2. 更新 index.json
  const list = await listNotes();
  list.push(note);
  const indexSha = await getFileSha("index.json");
  const indexOk = await putFile(
    "index.json",
    JSON.stringify(list, null, 2),
    `Update index.json for ${title}`,
    indexSha
  );
  if (!indexOk) return null;

  return note;
};
