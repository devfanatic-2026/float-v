import fs from 'node:fs';
import path from 'node:path';
import pc from 'picocolors';

export interface ImportMap {
    imports: Record<string, string>;
}

export class DependencyRegistry {
    private registry: Record<string, string> = {};
    private projectRoot: string;

    constructor(projectRoot: string) {
        this.projectRoot = projectRoot;
    }

    /**
     * Scan project root for dependencies and build the registry
     */
    async scan(): Promise<void> {
        const pkgPath = path.join(this.projectRoot, 'package.json');
        if (!fs.existsSync(pkgPath)) {
            console.log(pc.yellow(`[Float-V] No package.json found at ${this.projectRoot}`));
            return;
        }

        try {
            const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
            const deps = {
                ...(pkg.dependencies || {}),
                ...(pkg.devDependencies || {})
            };

            const newRegistry: Record<string, string> = {
                "react": "https://esm.sh/react@18.3.1",
                "react-dom": "https://esm.sh/react-dom@18.3.1",
                "react-dom/client": "https://esm.sh/react-dom@18.3.1/client",
                "react/jsx-runtime": "https://esm.sh/react@18.3.1/jsx-runtime",
                "@float-v/core": "/__float/dist/client/index.js",
                "@float-v/lite": "/__float/dist/client/index.js",  // Temporary alias for browser compatibility
                '@float-v/core/ai': '/__float/dist/ai/index.js',
                '@float-v/core/network': '/__float/dist/network/index.js',
                '@float-v/core/api': '/__float/dist/api/index.js',
                '@float-v/core/hooks/use-store': '/__float/dist/hooks/use-store.js',
                'react-native': 'https://esm.sh/react-native-web@0.19.13?external=react,react-dom',
            };

            let count = 0;
            for (const [name, version] of Object.entries(deps)) {
                // Skip framework itself and core react (already mapped)
                if (name === '@float-v/core' || name === '@float-v/lite' || name === 'react' || name === 'react-dom') continue;

                // Handle workspace/link dependencies (local transformation)
                if (typeof version === 'string' && (version.startsWith('workspace:') || version.startsWith('link:'))) {
                    // Map to a workspace-specific route that the dev server can intercept
                    newRegistry[name] = `/__workspace/${name}/index`;
                    count++;
                    continue;
                }

                // Clean version string
                // Only keep numeric versions, otherwise use empty (esm.sh will use latest)
                let cleanVersion = '';
                if (typeof version === 'string' && /^[~^]?\d/.test(version)) {
                    cleanVersion = '@' + version.replace(/[^0-9.]/g, '');
                }

                // Force singleton React/ReactDOM by marking them as external
                newRegistry[name] = `https://esm.sh/${name}${cleanVersion}?external=react,react-dom`;
                count++;
            }

            this.registry = newRegistry;
            console.log(pc.green(`[Float-V] Registry updated: Discovered ${count} components from package.json`));
        } catch (error) {
            console.error(pc.red('[Float-V] Failed to parse package.json:'), error);
        }
    }

    /**
     * Get the current import map
     */
    getImportMap(): ImportMap {
        return { imports: this.registry };
    }
}

// Global registry instance to be shared between dev-server and SSR
const REGISTRY_SYMBOL = Symbol.for('__FLOAT_DEPENDENCY_REGISTRY__');

export function getRegistry(root?: string): DependencyRegistry {
    const g = globalThis as any;
    if (!g[REGISTRY_SYMBOL]) {
        g[REGISTRY_SYMBOL] = new DependencyRegistry(root || process.cwd());
    }
    return g[REGISTRY_SYMBOL];
}
