import type { StateCreator } from "zustand";

export type BootPhase = "idle" | "database" | "session-restore" | "post-checks" | "done";
export type BootStatus = "idle" | "running" | "done" | "failed";

export interface BootState {
  phase: BootPhase;
  status: BootStatus;
  /** 0..100，真实进度（Boot 组件用 rAF 平滑插值到此值） */
  progress: number;
  error: string | null;
}

export interface BootSlice {
  bootState: BootState;
  setBootState: (s: Partial<BootState>) => void;
}

const INITIAL: BootState = {
  phase: "idle",
  status: "idle",
  progress: 0,
  error: null
};

export const createBootSlice: StateCreator<BootSlice> = (set) => ({
  bootState: INITIAL,
  setBootState: (s) => set((state) => ({ bootState: { ...state.bootState, ...s } }))
});
