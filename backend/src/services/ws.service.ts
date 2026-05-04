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
  // Vite dev server (5173 default; 5174 when 5173 is occupied)
  for (const vitePort of [5173, 5174, 5175]) {
    origins.add(`http://localhost:${vitePort}`);
    origins.add(`http://127.0.0.1:${vitePort}`);
    origins.add(`http://[::1]:${vitePort}`);
  }
  return origins;
}

/**
 * Attach WebSocket handler to an HTTP server.
 */
export function attachWebSocket(server: Server, port: number): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const allowedOrigins = getAllowedOrigins(port);
  const serveFrontend = process.env.AIRA_SERVE_FRONTEND === 'true';

  server.on('upgrade', (request: IncomingMessage, socket, head) => {
    const origin = request.headers.origin ?? '';
    const url = request.url ?? '';

    // Origin verification
    // In Docker mode, the host port may differ from the container port,
    // so allow any localhost origin when serving the embedded frontend.
    const isLocalhost = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(origin);
    if (origin && !allowedOrigins.has(origin) && !(serveFrontend && isLocalhost)) {
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
            handleChatMessage(client, msg.content, msg.messageId, msg.model);
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
function handleChatMessage(client: WSClient, content: string, messageId?: string, model?: string): void {
  // Import dynamically to avoid circular deps
  import('./exec-context.js').then(({ executeChat }) => {
    executeChat(client.projectId, content, {
      existingMessageId: messageId,
      model,
      onChunk: (chunk) => {
        broadcastToProject(client.projectId, { type: 'chunk', content: chunk });
      },
      onProgress: (message) => {
        broadcastToProject(client.projectId, { type: 'progress', message });
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
