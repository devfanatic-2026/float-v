/**
 * Float-V Real-time Client
 * Client-side safe types and logic
 * 
 * NO plugins needed - real-time is native to Float-V!
 */

export interface RealtimeMessage<T = unknown> {
    type: string;
    payload: T;
    from?: string;
    room?: string;
    timestamp: number;
}

export interface RealtimeClientOptions {
    url: string;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxReconnectAttempts?: number;
}

/**
 * Create a client-side realtime connection
 * This code is isomorphic and can run in the browser
 */
export function createRealtimeClient(options: RealtimeClientOptions) {
    const {
        url,
        autoReconnect = true,
        reconnectInterval = 3000,
        maxReconnectAttempts = 10,
    } = options;

    let ws: WebSocket | null = null;
    let reconnectAttempts = 0;
    let clientId: string | null = null;
    const eventHandlers = new Map<string, Set<(payload: unknown) => void>>();
    const rooms = new Set<string>();

    const connect = (): Promise<void> => {
        return new Promise((resolve, reject) => {
            try {
                ws = new WebSocket(url);

                ws.onopen = () => {
                    reconnectAttempts = 0;
                    console.log('🔌 Connected to Float-V Realtime');
                };

                ws.onmessage = (event) => {
                    try {
                        const data = typeof event.data === 'string' ? event.data : String(event.data);
                        const message = JSON.parse(data) as RealtimeMessage;

                        // Handle system messages
                        if (message.type === '_connected') {
                            clientId = (message.payload as { id: string }).id;
                            resolve();
                            return;
                        }

                        // Emit to handlers
                        const handlers = eventHandlers.get(message.type);
                        if (handlers) {
                            handlers.forEach(handler => handler(message.payload));
                        }

                        // Also emit to 'message' handlers for all messages
                        const allHandlers = eventHandlers.get('*');
                        if (allHandlers) {
                            allHandlers.forEach(handler => handler(message));
                        }
                    } catch (error) {
                        console.error('Failed to parse message:', error);
                    }
                };

                ws.onclose = () => {
                    console.log('🔌 Disconnected from Float-V Realtime');
                    clientId = null;

                    if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
                        reconnectAttempts++;
                        console.log(`Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttempts}/${maxReconnectAttempts})`);
                        setTimeout(() => {
                            connect().then(() => {
                                // Rejoin rooms after reconnect
                                rooms.forEach(room => {
                                    send({ type: '_join', payload: { room } });
                                });
                            });
                        }, reconnectInterval);
                    }
                };

                ws.onerror = (error) => {
                    console.error('WebSocket error:', error);
                    reject(error);
                };
            } catch (error) {
                reject(error);
            }
        });
    };

    const disconnect = () => {
        if (ws) {
            ws.close(1000, 'Client disconnect');
            ws = null;
        }
    };

    const send = (message: Partial<RealtimeMessage>) => {
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
                ...message,
                timestamp: Date.now(),
            }));
        }
    };

    const join = (room: string, data?: Record<string, unknown>) => {
        rooms.add(room);
        send({ type: '_join', payload: { room, data } });
    };

    const leave = (room: string) => {
        rooms.delete(room);
        send({ type: '_leave', payload: { room } });
    };

    const broadcast = (room: string, type: string, data: unknown) => {
        send({
            type: '_broadcast',
            payload: { room, type, data },
        });
    };

    const emit = (type: string, data: unknown) => {
        send({ type, payload: data });
    };

    const on = <T = unknown>(eventType: string, handler: (payload: T) => void) => {
        if (!eventHandlers.has(eventType)) {
            eventHandlers.set(eventType, new Set());
        }
        eventHandlers.get(eventType)!.add(handler as (payload: unknown) => void);

        // Return unsubscribe function
        return () => {
            eventHandlers.get(eventType)?.delete(handler as (payload: unknown) => void);
        };
    };

    const updatePresence = (data: Record<string, unknown>) => {
        send({ type: '_presence', payload: data });
    };

    return {
        connect,
        disconnect,
        join,
        leave,
        broadcast,
        emit,
        on,
        updatePresence,
        get id() { return clientId; },
        get connected() { return ws?.readyState === WebSocket.OPEN; },
    };
}
