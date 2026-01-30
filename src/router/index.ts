/**
 * Float-V Router
 * File-based routing system
 */

import { matchRoute, type Route, type RouterOptions } from './matcher.js';

// Re-export for compatibility
export { matchRoute, type Route, type RouterOptions };
export type { Route as FloatRoute, RouterOptions as FloatRouterOptions } from './matcher.js';
