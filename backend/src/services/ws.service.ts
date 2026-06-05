import { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import { isOriginAllowed } from '../middleware/security.js';

interface WSClient {
  ws: WebSocket;
  projectId: string;
  alive: boolean;
}

const clients = new Set<WSClient>();

// Ping/pong heartbeat to detect and clean stale connections
const PING_INTERVAL_MS = 30_000;
let pingTimer: ReturnType<typeof setInterval> | null = null;

function startHeartbeat(): void {
  if (pingTimer) return;
  pingTimer = setInterval(() => {
    for (const client of clients) {
      if (!client.alive) {
        client.ws.terminate();
        clients.delete(client);
        continue;
      }
      client.alive = false;
      client.ws.ping();
    }
  }, PING_INTERVAL_MS);
}

/**
 * Attach WebSocket handler to an HTTP server.
 */
export function attachWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const origin = request.headers.origin ?? '';
    const host = request.headers.host ?? '';
    const url = request.url ?? '';

    // Origin verification — uniform across modes. Same-origin (Origin host
    // matches request Host header) is accepted, so LAN access works without
    // explicit configuration. Browser-driven cross-origin attacks (CSWSH)
    // are blocked because the attacker cannot forge the Host header.
    // Missing Origin is allowed for non-browser tooling (Node clients);
    // CSRF does not apply to WS upgrade so this matches CSRF semantics.
    if (origin && !isOriginAllowed(origin, host)) {
      socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
      socket.destroy();
      return;
    }

    // Parse project ID from URL: /ws/projects/:id/chat
    const match = url.match(/^\/ws\/projects\/([^/]+)\/chat$/);
    if (!match) {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const projectId = match[1]!;

    wss.handleUpgrade(request, socket, head, (ws) => {
      const client: WSClient = { ws, projectId, alive: true };
      clients.add(client);

      ws.on('pong', () => { client.alive = true; });

      ws.on('message', (data) => {
        // Handle incoming messages (user chat messages via WS)
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'chat' && msg.content && typeof msg.content === 'string' && msg.content.trim().length > 0) {
            handleChatMessage(client, msg.content, msg.messageId, msg.model);
          }
        } catch {
          // Ignore invalid messages
        }
      });

      ws.on('close', () => {
        clients.delete(client);
        // Stop CLI run if no more clients are connected for this project
        if (getProjectClientCount(projectId) === 0) {
          import('./container-runner.js').then(({ stopRun }) => {
            if (stopRun(projectId)) {
              console.log(`[ws] last client disconnected, stopped run for project ${projectId.slice(0, 8)}`);
            }
          }).catch(() => {});
        }
      });

      ws.on('error', () => {
        clients.delete(client);
        if (getProjectClientCount(projectId) === 0) {
          import('./container-runner.js').then(({ stopRun }) => {
            stopRun(projectId);
          }).catch(() => {});
        }
      });
    });
  });

  startHeartbeat();

  return wss;
}

/**
 * Send a message to a specific WebSocket client.
 */
function sendToClient(ws: WebSocket, event: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(event));
  }
}

/**
 * Handle incoming chat message from WebSocket.
 */
function handleChatMessage(client: WSClient, content: string, messageId?: string, model?: string): void {
  // Import dynamically to avoid circular deps
  import('./exec-context.js').then(({ executeChat }) => {
    try {
      executeChat(client.projectId, content, {
        existingMessageId: messageId,
        model,
        onChunk: (chunk) => {
          // Send only to the client that initiated the chat to prevent duplication
          sendToClient(client.ws, { type: 'chunk', content: chunk });
        },
        onProgress: (message) => {
          sendToClient(client.ws, { type: 'progress', message });
        },
        onStatus: (runId, status) => {
          broadcastToProject(client.projectId, { type: 'status', runId, status });
        },
        onComplete: () => {
          // Clients can fetch updated state via REST
        },
        onFileCreated: (file) => {
          broadcastToProject(client.projectId, { type: 'file_added', file });
        },
      });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      console.error(`[ws] executeChat error: ${errMsg}`);

      // Send user-friendly error as assistant message
      const isTokenError = errMsg.includes('Token not configured') || errMsg.includes('GITHUB_TOKEN');
      const userMessage = isTokenError
        ? '⚠️ GitHubトークンが未設定です。設定画面からトークンを設定してください。'
        : `⚠️ エラーが発生しました: ${errMsg}`;

      sendToClient(client.ws, { type: 'chunk', content: userMessage });
      broadcastToProject(client.projectId, { type: 'status', runId: '', status: 'failed' });
    }
  });
}

/**
 * Broadcast a message to all WebSocket clients connected to a project.
 */
export function broadcastToProject(projectId: string, event: Record<string, unknown>): void {
  const message = JSON.stringify(event);
  for (const client of clients) {
    if (client.projectId === projectId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(message);
    }
  }
}

/**
 * Broadcast file events to project clients.
 */
export function broadcastFileEvent(
  projectId: string,
  type: 'file_added' | 'file_modified' | 'file_deleted',
  data: Record<string, unknown>,
): void {
  broadcastToProject(projectId, { type, ...data });
}

/**
 * Get connected client count for a project.
 */
export function getProjectClientCount(projectId: string): number {
  let count = 0;
  for (const client of clients) {
    if (client.projectId === projectId && client.ws.readyState === WebSocket.OPEN) {
      count++;
    }
  }
  return count;
}
