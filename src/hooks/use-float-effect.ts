/**
 * Float-V Effect Hook
 * Enhanced useEffect with named effects, conditional execution, and cleanup tracking
 */

import { useEffect, useRef, DependencyList } from 'react';

export interface FloatEffectOptions {
    /** Name for debugging purposes */
    name?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Only run when this condition is true */
    condition?: boolean;
    /** Run on mount (default: true) */
    onMount?: boolean;
}

/**
 * Enhanced side effects with Float-V features
 * @example
 * useFloatEffect(() => {
 *   fetchData();
 * }, [id], { name: 'fetch-data', condition: isLoggedIn });
 */
export function useFloatEffect(
    effect: () => void | (() => void),
    deps: DependencyList = [],
    options: FloatEffectOptions = {}
): void {
    const {
        name,
        debug = false,
        condition = true,
        onMount = true,
    } = options;

    const isMountRef = useRef(true);
    const cleanupRef = useRef<(() => void) | void>();

    useEffect(() => {
        // Skip on mount if disabled
        if (isMountRef.current && !onMount) {
            isMountRef.current = false;
            return;
        }
        isMountRef.current = false;

        // Skip if condition is false
        if (!condition) {
            if (debug && name) {
                console.log(`[Float-V Effect] "${name}" skipped (condition: false)`);
            }
            return;
        }

        // Log execution
        if (debug && name) {
            console.log(`[Float-V Effect] "${name}" executing...`);
        }

        // Execute effect
        cleanupRef.current = effect();

        // Cleanup function
        return () => {
            if (cleanupRef.current) {
                if (debug && name) {
                    console.log(`[Float-V Effect] "${name}" cleaning up...`);
                }
                cleanupRef.current();
            }
        };
    }, deps);
}

/**
 * Effect that only runs once on mount
 */
export function useFloatMount(
    effect: () => void | (() => void),
    options: Omit<FloatEffectOptions, 'onMount'> = {}
): void {
    useFloatEffect(effect, [], { ...options, onMount: true });
}

/**
 * Effect that only runs when dependencies change (not on mount)
 */
export function useFloatUpdate(
    effect: () => void | (() => void),
    deps: DependencyList,
    options: Omit<FloatEffectOptions, 'onMount'> = {}
): void {
    useFloatEffect(effect, deps, { ...options, onMount: false });
}

/**
 * Lifecycle hook for component unmount
 */
export function useFloatUnmount(
    cleanup: () => void,
    options: Pick<FloatEffectOptions, 'name' | 'debug'> = {}
): void {
    useEffect(() => {
        return () => {
            if (options.debug && options.name) {
                console.log(`[Float-V Effect] "${options.name}" unmounting...`);
            }
            cleanup();
        };
    }, []);
}
