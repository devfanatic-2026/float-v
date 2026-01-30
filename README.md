# @float-v/core ⚡

**High-Performance Full-Stack React Framework**

Float-V is a robust framework designed for building scalable, server-rendered applications with a focus on cross-platform logic sharing and robust state persistence.

## 🏗️ Architecture

The framework is architected into specialized modules for maximum portability:

- **Server Engine**: Handles low-latency SSR and SSG using a unified hydration model.
- **Middleware System**: Edge-ready request interceptors (Redirects, Rewrites, Auth) based on the Fetch API.
- **Router Layer**: File-based routing with support for dynamic segments and layouts.
- **State Primitives**: Enhanced React hooks with built-in persistence (IndexedDB/LocalStorage) and semantic telemetry.
- **Real-time Gateway**: Standardized WebSocket management for high-concurrency event streams.

## 🚀 Core Capabilities

- **Universal Render Logic**: Unified API for Web and Native interop through `@float-v/lite`.
- **Hybrid Data Fetching**: Support for `useFloatAsync` and `useFloatData` with optimistic updates and deduplication.
- **Durable Persistence**: State preservation across sessions and offline environments.
- **Agent-Optimized**: Predictable API surface and explicit state naming for LLM-integrated development workflows.

## 📦 Installation

```bash
pnpm add @float-v/core
```

## 🛠️ Basic Usage

```tsx
import { useFloatState } from '@float-v/core';

// Persistent, named state atom
const [session, setSession] = useFloatState(null, { 
  key: 'auth_session',
  persist: true 
});
```

---
*Maintained by the Float-V core team. Professional grade framework for the modern web.*
