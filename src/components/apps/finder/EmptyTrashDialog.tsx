import React from "react";

interface EmptyTrashDialogProps {
  itemCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * 清空废纸篓确认对话框（对齐 macOS 系统警告样式）。
 * macOS 真实文案："Are you sure you want to remove the items in the Trash permanently?
 * You can't undo this action."
 */
const EmptyTrashDialog = React.memo(function EmptyTrashDialog({
  itemCount,
  onConfirm,
  onCancel
}: EmptyTrashDialogProps) {
  return (
    <div className="fixed inset-0 z-50 flex-center bg-black/30" onClick={onCancel}>
      <div
        className="w-3/4 max-w-sm rounded-lg overflow-hidden shadow-2xl bg-c-100 border border-c-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="h-9 flex items-center px-3 border-b border-c-300 bg-c-200">
          <span className="text-xs font-medium text-c-700">Empty Trash</span>
        </div>
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="i-ri:alert-line text-2xl text-yellow-500 shrink-0" />
            <div className="text-xs text-c-600 leading-relaxed">
              <p className="mb-1">
                Are you sure you want to remove the {itemCount}{" "}
                {itemCount === 1 ? "item" : "items"} in the Trash permanently?
              </p>
              <p className="text-c-500">You can&apos;t undo this action.</p>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button
              className="h-7 px-3 text-xs rounded hover:bg-c-200"
              onClick={onCancel}
            >
              Cancel
            </button>
            <button
              className="h-7 px-3 text-xs rounded bg-red-500 text-white hover:bg-red-600"
              onClick={onConfirm}
              autoFocus
            >
              Empty Trash
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

export default EmptyTrashDialog;
