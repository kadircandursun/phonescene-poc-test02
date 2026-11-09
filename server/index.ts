import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { attachSignaling, createPairCode } from './signaling';
import { listIpv4Adapters } from './network';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const PORT = Number(process.env.PORT || 8787);
const PAIR_CODE = (process.env.PAIR_CODE || createPairCode()).trim();
const dist = path.join(root, 'dist');
const startedAt = Date.now();

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.map': 'application/json',
  '.woff2': 'font/woff2',
};

function sendFile(res: http.ServerResponse, filePath: string) {
  const data = fs.readFileSync(filePath);
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(filePath)] || 'application/octet-stream',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Permissions-Policy': 'camera=(self), accelerometer=(self), gyroscope=(self), microphone=()',
  });
  res.end(data);
}

function resolveDistFile(pathname: string): string | null {
  const map: Record<string, string> = {
    '/': 'companion/index.html',
    '/index.html': 'companion/index.html',
    '/companion': 'companion/index.html',
    '/companion/': 'companion/index.html',
    '/mobile': 'mobile/index.html',
    '/mobile/': 'mobile/index.html',
    '/desktop': 'desktop/index.html',
    '/desktop/': 'desktop/index.html',
  };

  const relative = map[pathname] || pathname.replace(/^\/+/, '');
  const file = path.resolve(dist, relative);
  if (!file.startsWith(dist + path.sep) && file !== dist) return null;
  if (fs.existsSync(file) && fs.statSync(file).isFile()) return file;
  return null;
}

function json(res: http.ServerResponse, body: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(body));
}

function main() {
  if (!fs.existsSync(path.join(dist, 'mobile', 'index.html'))) {
    console.error('dist/ missing. Run: npm run build');
    process.exit(1);
  }

  let signaling: ReturnType<typeof attachSignaling> | null = null;

  const server = http.createServer((req, res) => {
    try {
      const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
      const pathname = decodeURIComponent(url.pathname);

      if (pathname === '/api/health') {
        json(res, { ok: true, service: 'phonescene-poc', mode: 'production', phase: 'poc' });
        return;
      }

      if (pathname === '/api/session') {
        json(res, { ok: true, pairCode: PAIR_CODE, roles: ['mobile', 'desktop'] });
        return;
      }

      if (pathname === '/api/network') {
        const adapters = listIpv4Adapters();
        json(res, {
          ok: true,
          adapters,
          recommended: adapters.find((a) => a.recommended) || null,
          port: PORT,
        });
        return;
      }

      if (pathname === '/api/status') {
        const snap = signaling?.getSnapshot() || {
          mobileConnected: false,
          desktopConnected: false,
          peerReady: false,
        };
        const adapters = listIpv4Adapters();
        json(res, {
          ok: true,
          pairCode: PAIR_CODE,
          port: PORT,
          uptimeMs: Date.now() - startedAt,
          signaling: snap,
          recommendedAddress: adapters.find((a) => a.recommended)?.address || null,
          links: {
            companion: `http://127.0.0.1:${PORT}/companion/`,
            desktop: `http://127.0.0.1:${PORT}/desktop/`,
            mobilePath: '/mobile/',
          },
        });
        return;
      }

      const file = resolveDistFile(pathname);
      if (!file) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
        return;
      }
      sendFile(res, file);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(message);
    }
  });

  signaling = attachSignaling(server, PAIR_CODE);

  server.listen(PORT, '0.0.0.0', () => {
    const adapters = listIpv4Adapters();
    const preferred = adapters.find((a) => a.recommended);
    console.log('');
    console.log('PhoneScene PoC — Companion + Receiver');
    console.log('────────────────────────────────────');
    console.log(`Pair code : ${PAIR_CODE}`);
    console.log(`Port      : ${PORT}`);
    console.log(`Companion : http://127.0.0.1:${PORT}/companion/`);
    console.log(`Receiver  : http://127.0.0.1:${PORT}/desktop/`);
    if (preferred) {
      console.log(`LAN hint  : http://${preferred.address}:${PORT}/mobile/  (${preferred.name})`);
    }
    console.log('');
    console.log('Phone HTTPS still needs: npm run tunnel (Safari secure context)');
    console.log('');
  });
}

main();
