/**
 * Float-V Store Hook
 * Lightweight global state management (like Zustand but simpler)
 */

import { useSyncExternalStore, useCallback } from 'react';

type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>)) => void;
type GetState<T> = () => T;
type Subscribe = (listener: () => void) => () => void;
type Selector<T, U> = (state: T) => U;

export interface FloatStore<T> {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: Subscribe;
  reset: () => void;
  undo?: () => void;
  redo?: () => void;
}

export interface FloatStoreOptions<T> {
  /** Persist state to localStorage */
  persist?: string;
  /** Custom equality function */
  equals?: (a: any, b: any) => boolean;
  /** Middleware */
  middleware?: (set: SetState<T>, get: GetState<T>, store: any) => SetState<T>;
}

/**
 * Create a global store
 * @example
 * const useStore = createFloatStore({ count: 0 });
 * 
 * // In component
 * const count = useStore(state => state.count);
 */
export function createFloatStore<T extends object>(
  initialState: T | (() => T),
  options: FloatStoreOptions<T> = {}
): {
  (): T;
  <U>(selector: Selector<T, U>): U;
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: Subscribe;
  reset: () => void;
} {
  const { persist, middleware } = options;

  // Initialize state
  let state: T = typeof initialState === 'function'
    ? (initialState as () => T)()
    : initialState;

  // Load persisted state
  if (persist && typeof window !== 'undefined') {
    try {
      const saved = localStorage.getItem(`float-store:${persist}`);
      if (saved) {
        state = { ...state, ...JSON.parse(saved) };
      }
    } catch (e) {
      console.warn('Float Store: Failed to load persisted state');
    }
  }

  const initialStateRef = state;
  const listeners = new Set<() => void>();

  const getState: GetState<T> = () => state;

  let setState: SetState<T> = (partial) => {
    const nextState = typeof partial === 'function'
      ? (partial as (state: T) => Partial<T>)(state)
      : partial;

    if (nextState !== state) {
      state = { ...state, ...nextState };

      // Persist
      if (persist && typeof window !== 'undefined') {
        try {
          localStorage.setItem(`float-store:${persist}`, JSON.stringify(state));
        } catch (e) {
          console.warn('Float Store: Failed to persist state');
        }
      }

      listeners.forEach((listener) => listener());
    }
  };

  // Apply middleware
  if (middleware) {
    setState = middleware(setState, getState, useStore);
  }

  const subscribe: Subscribe = (listener) => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };

  const reset = () => {
    setState(initialStateRef);
  };

  // Hook function
  function useStore(): T;
  function useStore<U>(selector: Selector<T, U>): U;
  function useStore<U>(selector?: Selector<T, U>): T | U {
    const getSnapshot = useCallback(() => {
      const currentState = getState();
      return selector ? selector(currentState) : currentState;
    }, [selector]);

    const getServerSnapshot = useCallback(() => {
      const currentState = getState();
      return selector ? selector(currentState) : currentState;
    }, [selector]);

    return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  }

  // Attach methods to hook
  useStore.getState = getState;
  useStore.setState = setState;
  useStore.subscribe = subscribe;
  useStore.reset = reset;

  return useStore;
}

/**
 * Use a selector on an existing store
 */
export function useFloatStore<T, U>(
  store: FloatStore<T>,
  selector: Selector<T, U>
): U {
  const getSnapshot = useCallback(() => selector(store.getState()), [store, selector]);
  const getServerSnapshot = useCallback(() => selector(store.getState()), [store, selector]);

  return useSyncExternalStore(store.subscribe, getSnapshot, getServerSnapshot);
}

// Middleware helpers
export const floatMiddleware = {
  /**
   * Log all state changes
   */
  logger: <T>(name?: string) => (set: SetState<T>, get: GetState<T>): SetState<T> => {
    return (partial) => {
      const prev = get();
      set(partial);
      const next = get();
      console.group(`${name || 'Float Store'} Update`);
      console.log('Prev:', prev);
      console.log('Next:', next);
      console.groupEnd();
    };
  },

  /**
   * Add undo/redo capability
   */
  undoable: <T extends object>(maxHistory = 10) => {
    let history: T[] = [];
    let index = -1;
    let isInternalUpdate = false;

    return (set: SetState<T>, get: GetState<T>, store: any): SetState<T> => {
      // Initialize history with current state
      history = [get()];
      index = 0;

      // Create control functions
      const undo = () => {
        if (index > 0) {
          isInternalUpdate = true;
          index--;
          set(history[index]);
          isInternalUpdate = false;
        }
      };

      const redo = () => {
        if (index < history.length - 1) {
          isInternalUpdate = true;
          index++;
          set(history[index]);
          isInternalUpdate = false;
        }
      };

      const clearHistory = () => {
        history = [get()];
        index = 0;
      };

      const canUndo = () => index > 0;
      const canRedo = () => index < history.length - 1;

      // Expose to store
      store.undo = undo;
      store.redo = redo;
      store.clearHistory = clearHistory;
      store.canUndo = canUndo;
      store.canRedo = canRedo;

      return (partial) => {
        if (isInternalUpdate) return set(partial);

        // Wipe future history if we're moving forward
        if (index < history.length - 1) {
          history = history.slice(0, index + 1);
        }

        // Apply change and push to history
        set(partial);
        history.push(get());

        if (history.length > maxHistory) {
          history.shift();
        } else {
          index++;
        }
      };
    };
  },

  /**
   * Debounce state updates
   */
  debounce: <T>(delay: number) => {
    let timeout: NodeJS.Timeout;

    return (set: SetState<T>, _get: GetState<T>): SetState<T> => {
      return (partial) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => set(partial), delay);
      };
    };
  },
};

/**
 * Combine multiple stores
 */
export function combineFloatStores<T extends Record<string, FloatStore<any>>>(
  stores: T
): FloatStore<{ [K in keyof T]: ReturnType<T[K]['getState']> }> {
  type CombinedState = { [K in keyof T]: ReturnType<T[K]['getState']> };

  const getState = (): CombinedState => {
    const state = {} as CombinedState;
    for (const [key, store] of Object.entries(stores)) {
      state[key as keyof T] = store.getState();
    }
    return state;
  };

  const setState: SetState<CombinedState> = (partial) => {
    const nextState = typeof partial === 'function'
      ? (partial as (state: CombinedState) => Partial<CombinedState>)(getState())
      : partial;

    for (const [key, value] of Object.entries(nextState)) {
      if (stores[key as keyof T] && value !== undefined) {
        stores[key as keyof T].setState(value as any);
      }
    }
  };

  const subscribe: Subscribe = (listener) => {
    const unsubscribes = Object.values(stores).map(store => store.subscribe(listener));
    return () => unsubscribes.forEach(unsub => unsub());
  };

  const reset = () => {
    Object.values(stores).forEach(store => store.reset());
  };

  return { getState, setState, subscribe, reset };
}
