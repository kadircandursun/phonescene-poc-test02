import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';
import crypto from 'node:crypto';

export type Role = 'mobile' | 'desktop';

type AuthedSocket = WebSocket & {
  isAuthed: boolean;
  role: Role | null;
};

type SignalMessage = {
  type: string;
  code?: string;
  role?: Role;
  sdp?: unknown;
  candidate?: unknown;
  message?: string;
};

const SIGNAL_TYPES = new Set(['offer', 'answer', 'ice', 'bye']);

export function createPairCode(): string {
  return String(crypto.randomInt(100000, 999999));
}

export type SignalingSnapshot = {
  mobileConnected: boolean;
  desktopConnected: boolean;
  peerReady: boolean;
};

export function attachSignaling(
  server: Server,
  pairCode: string,
): WebSocketServer & { getSnapshot: () => SignalingSnapshot } {
  const wss = new WebSocketServer({ server, path: '/signal', maxPayload: 64 * 1024 }) as WebSocketServer & {
    getSnapshot: () => SignalingSnapshot;
  };
  const peers: Record<Role, AuthedSocket | null> = { mobile: null, desktop: null };

  wss.getSnapshot = () => ({
    mobileConnected: !!(peers.mobile && peers.mobile.readyState === WebSocket.OPEN),
    desktopConnected: !!(peers.desktop && peers.desktop.readyState === WebSocket.OPEN),
    peerReady: !!(
      peers.mobile &&
      peers.desktop &&
      peers.mobile.readyState === WebSocket.OPEN &&
      peers.desktop.readyState === WebSocket.OPEN
    ),
  });

  const send = (ws: WebSocket | null | undefined, message: unknown) => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  };

  const otherRole = (role: Role): Role => (role === 'mobile' ? 'desktop' : 'mobile');

  wss.on('connection', (raw) => {
    const ws = raw as AuthedSocket;
    ws.isAuthed = false;
    ws.role = null;

    ws.on('message', (data) => {
      let message: SignalMessage;
      try {
        message = JSON.parse(data.toString()) as SignalMessage;
      } catch {
        return;
      }

      if (!ws.isAuthed) {
        if (
          message.type !== 'join' ||
          message.code !== pairCode ||
          (message.role !== 'mobile' && message.role !== 'desktop')
        ) {
          send(ws, { type: 'error', message: 'Eşleştirme kodu hatalı veya rol geçersiz.' });
          ws.close(1008, 'Unauthorized');
          return;
        }

        const role = message.role;
        if (peers[role] && peers[role] !== ws) {
          send(ws, { type: 'error', message: 'Bu rol için bir cihaz zaten bağlı.' });
          ws.close(1008, 'Role occupied');
          return;
        }

        peers[role] = ws;
        ws.role = role;
        ws.isAuthed = true;
        console.log(`[signal] ${role} joined`);
        send(ws, { type: 'joined', role, pairCode });

        if (peers.mobile && peers.desktop) {
          console.log('[signal] peer-ready (mobile + desktop)');
          send(peers.mobile, { type: 'peer-ready' });
          send(peers.desktop, { type: 'peer-ready' });
        }
        return;
      }

      if (!SIGNAL_TYPES.has(message.type) || !ws.role) return;

      const receiver = peers[otherRole(ws.role)];
      if (message.type === 'bye') {
        send(receiver, { type: 'peer-left', from: ws.role });
        return;
      }

      send(receiver, { ...message, from: ws.role });
    });

    ws.on('close', () => {
      if (ws.role && peers[ws.role] === ws) {
        const role = ws.role;
        peers[role] = null;
        send(peers[otherRole(role)], { type: 'peer-left', from: role });
      }
    });

    ws.on('error', () => {});
  });

  return wss;
}
