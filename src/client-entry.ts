/**
 * Float-V Client-Side Entry Point
 * Exports only browser-safe modules
 */

export {
    VERSION
} from './version.js';

// React Native Primitives (Interop) for Browser
export {
    View,
    Text,
    Image,
    ScrollView,
    TouchableOpacity,
    ActivityIndicator,
} from 'react-native-web';

import * as RNW from 'react-native-web';

// Use explicit types to avoid breakage
export const StyleSheet: any = (RNW as any).StyleSheet;
export const Platform: any = (RNW as any).Platform;

// Float-V Hooks - 100% Client Safe
export {
    useFloatRouter,
    useFloatData,
    useFloatForm,
    useFloatAsync,
    useFloatDebounce,
    useFloatThrottle,
    createFloatStore,
    useFloatStore,
    combineFloatStores,
    floatMiddleware,
    validators,
    type FloatRouter,
    type FloatRouterState,
    type NavigateOptions,
    type FloatDataOptions,
    type FloatDataResult,
    type FloatFormOptions,
    type FloatFormResult,
    type FieldState,
    type ValidationRule,
    type AsyncState,
    type FloatAsyncResult,
    type FloatAsyncOptions,
    type FloatStore,
    type FloatStoreOptions
} from './hooks/index.js';

// Router (Client Safe)
export {
    matchRoute,
    type FloatRoute,
    type FloatRouterOptions,
} from './router/matcher.js';

// Network & Realtime (Client Safe)
// Network & Realtime (Client Safe)
import {
    createRealtimeClient,
    type RealtimeMessage,
    type RealtimeClientOptions as RealtimeOptions,
} from './network/client-realtime.js';

export {
    createRealtimeClient,
    type RealtimeMessage,
    type RealtimeOptions,
};

// Stub missing types to prevent breakages, or remove them if unused by client
export type RealtimeClient = any;
export type RealtimeRoom = any;
export type PresenceState = any;
export const realtime = {
    client: createRealtimeClient
};
export const FloatRealtime = null;
export const getRealtimeServer = null;

// AI (Client side helpers)
export {
    ai,
    streamResponse,
    sseResponse,
    aiAction,
    OpenAIProvider,
    AnthropicProvider,
    type AIProvider,
    type ChatOptions,
    type Message,
    type AIResponse,
} from './ai/index.js';

// Image (Client Safe)
import {
    configureImages,
    getImageConfig,
    floatImageLoader,
    generateSrcSet,
    getImageProps,
    renderImageToString,
    type ImageConfig,
    type ImageProps,
    type OptimizedImage,
} from './image/client-image.js';

export {
    getImageProps,
    type ImageConfig,
    type ImageProps,
    type OptimizedImage,
};

export const image = {
    configure: configureImages,
    getConfig: getImageConfig,
    loader: floatImageLoader,
    srcSet: generateSrcSet,
    props: getImageProps,
    render: renderImageToString,
};

// Re-export React types for convenience
export type {
    ReactNode,
    ReactElement,
    FC,
    ComponentType
} from 'react';

// Client Utilities
export {
    generateWelcomePage
} from './client/welcome-page.js';
