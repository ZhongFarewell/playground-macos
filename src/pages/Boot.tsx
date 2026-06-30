import { useEffect } from "react";
import { useBootSequence } from "~/boot";

interface BootProps {
  restart: boolean;
  sleep: boolean;
  setBooting: (value: boolean | ((prevVar: boolean) => boolean)) => void;
  setLogin: (value: boolean | ((prevVar: boolean) => boolean)) => void;
}

const bootingInterval = 500;

export default function Boot({ restart, sleep, setBooting, setLogin }: BootProps) {
  const { state, start } = useBootSequence({
    onAuthResult: (loggedIn) => setLogin(loggedIn)
  });

  // 首次 boot / restart 场景：挂载即开始 boot 序列
  // sleep 场景：不执行序列，等用户点击唤醒（内存状态还在）
  useEffect(() => {
    if (!sleep) {
      start();
    }
  }, [restart, sleep, start]);

  // 序列完成 → 交接（延迟一点让进度条走完 100%）
  useEffect(() => {
    if (state.status === "done") {
      const t = setTimeout(() => setBooting(false), bootingInterval);
      return () => clearTimeout(t);
    }
  }, [state.status, setBooting]);

  const loading = state.status === "running" || state.status === "done";

  const handleClick = () => {
    if (sleep) setBooting(false);
    else if (restart || loading) return;
    else start();
  };

  return (
    <div className="size-full bg-black flex-center" onClick={handleClick}>
      <div className="i-fa-brands:apple text-white -mt-4 size-20 sm:size-24" />
      {loading && (
        <div
          className="absolute top-1/2 inset-x-0 w-56 h-1 sm:h-1.5 bg-gray-500 rounded overflow-hidden"
          m="t-16 sm:t-24 x-auto"
        >
          <span
            className="absolute top-0 bg-white h-full rounded-sm transition-[width] duration-100 ease-linear"
            style={{
              width: `${state.progress.toString()}%`
            }}
          />
        </div>
      )}
      {!restart && !loading && (
        <div
          pos="absolute top-1/2 inset-x-0"
          m="t-16 sm:t-20 x-auto"
          text="sm gray-200 center"
        >
          Click to {sleep ? "wake up" : "boot"}
        </div>
      )}
    </div>
  );
}
