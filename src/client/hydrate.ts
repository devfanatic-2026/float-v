/**
 * Float-V Client-Side Hydration Runtime
 * Hydrates server-rendered React components on the client
 */

import React from 'react';
import { hydrateRoot } from 'react-dom/client';
import { RouterProvider } from '../hooks/use-router.js';

interface HydrationData {
    routerState: {
        pathname: string;
        params: Record<string, string>;
        query: Record<string, string>;
        search: string;
        hash: string;
    };
    props: Record<string, any>;
    componentPath: string;
}

/**
 * Hydrate the application
 * Called automatically when page loads
 */
export async function hydrateApp() {
    // Get hydration data injected by server
    const data = (window as any).__FLOAT_HYDRATION_DATA as HydrationData | undefined;

    if (!data) {
        console.log('[Float-V] No hydration data found, skipping client hydration');
        return;
    }

    console.log('[Float-V] Starting client-side hydration...');

    try {
        const container = document.getElementById('__float');

        if (!container) {
            console.error('[Float-V] Hydration container #__float not found');
            return;
        }

        // For now, we'll hydrate the existing HTML
        // The server has already rendered the correct HTML
        // We just need to attach React's event listeners

        // Create a simple wrapper that maintains the same structure
        const App = () => {
            // The HTML is already rendered, React will attach to it
            return React.createElement('div', {
                dangerouslySetInnerHTML: { __html: container.innerHTML }
            });
        };

        // Wrap with RouterProvider for consistency with SSR
        const element = React.createElement(RouterProvider, {
            value: data.routerState,
            children: React.createElement(App)
        });

        // Hydrate using React 18 hydrateRoot
        hydrateRoot(container, element);

        console.log('[Float-V] Hydration complete!');

    } catch (error) {
        console.error('[Float-V] Hydration error:', error);
    }
}

// Auto-run on page load
if (typeof window !== 'undefined') {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', hydrateApp);
    } else {
        hydrateApp();
    }
}
