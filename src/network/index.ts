/**
 * Float-V Real-time Module
 * Built-in WebSocket support with rooms, presence, and broadcasting
 * 
 * NO plugins needed - real-time is native to Float-V!
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import type { Server as HTTPServer } from 'http';
import { EventEmitter } from 'events';

// ============================================================================
// TYPES
// ============================================================================

export interface RealtimeClient {
  id: string;
  socket: WebSocket;
  rooms: Set<string>;
  data: Record<string, unknown>;
  isAlive: boolean;
  connectedAt: Date;
}



export interface RealtimeRoom {
  name: string;
  clients: Set<string>;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

export interface PresenceState {
  clientId: string;
  data: Record<string, unknown>;
  joinedAt: Date;
  lastSeen: Date;
}

export interface RealtimeOptions {
  /** Port for WebSocket server (default: 3001) */
  port?: number;
  /** Path for WebSocket endpoint (default: '/ws') */
  path?: string;
  /** Ping interval in ms (default: 30000) */
  pingInterval?: number;
  /** Max message size in bytes (default: 1MB) */
  maxPayload?: number;
  /** Enable presence tracking (default: true) */
  presence?: boolean;
  /** Custom authentication handler */
  authenticate?: (request: IncomingMessage) => Promise<{ id: string; data?: Record<string, unknown> } | null>;
  /** Optional existing HTTP server */
  server?: HTTPServer;
}

type EventHandler<T = unknown> = (message: RealtimeMessage<T>, client: RealtimeClient) => void | Promise<void>;
type ConnectionHandler = (client: RealtimeClient) => void | Promise<void>;
type DisconnectHandler = (client: RealtimeClient, code: number, reason: string) => void | Promise<void>;

// ============================================================================
// REALTIME SERVER
// ============================================================================

