/**
 * Float-V Server Exports
 */

export { createDevServer, type DevServerOptions, type DevServer } from './dev-server.js';
export { renderPage, renderPageStream, type RenderOptions, type PageProps } from './ssr.js';
export { startProductionServer, type ProdServerOptions } from './prod-server.js';
export { getRegistry } from './registry.js';
export { scanRoutes } from '../router/server-router.js';

// Server-side modules (moved from root index to prevent fs leakage)
export * from '../ssg/index.js';
export * from '../devtools/index.js';
export * from '../middleware/index.js';
export {
    image as serverImage,
    configureImages,
    createImageHandler
} from '../image/index.js';
