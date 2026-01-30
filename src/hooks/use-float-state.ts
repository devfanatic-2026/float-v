/**
 * Float-V State Hook
 * Enhanced useState with persistence, debugging, and history tracking
 */

import { useState, useCallback, useRef } from 'react';

export interface FloatStateOptions<T> {
    /** Persist state to localStorage with this key */
    persist?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Track state history */
    history?: boolean;
    /** Max history entries (default: 10) */
    maxHistory?: number;
    /** Custom serializer for persistence */
    serializer?: {
        serialize: (value: T) => string;
        deserialize: (value: string) => T;
    };
}

export interface FloatStateResult<T> {
    /** Current state value */
    value: T;
    /** Set new state value */
    setValue: (value: T | ((prev: T) => T)) => void;
    /** Reset to initial value */
    reset: () => void;
    /** State history (if enabled) */
    history?: T[];
    /** Undo to previous state (if history enabled) */
    undo?: () => void;
    /** Redo to next state (if history enabled) */
    redo?: () => void;
}

/**
 * Enhanced state management with Float-V features
 * @example
 * const [count, setCount] = useFloatState(0, { 
 *   persist: 'counter',
 *   debug: true 
 * });
 * 
 * // Or with full result object
 * const counter = useFloatState(0, { history: true });
 * counter.setValue(1);
 * counter.undo();
 */
export function useFloatState<T>(
    initialValue: T | (() => T),
    options: FloatStateOptions<T> = {}
): [T, (value: T | ((prev: T) => T)) => void] & FloatStateResult<T> {
    const {
        persist,
        debug = false,
        history: enableHistory = false,
        maxHistory = 10,
        serializer = {
            serialize: JSON.stringify,
            deserialize: JSON.parse,
        },
    } = options;

    // Initialize value (with persistence support)
    const getInitialValue = useCallback((): T => {
        const initial = typeof initialValue === 'function'
            ? (initialValue as () => T)()
            : initialValue;

        // Try to load from localStorage
        if (persist && typeof window !== 'undefined') {
            try {
                const stored = localStorage.getItem(`float-state:${persist}`);
                if (stored !== null) {
                    const deserialized = serializer.deserialize(stored);
                    if (debug) {
                        console.log(`[Float-V State] Loaded "${persist}" from localStorage:`, deserialized);
                    }
                    return deserialized;
                }
            } catch (error) {
                console.warn(`[Float-V State] Failed to load "${persist}" from localStorage:`, error);
            }
        }

        return initial;
    }, []);

    const [state, setState] = useState<T>(getInitialValue);
    const initialValueRef = useRef<T>(getInitialValue());

    // History tracking
    const historyRef = useRef<T[]>([initialValueRef.current]);
    const historyIndexRef = useRef(0);

    // Custom setValue with Float-V features
    const setValue = useCallback((value: T | ((prev: T) => T)) => {
        setState((prev) => {
            const nextValue = typeof value === 'function'
                ? (value as (prev: T) => T)(prev)
                : value;

            // Debug logging
            if (debug) {
                console.group(`[Float-V State]${persist ? ` "${persist}"` : ''} Update`);
                console.log('Previous:', prev);
                console.log('Next:', nextValue);
                console.groupEnd();
            }

            // Persist to localStorage
            if (persist && typeof window !== 'undefined') {
                try {
                    localStorage.setItem(`float-state:${persist}`, serializer.serialize(nextValue));
                } catch (error) {
                    console.warn(`[Float-V State] Failed to persist "${persist}":`, error);
                }
            }

            // Track history
            if (enableHistory) {
                // Remove future history if we're not at the end
                if (historyIndexRef.current < historyRef.current.length - 1) {
                    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
                }

                historyRef.current.push(nextValue);

                // Limit history size
                if (historyRef.current.length > maxHistory) {
                    historyRef.current.shift();
                } else {
                    historyIndexRef.current++;
                }
            }

            return nextValue;
        });
    }, [persist, debug, enableHistory, maxHistory, serializer]);

    // Reset to initial value
    const reset = useCallback(() => {
        setValue(initialValueRef.current);
        if (debug) {
            console.log(`[Float-V State]${persist ? ` "${persist}"` : ''} Reset to initial value`);
        }
    }, [setValue, debug, persist]);

    // Undo/Redo functionality
    const undo = useCallback(() => {
        if (!enableHistory) return;
        if (historyIndexRef.current > 0) {
            historyIndexRef.current--;
            setState(historyRef.current[historyIndexRef.current]);
            if (debug) {
                console.log(`[Float-V State]${persist ? ` "${persist}"` : ''} Undo to:`, historyRef.current[historyIndexRef.current]);
            }
        }
    }, [enableHistory, debug, persist]);

    const redo = useCallback(() => {
        if (!enableHistory) return;
        if (historyIndexRef.current < historyRef.current.length - 1) {
            historyIndexRef.current++;
            setState(historyRef.current[historyIndexRef.current]);
            if (debug) {
                console.log(`[Float-V State]${persist ? ` "${persist}"` : ''} Redo to:`, historyRef.current[historyIndexRef.current]);
            }
        }
    }, [enableHistory, debug, persist]);

    // Create result object
    const result = [state, setValue] as [T, typeof setValue] & FloatStateResult<T>;
    result.value = state;
    result.setValue = setValue;
    result.reset = reset;

    if (enableHistory) {
        result.history = historyRef.current;
        result.undo = undo;
        result.redo = redo;
    }

    return result;
}

/**
 * Simple Float-V state without options (drop-in replacement for useState)
 */
export function useFloatStateSimple<T>(initialValue: T | (() => T)): [T, (value: T | ((prev: T) => T)) => void] {
    return useFloatState(initialValue);
}
