/**
 * 书签持久化（基于 macos-database 系统）。
 *
 * 数据模型：
 * - 每个书签 = 一条 `browser:bookmark` 类型 record（id = ULID，集合型）
 * - record.data = BookmarkData（title/link/img/section/order 等）
 *
 * 首次启动种子：database 无书签时，从 src/configs/websites.ts 的硬编码数据
 * 自动播种到 database（保留原有书签数据不丢）。
 */
import {
  queryByType,
  insertRecord,
  updateRecord,
  deleteRecord,
  hasPat
} from "~/services/database";
import websites from "~/configs/websites";
import type { DatabaseRecord } from "~/services/database/types";
import type { SiteData } from "~/types";

/** 书签分组 */
export type BookmarkSection = "favorites" | "freq";

/** 书签业务数据（存于 record.data） */
export interface BookmarkData {
  title: string;
  link: string;
  img?: string;
  /** 是否在 iframe 内打开（false = 新标签打开） */
  inner?: boolean;
  /** 分组：favorites | freq */
  section: BookmarkSection;
  /** 同组内的排序权重（小的在前） */
  order: number;
}

/** UI 层使用的书签对象（由 record 转换） */
export interface Bookmark extends SiteData {
  /** record id（ULID） */
  id: string;
  section: BookmarkSection;
  order: number;
}

const recordToBookmark = (r: DatabaseRecord<BookmarkData>): Bookmark => ({
  id: r.id,
  title: r.data.title,
  link: r.data.link,
  img: r.data.img,
  inner: r.data.inner,
  section: r.data.section,
  order: r.data.order
});

/**
 * 加载所有书签（本地缓存优先）。
 * 按 section 分组返回，每组内按 order 升序。
 */
export const loadBookmarks = async (): Promise<{
  favorites: Bookmark[];
  freq: Bookmark[];
}> => {
  const records = await queryByType<BookmarkData>("browser:bookmark");
  const bookmarks = records.map(recordToBookmark);

  const favorites = bookmarks
    .filter((b) => b.section === "favorites")
    .sort((a, b) => a.order - b.order);
  const freq = bookmarks
    .filter((b) => b.section === "freq")
    .sort((a, b) => a.order - b.order);

  return { favorites, freq };
};

/**
 * 首次启动种子：如果 database 无书签，从 websites.ts 播种。
 * 返回是否执行了播种。
 */
export const seedBookmarksIfEmpty = async (): Promise<boolean> => {
  const { favorites, freq } = await loadBookmarks();
  if (favorites.length > 0 || freq.length > 0) return false;

  // 从 websites.ts 播种（保留原有数据）
  websites.favorites.sites.forEach((site, i) => {
    insertRecord<BookmarkData>("browser:bookmark", {
      title: site.title,
      link: site.link,
      img: site.img,
      inner: site.inner,
      section: "favorites",
      order: i
    });
  });
  websites.freq.sites.forEach((site, i) => {
    insertRecord<BookmarkData>("browser:bookmark", {
      title: site.title,
      link: site.link,
      img: site.img,
      inner: site.inner,
      section: "freq",
      order: i
    });
  });
  return true;
};

/** 添加书签（自动追加到指定分组的末尾） */
export const addBookmark = async (
  data: Omit<BookmarkData, "section" | "order">,
  section: BookmarkSection
): Promise<string> => {
  // 算 order：当前分组内最大 order + 1
  const { favorites, freq } = await loadBookmarks();
  const list = section === "favorites" ? favorites : freq;
  const maxOrder = list.reduce((m, b) => Math.max(m, b.order), -1);

  const id = insertRecord<BookmarkData>("browser:bookmark", {
    ...data,
    section,
    order: maxOrder + 1
  });
  return id;
};

/** 重命名书签（只改 title） */
export const renameBookmark = async (id: string, newTitle: string): Promise<void> => {
  // 拉最新 record（保留其他字段）
  const { getRecord } = await import("~/services/database");
  const record = await getRecord<BookmarkData>(id);
  if (!record) return;
  updateRecord<BookmarkData>(id, "browser:bookmark", {
    ...record.data,
    title: newTitle
  });
};

/** 删除书签 */
export const removeBookmark = (id: string): void => {
  deleteRecord(id);
};

/** 是否配置了 PAT（写操作前置检查） */
export const canWriteBookmarks = (): boolean => hasPat();
