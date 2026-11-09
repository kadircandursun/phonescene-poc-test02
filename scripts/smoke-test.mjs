#!/usr/bin/env node
/**
 * Automated smoke checks that do not require a physical phone.
 * Verifies HTTP routes, health, WebSocket join auth, and peer-ready signaling.
 */
import WebSocket from 'ws';

const base = process.env.BASE_URL || 'http://127.0.0.1:8787';
const pairCode = process.env.PAIR_CODE;
if (!pairCode) {
  console.error('PAIR_CODE env required');
  process.exit(1);
}

const wsBase = base.replace(/^http/, 'ws') + '/signal';
let failed = 0;

async function check(name, fn) {
  try {
    await fn();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`FAIL  ${name}:`, error instanceof Error ? error.message : error);
  }
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

await check('GET /api/health', async () => {
  const res = await fetch(`${base}/api/health`);
  assert(res.status === 200, `status ${res.status}`);
  const json = await res.json();
  assert(json.ok === true, 'ok != true');
});

await check('GET /desktop/', async () => {
  const res = await fetch(`${base}/desktop/`);
  assert(res.status === 200, `status ${res.status}`);
  const text = await res.text();
  assert(text.includes('Windows Receiver'), 'missing desktop title');
});

await check('GET /mobile/', async () => {
  const res = await fetch(`${base}/mobile/`);
  assert(res.status === 200, `status ${res.status}`);
  const text = await res.text();
  assert(text.includes('Mobil gönderici'), 'missing mobile title');
});

await check('GET /companion/', async () => {
  const res = await fetch(`${base}/companion/`);
  assert(res.status === 200, `status ${res.status}`);
  const text = await res.text();
  assert(text.includes('Windows Companion'), 'missing companion title');
});

await check('GET /api/network', async () => {
  const res = await fetch(`${base}/api/network`);
  assert(res.status === 200, `status ${res.status}`);
  const json = await res.json();
  assert(json.ok === true, 'ok != true');
  assert(Array.isArray(json.adapters), 'adapters missing');
});

await check('GET /api/status', async () => {
  const res = await fetch(`${base}/api/status`);
  assert(res.status === 200, `status ${res.status}`);
  const json = await res.json();
  assert(json.ok === true, 'ok != true');
  assert(/^\d{6}$/.test(json.pairCode), 'pairCode invalid');
  assert(json.signaling, 'signaling missing');
});

await check('WS rejects bad pair code', async () => {
  await new Promise((resolve, reject) => {
    const ws = new WebSocket(wsBase);
    const timer = setTimeout(() => reject(new Error('timeout')), 5000);
    ws.on('open', () => ws.send(JSON.stringify({ type: 'join', code: '000000', role: 'desktop' })));
    ws.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.type === 'error') {
        clearTimeout(timer);
        ws.close();
        resolve();
      }
    });
    ws.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
    ws.on('error', reject);
  });
});

await check('WS peer-ready after mobile+desktop join', async () => {
  await new Promise((resolve, reject) => {
    const desktop = new WebSocket(wsBase);
    const mobile = new WebSocket(wsBase);
    let desktopReady = false;
    let mobileReady = false;
    const timer = setTimeout(() => reject(new Error('peer-ready timeout')), 8000);

    const maybeDone = () => {
      if (desktopReady && mobileReady) {
        clearTimeout(timer);
        desktop.close();
        mobile.close();
        resolve();
      }
    };

    desktop.on('open', () => {
      desktop.send(JSON.stringify({ type: 'join', code: pairCode, role: 'desktop' }));
    });
    mobile.on('open', () => {
      mobile.send(JSON.stringify({ type: 'join', code: pairCode, role: 'mobile' }));
    });

    desktop.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.type === 'peer-ready') desktopReady = true;
      maybeDone();
    });
    mobile.on('message', (data) => {
      const msg = JSON.parse(String(data));
      if (msg.type === 'peer-ready') mobileReady = true;
      maybeDone();
    });

    desktop.on('error', reject);
    mobile.on('error', reject);
  });
});

if (failed) {
  console.error(`\n${failed} smoke test(s) failed`);
  process.exit(1);
}

console.log('\nAll smoke tests passed.');
