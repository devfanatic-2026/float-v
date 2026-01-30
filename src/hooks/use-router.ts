import React, { useCallback, useMemo, createContext } from 'react';

export interface FloatRouterState {
  pathname: string;
  search: string;
  hash: string;
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface FloatRouter extends FloatRouterState {
  push: (url: string, options?: NavigateOptions) => void;
  replace: (url: string, options?: NavigateOptions) => void;
  back: () => void;
  forward: () => void;
  prefetch: (url: string) => void;
  refresh: () => void;
}

export interface NavigateOptions {
  scroll?: boolean;
  shallow?: boolean;
}

/**
 * Internal Router Context for SSR and Hybrid state
 * We use a Symbol and globalThis to ensure it's a true singleton across multiple framework instances
 */
const ROUTER_CONTEXT_SYMBOL = Symbol.for('float.router.context');
export const RouterContext: React.Context<FloatRouterState | null> =
  (globalThis as any)[ROUTER_CONTEXT_SYMBOL] ||
  ((globalThis as any)[ROUTER_CONTEXT_SYMBOL] = createContext<FloatRouterState | null>(null));

/**
 * Provider component for the Router Context
 */
export function RouterProvider({ children, value }: { children: React.ReactNode, value: FloatRouterState }) {
  return React.createElement(RouterContext.Provider, { value }, children);
}

export function useFloatRouter(): FloatRouter {
  // Get current location
  const getLocation = useCallback((): FloatRouterState => {
    // On server, use global state set by SSR engine
    if (typeof window === 'undefined') {
      const state = (globalThis as any).__FLOAT_ROUTER_STATE;
      return state || {
        pathname: '/',
        search: '',
        hash: '',
        params: {},
        query: {},
      };
    }

    const url = new URL(window.location.href);
    const query: Record<string, string> = {};
    url.searchParams.forEach((value, key) => {
      query[key] = value;
    });

    return {
      pathname: url.pathname,
      search: url.search,
      hash: url.hash,
      params: {}, // Populated by server if context used
      query,
    };
  }, []);

  const state = useMemo(() => getLocation(), [getLocation]);

  const push = useCallback((url: string, _options?: NavigateOptions) => {
    if (typeof window === 'undefined') return;

    // TODO: Implement true SPA routing with client-side fetching
    // For now, force a hard reload to ensure components load correctly
    window.location.assign(url);
  }, []);

  const replace = useCallback((url: string, options?: NavigateOptions) => {
    if (typeof window === 'undefined') return;

    window.history.replaceState({}, '', url);
    window.dispatchEvent(new PopStateEvent('popstate'));

    if (options?.scroll !== false) {
      window.scrollTo(0, 0);
    }
  }, []);

  const back = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.history.back();
  }, []);

  const forward = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.history.forward();
  }, []);

  const prefetch = useCallback((url: string) => {
    if (typeof window === 'undefined') return;

    // Create hidden link for prefetch
    const link = document.createElement('link');
    link.rel = 'prefetch';
    link.href = url;
    document.head.appendChild(link);
  }, []);

  const refresh = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.location.reload();
  }, []);

  return {
    ...state,
    push,
    replace,
    back,
    forward,
    prefetch,
    refresh,
  };
}
