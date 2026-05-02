import { IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

interface WSClient {
  ws: WebSocket;
  projectId: string;
}

const clients = new Set<WSClient>();

/**
 * Get the set of allowed origins for WS upgrade.
 */
function getAllowedOrigins(port: number): Set<string> {
  const origins = new Set<string>();
  origins.add(`http://localhost:${port}`);
  origins.add(`http://127.0.0.1:${port}`);
  origins.add(`http://[::1]:${port}`);
  // Vite dev server
  origins.add('http://localhost:5173');
  origins.add('http://127.0.0.1:5173');
  origins.add('http://[::1]:5173');
  return origins;
}

/**
 * Attach WebSocket handler to an HTTP server.
 */
export function attachWebSocket(server: Server, port: number): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const allowedOrigins = getAllowedOrigins(port);

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const origin = request.headers.origin ?? '';
    const url = request.url ?? '';

    // Origin verification
    if (!allowedOrigins.has(origin)) {
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
      const client: WSClient = { ws, projectId };
      clients.add(client);

      ws.on('message', (data) => {
        // Handle incoming messages (user chat messages via WS)
        try {
          const msg = JSON.parse(data.toString());
          if (msg.type === 'chat' && msg.content) {
            handleChatMessage(client, msg.content, msg.messageId);
          }
        } catch {
          // Ignore invalid messages
        }
      });

      ws.on('close', () => {
        clients.delete(client);
      });

      ws.on('error', () => {
        clients.delete(client);
      });
    });
  });

  return wss;
}

/**
 * Handle incoming chat message from WebSocket.
 */
function handleChatMessage(client: WSClient, content: string, messageId?: string): void {
  // Import dynamically to avoid circular deps
  import('./exec-context.js').then(({ executeChat }) => {
    executeChat(client.projectId, content, {
      existingMessageId: messageId,
      onChunk: (chunk) => {
        broadcastToProject(client.projectId, { type: 'chunk', content: chunk });
      },
      onStatus: (runId, status) => {
        broadcastToProject(client.projectId, { type: 'status', runId, status });
      },
      onComplete: (_runId, _exitCode) => {
        // Clients can fetch updated state via REST
      },
    });
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
