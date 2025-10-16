// Utility types
type Handler<E> = (payload: E) => void;

export interface TypedBus<Events extends Record<string, any>> {
  on<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): () => void;
  once<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): void;
  off<K extends keyof Events & string>(event: K, handler: Handler<Events[K]>): void;
  emit<K extends keyof Events & string>(event: K, payload: Events[K]): void;
  clear(): void;
}

// Lightweight implementation (no external libs).
export function createBus<Events extends Record<string, any>>(): TypedBus<Events> {
  const listeners = new Map<string, Set<Function>>();

  const on = (event: string, handler: Function) => {
    const set = listeners.get(event) ?? new Set();
    set.add(handler);
    listeners.set(event, set);
    return () => off(event, handler);
  };

  const once = (event: string, handler: Function) => {
    const wrap = (payload: unknown) => {
      off(event, wrap);
      (handler as Function)(payload);
    };
    on(event, wrap);
  };

  const off = (event: string, handler: Function) => {
    const set = listeners.get(event);
    if (!set) return;
    set.delete(handler);
    if (set.size === 0) listeners.delete(event);
  };

  const emit = (event: string, payload: unknown) => {
    const set = listeners.get(event);
    if (!set) return;
    // copy to protect against mutations during emit
    [...set].forEach(fn => fn(payload));
  };

  const clear = () => listeners.clear();

  return { on, once, off, emit, clear } as TypedBus<Events>;
}