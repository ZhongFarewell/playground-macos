import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "~/stores";
import type { BootPhase, BootState } from "./types";
import { PHASE_PROGRESS } from "./types";
import {
  runDatabasePhase,
  runSessionRestorePhase,
  runAuthPhase,
  runPostChecksPhase
} from "./tasks";

const BOOT_TIMEOUT = 12000; // 12s 超时强制完成（含 auth 网络请求，放宽）
const MIN_DISPLAY = 800; // 最小展示时间，避免闪过

/** 计算阶段对应的进度目标值 */
const phaseProgress = (phase: BootPhase): number => {
  if (phase === "done") return 100;
  const range = PHASE_PROGRESS[phase as Exclude<BootPhase, "idle" | "done">];
  return range ? range[1] : 0;
};

interface UseBootSequenceOptions {
  /** auth 校验结果回调：true=已登录进桌面，false=未登录进登录页 */
  onAuthResult?: (loggedIn: boolean) => void;
}

/**
 * boot 序列编排 hook。
 * 管理 BootState，按序执行四阶段，rAF 平滑插值进度，超时保护。
 */
export const useBootSequence = (options: UseBootSequenceOptions = {}) => {
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
  const setUserInfo = useStore((s) => s.setUserInfo);
  const addPreloadedWallpaper = useStore((s) => s.addPreloadedWallpaper);
  const pushNotification = useStore((s) => s.pushNotification);

  // onAuthResult 存 ref，避免它变化导致 start 重建
  const onAuthResultRef = useRef(options.onAuthResult);
  onAuthResultRef.current = options.onAuthResult;

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

    const actions = {
      setWallpaper,
      setUserWallpapers,
      setUserInfo,
      addPreloadedWallpaper,
      pushNotification
    };

    const setPhase = (phase: BootPhase) => {
      targetProgress.current = phaseProgress(phase);
      setState((p) => ({ ...p, phase }));
    };

    // 进入 running 态
    setState({ phase: "database", status: "running", progress: 0, error: null });
    targetProgress.current = phaseProgress("database");

    // Phase 1: database (0→40%)
    await runDatabasePhase({ signal: new AbortController().signal });

    // Phase 2: session-restore (40→75%)
    setPhase("session-restore");
    await runSessionRestorePhase({ signal: new AbortController().signal }, actions);

    // Phase 3: auth (75→90%)
    setPhase("auth");
    const loggedIn = await runAuthPhase(
      { signal: new AbortController().signal },
      actions
    );
    onAuthResultRef.current?.(loggedIn);

    // Phase 4: post-checks (90→100%)
    setPhase("post-checks");
    await runPostChecksPhase({ signal: new AbortController().signal }, actions);

    // done：等最小展示时间
    targetProgress.current = 100;
    const elapsed = Date.now() - startTimeRef.current;
    const wait = Math.max(0, MIN_DISPLAY - elapsed);
    await new Promise((resolve) => setTimeout(resolve, wait));

    setState({ phase: "done", status: "done", progress: 100, error: null });
    runningRef.current = false;
  }, [
    setWallpaper,
    setUserWallpapers,
    setUserInfo,
    addPreloadedWallpaper,
    pushNotification
  ]);

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
