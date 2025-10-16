import { create } from "zustand";

export function createStorage<T extends {}>(key: string, defaultValue: T) {
  const getValue = (): T => {
    let existing = localStorage.getItem(key);
    return Object.assign({}, defaultValue, JSON.parse(existing || '{}'));
  }

  const hook = create<T>(() => getValue());
  const update = (partial: Partial<T>) => {
    hook.setState(partial);
    localStorage.setItem(key, JSON.stringify(Object.assign(getValue(), partial)));
  }

  addEventListener('storage', e => e.key === key && hook.setState(JSON.parse(e.newValue || '{}')));

  return { hook, getValue, update };
}
