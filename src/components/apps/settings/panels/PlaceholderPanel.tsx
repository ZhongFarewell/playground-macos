import React from "react";

/** 未实现面板的占位组件 */
const PlaceholderPanel = React.memo(function PlaceholderPanel({
  title
}: {
  title: string;
}) {
  return (
    <div className="flex-1 overflow-y-auto px-7 py-6">
      <h1 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-1">
        {title}
      </h1>
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-5">
        This panel is not yet implemented in the current version.
      </p>
      <div className="flex-center flex-col text-gray-300 dark:text-zinc-600 py-12">
        <span className="i-ri:tools-line text-5xl mb-3" />
        <span className="text-sm">Coming soon</span>
      </div>
    </div>
  );
});

export default PlaceholderPanel;
