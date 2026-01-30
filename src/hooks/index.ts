/**
 * Float-V Hooks
 * Modern React hooks for Float-V applications
 */

// Primitives (Float-V enhanced)
export { useFloatState, useFloatStateSimple, type FloatStateOptions, type FloatStateResult } from './use-float-state.js';
export { useFloatEffect, useFloatMount, useFloatUpdate, useFloatUnmount, type FloatEffectOptions } from './use-float-effect.js';
export { useFloatCallback, useFloatCallbackMetrics, type FloatCallbackOptions } from './use-float-callback.js';
export { useFloatMemo, useFloatMemoMetrics, type FloatMemoOptions } from './use-float-memo.js';

// Router
export { useFloatRouter, type FloatRouter, type FloatRouterState, type NavigateOptions } from './use-router.js';

// Data fetching
export { useFloatData, type FloatDataOptions, type FloatDataResult } from './use-data.js';

// Forms
export { useFloatForm, validators, type FloatFormOptions, type FloatFormResult, type FieldState, type ValidationRule } from './use-form.js';

// Async operations
export { useFloatAsync, useFloatDebounce, useFloatThrottle, type AsyncState, type FloatAsyncResult, type FloatAsyncOptions } from './use-async.js';

// Store
export { createFloatStore, useFloatStore, combineFloatStores, floatMiddleware, type FloatStore, type FloatStoreOptions } from './use-store.js';
