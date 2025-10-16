import { Close, Delete } from '@mui/icons-material';
import Chip from '@mui/material/Chip';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { create } from 'zustand';
import { kDbdGameId, kHotkeys } from '../../../consts';
import { useHotkeys } from '../../../utils/hooks/hotkey-hook';
import { useAppSettings } from './use-app-settings';
import { useIngameApp } from '../use-ingame-app';

type HotkeyName = typeof kHotkeys[keyof typeof kHotkeys];

// --- Global edit state (only one chip can be in reassign mode) ---
type EditStore = {
  editingName: string | null;
  start: (name: string) => void;
  stop: () => void;
};
const useHotkeyEditStore = create<EditStore>((set) => ({
  editingName: null,
  start: (name) => set({ editingName: name }),
  stop: () => set({ editingName: null }),
}));

useAppSettings.subscribe(state => useHotkeyEditStore.getState().stop());
useIngameApp.subscribe(state => useHotkeyEditStore.getState().stop());

type Mods = { ctrl: boolean; alt: boolean; shift: boolean };
const MOD_KEYS = new Set(['Control', 'Shift', 'Alt']);

const VK = {
  ...Object.fromEntries(Array.from({ length: 26 }, (_, i) => [String.fromCharCode(65 + i), 65 + i])),
  '0': 48, '1': 49, '2': 50, '3': 51, '4': 52, '5': 53, '6': 54, '7': 55, '8': 56, '9': 57,
  ...Object.fromEntries(Array.from({ length: 24 }, (_, i) => [`F${i + 1}`, 112 + i])),
  Numpad0: 96, Numpad1: 97, Numpad2: 98, Numpad3: 99, Numpad4: 100,
  Numpad5: 101, Numpad6: 102, Numpad7: 103, Numpad8: 104, Numpad9: 105,
  NumpadMultiply: 106, NumpadAdd: 107, NumpadSubtract: 109, NumpadDecimal: 110, NumpadDivide: 111,
  Tab: 9, Enter: 13, Space: 32, Escape: 27, Backspace: 8,
  ArrowLeft: 37, ArrowUp: 38, ArrowRight: 39, ArrowDown: 40,
  Minus: 189, Equal: 187, BracketLeft: 219, BracketRight: 221, Backslash: 220,
  Semicolon: 186, Quote: 222, Comma: 188, Period: 190, Slash: 191, Backquote: 192,
} as const;

function keyEventToDescriptor(e: KeyboardEvent): { mainKey: string | null; mods: Mods; vk: number | null; label: string } {
  const mods: Mods = { ctrl: e.ctrlKey, alt: e.altKey, shift: e.shiftKey };
  let mainKey: string | null = null;

  // --- DIGITS: handle Shift+DigitX where e.key becomes '!', '@', etc.
  // Use e.code 'Digit0'..'Digit9' which is layout-agnostic for the top row
  if (/^Digit[0-9]$/.test(e.code)) {
    mainKey = e.code.replace('Digit', ''); // "Digit1" -> "1"
  }

  // Letters/digits via e.key (works for plain '1' and letters)
  if (!mainKey && e.key.length === 1) {
    const ch = e.key.toUpperCase();
    if (/[A-Z0-9]/.test(ch)) mainKey = ch;
  }

  // Function keys
  if (!mainKey && /^F\d{1,2}$/.test(e.key)) {
    mainKey = e.key;
  }

  // Additional commit-worthy keys (code-based)
  const codeCandidates = [
    'Tab', 'Space', 'Enter', 'Backspace',
    'Minus', 'Equal', 'BracketLeft', 'BracketRight', 'Backslash',
    'Semicolon', 'Quote', 'Comma', 'Period', 'Slash', 'Backquote',
    'Numpad0', 'Numpad1', 'Numpad2', 'Numpad3', 'Numpad4', 'Numpad5', 'Numpad6', 'Numpad7', 'Numpad8', 'Numpad9',
    'NumpadMultiply', 'NumpadAdd', 'NumpadSubtract', 'NumpadDecimal', 'NumpadDivide',
    'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
  ];
  if (!mainKey) {
    if (/^F\d{1,2}$/.test(e.code)) mainKey = e.code;
    else if (codeCandidates.includes(e.code)) mainKey = e.code;
  }

  // Map to Windows VK
  let vk: number | null = null;
  if (mainKey) {
    if (VK[mainKey as keyof typeof VK] !== undefined) {
      vk = VK[mainKey as keyof typeof VK];
    } else if (/^[A-Z]$/.test(mainKey)) {
      vk = mainKey.charCodeAt(0);
    } else if (/^\d$/.test(mainKey)) {
      vk = mainKey.charCodeAt(0); // '0'..'9' -> 48..57
    }
  }

  // Build UI label
  const parts: string[] = [];
  if (mods.ctrl) parts.push('Ctrl');
  if (mods.alt) parts.push('Alt');
  if (mods.shift) parts.push('Shift');
  if (mainKey) {
    const pretty =
      mainKey === 'BracketLeft' ? '[' :
        mainKey === 'BracketRight' ? ']' :
          mainKey === 'Backslash' ? '\\' :
            mainKey === 'Semicolon' ? ';' :
              mainKey === 'Quote' ? '\'' :
                mainKey === 'Comma' ? ',' :
                  mainKey === 'Period' ? '.' :
                    mainKey === 'Slash' ? '/' :
                      mainKey === 'Minus' ? '-' :
                        mainKey === 'Equal' ? '=' :
                          mainKey === 'Backquote' ? '`' :
                            mainKey;
    parts.push(pretty);
  }
  const label = parts.length ? parts.join('+') : 'Press keys…';
  return { mainKey, mods, vk, label };
}

