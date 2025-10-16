import { create } from "zustand";
import { useMapDir } from "./use-callout-map-dir";
import { CALLOUT_SETTINGS } from "../callout-settings";

export const useMapBrowserNavigation = create<{
  selectedRealmIndex: number,
  selectedMapIndex: number,
  realmOpen: boolean,
  next: () => void,
  previous: () => void,
  open: () => void,
  close: () => void,
  ref: { onOpenCallback: () => void }
}>((set, get) => {
  const dir = () => useMapDir.getState().realms;

  return {
    selectedRealmIndex: 0,
    selectedMapIndex: 0,
    realmOpen: false,

    next: () => {
      const _dir = dir();
      if (!_dir || _dir.length === 0) return;

      // normalize current realm index
      let realmIndex = get().selectedRealmIndex;
      realmIndex = realmIndex === -1 ? 0 : ((realmIndex % _dir.length) + _dir.length) % _dir.length;

      if (!get().realmOpen) {
        // advance realm (wrap realms only), reset map selection
        const nextRealm = (realmIndex + 1) % _dir.length;
        set({ selectedRealmIndex: nextRealm, selectedMapIndex: 0 });
      } else {
        // inside a realm: do NOT wrap maps — close the realm instead
        const maps = _dir[realmIndex]?.mapFiles ?? [];
        if (maps.length === 0) {
          set({ realmOpen: false });
          return;
        }
        const nextMap = get().selectedMapIndex + 1;
        if (nextMap >= maps.length) {
          // out of bounds → close realm, keep indices as-is
          set({ realmOpen: false });
        } else {
          set({ selectedMapIndex: nextMap });
        }
      }
    },

    previous: () => {
      const _dir = dir();
      if (!_dir || _dir.length === 0) return;

      // normalize current realm index
      let realmIndex = get().selectedRealmIndex;
      realmIndex = realmIndex === -1 ? 0 : ((realmIndex % _dir.length) + _dir.length) % _dir.length;

      if (!get().realmOpen) {
        // go to previous realm (wrap realms only)
        const prevRealmIndex = (realmIndex - 1 + _dir.length) % _dir.length;
        set({ selectedRealmIndex: prevRealmIndex });
      } else {
        // inside a realm: do NOT wrap maps — close the realm instead
        const maps = _dir[realmIndex]?.mapFiles ?? [];
        if (maps.length === 0) {
          set({ realmOpen: false });
          return;
        }
        const prevMap = get().selectedMapIndex - 1;
        if (prevMap < 0) {
          // out of bounds → close realm, keep indices as-is
          set({ realmOpen: false });
        } else {
          set({ selectedMapIndex: prevMap });
        }
      }
    },

    open: () => {
      if (!get().realmOpen) set({ realmOpen: true });
      else get().ref.onOpenCallback?.();
    },

    close: () => {
      if (get().realmOpen) set({ realmOpen: false });
      else CALLOUT_SETTINGS.update({ browser: false });
    },

    ref: { onOpenCallback: () => void 0 },
  };
});