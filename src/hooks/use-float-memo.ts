/**
 * Float-V Memo Hook
 * Enhanced useMemo with cache visualization and performance metrics
 */

import { useMemo, useRef, DependencyList } from 'react';

export interface FloatMemoOptions {
    /** Name for debugging purposes */
    name?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Track performance metrics */
    metrics?: boolean;
}

/**
 * Enhanced memoization with Float-V features
 * @example
 * const expensiveValue = useFloatMemo(() => {
 *   return heavyComputation(data);
 * }, [data], { name: 'heavy-computation', metrics: true });
 */
export function useFloatMemo<T>(
    factory: () => T,
    deps: DependencyList,
    options: FloatMemoOptions = {}
): T {
    const { name, debug = false, metrics = false } = options;

    const computeCountRef = useRef(0);
    const totalTimeRef = useRef(0);
    const lastValueRef = useRef<T>();

    const value = useMemo(() => {
        computeCountRef.current++;

        if (debug && name) {
            console.log(`[Float-V Memo] "${name}" recomputing (${computeCountRef.current} times)`);
        }

        let result: T;

        if (metrics) {
            const start = performance.now();
            result = factory();
            const duration = performance.now() - start;
            totalTimeRef.current += duration;

            if (debug && name) {
                console.log(
                    `[Float-V Memo] "${name}" took ${duration.toFixed(2)}ms (total: ${totalTimeRef.current.toFixed(2)}ms)`
                );
            }
        } else {
            result = factory();
        }

        lastValueRef.current = result;
        return result;
    }, deps);

    return value;
}

/**
 * Get memoization metrics
 */
export function useFloatMemoMetrics(): {
    computeCount: number;
    totalTime: number;
    avgTime: number;
} {
    const computeCountRef = useRef(0);
    const totalTimeRef = useRef(0);

    return {
        computeCount: computeCountRef.current,
        totalTime: totalTimeRef.current,
        avgTime: computeCountRef.current > 0 ? totalTimeRef.current / computeCountRef.current : 0,
    };
}
