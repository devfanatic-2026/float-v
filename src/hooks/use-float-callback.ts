/**
 * Float-V Callback Hook
 * Enhanced useCallback with automatic memoization, debug labels, and performance tracking
 */

import { useCallback, useRef, DependencyList } from 'react';

export interface FloatCallbackOptions {
    /** Name for debugging purposes */
    name?: string;
    /** Enable debug logging */
    debug?: boolean;
    /** Track performance metrics */
    metrics?: boolean;
}

/**
 * Enhanced callback memoization with Float-V features
 * @example
 * const handleClick = useFloatCallback(() => {
 *   console.log('clicked');
 * }, [], { name: 'handle-click', debug: true });
 */
export function useFloatCallback<T extends (...args: any[]) => any>(
    callback: T,
    deps: DependencyList,
    options: FloatCallbackOptions = {}
): T {
    const { name, debug = false, metrics = false } = options;

    const callCountRef = useRef(0);
    const totalTimeRef = useRef(0);

    const memoizedCallback = useCallback(
        (...args: Parameters<T>): ReturnType<T> => {
            callCountRef.current++;

            if (debug && name) {
                console.log(`[Float-V Callback] "${name}" called (${callCountRef.current} times)`);
            }

            let result: ReturnType<T>;

            if (metrics) {
                const start = performance.now();
                result = callback(...args);
                const duration = performance.now() - start;
                totalTimeRef.current += duration;

                if (debug && name) {
                    console.log(
                        `[Float-V Callback] "${name}" took ${duration.toFixed(2)}ms (avg: ${(totalTimeRef.current / callCountRef.current).toFixed(2)}ms)`
                    );
                }
            } else {
                result = callback(...args);
            }

            return result;
        },
        deps
    ) as T;

    return memoizedCallback;
}

/**
 * Get callback metrics
 */
export function useFloatCallbackMetrics(): {
    callCount: number;
    totalTime: number;
    avgTime: number;
} {
    const callCountRef = useRef(0);
    const totalTimeRef = useRef(0);

    return {
        callCount: callCountRef.current,
        totalTime: totalTimeRef.current,
        avgTime: callCountRef.current > 0 ? totalTimeRef.current / callCountRef.current : 0,
    };
}