export class FloatRealtime extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private httpServer: HTTPServer | null = null;
  private clients: Map<string, RealtimeClient> = new Map();
  private rooms: Map<string, RealtimeRoom> = new Map();
  private eventHandlers: Map<string, EventHandler[]> = new Map();
  private connectionHandlers: ConnectionHandler[] = [];
  private disconnectHandlers: DisconnectHandler[] = [];
  private pingInterval: NodeJS.Timeout | null = null;
  private options: Required<RealtimeOptions>;

  constructor(options: RealtimeOptions = {}) {
    super();
    this.options = {
      port: options.port ?? 3001,
      path: options.path ?? '/ws',
      pingInterval: options.pingInterval ?? 30000,
      maxPayload: options.maxPayload ?? 1024 * 1024, // 1MB
      presence: options.presence ?? true,
      authenticate: options.authenticate ?? (async () => ({ id: this.generateId() })),
      server: options.server as any,
    };
  }

  /**
   * Start the WebSocket server
   */
  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.httpServer = this.options.server || createServer();

      this.wss = new WebSocketServer({
        server: this.httpServer,
        path: this.options.path,
        maxPayload: this.options.maxPayload,
      });

      this.wss.on('connection', (socket, request) => {
        this.handleConnection(socket, request);
      });

      // Start ping interval
      this.pingInterval = setInterval(() => {
        this.pingClients();
      }, this.options.pingInterval);

      if (this.options.server) {
        console.log(`🔌 Float-V Realtime attached to existing server on ${this.options.path}`);
        resolve();
      } else {
        this.httpServer.listen(this.options.port, () => {
          console.log(`🔌 Float-V Realtime running on ws://localhost:${this.options.port}${this.options.path}`);
          resolve();
        });
      }
    });
  }

  /**
   * Stop the WebSocket server
   */
  async stop(): Promise<void> {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    // Close all client connections
    for (const client of this.clients.values()) {
      client.socket.close(1000, 'Server shutting down');
    }

    return new Promise((resolve) => {
      if (this.wss) {
        this.wss.close(() => {
          if (this.httpServer) {
            this.httpServer.close(() => {
              resolve();
            });
          } else {
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private async handleConnection(socket: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      // Authenticate
      const authResult = await this.options.authenticate(request);
      if (!authResult) {
        socket.close(4001, 'Unauthorized');
        return;
      }

      // Create client
      const client: RealtimeClient = {
        id: authResult.id,
        socket,
        rooms: new Set(),
        data: authResult.data || {},
        isAlive: true,
        connectedAt: new Date(),
      };

      this.clients.set(client.id, client);

      // Send welcome message
      this.sendToClient(client, {
        type: '_connected',
        payload: {
          id: client.id,
          connectedAt: client.connectedAt,
        },
        timestamp: Date.now(),
      });

      // Handle pong
      socket.on('pong', () => {
        client.isAlive = true;
      });

      // Handle messages
      socket.on('message', (data) => {
        this.handleMessage(client, data);
      });

      // Handle close
      socket.on('close', (code, reason) => {
        this.handleDisconnect(client, code, reason.toString());
      });

      // Handle error
      socket.on('error', (error) => {
        console.error(`WebSocket error for client ${client.id}:`, error);
      });

      // Notify connection handlers
      for (const handler of this.connectionHandlers) {
        await handler(client);
      }

      this.emit('connection', client);
    } catch (error) {
      console.error('Connection error:', error);
      socket.close(4000, 'Connection error');
    }
  }

  /**
   * Handle incoming message
   */
  private async handleMessage(client: RealtimeClient, rawData: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(rawData.toString()) as RealtimeMessage;
      message.from = client.id;
      message.timestamp = Date.now();

      // Handle built-in message types
      switch (message.type) {
        case '_join':
          await this.handleJoin(client, message.payload as { room: string; data?: Record<string, unknown> });
          return;
        case '_leave':
          await this.handleLeave(client, message.payload as { room: string });
          return;
        case '_broadcast':
          await this.handleBroadcast(client, message);
          return;
        case '_presence':
          await this.handlePresenceUpdate(client, message.payload as Record<string, unknown>);
          return;
      }

      // Handle custom events
      const handlers = this.eventHandlers.get(message.type) || [];
      for (const handler of handlers) {
        await handler(message, client);
      }

      this.emit('message', message, client);
    } catch (error) {
      console.error('Message handling error:', error);
    }
  }

  /**
   * Handle client disconnect
   */
  private async handleDisconnect(client: RealtimeClient, code: number, reason: string): Promise<void> {
    // Leave all rooms
    for (const roomName of client.rooms) {
      const room = this.rooms.get(roomName);
      if (room) {
        room.clients.delete(client.id);

        // Notify room members
        this.broadcastToRoom(roomName, {
          type: '_presence_leave',
          payload: { clientId: client.id },
          timestamp: Date.now(),
        }, client.id);

        // Delete empty rooms
        if (room.clients.size === 0) {
          this.rooms.delete(roomName);
        }
      }
    }

    // Remove client
    this.clients.delete(client.id);

    // Notify disconnect handlers
    for (const handler of this.disconnectHandlers) {
      await handler(client, code, reason);
    }

    this.emit('disconnect', client, code, reason);
  }

  /**
   * Handle room join
   */
  private async handleJoin(client: RealtimeClient, payload: { room: string; data?: Record<string, unknown> }): Promise<void> {
    const { room: roomName, data } = payload;

    // Create room if doesn't exist
    let room = this.rooms.get(roomName);
    if (!room) {
      room = {
        name: roomName,
        clients: new Set(),
        metadata: {},
        createdAt: new Date(),
      };
      this.rooms.set(roomName, room);
    }

    // Add client to room
    room.clients.add(client.id);
    client.rooms.add(roomName);

    // Update client data
    if (data) {
      client.data = { ...client.data, ...data };
    }

    // Send confirmation
    this.sendToClient(client, {
      type: '_joined',
      payload: {
        room: roomName,
        members: this.getRoomPresence(roomName),
      },
      timestamp: Date.now(),
    });

    // Notify other members
    if (this.options.presence) {
      this.broadcastToRoom(roomName, {
        type: '_presence_join',
        payload: {
          clientId: client.id,
          data: client.data,
          joinedAt: new Date(),
        },
        timestamp: Date.now(),
      }, client.id);
    }

    this.emit('join', client, roomName);
  }

  /**
   * Handle room leave
   */
  private async handleLeave(client: RealtimeClient, payload: { room: string }): Promise<void> {
    const { room: roomName } = payload;
    const room = this.rooms.get(roomName);

    if (room) {
      room.clients.delete(client.id);
      client.rooms.delete(roomName);

      // Notify other members
      if (this.options.presence) {
        this.broadcastToRoom(roomName, {
          type: '_presence_leave',
          payload: { clientId: client.id },
          timestamp: Date.now(),
        });
      }

      // Delete empty rooms
      if (room.clients.size === 0) {
        this.rooms.delete(roomName);
      }
    }

    // Send confirmation
    this.sendToClient(client, {
      type: '_left',
      payload: { room: roomName },
      timestamp: Date.now(),
    });

    this.emit('leave', client, roomName);
  }

  /**
   * Handle broadcast message
   */
  private async handleBroadcast(client: RealtimeClient, message: RealtimeMessage): Promise<void> {
    const { room } = message.payload as { room?: string; data: unknown };
    const broadcastMessage = {
      ...message,
      type: (message.payload as { type?: string }).type || 'broadcast',
      payload: (message.payload as { data?: unknown }).data,
    };

    if (room) {
      this.broadcastToRoom(room, broadcastMessage, client.id);
    } else {
      this.broadcastToAll(broadcastMessage, client.id);
    }
  }

  /**
   * Handle presence update
   */
  private async handlePresenceUpdate(client: RealtimeClient, data: Record<string, unknown>): Promise<void> {
    client.data = { ...client.data, ...data };

    // Broadcast to all rooms the client is in
    for (const roomName of client.rooms) {
      this.broadcastToRoom(roomName, {
        type: '_presence_update',
        payload: {
          clientId: client.id,
          data: client.data,
        },
        timestamp: Date.now(),
      }, client.id);
    }
  }

  /**
   * Ping all clients to check if they're alive
   */
  private pingClients(): void {
    for (const client of this.clients.values()) {
      if (!client.isAlive) {
        client.socket.terminate();
        this.handleDisconnect(client, 4002, 'Ping timeout');
        continue;
      }

      client.isAlive = false;
      client.socket.ping();
    }
  }

  // ============================================================================
  // PUBLIC API
  // ============================================================================

  /**
   * Register a handler for connection events
   */
  onConnection(handler: ConnectionHandler): this {
    this.connectionHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for disconnect events
   */
  onDisconnect(handler: DisconnectHandler): this {
    this.disconnectHandlers.push(handler);
    return this;
  }

  /**
   * Register a handler for a specific event type
   */
  onEvent<T = unknown>(eventType: string, handler: EventHandler<T>): this {
    const handlers = this.eventHandlers.get(eventType) || [];
    handlers.push(handler as EventHandler);
    this.eventHandlers.set(eventType, handlers);
    return this;
  }

  /**
   * Send a message to a specific client
   */
  sendToClient(client: RealtimeClient, message: RealtimeMessage): boolean {
    if (client.socket.readyState === WebSocket.OPEN) {
      client.socket.send(JSON.stringify(message));
      return true;
    }
    return false;
  }

  /**
   * Send a message to a client by ID
   */
  sendToId(clientId: string, message: RealtimeMessage): boolean {
    const client = this.clients.get(clientId);
    if (client) {
      return this.sendToClient(client, message);
    }
    return false;
  }

  /**
   * Broadcast to all clients in a room
   */
  broadcastToRoom(roomName: string, message: RealtimeMessage, excludeId?: string): void {
    const room = this.rooms.get(roomName);
    if (!room) return;

    message.room = roomName;

    for (const clientId of room.clients) {
      if (clientId !== excludeId) {
        const client = this.clients.get(clientId);
        if (client) {
          this.sendToClient(client, message);
        }
      }
    }
  }

  /**
   * Broadcast to all connected clients
   */
  broadcastToAll(message: RealtimeMessage, excludeId?: string): void {
    for (const [clientId, client] of this.clients) {
      if (clientId !== excludeId) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * Get all clients in a room
   */
  getRoom(roomName: string): RealtimeRoom | undefined {
    return this.rooms.get(roomName);
  }

  /**
   * Get client by ID
   */
  getClient(clientId: string): RealtimeClient | undefined {
    return this.clients.get(clientId);
  }

  /**
   * Get presence data for a room
   */
  getRoomPresence(roomName: string): PresenceState[] {
    const room = this.rooms.get(roomName);
    if (!room) return [];

    return Array.from(room.clients).map((clientId) => {
      const client = this.clients.get(clientId);
      return {
        clientId,
        data: client?.data || {},
        joinedAt: client?.connectedAt || new Date(),
        lastSeen: new Date(),
      };
    });
  }

  /**
   * Get all connected clients count
   */
  get clientCount(): number {
    return this.clients.size;
  }

  /**
   * Get all rooms count
   */
  get roomCount(): number {
    return this.rooms.size;
  }

  /**
   * Generate a unique client ID
   */
  private generateId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

// ============================================================================
// CLIENT-SIDE REALTIME (for browser)
// ============================================================================

// Re-export client-side utilities
import {
  createRealtimeClient,
  type RealtimeMessage,
  type RealtimeClientOptions,
} from './client-realtime.js';

export {
  createRealtimeClient,
  type RealtimeMessage,
  type RealtimeClientOptions,
};

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let realtimeInstance: FloatRealtime | null = null;

/**
 * Get or create the realtime server instance
 */
export function getRealtimeServer(options?: RealtimeOptions): FloatRealtime {
  if (!realtimeInstance) {
    realtimeInstance = new FloatRealtime(options);
  }
  return realtimeInstance;
}

/**
 * Shorthand export for easy usage
 */
export const realtime = {
  create: (options?: RealtimeOptions) => new FloatRealtime(options),
  server: getRealtimeServer,
  client: createRealtimeClient,
};
