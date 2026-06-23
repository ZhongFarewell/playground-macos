import type { StateCreator } from "zustand";

export interface UserSlice {
  typoraMd: string;
  setTyporaMd: (v: string) => void;
  faceTimeImages: {
    [date: string]: string;
  };
  addFaceTimeImage: (v: string) => void;
  delFaceTimeImage: (k: string) => void;
  /** 登录态：后端 /auth 或 /login 返回的用户信息（成功登录后才写入） */
  userInfo: UserInfo | null;
  setUserInfo: (v: UserInfo | null) => void;
}

/** 后端 formUserInfo 返回的字段子集（见 Align-server helper.ts:149） */
export interface UserInfo {
  username: string;
  avatar?: string;
  autograph?: string;
  gender?: string;
  wechat?: string;
  QQ?: string;
  intr?: string;
  root?: boolean;
}

export const createUserSlice: StateCreator<UserSlice> = (set) => ({
  typoraMd: `# Hi 👋\nThis is a simple clone of [Typora](https://typora.io/). Built on top of [Milkdown](https://milkdown.dev/), an open-source WYSIWYG markdown editor.`,
  setTyporaMd: (v) => set(() => ({ typoraMd: v })),
  faceTimeImages: {},
  addFaceTimeImage: (v) =>
    set((state) => {
      const images = state.faceTimeImages;
      images[+new Date()] = v;
      return { faceTimeImages: images };
    }),
  delFaceTimeImage: (k) =>
    set((state) => {
      const images = state.faceTimeImages;
      delete images[k];
      return { faceTimeImages: images };
    }),
  userInfo: null,
  setUserInfo: (v) => set(() => ({ userInfo: v }))
});
