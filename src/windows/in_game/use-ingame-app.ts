import { create } from "zustand";

export enum IngameAppTab {
  WELCOME,
  SETTINGS,
  ABOUT
}

export const useIngameApp = create<{ tab: IngameAppTab }>(set => ({ tab: IngameAppTab.WELCOME }));
