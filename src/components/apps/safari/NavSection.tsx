import type { Bookmark } from "~/services/bookmark";

interface NavSectionProps {
  title: string;
  bookmarks: Bookmark[];
  loading: boolean;
  width: number;
  onOpen: (url: string, inner?: boolean) => void;
  onRename: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
  onCopyLink: (url: string) => void;
}

/**
 * 起始页书签宫格分组。
 *
 * macOS 对齐：真实 Safari 起始页的"收藏夹"和"常访"分区，
 * 右键书签弹出菜单（Open / Open in New Tab / Copy Link / Rename / Delete）。
 */
const NavSection = ({
  title,
  bookmarks,
  loading,
  width,
  onOpen,
  onRename,
  onDelete,
  onCopyLink
}: NavSectionProps) => {
  const grid = width < 640 ? "grid-cols-4" : "grid-cols-9";

  return (
    <div className="mx-auto w-full max-w-screen-md" p="t-8 x-4">
      <div className="font-medium ml-2" text="xl sm:2xl">
        {title}
      </div>
      <div className={`mt-3 grid grid-flow-row ${grid}`}>
        {loading ? (
          <div className="col-span-full text-center text-sm text-c-500 py-4">
            Loading...
          </div>
        ) : bookmarks.length === 0 ? (
          <div className="col-span-full text-center text-sm text-c-500 py-4">
            No bookmarks
          </div>
        ) : (
          bookmarks.map((bookmark) => (
            <BookmarkCell
              key={bookmark.id}
              bookmark={bookmark}
              onOpen={onOpen}
              onRename={onRename}
              onDelete={onDelete}
              onCopyLink={onCopyLink}
            />
          ))
        )}
      </div>
    </div>
  );
};

interface BookmarkCellProps {
  bookmark: Bookmark;
  onOpen: (url: string, inner?: boolean) => void;
  onRename: (bookmark: Bookmark) => void;
  onDelete: (id: string) => void;
  onCopyLink: (url: string) => void;
}

const BookmarkCell = ({
  bookmark,
  onOpen,
  onRename,
  onDelete,
  onCopyLink
}: BookmarkCellProps) => {
  // 右键菜单：Open / Open in New Tab / Copy Link / Rename / Delete
  // macOS Safari 在书签上右键的真实选项
  const menuRef = useContextMenu((_ctx, collector) => {
    collector.add(
      {
        label: "Open",
        onClick: () => onOpen(bookmark.link)
      },
      {
        label: "Open in New Tab",
        onClick: () => onOpen(bookmark.link, false)
      },
      { separator: true },
      {
        label: "Copy Link",
        onClick: () => onCopyLink(bookmark.link)
      },
      { separator: true },
      {
        label: "Rename…",
        onClick: () => onRename(bookmark)
      },
      {
        label: "Delete",
        onClick: () => onDelete(bookmark.id)
      }
    );
  });

  const handleClick = () => onOpen(bookmark.link);

  return (
    <div className="h-28 flex flex-col">
      <div
        ref={menuRef as React.RefObject<HTMLDivElement>}
        className="size-16 mx-auto rounded-md overflow-hidden bg-white cursor-pointer"
        onClick={handleClick}
        title={bookmark.title}
      >
        {bookmark.img ? (
          <img
            src={bookmark.img}
            alt={bookmark.title}
            className="size-full object-contain"
          />
        ) : (
          <div className="size-full flex-center cursor-default text-black">
            <span text-lg>{bookmark.title.slice(0, 1).toUpperCase()}</span>
          </div>
        )}
      </div>
      <span m="t-2 x-auto" text-sm>
        {bookmark.title}
      </span>
    </div>
  );
};

export default NavSection;
