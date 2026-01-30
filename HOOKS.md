# Float-V Hooks Specification 🪝

Float-V provides a suite of **enhanced React primitives** engineered for performance, durability, and state persistence. These hooks maintain **100% API compatibility** with standard React hooks while introducing advanced features for professional-grade applications.

## Technical Advantages

### 1. **Durable Persistence**
Automated state preservation across sessions using pluggable storage engines:
- Built-in LocalStorage and IndexedDB support.
- Custom serialization/deserialization logic.
- Automatic rehydration cycles.

### 2. **Telemetry & Observability**
High-signal lifecycle tracking without boilerplate:
- Named effect tracking for clear stack traces.
- Latency metrics for memoized computations and callbacks.
- Conditional execution guards.

### 3. **State History Engine**
Integrated undo/redo capabilities at the atom level.

---

## Hook API Reference

### `useFloatState`
Extends `useState` with persistence and history.

```typescript
const [count, setCount] = useFloatState(0, {
  persist: 'counter_v1',   // Persistent storage key
  debug: true,            // Lifecycle logging
  history: true,          // Enable undo/redo stack
  maxHistory: 50          // Stack depth limit
});

// Advanced controls
count.undo();  
count.redo();  
count.reset(); 
```

### `useFloatEffect`
Named lifecycle interceptor with conditional execution.

```typescript
useFloatEffect(
  () => {
    const channel = api.subscribe(topic);
    return () => channel.unsubscribe();
  },
  [topic],
  {
    name: 'realtime_subscription',
    condition: isConnected // Guard clause
  }
);
```

### `useFloatCallback`
Performance-monitored callback primitive.

```typescript
const handleTransaction = useFloatCallback(
  () => processOrder(),
  [deps],
  {
    name: 'order_processing',
    metrics: true // Tracks execution time and frequency
  }
);
```

### `useFloatMemo`
Measured memoization for expensive computations.

```typescript
const computedSet = useFloatMemo(
  () => performHeavyCalculation(data),
  [data],
  {
    name: 'data_processing_layer',
    metrics: true
  }
);
```

---

## Best Practices

1. **Strategic Persistence**: Use `persist` for application state that must survive refresh (authentication, preferences, drafts).
2. **Naming Conventions**: Use snake_case for `name` and `key` options to ensure consistency in telemetry logs.
3. **Environment Guards**: Enable `metrics` and `debug` conditionally based on the environment (`process.env.NODE_ENV`).

---

*Float-V: Engineered for deterministic state management.*
