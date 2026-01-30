/**
 * Observable State Hook for Float-V
 * Provides 'Vibe' visibility into local state changes.
 */
import { useState, useCallback, useEffect } from 'react';

/**
 * useFloatState
 * A Vibe-native replacement for useState that logs transitions.
 * @param key Unique identifier for this state atom (e.g. 'login-success')
 * @param initialValue Initial value
 */
export function useFloatState<T>(key: string, initialValue: T): [T, (value: T | ((prev: T) => T)) => void] {
    const [state, setState] = useState<T>(initialValue);

    const setObservableState = useCallback((newValue: T | ((prev: T) => T)) => {
        setState((prev) => {
            const next = newValue instanceof Function ? (newValue as (prev: T) => T)(prev) : newValue;

            // Vibe Visibility Log
            // In production, this would be stripped or behind a debug flag
            if (typeof window !== 'undefined' || process.env.VIBE_DEBUG) {
                console.log(`%c[VibeState:${key}]`, 'color: #a855f7; font-weight: bold;', prev, '->', next);
            }
            return next;
        });
    }, [key]);

    // Optional: Log mount
    useEffect(() => {
        if (typeof window !== 'undefined' || process.env.VIBE_DEBUG) {
            console.log(`%c[VibeState:${key}]`, 'color: #a855f7; font-weight: bold;', 'MOUNT', initialValue);
        }
    }, [key, initialValue]);

    return [state, setObservableState];
}
