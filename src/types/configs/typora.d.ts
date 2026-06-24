export interface TyporaNote {
  id: string;
  title: string;
  /** 仓库内相对路径，如 notes/xxx.md */
  file: string;
  excerpt?: string;
  createdAt?: string;
  updatedAt?: string;
}
