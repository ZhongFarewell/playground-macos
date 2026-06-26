/** boot 序列阶段（参照真实 OS 启动：内核 → 会话恢复 → 就绪） */
export type BootPhase =
  | "idle"
  | "database" // Phase 1: 拉远端 manifest + 合并本地缓存
  | "session-restore" // Phase 2: 恢复用户会话数据（壁纸等）
  | "post-checks" // Phase 3: 非阻塞检查（PAT 缺失提示等）
  | "done";

export type BootStatus = "idle" | "running" | "done" | "failed";

export interface BootState {
  phase: BootPhase;
  status: BootStatus;
  /** 0..100，真实进度目标值（Boot 组件用 rAF 平滑插值到此值） */
  progress: number;
  error: string | null;
}

/** 各阶段的进度区间（真实进度按阶段映射到 0..100） */
export const PHASE_PROGRESS: Record<
  Exclude<BootPhase, "idle" | "done">,
  [number, number]
> = {
  database: [0, 60],
  "session-restore": [60, 90],
  "post-checks": [90, 100]
};
