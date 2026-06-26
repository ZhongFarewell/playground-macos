import React from "react";

interface AccountFieldProps {
  label: string;
  value: string;
  onBlur: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}

/** macOS 表单行：左标签 + 右输入框，失焦触发保存 */
const AccountField = React.memo(function AccountField({
  label,
  value,
  onBlur,
  multiline,
  placeholder
}: AccountFieldProps) {
  const [local, setLocal] = useState(value);

  // 父组件 value 变化时同步（如首次加载后）
  useEffect(() => {
    setLocal(value);
  }, [value]);

  const handleBlur = () => {
    if (local !== value) {
      onBlur(local);
    }
  };

  return (
    <div className="px-4 py-2.5 flex items-start gap-4 border-b border-gray-100 dark:border-zinc-700 last:border-b-0">
      <label className="text-xs text-gray-500 dark:text-gray-400 w-20 shrink-0 pt-1.5">
        {label}
      </label>
      {multiline ? (
        <textarea
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          rows={3}
          className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none resize-none rounded-md p-1.5 focus:bg-gray-50 dark:focus:bg-zinc-700/50 transition-colors"
        />
      ) : (
        <input
          type="text"
          value={local}
          placeholder={placeholder}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={handleBlur}
          className="flex-1 text-sm text-gray-800 dark:text-gray-100 bg-transparent outline-none rounded-md px-1.5 py-1 focus:bg-gray-50 dark:focus:bg-zinc-700/50 transition-colors"
        />
      )}
    </div>
  );
});

export default AccountField;
