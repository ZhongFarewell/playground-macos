import React from "react";
import { MilkdownProvider } from "@milkdown/react";
import { useAppMenus } from "~/hooks/useAppMenus";
import MilkdownEditor from "./MilkdownEditor";
import { useTyporaState } from "./useTyporaState";
import { buildMenus, menuDeps } from "./menus";
import TyporaOpenPanel from "./TyporaOpenPanel";
import TyporaSaveDialog from "./TyporaSaveDialog";
import TyporaPatDialog from "./TyporaPatDialog";
import TyporaRenameDialog from "./TyporaRenameDialog";

const Typora = () => {
  const s = useTyporaState();

  useAppMenus("typora", () => buildMenus(s), menuDeps(s));

  return (
    <div
      className="flex flex-col h-full bg-c-100 dark:bg-gray-800 relative"
      onDragOver={s.handleDragOver}
      onDragLeave={s.handleDragLeave}
      onDrop={s.handleDrop}
    >
      <input
        ref={s.fileInputRef}
        type="file"
        accept=".md,.markdown,.txt"
        onChange={s.handleFileChange}
        className="hidden"
      />
      <div className="flex-1 overflow-hidden relative">
        <MilkdownProvider>
          <MilkdownEditor editorRef={s.editorRef} />
        </MilkdownProvider>
        {s.dragOver && (
          <div className="absolute inset-0 z-40 flex-center bg-c-100/90 dark:bg-gray-800/90 border-2 border-dashed border-blue-500 rounded">
            <div className="flex flex-col items-center gap-2 text-c-600">
              <span className="i-ri:file-download-line text-4xl" />
              <span className="text-xs">Drop .md file to open</span>
            </div>
          </div>
        )}
        {s.loading && (
          <div className="absolute inset-0 flex-center bg-c-100/80 dark:bg-gray-800/80">
            <span className="i-ri:loader-4-line text-2xl text-c-600 animate-spin" />
          </div>
        )}
        {s.toast && (
          <div
            className={`absolute top-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-md text-xs text-white shadow-lg ${
              s.toast.type === "success" ? "bg-green-600" : "bg-red-600"
            }`}
          >
            {s.toast.msg}
          </div>
        )}
      </div>

      {s.showOpen && (
        <TyporaOpenPanel
          notes={s.notes}
          loading={s.loadingList}
          onPick={s.handlePick}
          onClose={() => s.setShowOpen(false)}
        />
      )}
      {s.showSaveDialog && (
        <TyporaSaveDialog
          onConfirm={s.handleSaveDialogConfirm}
          onCancel={() => s.setShowSaveDialog(false)}
        />
      )}
      {s.showPatDialog && (
        <TyporaPatDialog
          onConfirm={s.handlePatConfirm}
          onCancel={() => s.setShowPatDialog(false)}
        />
      )}
      {s.showRenameDialog && (
        <TyporaRenameDialog
          defaultValue={s.renameValue}
          onConfirm={s.handleRenameConfirm}
          onCancel={() => s.setShowRenameDialog(false)}
        />
      )}
    </div>
  );
};

export default Typora;
