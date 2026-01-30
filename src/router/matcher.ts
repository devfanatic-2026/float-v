/**
 * Float-V Router - Client Safe Types & Matcher
 */

export interface Route {
    /** URL path pattern (e.g., /users/:id) */
    path: string;
    /** File path relative to app directory */
    filePath: string;
    /** Absolute file path */
    absolutePath: string;
    /** Route type */
    type: 'page' | 'layout' | 'api' | 'error' | 'loading';
    /** Dynamic segments */
    params: string[];
    /** Is catch-all route */
    isCatchAll: boolean;
    /** Is optional catch-all */
    isOptionalCatchAll: boolean;
    /** Nested layouts */
    layouts: string[];
    /** Loading component path */
    loading?: string;
    /** Error boundary path */
    error?: string;
}

export interface RouterOptions {
    /** Root directory of the app (default: 'app') */
    appDir?: string;
    /** Base path for all routes */
    basePath?: string;
    /** File extensions to consider */
    extensions?: string[];
}

/**
 * Match a URL path to a route
 */
export function matchRoute(url: string, routes: Route[]): {
    route: Route | null;
    params: Record<string, string>;
} {
    const urlParts = url.split('/').filter(Boolean);

    for (const route of routes) {
        if (route.type !== 'page' && route.type !== 'api') continue;

        const routeParts = route.path.split('/').filter(Boolean);
        const params: Record<string, string> = {};
        let matched = true;
        let urlIndex = 0;

        for (let i = 0; i < routeParts.length; i++) {
            const routePart = routeParts[i];

            // Catch-all
            if (routePart.startsWith('*')) {
                const paramName = routePart.replace(/^\*/, '').replace(/\?$/, '');
                params[paramName] = urlParts.slice(urlIndex).join('/');
                return { route, params };
            }

            // Dynamic segment
            if (routePart.startsWith(':')) {
                const paramName = routePart.slice(1);
                if (urlIndex >= urlParts.length) {
                    matched = false;
                    break;
                }
                params[paramName] = urlParts[urlIndex];
                urlIndex++;
                continue;
            }

            // Static segment
            if (urlParts[urlIndex] !== routePart) {
                matched = false;
                break;
            }
            urlIndex++;
        }

        // Check if we consumed all URL parts
        if (matched && urlIndex === urlParts.length) {
            return { route, params };
        }
    }

    return { route: null, params: {} };
}

export type { Route as FloatRoute, RouterOptions as FloatRouterOptions };
