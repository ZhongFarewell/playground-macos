import { create } from "zustand";
import { createDockSlice, type DockSlice } from "./slices/dock";
import { createMenuSlice, type MenuSlice } from "./slices/menu";
import { createSystemSlice, type SystemSlice } from "./slices/system";
import { createUserSlice, type UserSlice } from "./slices/user";

export const useStore = create<DockSlice & SystemSlice & UserSlice & MenuSlice>(
  (...a) => ({
    ...createDockSlice(...a),
    ...createSystemSlice(...a),
    ...createUserSlice(...a),
    ...createMenuSlice(...a)
  })
);
