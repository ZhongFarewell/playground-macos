import { wallpapers } from "~/configs";
import { useSafariState } from "./useSafariState";
import NavSection from "./NavSection";
import SafariAddDialog from "./SafariAddDialog";
import SafariRenameDialog from "./SafariRenameDialog";

interface SafariProps {
  width?: number;
}

const numTracker = 0;

interface NavPageProps {
  width: number;
  state: ReturnType<typeof useSafariState>;
}

const NavPage = ({ width, state: s }: NavPageProps) => {
  const dark = useStore((state) => state.dark);

  return (
    <div
      className="w-full safari-content overflow-y-scroll bg-center bg-cover text-c-black"
      style={{
        backgroundImage: `url(${dark ? wallpapers.night : wallpapers.day})`
      }}
    >
      <div className="w-full min-h-full pt-8 bg-c-100/80 backdrop-blur-2xl">
        {/* Favorites */}
        <NavSection
          title="SNS Links"
          bookmarks={s.bookmarks.favorites}
          loading={s.loadingBookmarks}
          width={width}
          onOpen={s.openLink}
          onRename={s.setRenameTarget}
          onDelete={s.handleDeleteBookmark}
          onCopyLink={s.copyLink}
        />

        {/* Frequently Visited */}
        <NavSection
          title="Frequently Visited"
          bookmarks={s.bookmarks.freq}
          loading={s.loadingBookmarks}
          width={width}
          onOpen={s.openLink}
          onRename={s.setRenameTarget}
          onDelete={s.handleDeleteBookmark}
          onCopyLink={s.copyLink}
        />

        {/* Privacy Report */}
        <div className="mx-auto w-full max-w-screen-md" p="t-8 x-4 b-16">
          <div font="medium" text="xl sm:2xl">
            Privacy Report
          </div>
          <div
            className="h-16 w-full mt-4 grid grid-cols-3 shadow-md rounded-xl text-sm"
            bg="gray-50/70 dark:gray-600/50"
          >
            <div className="col-start-1 col-span-1 flex-center space-x-2">
              <span className="i-fa-solid:shield-alt text-2xl" />
              <span className="text-xl">{numTracker}</span>
            </div>
            <div className="col-start-2 col-span-2 hstack px-2">
              In the last seven days, Safari has prevented {numTracker} tracker from
              profiling you.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const NoInternetPage = () => {
  const dark = useStore((state) => state.dark);

  return (
    <div
      className="w-full safari-content bg-blue-50 overflow-y-scroll bg-center bg-cover"
      style={{
        backgroundImage: `url(${dark ? wallpapers.night : wallpapers.day})`
      }}
    >
      <div className="w-full h-full pb-10 backdrop-blur-2xl flex-center text-c-600 bg-c-100/80">
        <div className="text-center">
          <div className="text-2xl font-bold">You Are Not Connected to the Internet</div>
          <div className="pt-4 text-sm">
            This page can't be displayed because your computer is currently offline.
          </div>
        </div>
      </div>
    </div>
  );
};

const Safari = ({ width }: SafariProps) => {
  const wifi = useStore((state) => state.wifi);
  const s = useSafariState();

  const pressURL = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") s.setGoURL((e.target as HTMLInputElement).value);
  };

  const buttonColor = s.goURL === "" ? "text-c-400" : "text-c-700";
  const grid = (width as number) < 640 ? "grid-cols-2" : "grid-cols-3";
  const hideLast = (width as number) < 640 ? "hidden" : "flex";

  return (
    <div className="w-full h-full relative">
      {/* browser topbar */}
      <div className={`h-10 grid ${grid} items-center bg-c-white`}>
        <div className="flex px-2">
          <button
            className={`safari-btn w-7 ${buttonColor}`}
            onClick={() => s.setGoURL("")}
          >
            <span className="i-jam:chevron-left text-xl" />
          </button>
          <button className="safari-btn w-7 text-c-400">
            <span className="i-jam:chevron-right text-xl" />
          </button>
          <button className="safari-btn w-9 ml-3 text-c-700">
            <span className="i-bi:layout-sidebar text-sm" />
          </button>
        </div>
        <div className="hstack space-x-2 px-2">
          <button className="safari-btn w-9 -ml-10 text-c-400">
            <span className="i-fa-solid:shield-alt text-sm" />
          </button>
          <input
            type="text"
            value={s.currentURL}
            onChange={(e) => s.setCurrentURL(e.target.value)}
            onKeyPress={pressURL}
            className="h-6 w-full p-2 rounded font-normal no-outline text-sm text-center text-c-500 bg-c-200"
            border="2 transparent focus:blue-400 dark:focus:blue-500"
            placeholder="Search or enter website name"
          />
          {/* 添加书签按钮：+ —— 仅在浏览页面时显示（起始页无当前页可收藏） */}
          {s.goURL !== "" && (
            <button
              className="safari-btn w-7 text-c-700 hover:text-blue-500"
              title="Add Bookmark"
              onClick={() => s.setShowAddDialog(true)}
            >
              <span className="i-ion:add text-base" />
            </button>
          )}
        </div>
        <div className={`${hideLast} justify-end space-x-2 px-2`}>
          <button className={`safari-btn w-9 ${buttonColor}`}>
            <span className="i-ion:share-outline" />
          </button>
          <button className="safari-btn w-9 text-c-700">
            <span className="i-ion:copy-outline" />
          </button>
        </div>
      </div>

      {/* browser content */}
      {wifi ? (
        s.goURL === "" ? (
          <NavPage width={width as number} state={s} />
        ) : (
          <iframe
            title={"Safari clone browser"}
            src={s.goURL}
            className="safari-content w-full bg-white"
          />
        )
      ) : (
        <NoInternetPage />
      )}

      {/* dialogs（顶层渲染，覆盖整个 Safari 窗口） */}
      {s.showAddDialog && (
        <SafariAddDialog
          defaultLink={s.currentURL}
          onConfirm={(data) => {
            s.handleAddBookmark(data);
            s.setShowAddDialog(false);
          }}
          onCancel={() => s.setShowAddDialog(false)}
        />
      )}
      {s.renameTarget && (
        <SafariRenameDialog
          bookmark={s.renameTarget}
          onConfirm={(id, newTitle) => {
            s.handleRenameBookmark(id, newTitle);
            s.setRenameTarget(null);
          }}
          onCancel={() => s.setRenameTarget(null)}
        />
      )}

      {/* 顶层 toast —— 起始页与浏览页均显示 */}
      {s.toast && (
        <div
          className={`absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md text-xs text-white shadow-lg z-40 ${
            s.toast.type === "success" ? "bg-green-600" : "bg-red-600"
          }`}
        >
          {s.toast.msg}
        </div>
      )}
    </div>
  );
};

export default Safari;
