import { create } from "zustand";
import { kDbdGameId, kHotkeys } from "../../consts";

// Minimal typings for the bits we use
type HotkeyEntry = { name: string; binding: string };

/**
 * Creates a Zustand store hook where the state has exactly the given hotkey names.
 * Any unassigned hotkey will have value "Unassigned".
 */
export function createHotkeyHook<K extends readonly string[]>(keys: K) {
  type Key = K[number];
  type State = Record<Key, string>;

  const useHotkeys = create<State>(() =>
    Object.fromEntries(keys.map(k => [k, "Unassigned"])) as State
  );

  const isKey = (n: string): n is Key => (keys as readonly string[]).includes(n);

  // Seed once
  overwolf.settings.hotkeys.get(res => {
    if (!res?.success || !res.games) return;

    const patch: Partial<State> = {};

    // res.games is Record<string, HotkeyEntry[]>
    for (const hk of Object.values(res.games[kDbdGameId])) {
      if (isKey(hk.name) && patch[hk.name] === undefined) {
        patch[hk.name] = hk.binding || "Unassigned";
      }
    }

    if (Object.keys(patch).length) useHotkeys.setState(patch);
  });

  // Live updates
  const onChange = (e: HotkeyEntry) => {
    if (isKey(e.name)) {
      useHotkeys.setState({ [e.name]: e.binding || "Unassigned" } as Partial<State>);
    }
  };
  overwolf.settings.hotkeys.onChanged.addListener(onChange);

  // Optional teardown
  (useHotkeys as typeof useHotkeys & { unsubscribe: () => void }).unsubscribe = () =>
    overwolf.settings.hotkeys.onChanged.removeListener(onChange);

  return useHotkeys;
}

export const useHotkeys = createHotkeyHook(Object.values(kHotkeys));