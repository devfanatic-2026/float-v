/**
 * Detect if a component needs client-side rendering
 */

import * as fs from 'fs';

export function isClientComponent(filePath: string): boolean {
    try {
        const content = fs.readFileSync(filePath, 'utf-8');

        // Check for explicit 'use client' directive
        const lines = content.split('\n');
        for (let i = 0; i < Math.min(10, lines.length); i++) {
            const line = lines[i].trim();
            if (line === "'use client';" || line === "'use client'" ||
                line === '"use client";' || line === '"use client"') {
                return true;
            }
            // Stop at first non-comment, non-import line
            if (line && !line.startsWith('//') && !line.startsWith('/*') &&
                !line.startsWith('import ') && !line.startsWith('export ')) {
                break;
            }
        }

        // Auto-detect: check for React hooks that require client-side execution
        const clientHooks = [
            'useState',
            'useEffect',
            'useLayoutEffect',
            'useReducer',
            'useCallback',
            'useMemo',
            'useRef',
            'useImperativeHandle',
            'useDebugValue',
            'useId',
            'useTransition',
            'useDeferredValue',
            'useSyncExternalStore'
        ];

        for (const hook of clientHooks) {
            // Look for hook usage: useState(, React.useState(
            const hookRegex = new RegExp(`\\b${hook}\\s*\\(|React\\.${hook}\\s*\\(`);
            if (hookRegex.test(content)) {
                console.log(`[Float-V] Auto-detected client component (uses ${hook}): ${filePath}`);
                return true;
            }
        }

        return false;

    } catch (error) {
        console.warn(`[Float-V] Could not read file for client detection: ${filePath}`);
        return false;
    }
}

export function extractUseClientDirective(content: string): boolean {
    const lines = content.split('\n');
    for (let i = 0; i < Math.min(5, lines.length); i++) {
        const line = lines[i].trim();
        if (line === "'use client';" || line === "'use client'" ||
            line === '"use client";' || line === '"use client"') {
            return true;
        }
    }
    return false;
}