type Props<T extends HotkeyName> = { name: T };

export function SettingsHotkey<T extends HotkeyName>({ name }: Props<T>) {
  const hotkeys = useHotkeys();
  const binding = hotkeys[name] || 'Unassigned';

  // Global editing coordination
  const editingName = useHotkeyEditStore((s) => s.editingName);
  const startGlobal = useHotkeyEditStore((s) => s.start);
  const stopGlobal = useHotkeyEditStore((s) => s.stop);

  const [reassigning, setReassigning] = useState(false);
  const [tempLabel, setTempLabel] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<number | null>(null);
  const committingRef = useRef(false);

  // If another chip starts editing, exit this one
  useEffect(() => {
    if (editingName !== name && reassigning) {
      setReassigning(false);
      setTempLabel(null);
      committingRef.current = false;
    }
  }, [editingName, name, reassigning]);

  const startReassign = useCallback(() => {
    if (errorMsg) return; // locked during error display
    startGlobal(name as string);
    setReassigning(true);
    setTempLabel('Press keys…');
  }, [name, startGlobal, errorMsg]);

  const stopReassign = useCallback(() => {
    setReassigning(false);
    setTempLabel(null);
    committingRef.current = false;
    if (editingName === name) stopGlobal();
  }, [editingName, name, stopGlobal]);

  const showError = useCallback((msg: string) => {
    setErrorMsg(msg || 'Failed to assign');
    if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    errorTimerRef.current = window.setTimeout(() => {
      setErrorMsg(null);
      // fall back to whatever binding useHotkeys() shows
    }, 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (errorTimerRef.current) window.clearTimeout(errorTimerRef.current);
    };
  }, []);

  const handleAssign = useCallback((vk: number, mods: Mods) => {
    committingRef.current = true;
    overwolf.settings.hotkeys.assign(
      {
        name: name as string,
        gameId: kDbdGameId,
        virtualKey: vk,
        modifiers: { ctrl: mods.ctrl, alt: mods.alt, shift: mods.shift },
      },
      (res: { success: boolean; error?: string | null }) => {
        stopReassign();
        if (!res?.success) {
          showError(res?.error || 'Assignment failed');
        }
      }
    );
  }, [name, stopReassign, showError]);

  const handleUnassign = useCallback(() => {
    if (errorMsg) return;
    stopReassign();
    overwolf.settings.hotkeys.unassign(
      {
        name: name as string,
        gameId: kDbdGameId,
      },
      (res: { success: boolean; error?: string | null }) => {
        if (!res?.success) {
          showError(res?.error || 'Unassign failed');
        }
      }
    );
  }, [name, stopReassign, showError, errorMsg]);

  useEffect(() => {
    if (!reassigning) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (errorMsg) return;

      // Cancel with Escape
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        stopReassign();
        return;
      }

      const { mainKey, mods, vk, label } = keyEventToDescriptor(e);
      setTempLabel(label);

      // Prevent accidental activation in settings UI
      e.preventDefault();
      e.stopPropagation();

      // Commit on first non-modifier key
      if (mainKey && vk != null && !committingRef.current) {
        // Note: don't rely on e.key here; use computed mainKey/vk so that Shift+1 works.
        if (!MOD_KEYS.has(e.key)) {
          handleAssign(vk, mods);
        } else {
          // If e.key is a modifier but we computed a mainKey (rare), still commit.
          handleAssign(vk, mods);
        }
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (errorMsg) return;
      const { label } = keyEventToDescriptor(e);
      setTempLabel(label);
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    window.addEventListener('keyup', onKeyUp, { capture: true });

    return () => {
      window.removeEventListener('keydown', onKeyDown as any, { capture: true } as any);
      window.removeEventListener('keyup', onKeyUp as any, { capture: true } as any);
    };
  }, [reassigning, handleAssign, stopReassign, errorMsg]);

  const label = useMemo(() => {
    if (errorMsg) return errorMsg;
    if (reassigning && tempLabel) return tempLabel;
    return binding || 'Unassigned';
  }, [errorMsg, reassigning, tempLabel, binding]);

  const chipProps = errorMsg ? {} : reassigning
    ? { onDelete: stopReassign as (() => void), deleteIcon: <Close /> }
    : (!!binding && binding !== "Unassigned") ? { onDelete: handleUnassign as (() => void), deleteIcon: <Delete /> } : {};

  return (
    <Chip
      label={label}
      color={errorMsg ? 'error' : reassigning ? 'primary' : 'default'}
      variant={reassigning ? 'outlined' : 'filled'}
      onClick={!errorMsg ? (() => (!reassigning ? startReassign() : undefined)) : undefined}
      disabled={!!errorMsg}
      sx={{ cursor: errorMsg ? 'not-allowed' : 'pointer' }}
      {...chipProps}
    />
  );
}