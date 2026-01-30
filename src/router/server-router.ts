import fg from 'fast-glob';
import path from 'node:path';
import { type Route, type RouterOptions } from './matcher.js';

const DEFAULT_OPTIONS: Required<RouterOptions> = {
    appDir: 'app',
    basePath: '',
    extensions: ['.tsx', '.ts', '.jsx', '.js'],
};

/**
 * Convert file path to URL path
 * 
 * Examples:
 * - app/page.tsx -> /
 * - app/about/page.tsx -> /about
 * - app/users/[id]/page.tsx -> /users/:id
 * - app/docs/[...slug]/page.tsx -> /docs/*
 * - app/shop/[[...slug]]/page.tsx -> /shop/*?
 */
function filePathToUrlPath(filePath: string, appDir: string): {
    urlPath: string;
    params: string[];
    isCatchAll: boolean;
    isOptionalCatchAll: boolean;
} {
    // Remove app dir prefix
    const appDirPrefix = appDir ? appDir + '/' : '';
    let urlPath = filePath.replace(new RegExp(`^${appDirPrefix}`), '');

    // Special handling for API routes to allow flexible naming
    if (urlPath.includes('api/')) {
        urlPath = urlPath
            .replace(/\.(tsx?|jsx?)$/, '')
            .replace(/\/index$/, '')
            .replace(/\/route$/, '');
    } else {
        // Standard page/layout/etc logic
        urlPath = urlPath.replace(/\/?(page|layout|route|error|loading|not-found)\.(tsx?|jsx?)$/, '');
    }

    const params: string[] = [];
    let isCatchAll = false;
    let isOptionalCatchAll = false;

    // Convert [param] to :param
    urlPath = urlPath.replace(/\[([^\]]+)\]/g, (_, param) => {
        // Optional catch-all [[...slug]]
        if (param.startsWith('...') && filePath.includes('[[')) {
            isOptionalCatchAll = true;
            const paramName = param.replace('...', '');
            params.push(paramName);
            return `*${paramName}?`;
        }
        // Catch-all [...slug]
        if (param.startsWith('...')) {
            isCatchAll = true;
            const paramName = param.replace('...', '');
            params.push(paramName);
            return `*${paramName}`;
        }
        // Regular dynamic param [id]
        params.push(param);
        return `:${param}`;
    });

    // Ensure leading slash
    urlPath = '/' + urlPath;

    // Clean up double slashes and trailing slash
    urlPath = urlPath.replace(/\/+/g, '/').replace(/\/$/, '') || '/';

    return { urlPath, params, isCatchAll, isOptionalCatchAll };
}

/**
 * Determine route type from file name
 */
function getRouteType(filePath: string): Route['type'] {
    // Check if file name (without path) matches special file types
    const fileName = filePath.split('/').pop() || filePath;

    if (fileName.match(/^route\.(tsx?|jsx?)$/)) return 'api';
    if (filePath.split('/').includes('api')) return 'api';
    if (fileName.match(/^layout\.(tsx?|jsx?)$/)) return 'layout';
    if (fileName.match(/^error\.(tsx?|jsx?)$/)) return 'error';
    if (fileName.match(/^loading\.(tsx?|jsx?)$/)) return 'loading';
    return 'page';
}

/**
 * Find all layouts that apply to a route
 */
function findLayouts(routePath: string, allLayouts: Map<string, string>): string[] {
    const layouts: string[] = [];
    const segments = routePath.split('/').filter(Boolean);

    // Check from root to deepest
    let currentPath = '';

    // Root layout
    if (allLayouts.has('/')) {
        layouts.push(allLayouts.get('/')!);
    }

    for (const segment of segments) {
        currentPath += '/' + segment;
        if (allLayouts.has(currentPath)) {
            layouts.push(allLayouts.get(currentPath)!);
        }
    }

    return layouts;
}

/**
 * Find loading component for a route (closest ancestor)
 */
function findLoading(routePath: string, allLoading: Map<string, string>): string | undefined {
    const segments = routePath.split('/').filter(Boolean);

    // Check from most specific to root
    for (let i = segments.length; i >= 0; i--) {
        const currentPath = i === 0 ? '/' : '/' + segments.slice(0, i).join('/');
        if (allLoading.has(currentPath)) {
            return allLoading.get(currentPath);
        }
    }

    return undefined;
}

/**
 * Find error boundary for a route (closest ancestor)
 */
function findError(routePath: string, allErrors: Map<string, string>): string | undefined {
    const segments = routePath.split('/').filter(Boolean);

    // Check from most specific to root
    for (let i = segments.length; i >= 0; i--) {
        const currentPath = i === 0 ? '/' : '/' + segments.slice(0, i).join('/');
        if (allErrors.has(currentPath)) {
            return allErrors.get(currentPath);
        }
    }

    return undefined;
}

/**
 * Scan app directory and build routes
 */
export async function scanRoutes(
    rootDir: string,
    options: RouterOptions = {}
): Promise<Route[]> {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const appDir = path.join(rootDir, opts.appDir);
    const extensions = opts.extensions.map(ext => ext.replace('.', '')).join(',');

    // Find all route files
    const pattern = `**/*.{${extensions}}`;
    const files = await fg(pattern, {
        cwd: appDir,
        onlyFiles: true,
        ignore: ['**/node_modules/**', '**/_*/**'],
    });

    // First pass: collect all layouts, loading, errors
    const layoutMap = new Map<string, string>();
    const loadingMap = new Map<string, string>();
    const errorMap = new Map<string, string>();

    for (const file of files) {
        const type = getRouteType(file);
        const { urlPath } = filePathToUrlPath(file, '');

        if (type === 'layout') {
            const layoutPath = urlPath === '/' ? '/' : urlPath.replace(/\/layout$/, '') || '/';
            layoutMap.set(layoutPath, path.join(appDir, file));
        } else if (type === 'loading') {
            const loadingPath = urlPath === '/' ? '/' : urlPath.replace(/\/loading$/, '') || '/';
            loadingMap.set(loadingPath, path.join(appDir, file));
        } else if (type === 'error') {
            const errorPath = urlPath === '/' ? '/' : urlPath.replace(/\/error$/, '') || '/';
            errorMap.set(errorPath, path.join(appDir, file));
        }
    }

    // Second pass: build all routes (only pages and API routes)
    const routes: Route[] = [];

    for (const file of files) {
        const type = getRouteType(file);

        // Skip layouts, errors, loading - they are not matchable routes
        if (type === 'layout' || type === 'error' || type === 'loading') {
            continue;
        }
        const { urlPath, params, isCatchAll, isOptionalCatchAll } = filePathToUrlPath(file, '');

        const route: Route = {
            path: opts.basePath + urlPath,
            filePath: file,
            absolutePath: path.join(appDir, file),
            type,
            params,
            isCatchAll,
            isOptionalCatchAll,
            layouts: type === 'page' ? findLayouts(urlPath, layoutMap) : [],
            loading: type === 'page' ? findLoading(urlPath, loadingMap) : undefined,
            error: type === 'page' ? findError(urlPath, errorMap) : undefined,
        };

        routes.push(route);
    }

    // Sort routes: static first, then dynamic, catch-all last
    routes.sort((a, b) => {
        if (a.isCatchAll !== b.isCatchAll) return a.isCatchAll ? 1 : -1;
        if (a.params.length !== b.params.length) return a.params.length - b.params.length;
        return a.path.localeCompare(b.path);
    });

    return routes;
}
