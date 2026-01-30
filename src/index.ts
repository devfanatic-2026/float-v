/**
 * Float-V - Ultra Modern Web Framework
 * 
 * @packageDocumentation
 */

// Core exports
export { VERSION } from './version.js';

// Router
// Router
export {
  matchRoute,
  type Route as FloatRoute,
  type RouterOptions as FloatRouterOptions,
} from './router/index.js';

// React Native Primitives (Interop)
export {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native-web';

import * as RNW from 'react-native-web';

export const StyleSheet: any = (RNW as any).StyleSheet;
export const Platform: any = (RNW as any).Platform;

// Float-V Hooks - Modern utilities for applications
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
  // New Float-V Hooks
  useFloatState,
  useFloatEffect,
  useFloatCallback,
  useFloatMemo,
} from './hooks/index.js';

// AI Module - Native AI integration
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

// Type-Safe API Module
export {
  f,
  typedRoute,
  json,
  error,
  redirect,
  FloatValidationError,
  type Infer,
} from './api/index.js';

// Real-time Module - Built-in WebSocket support
export {
  FloatRealtime,
  realtime,
  getRealtimeServer,
  createRealtimeClient,
  type RealtimeClient,
  type RealtimeMessage,
  type RealtimeRoom,
  type PresenceState,
  type RealtimeOptions,
} from './network/index.js';

// Image Optimization (Client Types & Loaders)
export {
  type ImageConfig,
  type ImageFormat,
  type ImageLoaderProps,
  type ImageProps,
  type OptimizedImage,
  type StaticImageData,
  getImageConfig,
  floatImageLoader,
  generateSrcSet,
  getImageProps,
  renderImageToString,
} from './image/client-image.js';

// Built-in Analytics
export {
  analytics,
  AnalyticsEngine,
  getAnalytics,
  configureAnalytics,
  createAnalyticsMiddleware,
  createAnalyticsHandler,
  analyticsClientScript,
  type PageView,
  type WebVitals,
  type CustomEvent,
  type AnalyticsData,
  type AnalyticsConfig,
  type AnalyticsSummary,
} from './analytics/index.js';

// Client utilities
export { generateWelcomePage } from './client/welcome-page.js';
