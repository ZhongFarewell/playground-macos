import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "~/stores";
import type { BootPhase, BootState } from "./types";
import { PHASE_PROGRESS } from "./types";
import { runDatabasePhase, runSessionRestorePhase, runPostChecksPhase } from "./tasks";

const BOOT_TIMEOUT = 8000; // 8s 超时强制完成
const MIN_DISPLAY = 800; // 最小展示时间，避免闪过

/** 计算阶段对应的进度目标值 */
const phaseProgress = (phase: BootPhase): number => {
  if (phase === "done") return 100;
  const range = PHASE_PROGRESS[phase as Exclude<BootPhase, "idle" | "done">];
  return range ? range[1] : 0;
};

/**
 * boot 序列编排 hook。
 * 管理 BootState，按序执行三阶段，rAF 平滑插值进度，超时保护。
 *
 * 调用方：Boot 组件在 boot/restart 场景调 start()，
 * status===done 后等 MIN_DISPLAY 再 setBooting(false)。
 */
export const useBootSequence = () => {
  const [state, setState] = useState<BootState>({
    phase: "idle",
    status: "idle",
    progress: 0,
    error: null
  });

  // 平滑进度：rAF 向目标值线性逼近
  const targetProgress = useRef(0);
  const rafRef = useRef<number | null>(null);
  const runningRef = useRef(false); // 用 ref 跟踪运行态，避免闭包陈旧
  const startTimeRef = useRef(0);

  const setBootState = useStore((s) => s.setBootState);
  const setWallpaper = useStore((s) => s.setWallpaper);
  const setUserWallpapers = useStore((s) => s.setUserWallpapers);
  const pushNotification = useStore((s) => s.pushNotification);

  // rAF 平滑插值进度条（仅在 progress 未达目标时持续）
  useEffect(() => {
    const tick = () => {
      setState((prev) => {
        const target = targetProgress.current;
        const diff = target - prev.progress;
        if (Math.abs(diff) < 0.3) {
          return prev.progress === target ? prev : { ...prev, progress: target };
        }
        return { ...prev, progress: prev.progress + diff * 0.12 };
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // 同步 state 到 store（供其他组件读 bootState）
  useEffect(() => {
    setBootState(state);
  }, [state, setBootState]);

  const start = useCallback(async () => {
    // 用 ref 防重入，避免 StrictMode 双调用 / 重复触发导致死锁
    if (runningRef.current) return;
    runningRef.current = true;
    startTimeRef.current = Date.now();

    const actions = { setWallpaper, setUserWallpapers, pushNotification };

    const setPhase = (phase: BootPhase) => {
      targetProgress.current = phaseProgress(phase);
      setState((p) => ({ ...p, phase }));
    };

    // 进入 running 态
    setState({ phase: "database", status: "running", progress: 0, error: null });
    targetProgress.current = phaseProgress("database");

    // Phase 1: database (0→60%)
    await runDatabasePhase({ signal: new AbortController().signal });

    // Phase 2: session-restore (60→90%)
    setPhase("session-restore");
    await runSessionRestorePhase({ signal: new AbortController().signal }, actions);

    // Phase 3: post-checks (90→100%)
    setPhase("post-checks");
    await runPostChecksPhase({ signal: new AbortController().signal }, actions);

    // done：等最小展示时间
    targetProgress.current = 100;
    const elapsed = Date.now() - startTimeRef.current;
    const wait = Math.max(0, MIN_DISPLAY - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));

    setState({ phase: "done", status: "done", progress: 100, error: null });
    runningRef.current = false;
  }, [setWallpaper, setUserWallpapers, pushNotification]);

  // 超时保护：8s 强制完成（start 内部卡住时兜底）
  useEffect(() => {
    if (state.status !== "running") return;
    const timer = setTimeout(() => {
      if (!runningRef.current) return;
      runningRef.current = false;
      setState((p) =>
        p.status === "done"
          ? p
          : { ...p, phase: "done", status: "done", progress: 100, error: "timeout" }
      );
    }, BOOT_TIMEOUT);
    return () => clearTimeout(timer);
  }, [state.status]);

  const cancel = useCallback(() => {
    runningRef.current = false;
  }, []);

  return { state, start, cancel };
};
