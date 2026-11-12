import fs from 'node:fs';
import path from 'node:path';
import type http from 'node:http';

export type RoomBackgroundMeta = {
  hasBackground: boolean;
  name: string;
  contentType: string;
  updatedAt: number | null;
  bytes: number;
};

const MAX_BYTES = 12 * 1024 * 1024;

export function createRoomBackgroundStore(rootDir: string) {
  const dir = path.join(rootDir, 'data', 'room-background');
  const binPath = path.join(dir, 'current.bin');
  const metaPath = path.join(dir, 'meta.json');
  fs.mkdirSync(dir, { recursive: true });

  function readMeta(): RoomBackgroundMeta {
    try {
      const raw = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as RoomBackgroundMeta;
      if (!fs.existsSync(binPath)) {
        return { hasBackground: false, name: '', contentType: '', updatedAt: null, bytes: 0 };
      }
      return { ...raw, hasBackground: true, bytes: fs.statSync(binPath).size };
    } catch {
      return { hasBackground: false, name: '', contentType: '', updatedAt: null, bytes: 0 };
    }
  }

  function writeMeta(meta: RoomBackgroundMeta) {
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
  }

  async function readRequestBody(req: http.IncomingMessage): Promise<Buffer> {
    const chunks: Buffer[] = [];
    let total = 0;
    for await (const chunk of req) {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buf.length;
      if (total > MAX_BYTES) throw new Error('file too large');
      chunks.push(buf);
    }
    return Buffer.concat(chunks);
  }

  function cors(res: http.ServerResponse) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Room-Name');
  }

  async function handle(req: http.IncomingMessage, res: http.ServerResponse, pathname: string): Promise<boolean> {
    if (!pathname.startsWith('/api/room')) return false;
    cors(res);

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return true;
    }

    if (pathname === '/api/room/status' && req.method === 'GET') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify({ ok: true, ...readMeta() }));
      return true;
    }

    if (pathname === '/api/room/background' && req.method === 'GET') {
      const meta = readMeta();
      if (!meta.hasBackground || !fs.existsSync(binPath)) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: 'no background' }));
        return true;
      }
      const data = fs.readFileSync(binPath);
      res.writeHead(200, {
        'Content-Type': meta.contentType || 'image/jpeg',
        'Cache-Control': 'no-store',
        'Content-Length': data.length,
        'X-Room-Name': encodeURIComponent(meta.name || ''),
      });
      res.end(data);
      return true;
    }

    if (pathname === '/api/room/background' && req.method === 'POST') {
      try {
        const body = await readRequestBody(req);
        if (body.length < 32) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'empty body' }));
          return true;
        }
        const ctype = String(req.headers['content-type'] || 'image/jpeg').split(';')[0]!.trim();
        if (!ctype.startsWith('image/')) {
          res.writeHead(415, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: false, error: 'expected image/*' }));
          return true;
        }
        const nameHeader = req.headers['x-room-name'];
        const name = nameHeader ? decodeURIComponent(String(nameHeader)) : 'Oda';
        fs.writeFileSync(binPath, body);
        const meta: RoomBackgroundMeta = {
          hasBackground: true,
          name,
          contentType: ctype,
          updatedAt: Date.now(),
          bytes: body.length,
        };
        writeMeta(meta);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ ok: true, ...meta }));
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: message }));
      }
      return true;
    }

    if (pathname === '/api/room/background' && req.method === 'DELETE') {
      try {
        if (fs.existsSync(binPath)) fs.unlinkSync(binPath);
        writeMeta({ hasBackground: false, name: '', contentType: '', updatedAt: null, bytes: 0 });
      } catch {
        /* ignore */
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, hasBackground: false }));
      return true;
    }

    return false;
  }

  return { handle, readMeta };
}
